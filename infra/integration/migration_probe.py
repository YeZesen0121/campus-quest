"""Three independent PG paths and roundtrips, scoped to one invocation."""
from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import SplitResult, urlsplit, urlunsplit
from uuid import uuid4

import asyncpg

ROOT = Path(__file__).resolve().parents[2]


def validate_source(database_url: str, *, ci: bool = False) -> SplitResult:
    """Validate the explicit test environment before opening any connection."""
    resources = json.loads((ROOT / "infra/integration/resources.json").read_text())
    message = "Migration probe requires isolated integration PostgreSQL"
    try:
        source = urlsplit(database_url)
        if ci:
            if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CQ_INTEGRATION_CI") != "1":
                raise ValueError("CI contract missing")
            port = int(os.environ["CQ_INTEGRATION_PG_PORT"])
            database = os.environ["CQ_INTEGRATION_DATABASE"]
            if not re.fullmatch(r"campusquest_test(?:_[a-z0-9]+)*", database):
                raise ValueError("not a test database")
            hosts = {"localhost", "127.0.0.1"}
        else:
            port, database = resources["ports"]["postgres"], resources["database"]
            hosts = {"127.0.0.1"}
        if (source.scheme != "postgresql+asyncpg" or source.hostname not in hosts
            or source.port != port or source.path != "/" + database
            or source.username != resources["database_user"] or not source.password
            or source.query or source.fragment):
            raise ValueError("foreign target")
    except (ValueError, KeyError):
        raise SystemExit(message) from None
    return source


