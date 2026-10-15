"""Exercise migrations on a newly created database in the R5 PostgreSQL only."""

import asyncio
import os
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import asyncpg


async def main() -> None:
    source = urlsplit(os.environ["DATABASE_URL"])
    if (source.hostname, source.port, source.path) != (
        "127.0.0.1",
        16435,
        "/campusquest_test_r5",
    ):
        raise SystemExit("Migration probe requires the isolated R5 PostgreSQL")
    database_name = f"campusquest_test_r5_migration_{uuid4().hex[:12]}"
    admin_url = urlunsplit(source._replace(scheme="postgresql", path="/postgres"))
    target_url = urlunsplit(source._replace(path=f"/{database_name}"))
    admin = await asyncpg.connect(admin_url)
    created = False
    try:
        await admin.execute(f'CREATE DATABASE "{database_name}"')
        created = True
        environment = dict(os.environ, DATABASE_URL=target_url)
        for arguments in (
            ("upgrade", "head"),
            ("check",),
            ("downgrade", "base"),
            ("upgrade", "head"),
            ("check",),
        ):
            print(f"R5_MIGRATION_STEP={' '.join(arguments)}", flush=True)
            result = await asyncio.to_thread(
                subprocess.run,
                [sys.executable, "-m", "alembic", *arguments],
                env=environment,
                check=False,
            )
            if result.returncode:
                raise SystemExit(result.returncode)
        print("R5_MIGRATION_PROBE=PASS", flush=True)
    finally:
        if created:
            # The generated name belongs to this invocation, never to a prior run.
            await admin.execute(f'DROP DATABASE "{database_name}"')
        await admin.close()


asyncio.run(main())
