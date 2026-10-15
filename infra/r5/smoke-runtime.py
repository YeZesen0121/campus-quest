"""Probe the actual R5 services, including one scoped object write/delete."""

import asyncio
import os
import ssl
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

import asyncpg
import boto3
from redis.asyncio import Redis


async def main() -> None:
    database = await asyncpg.connect(
        os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        assert (
            await database.fetchval("select current_database()")
            == "campusquest_test_r5"
        )
        print("R5_POSTGRES_PROBE=PASS")
    finally:
        await database.close()
    redis = Redis.from_url(os.environ["REDIS_URL"])
    try:
        assert await redis.ping()
        print("R5_REDIS_PROBE=PASS")
    finally:
        await redis.aclose()
    for endpoint, ca in (
        (os.environ["S3_ENDPOINT_URL"], None),
        (os.environ["CQ_E2E_S3_ENDPOINT_URL"], os.environ["CQ_E2E_S3_CA_BUNDLE"]),
    ):
        if ca:
            ssl.create_default_context(cafile=str(Path(ca)))
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=os.environ["S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["S3_SECRET_KEY"],
            region_name="us-east-1",
            verify=ca if ca else True,
        )
        key = f"r5-runtime-probe/{uuid4()}.txt"
        bucket = os.environ["S3_BUCKET"]
        assert bucket == "campusquest-test-r5"
        try:
            client.put_object(Bucket=bucket, Key=key, Body=b"R5 isolated probe")
            assert (
                client.get_object(Bucket=bucket, Key=key)["Body"].read()
                == b"R5 isolated probe"
            )
        finally:
            client.delete_object(Bucket=bucket, Key=key)
        print(f"R5_OBJECT_STORE_PROBE={'TLS' if ca else 'HTTP'}:PASS")
        context = ssl.create_default_context(cafile=ca) if ca else None
        scheme = "https" if ca else "http"
        for port, allowed in ((3305, True), (3000, False)):
            origin = f"{scheme}://localhost:{port}"
            request = Request(
                f"{endpoint}/{bucket}/r5-cors-probe",
                method="OPTIONS",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "PUT",
                    "Access-Control-Request-Headers": "content-type,if-none-match",
                },
            )
            try:
                response = urlopen(request, context=context, timeout=10)
            except HTTPError as error:
                response = error
            with response:
                accepted = response.headers.get("Access-Control-Allow-Origin") == origin
                assert accepted == allowed, f"Unexpected R5 CORS result for {origin}"
        print(f"R5_CORS_PROBE={'TLS' if ca else 'HTTP'}:PASS; UI origin rejected")


asyncio.run(main())
