"""Independent PostgreSQL transactions, never an in-process lock substitute."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.core.errors import BusinessError
from app.modules.audit.context import AuditContext
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_models import (
    CollaborationReceipt,
    ProjectCollaboration,
    ProjectParticipation,
)
from app.modules.innovation.collaboration_schemas import (
    CollaborationInviteCommand,
    CollaborationVersionCommand,
    TargetResolveCommand,
)
from app.modules.innovation.collaboration_service import CollaborationService
from tests.e2e.factories import clean_world
from tests.integration.db_guard import require_test_database
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_achievement_review_operations import account

pytestmark = pytest.mark.integration
CONTEXT = AuditContext(None, None)


@pytest.fixture
async def committed(db_engine, clock):
    require_test_database(get_settings().database_url)
    sessions = async_sessionmaker(db_engine, expire_on_commit=False)
    service = CollaborationService(clock=clock)
    async with sessions() as db:
        owner, project, _, _ = await world(db, clock)
        target, _ = await account(db, clock)
        target.username = str(uuid4().int)[:12]
        owner_actor, target_actor = (
            Actor(owner.id, Role.STUDENT),
            Actor(target.id, Role.STUDENT),
        )
        project_id, username, users = project.id, target.username, [owner.id, target.id]
        await db.commit()
        reference = await service.resolve(
            db,
            actor=owner_actor,
            payload=TargetResolveCommand(account=username),
            context=CONTEXT,
        )
    try:
        yield (
            sessions,
            service,
            project_id,
            owner_actor,
            target_actor,
            reference.target_ref,
        )
    finally:
        await clean_world(sessions, user_ids=users)


async def test_duplicate_concurrent_invite_has_one_candidate_and_receipt(committed):
    sessions, service, project_id, owner, _, reference = committed
    payload = CollaborationInviteCommand(
        request_id=uuid4(), target_ref=reference, kind="MANAGER"
    )
    barrier = asyncio.Barrier(2)

    async def run():
        async with sessions() as db:
            await barrier.wait()
            return await service.invite(
                db, actor=owner, project_id=project_id, payload=payload, context=CONTEXT
            )

    results = await asyncio.wait_for(asyncio.gather(run(), run()), timeout=15)
    assert results[0].id == results[1].id
    async with sessions() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(ProjectCollaboration)
                .where(ProjectCollaboration.project_id == project_id)
            )
            == 1
        )
        assert (
            await db.scalar(
                select(func.count())
                .select_from(CollaborationReceipt)
                .where(CollaborationReceipt.actor_user_id == owner.user_id)
            )
            == 1
        )


@pytest.mark.parametrize("round_number", range(3))
async def test_accept_and_revoke_at_same_version_apply_at_most_once(
    committed, round_number
):
    sessions, service, project_id, owner, target, reference = committed
    async with sessions() as db:
        row = await service.invite(
            db,
            actor=owner,
            project_id=project_id,
            payload=CollaborationInviteCommand(
                request_id=uuid4(), target_ref=reference, kind="MANAGER"
            ),
            context=CONTEXT,
        )
    barrier = asyncio.Barrier(2)

    async def run(actor, action):
        async with sessions() as db:
            await barrier.wait()
            try:
                return await service.act(
                    db,
                    actor=actor,
                    collaboration_id=row.id,
                    action=action,
                    payload=CollaborationVersionCommand(
                        request_id=uuid4(), version=row.version
                    ),
                    context=CONTEXT,
                )
            except BusinessError as error:
                return error

    results = await asyncio.wait_for(
        asyncio.gather(run(target, "accept"), run(owner, "revoke")), timeout=15
    )
    assert sum(isinstance(result, BusinessError) for result in results) == 1
    async with sessions() as db:
        state = await db.get(ProjectCollaboration, row.id)
        assert state.version == 2
        assert state.status in {"ACCEPTED", "REVOKED"}
        history = await db.scalar(
            select(func.count())
            .select_from(ProjectParticipation)
            .where(ProjectParticipation.project_id == project_id)
        )
        assert history == (1 if state.status == "ACCEPTED" else 0)
