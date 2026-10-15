"""Regress persistent dev verification without changing its saved demo state.

Run only against a freshly seeded, stopped R5 dev world. A normal health check
must accept later account suspension/revocation; --fresh-seed must reject it.
"""

import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg  # type: ignore[import-untyped]


async def run_verifier(path: Path, *, fresh: bool) -> tuple[int, str]:
    arguments = [sys.executable, str(path)]
    if fresh:
        arguments.append("--fresh-seed")
    process = await asyncio.create_subprocess_exec(
        *arguments,
        cwd="/workspace/backend",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        output, _ = await asyncio.wait_for(process.communicate(), timeout=30)
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()
    assert process.returncode is not None
    return process.returncode, output.decode()


async def main() -> None:
    expected = {
        "DATABASE_URL": ("127.0.0.1", 16436, "/campusquest_r5_dev"),
        "REDIS_URL": ("127.0.0.1", 6476, "/5"),
        "S3_ENDPOINT_URL": ("127.0.0.1", 9107, ""),
    }
    for name, target in expected.items():
        url = urlsplit(os.environ[name])
        assert (url.hostname, url.port, url.path) == target, name
    assert os.environ["S3_BUCKET"] == "campusquest-r5-dev"
    verifier = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else Path(__file__).with_name("dev-verify.py")
    )
    connection = await asyncpg.connect(
        os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
    )
    try:
        assert (
            await connection.fetchval("SELECT current_database()")
            == "campusquest_r5_dev"
        )
        mentor = await connection.fetchrow(
            "SELECT id, status FROM users WHERE username='mentor@campus.example.edu'"
        )
        operator = await connection.fetchrow(
            "SELECT g.user_id, g.enabled FROM ie_operations_grants g "
            "JOIN users u ON u.id=g.user_id WHERE u.username='20250001'"
        )
        assert mentor is not None and operator is not None
        baseline_exit, baseline_output = await run_verifier(verifier, fresh=True)
        assert baseline_exit == 0, f"Fresh-world precondition: {baseline_output}"
        failures = []
        try:
            for label, status, enabled in (
                ("suspended_mentor", "SUSPENDED", True),
                ("revoked_operator", "ACTIVE", False),
                ("suspended_and_revoked", "SUSPENDED", False),
            ):
                async with connection.transaction():
                    await connection.execute(
                        "UPDATE users SET status=$1 WHERE id=$2", status, mentor["id"]
                    )
                    await connection.execute(
                        "UPDATE ie_operations_grants SET enabled=$1 WHERE user_id=$2",
                        enabled,
                        operator["user_id"],
                    )
                for fresh, expected_exit in ((False, 0), (True, 1)):
                    actual_exit, output = await run_verifier(verifier, fresh=fresh)
                    print(
                        f"R5_DEV_VERIFY_CASE={label} fresh={fresh} "
                        f"expected_exit={expected_exit} actual_exit={actual_exit}",
                        flush=True,
                    )
                    print(output, end="", flush=True)
                    if actual_exit != expected_exit or (
                        fresh and "AssertionError" not in output
                    ):
                        failures.append(f"{label} fresh={fresh}")
        finally:
            async with connection.transaction():
                await connection.execute(
                    "UPDATE users SET status=$1 WHERE id=$2",
                    mentor["status"],
                    mentor["id"],
                )
                await connection.execute(
                    "UPDATE ie_operations_grants SET enabled=$1 WHERE user_id=$2",
                    operator["enabled"],
                    operator["user_id"],
                )
            assert (
                await connection.fetchval(
                    "SELECT status FROM users WHERE id=$1", mentor["id"]
                )
                == mentor["status"]
            )
            assert (
                await connection.fetchval(
                    "SELECT enabled FROM ie_operations_grants WHERE user_id=$1",
                    operator["user_id"],
                )
                == operator["enabled"]
            )
            print("R5_DEV_VERIFY_ORIGINAL_STATE_RESTORED=PASS", flush=True)
        assert not failures, f"Verification regression: {failures}"
        print("R5_DEV_VERIFY_REGRESSION=PASS cases=6", flush=True)
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
