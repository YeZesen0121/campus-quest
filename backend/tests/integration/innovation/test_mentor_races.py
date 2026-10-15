"""Independent PG connections prove receipts, version races and durable history."""

import asyncio
from uuid import uuid4

import httpx
import pytest
from db_guard import require_test_database
from sqlalchemy import func, select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.core.errors import BusinessError
from app.main import create_app
from app.modules.audit.context import AuditContext
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.innovation.mentor_models import (
    MentorConsent,
    MentorProfile,
    MentorReceipt,
    MentorRevision,
)
from app.modules.innovation.mentor_schemas import (
    MentorConfirmCommand,
    MentorCreateCommand,
    MentorVersionCommand,
)
from app.modules.innovation.mentor_service import MentorService
from tests.e2e.factories import clean_world
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import fields
from tests.integration.innovation.test_achievement_review_operations import account

pytestmark = pytest.mark.integration
CONTEXT = AuditContext(None, None)


@pytest.fixture
async def production_db_lifecycle():
    from app.db.session import get_async_engine, get_async_session_maker

    # These composition checks own an application lifecycle. Clear and dispose
    # its lazy production pool within this test's event loop, just as a running
    # API process would, rather than carrying connections into the next loop.
    get_async_session_maker.cache_clear()
    get_async_engine.cache_clear()
    try:
        yield
    finally:
        if get_async_engine.cache_info().currsize:
            await get_async_engine().dispose()
        get_async_session_maker.cache_clear()
        get_async_engine.cache_clear()


@pytest.fixture
async def committed(db_engine, clock):
    require_test_database(get_settings().database_url)
    sessions = async_sessionmaker(db_engine, expire_on_commit=False)
    async with sessions() as db:
        operator, oh = await account(db, clock, operator=True)
        mentor, mh = await account(db, clock, role="MENTOR")
        viewer, vh = await account(db, clock)
        ids = [operator.id, mentor.id, viewer.id]
        data = (
            Actor(operator.id, Role.STUDENT),
            Actor(mentor.id, Role.MENTOR),
            mentor.username,
            oh,
            mh,
            vh,
        )
        await db.commit()
    try:
        yield sessions, MentorService(clock=clock), data
    finally:
        await clean_world(sessions, user_ids=ids)


async def create(sessions, service, data):
    operator, _, username, *_ = data
    async with sessions() as db:
        return (
            await service.create(
                db,
                actor=operator,
                payload=MentorCreateCommand(
                    request_id=uuid4(), mentor_username=username, fields=fields()
                ),
                context=CONTEXT,
            )
        ).current


async def publish(sessions, service, data, row):
    async with sessions() as db:
        return (
            await service.act(
                db,
                actor=data[1],
                action="confirm",
                context=CONTEXT,
                payload=MentorConfirmCommand(
                    request_id=uuid4(),
                    version=row.version,
                    confirm_profile=True,
                    contact_channels=["EMAIL"],
                    authorized_fields=["directions"],
                    accepting_contact=True,
                ),
            )
        ).current


async def test_same_request_concurrent_create_is_one_profile_and_one_receipt(committed):
    sessions, service, data = committed
    payload = MentorCreateCommand(
        request_id=uuid4(), mentor_username=data[2], fields=fields()
    )
    barrier = asyncio.Barrier(2)

    async def run():
        async with sessions() as db:
            await barrier.wait()
            return await service.create(
                db, actor=data[0], payload=payload, context=CONTEXT
            )

    results = await asyncio.wait_for(asyncio.gather(run(), run()), timeout=15)
    assert sorted(r.replayed for r in results) == [False, True]
    assert results[0].current.id == results[1].current.id
    async with sessions() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(MentorProfile)
                .where(MentorProfile.user_id == data[1].user_id)
            )
            == 1
        )
        assert (
            await db.scalar(
                select(func.count())
                .select_from(MentorReceipt)
                .where(MentorReceipt.actor_user_id == data[0].user_id)
            )
            == 1
        )


