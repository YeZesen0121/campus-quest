"""Cleanup owns a complete mentor world or refuses it without partial deletion."""

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, text, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.modules.identity.models import User
from app.modules.innovation.mentor_models import (
    MentorConsent,
    MentorProfile,
    MentorReceipt,
    MentorRevision,
    ProjectMentorLink,
)
from app.modules.innovation.models import ProjectDraft
from tests.e2e.factories import clean_world
from tests.integration.innovation.talent_support import clock as clock

pytestmark = pytest.mark.integration


@dataclass(frozen=True)
class World:
    mentor: UUID
    owner: UUID
    operator: UUID
    profile: UUID
    project: UUID

    @property
    def users(self):
        return [self.mentor, self.owner, self.operator]


async def seed(db, clock):
    """Real constrained rows, including public pointer and immutable history."""
    mentor, owner, operator = [uuid4() for _ in range(3)]
    for user_id, role in [
        (mentor, "MENTOR"),
        (owner, "STUDENT"),
        (operator, "STUDENT"),
    ]:
        db.add(
            User(
                id=user_id,
                username=f"cleanup-{user_id.hex}",
                password_hash="unused",
                nickname="清理测试模拟用户",
                role=role,
                status="ACTIVE",
            )
        )
    await db.flush()
    profile = MentorProfile(
        id=uuid4(),
        user_id=mentor,
        fields={"name": "清理测试模拟导师", "contacts": []},
        version=2,
        public_version=1,
        confirmation_state="CONFIRMED",
        visibility="HIDDEN",
        moderation_state="NORMAL",
        accepting_contact=False,
        authorized_fields=[],
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    project = ProjectDraft(
        id=uuid4(),
        owner_user_id=owner,
        creation_request_id=uuid4(),
        creation_payload_fingerprint="a" * 64,
        title="清理测试模拟项目",
    )
    db.add_all([profile, project])
    await db.flush()
    consent_id, revision_id = uuid4(), uuid4()
    db.add(
        MentorConsent(
            id=consent_id,
            profile_id=profile.id,
            actor_user_id=mentor,
            draft_version=1,
            action="confirm",
            scope={"contact_channels": []},
            created_at=clock.now(),
        )
    )
    await db.flush()
    db.add(
        MentorRevision(
            id=revision_id,
            profile_id=profile.id,
            consent_id=consent_id,
            number=1,
            content={"name": "清理测试模拟导师"},
            contacts=[],
            created_at=clock.now(),
        )
    )
    await db.flush()
    profile.public_revision_id = revision_id
    profile.visibility = "VISIBLE"
    world = World(mentor, owner, operator, profile.id, project.id)
    add_receipt(db, clock, actor=operator, profile=profile.id)
    add_link(db, clock, project=project.id, profile=profile.id, actor=owner)
    await db.flush()
    return world


def add_receipt(db, clock, *, actor, profile):
    db.add(
        MentorReceipt(
            actor_user_id=actor,
            request_id=uuid4(),
            profile_id=profile,
            resource_id=profile,
            action="save",
            fingerprint="b" * 64,
            applied_version=2,
            created_at=clock.now(),
        )
    )


def add_link(db, clock, *, project, profile, actor):
    db.add(
        ProjectMentorLink(
            project_id=project,
            mentor_id=profile,
            requested_by=actor,
            project_snapshot={"title": "清理测试模拟项目"},
            status="ACCEPTED",
            version=2,
            created_at=clock.now(),
            updated_at=clock.now(),
        )
    )


@pytest.fixture
async def worlds(db_session, clock):
    # Both clean_world's commits and failures stay inside the fixture's outer
    # transaction. Even a failing RED cannot leave immutable rows behind.
    local = await seed(db_session, clock)
    other = await seed(db_session, clock)
    await db_session.commit()
    factory = async_sessionmaker(
        bind=db_session.bind,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    return factory, local, other


async def state(factory, *worlds):
    users = [user for world in worlds for user in world.users]
    profiles = [world.profile for world in worlds]
    projects = [world.project for world in worlds]
    scopes = (
        (User, User.id.in_(users)),
        (ProjectDraft, ProjectDraft.id.in_(projects)),
        (MentorProfile, MentorProfile.id.in_(profiles)),
        (MentorConsent, MentorConsent.profile_id.in_(profiles)),
        (MentorRevision, MentorRevision.profile_id.in_(profiles)),
        (MentorReceipt, MentorReceipt.profile_id.in_(profiles)),
        (ProjectMentorLink, ProjectMentorLink.mentor_id.in_(profiles)),
    )
    async with factory() as db:
        return {
            model.__tablename__: (
                await db.execute(
                    select(model.__table__).where(scope).order_by(model.id)
                )
            ).all()
            for model, scope in scopes
        }


async def assert_history_guarded(factory, other):
    async with factory() as db:
        guards = (
            await db.execute(
                text(
                    "SELECT t.tgname, t.tgenabled FROM pg_trigger t "
                    "JOIN pg_class c ON c.oid = t.tgrelid "
                    "WHERE c.relname IN ('ie_mentor_profiles', "
                    "'ie_mentor_consents', 'ie_mentor_revisions', "
                    "'ie_mentor_receipts') AND NOT t.tgisinternal"
                )
            )
        ).all()
        assert len(guards) == 4
        assert all(enabled != "D" for _, enabled in guards)
        with pytest.raises(DBAPIError, match="immutable"):
            await db.execute(
                update(MentorConsent)
                .where(MentorConsent.profile_id == other.profile)
                .values(action="changed")
            )


async def test_cleanup_removes_complete_world_is_idempotent_and_preserves_other(worlds):
    factory, local, other = worlds
    before = await state(factory, other)
    await clean_world(factory, user_ids=local.users)
    assert all(not rows for rows in (await state(factory, local)).values())
    assert await state(factory, other) == before
    await clean_world(factory, user_ids=local.users)
    assert await state(factory, other) == before
    await assert_history_guarded(factory, other)


@pytest.mark.parametrize(
    "edge",
    [
        "local_project_external_mentor",
        "external_project_local_mentor",
        "external_requester_local_link",
        "local_requester_external_link",
        "external_receipt_actor",
        "local_receipt_actor_external_profile",
        "external_consent_actor",
        "local_consent_actor_external_profile",
    ],
)
async def test_cross_world_mentor_edges_refuse_cleanup_atomically(worlds, clock, edge):
    factory, local, other = worlds
    async with factory() as db:
        if edge == "local_project_external_mentor":
            add_link(
                db,
                clock,
                project=local.project,
                profile=other.profile,
                actor=local.owner,
            )
        elif edge == "external_project_local_mentor":
            add_link(
                db,
                clock,
                project=other.project,
                profile=local.profile,
                actor=other.owner,
            )
        elif edge in {"external_requester_local_link", "local_requester_external_link"}:
            target, actor = (
                (local, other.owner)
                if edge.startswith("external")
                else (other, local.owner)
            )
            await db.execute(
                update(ProjectMentorLink)
                .where(ProjectMentorLink.mentor_id == target.profile)
                .values(requested_by=actor)
            )
        elif "receipt" in edge:
            target, actor = (
                (local, other.operator)
                if edge.startswith("external")
                else (other, local.operator)
            )
            add_receipt(db, clock, actor=actor, profile=target.profile)
        else:
            target, actor = (
                (local, other.mentor)
                if edge.startswith("external")
                else (other, local.mentor)
            )
            db.add(
                MentorConsent(
                    id=uuid4(),
                    profile_id=target.profile,
                    actor_user_id=actor,
                    draft_version=2,
                    action="maintenance-scope",
                    scope={},
                    created_at=clock.now(),
                )
            )
        await db.commit()
    before = await state(factory, local, other)
    with pytest.raises(RuntimeError, match="outside this world"):
        await clean_world(factory, user_ids=local.users)
    assert await state(factory, local, other) == before
    await assert_history_guarded(factory, other)
