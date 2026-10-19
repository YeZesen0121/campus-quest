"""New immutable collaboration rows are cleaned only with all owners present."""

from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, update
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.modules.innovation.collaboration_models import (
    CollaborationReceipt,
    CollaborationTarget,
    ProjectCollaboration,
    ProjectParticipation,
    WorkspaceCommandReceipt,
)
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.innovation.transfer_models import (
    ProjectTransfer,
    TransferReceipt,
    TransferredEvidenceGrant,
)
from tests.e2e.factories import clean_world
from tests.integration.innovation.talent_support import clock as clock
from tests.integration.innovation.test_mentor_world_cleanup import seed as mentor_seed
from tests.integration.innovation.test_mentor_world_cleanup import state as mentor_state

pytestmark = pytest.mark.integration


async def seed(db, clock):
    world = await mentor_seed(db, clock)
    achievement = AchievementDraft(
        project_id=world.project,
        creation_request_id=uuid4(),
        creation_payload_fingerprint="c" * 64,
        title="清理测试成果",
    )
    candidate = ProjectCollaboration(
        project_id=world.project,
        target_user_id=world.operator,
        invited_by=world.owner,
        kind="MEMBER",
        status="ACCEPTED",
        public_name="模拟成员",
        division="调研",
        project_snapshot={"title": "模拟"},
        version=2,
        expires_at=clock.now() + timedelta(days=7),
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db.add_all([achievement, candidate])
    await db.flush()
    db.add_all(
        [
            ProjectParticipation(
                project_id=world.project,
                user_id=world.mentor,
                kind="MENTOR",
                created_at=clock.now(),
            ),
            CollaborationReceipt(
                actor_user_id=world.operator,
                request_id=uuid4(),
                resource_id=candidate.id,
                fingerprint="d" * 64,
                created_at=clock.now(),
            ),
            WorkspaceCommandReceipt(
                actor_user_id=world.operator,
                request_id=uuid4(),
                project_id=world.project,
                achievement_id=achievement.id,
                action="ACHIEVEMENT_SAVE",
                fingerprint="e" * 64,
                applied_version=2,
                created_at=clock.now(),
            ),
            CollaborationTarget(
                actor_user_id=world.owner,
                target_user_id=world.operator,
                expires_at=clock.now() + timedelta(minutes=15),
            ),
        ]
    )
    await db.flush()
    proof = AchievementEvidence(
        achievement_id=achievement.id,
        creation_request_id=uuid4(),
        creation_payload_fingerprint="a" * 64,
        object_key=f"cleanup/{uuid4()}",
        content_type="application/pdf",
        size=1,
        state="PENDING",
        upload_url="fixture-not-url",
        client_headers={},
        upload_expires_at=clock.now() + timedelta(minutes=10),
        expires_at=clock.now() + timedelta(minutes=15),
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    transfer = ProjectTransfer(
        project_id=world.project,
        from_user_id=world.owner,
        target_user_id=world.operator,
        from_generation=1,
        creation_request_id=uuid4(),
        creation_fingerprint="b" * 64,
        evidence_snapshot=[],
        initial_snapshot={},
        allow_preview=False,
        status="ACCEPTED",
        version=2,
        expires_at=clock.now() + timedelta(days=7),
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db.add_all([proof, transfer])
    await db.flush()
    db.add_all(
        [
            TransferReceipt(
                actor_user_id=world.operator,
                request_id=uuid4(),
                transfer_id=transfer.id,
                fingerprint="c" * 64,
                created_at=clock.now(),
            ),
            TransferredEvidenceGrant(
                project_id=world.project,
                ownership_generation=2,
                evidence_id=proof.id,
                transfer_id=transfer.id,
                created_at=clock.now(),
            ),
        ]
    )
    return world


@pytest.fixture
async def worlds(db_session, clock):
    local, other = await seed(db_session, clock), await seed(db_session, clock)
    await db_session.commit()
    factory = async_sessionmaker(
        bind=db_session.bind,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    return factory, local, other


async def state(factory, *worlds):
    projects = [w.project for w in worlds]
    users = [user for w in worlds for user in w.users]
    scopes = (
        (
            AchievementEvidence,
            AchievementEvidence.achievement_id.in_(
                select(AchievementDraft.id).where(
                    AchievementDraft.project_id.in_(projects)
                )
            ),
        ),
        (ProjectTransfer, ProjectTransfer.project_id.in_(projects)),
        (TransferReceipt, TransferReceipt.actor_user_id.in_(users)),
        (TransferredEvidenceGrant, TransferredEvidenceGrant.project_id.in_(projects)),
        (AchievementDraft, AchievementDraft.project_id.in_(projects)),
        (ProjectCollaboration, ProjectCollaboration.project_id.in_(projects)),
        (ProjectParticipation, ProjectParticipation.project_id.in_(projects)),
        (CollaborationReceipt, CollaborationReceipt.actor_user_id.in_(users)),
        (WorkspaceCommandReceipt, WorkspaceCommandReceipt.project_id.in_(projects)),
        (CollaborationTarget, CollaborationTarget.actor_user_id.in_(users)),
    )
    result = await mentor_state(factory, *worlds)
    async with factory() as db:
        result.update(
            {
                model.__tablename__: (
                    await db.execute(
                        select(model.__table__).where(scope).order_by(model.id)
                    )
                ).all()
                for model, scope in scopes
            }
        )
    return result


async def test_cleanup_removes_new_graph_preserves_other_world_and_history_guards(
    worlds,
):
    factory, local, other = worlds
    before = await state(factory, other)
    await clean_world(factory, user_ids=local.users)
    assert all(not rows for rows in (await state(factory, local)).values())
    assert await state(factory, other) == before
    await clean_world(factory, user_ids=local.users)
    assert await state(factory, other) == before
    async with factory() as db:
        for model, scope, values in (
            (
                ProjectTransfer,
                ProjectTransfer.project_id == other.project,
                {"allow_preview": True},
            ),
            (
                TransferReceipt,
                TransferReceipt.actor_user_id.in_(other.users),
                {"fingerprint": "f" * 64},
            ),
            (
                TransferredEvidenceGrant,
                TransferredEvidenceGrant.project_id == other.project,
                {"ownership_generation": 3},
            ),
            (
                ProjectParticipation,
                ProjectParticipation.project_id == other.project,
                {"kind": "OWNER"},
            ),
            (
                WorkspaceCommandReceipt,
                WorkspaceCommandReceipt.project_id == other.project,
                {"fingerprint": "f" * 64},
            ),
            (
                ProjectCollaboration,
                ProjectCollaboration.project_id == other.project,
                {"public_name": "不得改写"},
            ),
        ):
            with pytest.raises(DBAPIError):
                async with db.begin_nested():
                    await db.execute(update(model).where(scope).values(**values))


@pytest.mark.parametrize(
    "edge",
    [
        "participation_user",
        "participation_project",
        "receipt_actor",
        "receipt_project",
        "candidate_target",
        "target_reference",
        "creator",
        "transfer_target",
        "transfer_receipt",
        "proof_origin",
        "grant_proof",
    ],
)
async def test_cross_world_collaboration_edges_refuse_cleanup_atomically(
    worlds, clock, edge
):
    factory, local, other = worlds
    async with factory() as db:
        if edge == "transfer_target":
            db.add(
                ProjectTransfer(
                    project_id=local.project,
                    from_user_id=local.owner,
                    target_user_id=other.operator,
                    from_generation=1,
                    creation_request_id=uuid4(),
                    creation_fingerprint="b" * 64,
                    evidence_snapshot=[],
                    initial_snapshot={},
                    allow_preview=False,
                    status="PENDING",
                    version=1,
                    expires_at=clock.now() + timedelta(days=7),
                    created_at=clock.now(),
                    updated_at=clock.now(),
                )
            )
        elif edge == "transfer_receipt":
            transfer_id = await db.scalar(
                select(ProjectTransfer.id).where(
                    ProjectTransfer.project_id == local.project
                )
            )
            db.add(
                TransferReceipt(
                    actor_user_id=other.operator,
                    request_id=uuid4(),
                    transfer_id=transfer_id,
                    fingerprint="c" * 64,
                    created_at=clock.now(),
                )
            )
        elif edge == "proof_origin":
            achievement_id = await db.scalar(
                select(AchievementDraft.id).where(
                    AchievementDraft.project_id == local.project
                )
            )
            db.add(
                AchievementEvidence(
                    achievement_id=achievement_id,
                    uploaded_by_user_id=other.owner,
                    uploaded_owner_generation=1,
                    creation_request_id=uuid4(),
                    creation_payload_fingerprint="a" * 64,
                    object_key=f"cleanup-cross/{uuid4()}",
                    content_type="application/pdf",
                    size=1,
                    state="PENDING",
                    upload_url="fixture-not-url",
                    client_headers={},
                    upload_expires_at=clock.now() + timedelta(minutes=10),
                    expires_at=clock.now() + timedelta(minutes=15),
                    created_at=clock.now(),
                    updated_at=clock.now(),
                )
            )
        elif edge == "grant_proof":
            proof_id = await db.scalar(
                select(AchievementEvidence.id)
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementEvidence.achievement_id,
                )
                .where(AchievementDraft.project_id == other.project)
            )
            transfer_id = await db.scalar(
                select(ProjectTransfer.id).where(
                    ProjectTransfer.project_id == local.project
                )
            )
            db.add(
                TransferredEvidenceGrant(
                    project_id=local.project,
                    ownership_generation=3,
                    evidence_id=proof_id,
                    transfer_id=transfer_id,
                    created_at=clock.now(),
                )
            )
        elif edge.startswith("participation"):
            project_id, user_id = (
                (local.project, other.operator)
                if edge.endswith("user")
                else (other.project, local.operator)
            )
            db.add(
                ProjectParticipation(
                    project_id=project_id,
                    user_id=user_id,
                    kind="MEMBER",
                    created_at=clock.now(),
                )
            )
        elif edge.startswith("receipt"):
            project_id, actor_id = (
                (local.project, other.operator)
                if edge.endswith("actor")
                else (other.project, local.operator)
            )
            db.add(
                WorkspaceCommandReceipt(
                    project_id=project_id,
                    actor_user_id=actor_id,
                    request_id=uuid4(),
                    action="PROJECT_SAVE",
                    fingerprint="a" * 64,
                    applied_version=1,
                    created_at=clock.now(),
                )
            )
        elif edge == "candidate_target":
            db.add(
                ProjectCollaboration(
                    project_id=local.project,
                    target_user_id=other.operator,
                    invited_by=local.owner,
                    kind="MANAGER",
                    status="PENDING",
                    project_snapshot={"title": "模拟"},
                    version=1,
                    expires_at=clock.now() + timedelta(days=7),
                    created_at=clock.now(),
                    updated_at=clock.now(),
                )
            )
        elif edge == "target_reference":
            db.add(
                CollaborationTarget(
                    actor_user_id=local.owner,
                    target_user_id=other.operator,
                    expires_at=clock.now() + timedelta(minutes=15),
                )
            )
        else:
            await db.execute(
                update(ProjectDraft)
                .where(ProjectDraft.id == local.project)
                .values(owner_user_id=other.owner)
            )
        await db.commit()
    before = await state(factory, local, other)
    with pytest.raises(RuntimeError, match="outside this world"):
        await clean_world(factory, user_ids=local.users)
    assert await state(factory, local, other) == before
