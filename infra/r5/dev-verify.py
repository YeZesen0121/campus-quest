"""Probe only the isolated persistent dev resources, without API/Web servers."""

import asyncio
import os
import ssl
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import asyncpg  # type: ignore[import-untyped]
import boto3
from alembic.config import Config
from alembic.script import ScriptDirectory
from redis.asyncio import Redis


async def main() -> None:
    connection = await asyncpg.connect(
        os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        assert (
            await connection.fetchval("SELECT current_database()")
            == "campusquest_r5_dev"
        )
        revision = await connection.fetchval("SELECT version_num FROM alembic_version")
        assert (
            revision
            == ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        )
        users = await connection.fetchval("SELECT count(*) FROM users")
        mentor = await connection.fetchrow(
            "SELECT role, status FROM users "
            "WHERE username = 'mentor@campus.example.edu'"
        )
        assert mentor is not None and mentor["role"] == "MENTOR"
        operator_enabled = await connection.fetchval(
            "SELECT enabled FROM ie_operations_grants g "
            "JOIN users u ON u.id=g.user_id "
            "WHERE u.username='20250001'"
        )
        assert operator_enabled is not None
        profiles = await connection.fetchval("SELECT count(*) FROM ie_mentor_profiles")
        consents = await connection.fetchval("SELECT count(*) FROM ie_mentor_consents")
        if "--fresh-seed" in sys.argv:
            # A persistent demo may legitimately suspend/revoke these identities.
            assert mentor["status"] == "ACTIVE"
            assert operator_enabled is True
            assert users == 23
            assert profiles == consents == 0
        print(
            f"R5_DEV_DATABASE=PASS revision={revision} users={users} "
            f"mentor_profiles={profiles} mentor_consents={consents}"
        )
    finally:
        await connection.close()
    cache = Redis.from_url(os.environ["REDIS_URL"])
    key = f"r5-dev-probe:{uuid4()}"
    try:
        await cache.set(key, "isolated", ex=30)
        assert await cache.get(key) == b"isolated"
        assert cache.connection_pool.connection_kwargs["db"] == 5
        print("R5_DEV_REDIS=PASS db=5")
    finally:
        await cache.delete(key)
        await cache.aclose()
    endpoint = os.environ["S3_ENDPOINT_URL"]
    bucket = os.environ["S3_BUCKET"]
    assert endpoint == "https://127.0.0.1:9107"
    assert bucket == "campusquest-r5-dev"
    ca = os.environ["AWS_CA_BUNDLE"]
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="us-east-1",
        verify=ca,
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
    )
    object_key = f"r5-dev-probe/{uuid4()}.txt"
    try:
        client.put_object(Bucket=bucket, Key=object_key, Body=b"R5 persistent dev")
        assert (
            client.get_object(Bucket=bucket, Key=object_key)["Body"].read()
            == b"R5 persistent dev"
        )
    finally:
        client.delete_object(Bucket=bucket, Key=object_key)
    context = ssl.create_default_context(cafile=ca)
    for port, allowed in ((3306, True), (3305, False), (3000, False)):
        origin = f"https://localhost:{port}"
        request = Request(
            f"{endpoint}/{bucket}/cors-probe",
            method="OPTIONS",
            headers={"Origin": origin, "Access-Control-Request-Method": "PUT"},
        )
        try:
            response = urlopen(request, context=context, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            assert (
                response.headers.get("Access-Control-Allow-Origin") == origin
            ) == allowed
    print("R5_DEV_TLS_STORAGE_CORS=PASS dev accepted; test/UI origins rejected")


if __name__ == "__main__":
    asyncio.run(main())
