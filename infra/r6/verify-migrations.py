"""Exercise migrations on a newly created database in the R6 PostgreSQL only."""

import asyncio
import os
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import asyncpg


async def seed_legacy(database_url: str):
    """Real R5 rows, including a mentor who accepted and later left."""
    (
        owner_id,
        mentor_user_id,
        project_id,
        mentor_id,
        link_id,
        achievement_id,
        evidence_id,
    ) = [uuid4() for _ in range(7)]
    connection = await asyncpg.connect(
        database_url.replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        for user_id, role in ((owner_id, "STUDENT"), (mentor_user_id, "TEACHER")):
            await connection.execute(
                "INSERT INTO users (id, username, password_hash, nickname, role, status) "
                "VALUES ($1, $2, 'unused', 'migration fixture', $3, 'ACTIVE')",
                user_id,
                f"r6-migration-{user_id.hex}",
                role,
            )
        await connection.execute(
            "INSERT INTO ie_project_drafts "
            "(id, owner_user_id, creation_request_id, creation_payload_fingerprint, title) "
            "VALUES ($1, $2, $3, $4, 'R5 migration fixture')",
            project_id,
            owner_id,
            uuid4(),
            "a" * 64,
        )
        await connection.execute(
            "INSERT INTO ie_mentor_profiles "
            "(id, user_id, fields, version, public_version, confirmation_state, visibility, "
            "moderation_state, accepting_contact, authorized_fields, created_at, updated_at) "
            "VALUES ($1, $2, '{}', 1, 0, 'PENDING', 'HIDDEN', 'NORMAL', false, '[]', now(), now())",
            mentor_id,
            mentor_user_id,
        )
        await connection.execute(
            "INSERT INTO ie_project_mentor_links "
            "(id, project_id, mentor_id, requested_by, project_snapshot, status, version, created_at, updated_at) "
            "VALUES ($1, $2, $3, $4, '{}', 'REVOKED', 3, now(), now())",
            link_id,
            project_id,
            mentor_id,
            owner_id,
        )
        await connection.execute(
            "INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id) "
            "VALUES ($1, 'TEACHER', 'ie.mentor.link.accept', 'ie_project_mentor', $2)",
            mentor_user_id,
            str(link_id),
        )
        await connection.execute(
            "INSERT INTO ie_achievement_drafts "
            "(id, project_id, creation_request_id, creation_payload_fingerprint, title) "
            "VALUES ($1, $2, $3, $4, 'R5 proof owner fixture')",
            achievement_id,
            project_id,
            uuid4(),
            "b" * 64,
        )
        await connection.execute(
            "INSERT INTO ie_achievement_evidence "
            "(id, achievement_id, creation_request_id, creation_payload_fingerprint, "
            "object_key, content_type, size, upload_url, client_headers, "
            "upload_expires_at, expires_at, created_at, updated_at) "
            "VALUES ($1, $2, $3, $4, $5, 'application/pdf', 10, 'not-a-live-url', "
            "'{}', now()+interval '10 minutes', now()+interval '15 minutes', "
            "now(), now())",
            evidence_id,
            achievement_id,
            uuid4(),
            "c" * 64,
            f"r6-migration-proof-{evidence_id}",
        )
        return owner_id, mentor_user_id, project_id, evidence_id
    finally:
        await connection.close()


async def verify_legacy(database_url: str, identities) -> None:
    owner_id, mentor_user_id, project_id, evidence_id = identities
    connection = await asyncpg.connect(
        database_url.replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        assert (
            await connection.fetchval(
                "SELECT creator_user_id FROM ie_project_drafts WHERE id = $1",
                project_id,
            )
            == owner_id
        )
        facts = await connection.fetch(
            "SELECT user_id, kind FROM ie_project_participation WHERE project_id = $1",
            project_id,
        )
        assert {(fact["user_id"], fact["kind"]) for fact in facts} == {
            (owner_id, "OWNER"),
            (mentor_user_id, "MENTOR"),
        }
        try:
            await connection.execute(
                "UPDATE ie_project_drafts SET creation_payload_fingerprint = $1 WHERE id = $2",
                "f" * 64,
                project_id,
            )
        except asyncpg.RaiseError:
            pass
        else:
            raise AssertionError("Legacy creation identity was writable")
        origin = await connection.fetchrow(
            "SELECT uploaded_by_user_id, uploaded_owner_generation "
            "FROM ie_achievement_evidence WHERE id = $1",
            evidence_id,
        )
        assert tuple(origin) == (owner_id, 1)
        try:
            await connection.execute(
                "UPDATE ie_achievement_evidence SET uploaded_owner_generation = 2 "
                "WHERE id = $1",
                evidence_id,
            )
        except asyncpg.RaiseError:
            pass
        else:
            raise AssertionError("Legacy evidence origin was writable")
        print("R6_LEGACY_EVIDENCE_ORIGIN_BACKFILL=PASS", flush=True)
        print("R6_LEGACY_OWNER_MENTOR_BACKFILL=PASS", flush=True)
    finally:
        await connection.close()


async def main() -> None:
    source = urlsplit(os.environ["DATABASE_URL"])
    if (source.hostname, source.port, source.path) != (
        "127.0.0.1",
        16438,
        "/campusquest_test_r6",
    ):
        raise SystemExit("Migration probe requires the isolated R6 PostgreSQL")
    database_name = f"campusquest_test_r6_migration_{uuid4().hex[:12]}"
    admin_url = urlunsplit(source._replace(scheme="postgresql", path="/postgres"))
    target_url = urlunsplit(source._replace(path=f"/{database_name}"))
    admin = await asyncpg.connect(admin_url)
    created = False
    try:
        await admin.execute(f'CREATE DATABASE "{database_name}"')
        created = True
        environment = dict(os.environ, DATABASE_URL=target_url)
        legacy = None
        for arguments in (
            ("upgrade", "0037"),
            ("upgrade", "head"),
            ("check",),
            ("downgrade", "base"),
            ("upgrade", "head"),
            ("check",),
        ):
            print(f"R6_MIGRATION_STEP={' '.join(arguments)}", flush=True)
            result = await asyncio.to_thread(
                subprocess.run,
                [sys.executable, "-m", "alembic", *arguments],
                env=environment,
                check=False,
            )
            if result.returncode:
                raise SystemExit(result.returncode)
            if arguments == ("upgrade", "0037"):
                legacy = await seed_legacy(target_url)
            elif arguments == ("upgrade", "head") and legacy is not None:
                await verify_legacy(target_url, legacy)
                legacy = None
        print("R6_MIGRATION_PROBE=PASS", flush=True)
    finally:
        if created:
            # The generated name belongs to this invocation, never to a prior run.
            await admin.execute(f'DROP DATABASE "{database_name}"')
        await admin.close()


asyncio.run(main())
