"""Cyclic archive pointers and immutable history stay inside one explicit world."""

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.innovation.lifecycle_models import (
    LifecycleReceipt,
    ProjectIntroduction,
)
from app.modules.innovation.lifecycle_schemas import LifecycleCommand
from app.modules.innovation.lifecycle_service import LifecycleService
from app.modules.innovation.models import ProjectDraft
from app.modules.innovation.recruitment_models import (
    RecruitmentDraft,
    RecruitmentRevision,
)
from app.modules.innovation.recruitment_schemas import (
    RecruitmentDraftCreate,
    RecruitmentFields,
    RecruitmentVersionCommand,
)
from app.modules.innovation.recruitment_service import RecruitmentService
from tests.e2e.factories import clean_world
from tests.integration.db_guard import require_test_database
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import fields, world
from tests.integration.innovation.test_collaboration_races import CONTEXT

pytestmark = pytest.mark.integration


@dataclass(frozen=True)
class ArchiveWorld:
    owner: UUID
    project: UUID
    job: UUID
    intro: UUID


async def seed(sessions, clock):
    async with sessions() as db:
        owner, project, _, _ = await world(db, clock)
        actor, project_id = Actor(owner.id, Role.STUDENT), project.id
        jobs = RecruitmentService(clock=clock)
        drafted, _ = await jobs.create(
            db,
            actor=actor,
            project_id=project_id,
            payload=RecruitmentDraftCreate(
                request_id=uuid4(), fields=RecruitmentFields.model_validate(fields())
            ),
            context=CONTEXT,
        )
        await jobs.publish(
            db,
            actor=actor,
            project_id=project_id,
            recruitment_id=drafted.id,
            payload=RecruitmentVersionCommand(
                request_id=uuid4(), version=drafted.version
            ),
            context=CONTEXT,
        )
        lifecycle = LifecycleService(clock=clock)
        state = await lifecycle.read(
            db, actor=actor, project_id=project_id, context=CONTEXT
        )
        await lifecycle.act(
            db,
            actor=actor,
            project_id=project_id,
            action="complete",
            payload=LifecycleCommand(
                request_id=uuid4(),
                version=state.version,
                confirmation_digest=state.confirmation_digest,
            ),
            context=CONTEXT,
        )
        intro_id = await db.scalar(
            select(ProjectDraft.public_introduction_id).where(
                ProjectDraft.id == project_id
            )
        )
        assert intro_id is not None
        return ArchiveWorld(actor.user_id, project_id, drafted.id, intro_id)


@pytest.fixture
async def worlds(db_engine, clock):
    require_test_database(get_settings().database_url)
    sessions = async_sessionmaker(db_engine, expire_on_commit=False)
    local, other = await seed(sessions, clock), await seed(sessions, clock)
    try:
        yield sessions, local, other
    finally:
        await clean_world(sessions, user_ids=[local.owner, other.owner])


async def snapshot(sessions, groups):
    projects, jobs = [g.project for g in groups], [g.job for g in groups]
    scopes = (
        (ProjectDraft, ProjectDraft.id.in_(projects)),
        (ProjectIntroduction, ProjectIntroduction.project_id.in_(projects)),
        (LifecycleReceipt, LifecycleReceipt.project_id.in_(projects)),
        (RecruitmentDraft, RecruitmentDraft.id.in_(jobs)),
        (RecruitmentRevision, RecruitmentRevision.recruitment_id.in_(jobs)),
    )
    async with sessions() as db:
        return {
            model.__tablename__: (
                await db.execute(
                    select(model.__table__).where(scope).order_by(model.id)
                )
            ).all()
            for model, scope in scopes
        }


async def test_archive_cleanup_removes_only_local_cycle_and_restores_history_guards(
    worlds,
):
    sessions, local, other = worlds
    before = await snapshot(sessions, [other])
    await clean_world(sessions, user_ids=[local.owner])
    assert all(not rows for rows in (await snapshot(sessions, [local])).values())
    assert await snapshot(sessions, [other]) == before
    await clean_world(sessions, user_ids=[local.owner])
    assert await snapshot(sessions, [other]) == before
    async with sessions() as db:
        for model, scope, changes in (
            (
                ProjectIntroduction,
                ProjectIntroduction.project_id == other.project,
                {"fields": {"title": "篡改"}},
            ),
            (
                LifecycleReceipt,
                LifecycleReceipt.project_id == other.project,
                {"fingerprint": "f" * 64},
            ),
        ):
            with pytest.raises(DBAPIError):
                async with db.begin_nested():
                    await db.execute(update(model).where(scope).values(**changes))


async def test_foreign_receipt_actor_refuses_cleanup_before_any_pointer_is_cleared(
    worlds, clock
):
    sessions, local, other = worlds
    async with sessions() as db:
        db.add(
            LifecycleReceipt(
                project_id=local.project,
                actor_user_id=other.owner,
                request_id=uuid4(),
                action="COMPLETE",
                fingerprint="f" * 64,
                applied_version=2,
                created_at=clock.now(),
            )
        )
        await db.commit()
    before = await snapshot(sessions, [local, other])
    with pytest.raises(RuntimeError, match="outside this world"):
        await clean_world(sessions, user_ids=[local.owner])
    assert await snapshot(sessions, [local, other]) == before


@pytest.mark.parametrize("boundary", ["source", "pointer"])
async def test_archive_cross_project_foreign_keys_reject_inconsistent_links(
    worlds, clock, boundary
):
    sessions, local, other = worlds
    async with sessions() as db:
        original = await db.get(ProjectIntroduction, other.intro)
        with pytest.raises(DBAPIError) as error:
            async with db.begin_nested():
                if boundary == "pointer":
                    await db.execute(
                        update(ProjectDraft)
                        .where(ProjectDraft.id == local.project)
                        .values(public_introduction_id=other.intro)
                    )
                else:
                    db.add(
                        ProjectIntroduction(
                            project_id=local.project,
                            number=2,
                            fields=original.fields,
                            recruitment_id=other.job,
                            recruitment_revision_id=original.recruitment_revision_id,
                            created_by=local.owner,
                            created_at=clock.now(),
                        )
                    )
                    await db.flush()
        expected = (
            "fk_ie_project_introduction"
            if boundary == "pointer"
            else "fk_ie_introduction_recruitment"
        )
        assert expected in str(error.value.orig)