async def test_confirm_and_withdraw_at_same_version_cannot_both_apply(committed):
    sessions, service, data = committed
    row = await publish(sessions, service, data, await create(sessions, service, data))
    barrier = asyncio.Barrier(2)

    async def run(action):
        async with sessions() as db:
            await barrier.wait()
            payload = (
                MentorConfirmCommand(
                    request_id=uuid4(),
                    version=row.version,
                    confirm_profile=True,
                    contact_channels=["EMAIL"],
                    authorized_fields=[],
                    accepting_contact=True,
                )
                if action == "confirm"
                else MentorVersionCommand(request_id=uuid4(), version=row.version)
            )
            try:
                return await service.act(
                    db, actor=data[1], action=action, payload=payload, context=CONTEXT
                )
            except BusinessError as exc:
                return exc

    results = await asyncio.wait_for(
        asyncio.gather(run("confirm"), run("withdraw")), timeout=15
    )
    successes = [r for r in results if not isinstance(r, BusinessError)]
    conflicts = [r for r in results if isinstance(r, BusinessError)]
    assert len(successes) == len(conflicts) == 1
    assert conflicts[0].status_code == 409
    async with sessions() as db:
        current = await db.get(MentorProfile, row.id)
        assert current.version == row.version + 1
        assert current.visibility == successes[0].current.visibility


async def test_consent_and_public_revision_cannot_be_rewritten(committed):
    sessions, service, data = committed
    row = await publish(sessions, service, data, await create(sessions, service, data))
    async with sessions() as db:
        with pytest.raises(DBAPIError):
            async with db.begin_nested():
                await db.execute(
                    update(MentorConsent)
                    .where(MentorConsent.profile_id == row.id)
                    .values(action="forged")
                )
        with pytest.raises(DBAPIError):
            async with db.begin_nested():
                await db.execute(
                    update(MentorRevision)
                    .where(MentorRevision.profile_id == row.id)
                    .values(content={"name": "forged"})
                )


async def test_real_router_session_database_and_audit_composition(
    committed, production_db_lifecycle
):
    sessions, service, data = committed
    # No DB/service/actor overrides: real bearer decoding, DB factory, router,
    # service and durable audit are composed exactly as the application binds.
    _, _, username, oh, mh, vh = data
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_app()), base_url="https://localhost"
    ) as client:
        created = await client.post(
            "/api/v1/ie/operations/mentors",
            headers=oh,
            json={
                "request_id": str(uuid4()),
                "mentor_username": username,
                "fields": fields(),
            },
        )
        assert created.status_code == 200, created.text
        row = created.json()["current"]
        accepted = await client.post(
            "/api/v1/ie/me/mentor/confirm",
            headers=mh,
            json={
                "request_id": str(uuid4()),
                "version": row["version"],
                "confirm_profile": True,
                "contact_channels": ["EMAIL"],
                "authorized_fields": [],
                "accepting_contact": True,
            },
        )
        assert accepted.status_code == 200, accepted.text
        row = accepted.json()["current"]
        contacts = await client.post(
            f"/api/v1/ie/mentors/{row['id']}/contacts",
            headers=vh,
            json={"expected_public_version": row["public_version"]},
        )
        assert contacts.status_code == 200, contacts.text
        assert contacts.json()["contacts"][0]["value"] == "mentor@example.com"


class UnavailableAudit:
    async def append(self, *args, **kwargs):
        raise RuntimeError("simulated durable audit outage")


async def test_confirmation_audit_outage_rolls_back_consent_and_publication(
    committed, clock
):
    sessions, service, data = committed
    row = await create(sessions, service, data)
    failing = MentorService(clock=clock, audit=UnavailableAudit())
    with pytest.raises(RuntimeError, match="audit outage"):
        await publish(sessions, failing, data, row)
    async with sessions() as db:
        current = await db.get(MentorProfile, row.id)
        assert current.visibility == "HIDDEN"
        assert current.version == row.version
        assert current.public_revision_id is None
        assert (
            await db.scalar(
                select(func.count())
                .select_from(MentorConsent)
                .where(MentorConsent.profile_id == row.id)
            )
            == 0
        )


async def test_contact_audit_outage_never_returns_values(
    committed, clock, production_db_lifecycle
):
    from app.modules.innovation.mentor_router import get_public_mentor_service
    from app.modules.innovation.public_mentor_service import PublicMentorService

    sessions, service, data = committed
    row = await publish(sessions, service, data, await create(sessions, service, data))
    app = create_app()
    app.dependency_overrides[get_public_mentor_service] = lambda: PublicMentorService(
        clock=clock, audit=UnavailableAudit()
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="https://localhost",
    ) as client:
        result = await client.post(
            f"/api/v1/ie/mentors/{row.id}/contacts",
            headers=data[5],
            json={"expected_public_version": row.public_version},
        )
        assert result.status_code == 500
        assert "mentor@example.com" not in result.text
        assert result.json()["error"]["code"] == "INTERNAL_ERROR"