def native_url(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def compare_downgrade_failures(integrated: str, upstream: str) -> tuple[str, str, str]:
    """A fallback needs a separately reproduced upstream failure, never any error."""
    def fingerprint(log: str) -> tuple[str, str, str]:
        operations = re.findall(r"Running downgrade ([^,\n]+)", log)
        errors = re.findall(r"^(sqlalchemy\.exc\.\w+Error: .+)$", log, re.MULTILINE)
        statements = re.findall(r"^\[SQL: (.+)\]$", log, re.MULTILINE)
        assert operations and errors and statements, "Incomplete base downgrade failure evidence"
        return operations[-1], errors[-1], statements[-1]

    actual, original = fingerprint(integrated), fingerprint(upstream)
    assert actual == original, "Integrated base downgrade differs from pure upstream"
    return original


async def seed_upstream(url: str) -> list[tuple[str, str, object]]:
    """Valid constrained rows, including coherent ledger/wallet/reservation."""
    c = await asyncpg.connect(native_url(url))
    teacher, student, admin, task, notice, delivery, item, redemption, reserve, ledger = [uuid4() for _ in range(10)]
    event_key = f"integration-migration:{notice}"
    try:
        async with c.transaction():
            for identity, role in ((teacher, "TEACHER"), (student, "STUDENT"), (admin, "ADMIN")):
                await c.execute("INSERT INTO users(id,username,password_hash,nickname,role,status) VALUES($1,$2,'unused','migration sample',$3,'ACTIVE')", identity, "migration-" + identity.hex, role)
            await c.execute("INSERT INTO tasks(id,owner_teacher_id,title,description,task_type,rarity,base_reward_points,status,deadline_mode,duration_minutes,allowed_file_types,max_file_size_bytes,notification_channels,published_at) VALUES($1,$2,'Preserved document task','upstream migration sample','DATA_CRAWL','NORMAL',100,'PUBLISHED','RELATIVE',60,ARRAY['PDF'],10485760,ARRAY['IN_APP'],now())", task, teacher)
            await c.execute("INSERT INTO notifications(id,user_id,event_key,event_type,title,body) VALUES($1,$2,$3,'ACCOUNT_SECURITY','Preserved notice','migration sample')", notice, student, event_key)
            await c.execute("INSERT INTO notification_deliveries(id,notification_id,user_id,event_key,channel,status,scheduled_at,attempts,sent_at) VALUES($1,$2,$3,$4,'IN_APP','SENT',now(),1,now())", delivery, notice, student, event_key)
            await c.execute("INSERT INTO reward_items(id,name,point_cost,stock) VALUES($1,'Preserved reward',10,5)", item)
            await c.execute("INSERT INTO reward_redemptions(id,user_id,reward_item_id,status,term_key,points) VALUES($1,$2,$3,'REQUESTED','2026-fall',10)", redemption, student, item)
            await c.execute("INSERT INTO point_wallets(user_id,available_points,earned_points) VALUES($1,500,0)", student)
            await c.execute("INSERT INTO point_reservations(id,user_id,redemption_id,points,status) VALUES($1,$2,$3,10,'ACTIVE')", reserve, student, redemption)
            await c.execute("INSERT INTO points_ledger(id,user_id,ledger_type,amount,source_type,source_id,affects_balance,affects_ranking,operator_id,reason) VALUES($1,$2,'ADMIN_ADJUSTMENT',500,'ADMIN_ADJUSTMENT',$3,true,false,$4,'migration preservation fixture')", ledger, student, uuid4(), admin)
        return [("users", "id", teacher), ("users", "id", student), ("users", "id", admin), ("tasks", "id", task), ("notifications", "id", notice), ("notification_deliveries", "id", delivery), ("reward_items", "id", item), ("reward_redemptions", "id", redemption), ("point_wallets", "user_id", student), ("point_reservations", "id", reserve), ("points_ledger", "id", ledger)]
    finally:
        await c.close()


async def row_snapshot(url: str, keys: list[tuple[str, str, object]]) -> dict[str, str]:
    c = await asyncpg.connect(native_url(url))
    try:
        result = {}
        for table, column, identity in keys:
            assert re.fullmatch(r"[a-z_]+", table) and column in {"id", "user_id"}
            value = await c.fetchval(f'SELECT to_jsonb(t)::text FROM "{table}" t WHERE "{column}"=$1', identity)
            assert value is not None, f"Missing representative {table}"
            result[f"{table}:{identity}"] = value
        return result
    finally:
        await c.close()


async def catalog(url: str) -> dict[str, list[str]]:
    """Stable structure definitions; exclude OIDs/rows/other schemas."""
    c = await asyncpg.connect(native_url(url))
    queries = {
        "columns": "SELECT concat_ws('|',table_name,column_name,data_type,udt_name,is_nullable,coalesce(column_default,'')) FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
        "constraints": "SELECT c.relname||'|'||k.conname||'|'||pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname",
        "indexes": "SELECT tablename||'|'||indexname||'|'||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
        "triggers": "SELECT c.relname||'|'||t.tgname||'|'||pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
        "functions": "SELECT p.proname||'|'||pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname,p.oid",
    }
    try:
        return {key: [row[0] for row in await c.fetch(query)] for key, query in queries.items()}
    finally:
        await c.close()


async def verify_structure(url: str, target: str) -> None:
    c = await asyncpg.connect(native_url(url))
    try:
        assert await c.fetchval("SELECT version_num FROM alembic_version") == target
        for table in ("users", "tasks", "notifications", "reward_redemptions", "ie_project_drafts", "ie_achievement_drafts", "ie_mentor_profiles", "ie_project_participation", "ie_achievement_evidence"):
            assert await c.fetchval("SELECT to_regclass($1)::text", table) == table
            assert await c.fetchval("SELECT count(*) FROM pg_constraint WHERE conrelid=to_regclass($1)", table) > 0
            assert await c.fetchval("SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename=$1", table) > 0
        for table in ("ie_project_drafts", "ie_achievement_evidence"):
            assert await c.fetchval("SELECT count(*) FROM pg_trigger WHERE tgrelid=to_regclass($1) AND NOT tgisinternal", table) > 0
    finally:
        await c.close()


class Probe:
    def __init__(self, source: SplitResult, run_dir: Path, targets: dict) -> None:
        self.source, self.run_dir, self.targets = source, run_dir, targets
        self.run_id = run_dir.name
        self.created: set[str] = set()
        self.steps: list[dict] = []

    async def create(self, admin, label: str) -> str:
        name = f"campusquest_test_integration_{label.lower()}_{uuid4().hex[:12]}"
        assert re.fullmatch(r"campusquest_test_integration_[a-z0-9]+_[0-9a-f]{12}", name)
        await admin.execute(f'CREATE DATABASE "{name}"')
        self.created.add(name)
        await admin.execute(f"COMMENT ON DATABASE \"{name}\" IS 'cq-integration:{self.run_id}'")
        return urlunsplit(self.source._replace(path="/" + name))

    async def alembic(self, url: str, *arguments: str, may_fail: bool = False) -> int:
        index = len(self.steps) + 1
        log = self.run_dir / f"{index:02}-{'-'.join(arguments)}.log"
        command = [sys.executable, "-m", "alembic", *arguments]
        start = dt.datetime.now(dt.timezone.utc).isoformat()
        print(f"INTEGRATION_MIGRATION_STEP={index} {' '.join(arguments)}", flush=True)
        with log.open("wb") as stream:
            process = await asyncio.to_thread(subprocess.run, command, cwd=ROOT / "backend", env=dict(os.environ, DATABASE_URL=url), stdout=stream, stderr=subprocess.STDOUT)
        content = log.read_bytes()
        print(content.decode(errors="replace"), end="", flush=True)
        self.steps.append({"cwd": str(ROOT / "backend"), "args": command, "database": urlsplit(url).path, "start": start, "end": dt.datetime.now(dt.timezone.utc).isoformat(), "exit": process.returncode, "log": str(log), "sha256": hashlib.sha256(content).hexdigest()})
        print(f"INTEGRATION_MIGRATION_STEP_EXIT={process.returncode}", flush=True)
        if process.returncode and not may_fail:
            raise RuntimeError(f"Migration step {index} failed with exit {process.returncode}")
        return process.returncode

    async def path(self, admin, label: str) -> dict:
        url = await self.create(admin, label)
        head, upstream = self.targets["final_head"], self.targets["upstream_head"]
        if label == "M1":
            await self.alembic(url, "upgrade", head)
            await self.alembic(url, "check")
            await verify_structure(url, head)
            result = {"path": label, "empty_upgrade": True, "metadata": True, "structure": True}
        elif label in {"M2", "M4"}:
            await self.alembic(url, "upgrade", upstream)
            keys = await seed_upstream(url)
            before = await row_snapshot(url, keys)
            before_catalog = await catalog(url)
            await self.alembic(url, "upgrade", head)
            await self.alembic(url, "check")
            await verify_structure(url, head)
            assert await row_snapshot(url, keys) == before, "Upstream rows/relations changed"
            result = {"path": label, "upstream_rows_preserved": len(keys), "metadata": True}
            if label == "M4":
                await self.alembic(url, "downgrade", upstream)
                assert await row_snapshot(url, keys) == before
                assert await catalog(url) == before_catalog, "Upstream schema not restored exactly"
                await self.alembic(url, "upgrade", head)
                await self.alembic(url, "check")
                assert await row_snapshot(url, keys) == before
                result["upstream_roundtrip"] = True
                base_exit = await self.alembic(url, "downgrade", "base", may_fail=True)
                result["base_downgrade_exit"] = base_exit
                if base_exit == 0:
                    await self.alembic(url, "upgrade", head)
                    await self.alembic(url, "check")
                    await verify_structure(url, head)
                    result["base_roundtrip"] = True
                else:
                    integrated_failure = Path(self.steps[-1]["log"]).read_text()
                    original = await self.create(admin, "upstream")
                    await self.alembic(original, "upgrade", upstream)
                    await seed_upstream(original)
                    original_exit = await self.alembic(original, "downgrade", "base", may_fail=True)
                    assert original_exit != 0, "Pure upstream supports this downgrade; integration regression"
                    signature = compare_downgrade_failures(
                        integrated_failure, Path(self.steps[-1]["log"]).read_text()
                    )
                    result["upstream_base_limit_reproduced"] = list(signature)
                    fresh = await self.create(admin, "rebuild")
                    await self.alembic(fresh, "upgrade", head)
                    await self.alembic(fresh, "check")
                    await verify_structure(fresh, head)
                    result["base_roundtrip"] = False
                    result["fresh_rebuild"] = True
        else:
            from migration_fixtures import seed_legacy, verify_legacy
            await self.alembic(url, "upgrade", self.targets["innovation_r5"])
            identities = await seed_legacy(url)
            await self.alembic(url, "upgrade", head)
            await verify_legacy(url, identities)
            await self.alembic(url, "check")
            await verify_structure(url, head)
            result = {"path": label, "legacy_owner_mentor_evidence_backfill": True, "metadata": True}
        print("INTEGRATION_MIGRATION_PATH=" + json.dumps(result), flush=True)
        return result

    async def cleanup(self, admin) -> None:
        for name in sorted(self.created):
            assert re.fullmatch(r"campusquest_test_integration_[a-z0-9]+_[0-9a-f]{12}", name)
            row = await admin.fetchrow("SELECT pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", name)
            assert row and row["owner"] == self.source.username and row["marker"] == f"cq-integration:{self.run_id}"
            await admin.execute(f'DROP DATABASE "{name}"')
            print(f"INTEGRATION_MIGRATION_OWNED_DB_REMOVED={name}", flush=True)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ci", action="store_true")
    parser.add_argument("--path", choices=["M1", "M2", "M3", "M4"], action="append")
    args = parser.parse_args()
    source = validate_source(os.environ.get("DATABASE_URL", ""), ci=args.ci)
    targets = json.loads((ROOT / "infra/integration/migration-targets.json").read_text())
    run_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex[:8]
    run_dir = ROOT / "infra/integration/.runtime/migrations" / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    probe = Probe(source, run_dir, targets)
    admin = await asyncpg.connect(urlunsplit(source._replace(scheme="postgresql", path="/postgres")))
    results = []
    cleanup_ok = False
    try:
        for label in args.path or ["M1", "M2", "M3", "M4"]:
            results.append(await probe.path(admin, label))
    finally:
        try:
            await probe.cleanup(admin)
            cleanup_ok = True
        finally:
            await admin.close()
            record = {"run_id": run_id, "upstream_sha": targets["upstream_sha"], "paths": results, "steps": probe.steps, "cleanup_verified": cleanup_ok}
            (run_dir / "result.json").write_text(json.dumps(record, indent=2))
            print(f"INTEGRATION_MIGRATION_EVIDENCE={run_dir / 'result.json'}", flush=True)
