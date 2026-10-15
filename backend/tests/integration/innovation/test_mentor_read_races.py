"""Operations GET and PATCH must acquire account locks in the same UUID order."""

import asyncio
from uuid import UUID, uuid4

import pytest
from db_guard import require_test_database
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.modules.audit.context import AuditContext
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation import mentor_service as service_module
from app.modules.innovation.mentor_models import MentorProfile
from app.modules.innovation.mentor_schemas import MentorCreateCommand, MentorSaveCommand
from app.modules.innovation.mentor_service import MentorService
from app.modules.innovation.models import OperationsGrant
from tests.e2e.factories import clean_world
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import fields

pytestmark = pytest.mark.integration
CONTEXT = AuditContext(None, None)


@pytest.fixture
async def ordered_world(db_engine, clock):
    require_test_database(get_settings().database_url)
    sessions = async_sessionmaker(db_engine, expire_on_commit=False)
    # Random suffixes isolate runs; these prefixes deterministically put the
    # mentor before the operator in PostgreSQL's UUID lock ordering.
    mentor_id = UUID(f"10000000-0000-4000-8000-{uuid4().hex[-12:]}")
    operator_id = UUID(f"f0000000-0000-4000-8000-{uuid4().hex[-12:]}")
    mentor_username = f"read-race-mentor-{uuid4().hex}"
    async with sessions() as db:
        db.add_all(
            [
                User(
                    id=mentor_id,
                    username=mentor_username,
                    password_hash="unused",
                    nickname="锁序测试模拟导师",
                    role=Role.MENTOR,
                    status="ACTIVE",
                ),
                User(
                    id=operator_id,
                    username=f"read-race-operator-{uuid4().hex}",
                    password_hash="unused",
                    nickname="锁序测试模拟运营",
                    role=Role.STUDENT,
                    status="ACTIVE",
                ),
            ]
        )
        await db.flush()
        db.add(
            OperationsGrant(
                user_id=operator_id,
                enabled=True,
                version=1,
                changed_by=operator_id,
                updated_at=clock.now(),
            )
        )
        await db.commit()
    service = MentorService(clock=clock)
    actor = Actor(operator_id, Role.STUDENT)
    try:
        async with sessions() as db:
            row = (
                await service.create(
                    db,
                    actor=actor,
                    payload=MentorCreateCommand(
                        request_id=uuid4(),
                        mentor_username=mentor_username,
                        fields=fields(),
                    ),
                    context=CONTEXT,
                )
            ).current
        yield sessions, service, actor, row
    finally:
        await clean_world(sessions, user_ids=[operator_id, mentor_id])


async def wait_for_pg_block(observer, *, waiter_pid, blocker_pid, task):
    # Progress follows PostgreSQL's actual wait graph, never a guessed delay.
    async with asyncio.timeout(10):
        while True:
            blockers = await observer.scalar(
                text("SELECT pg_blocking_pids(:waiter)"), {"waiter": waiter_pid}
            )
            if blocker_pid in blockers:
                return
            assert not task.done(), "Save completed before its real lock wait"


async def test_operations_read_and_save_do_not_invert_account_lock_order(
    ordered_world, monkeypatch
):
    sessions, service, actor, row = ordered_world
    actor_only_locked, release_read = asyncio.Event(), asyncio.Event()
    original_active_accounts = service_module.active_accounts
    payload = MentorSaveCommand(
        request_id=uuid4(),
        version=row.version,
        fields={**fields(), "introduction": "并发保存后的模拟导师介绍"},
    )

    async with sessions() as read_db, sessions() as save_db, sessions() as observer:
        # Reserve independent real connections before either operation commits.
        read_pid = await read_db.scalar(text("SELECT pg_backend_pid()"))
        save_pid = await save_db.scalar(text("SELECT pg_backend_pid()"))
        observer_pid = await observer.scalar(text("SELECT pg_backend_pid()"))
        assert len({read_pid, save_pid, observer_pid}) == 3

        async def pause_after_real_actor_lock(db, current_actor, *others, **kwargs):
            accounts = await original_active_accounts(
                db, current_actor, *others, **kwargs
            )
            if db is read_db and not others:
                # Only the old read's premature single-actor lock is paused.
                # The real SQL and transaction remain in effect throughout.
                actor_only_locked.set()
                await release_read.wait()
            return accounts

        monkeypatch.setattr(
            service_module, "active_accounts", pause_after_real_actor_lock
        )
        reader = asyncio.create_task(
            service.read(read_db, actor=actor, profile_id=row.id, operations=True)
        )
        reached_actor_lock = asyncio.create_task(actor_only_locked.wait())
        tasks = [reader, reached_actor_lock]
        try:
            async with asyncio.timeout(10):
                await asyncio.wait(
                    {reader, reached_actor_lock},
                    return_when=asyncio.FIRST_COMPLETED,
                )
            writer = asyncio.create_task(
                service.save(
                    save_db,
                    actor=actor,
                    profile_id=row.id,
                    payload=payload,
                    context=CONTEXT,
                )
            )
            tasks.append(writer)
            if actor_only_locked.is_set():
                # Old read holds operator; save has taken the lower mentor
                # row and is now blocked by read. Releasing read completes
                # the real PG wait cycle, causing a deterministic deadlock.
                await wait_for_pg_block(
                    observer,
                    waiter_pid=save_pid,
                    blocker_pid=read_pid,
                    task=writer,
                )
            # A fixed read acquires both users in sorted order and completes
            # without entering the single-actor pause. It follows this same
            # success assertion path; there is no skip or timing fallback.
            release_read.set()
            results = await asyncio.wait_for(
                asyncio.gather(reader, writer, return_exceptions=True), timeout=15
            )
            errors = [result for result in results if isinstance(result, DBAPIError)]
            assert not errors, f"GET/PATCH account lock inversion: {errors!r}"
            assert not any(isinstance(result, BaseException) for result in results)
            read_result, save_result = results
            assert read_result.profile.id == row.id
            assert read_result.profile.version in (row.version, row.version + 1)
            assert save_result.current.version == row.version + 1
            assert (
                save_result.current.fields.introduction == payload.fields.introduction
            )
        finally:
            release_read.set()
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    async with sessions() as db:
        current = await db.scalar(
            select(MentorProfile).where(MentorProfile.id == row.id)
        )
        assert current.version == row.version + 1
        assert current.fields["introduction"] == payload.fields.introduction
