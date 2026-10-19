"""Guarded, atomic cleanup of a complete collaboration test world only."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import and_, delete, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.innovation.collaboration_models import (
    CollaborationReceipt,
    CollaborationTarget,
    ProjectCollaboration,
    ProjectParticipation,
    WorkspaceCommandReceipt,
)
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.lifecycle_models import (
    LifecycleReceipt,
    ProjectIntroduction,
)
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.innovation.transfer_models import (
    ProjectTransfer,
    TransferReceipt,
    TransferredEvidenceGrant,
)
from tests.integration.db_guard import require_test_database


async def clean_collaboration_world(db: AsyncSession, users: Sequence[UUID]) -> None:
    if not users:
        return
    require_test_database(get_settings().database_url)
    require_test_database(str(db.get_bind().engine.url))
    projects = select(ProjectDraft.id).where(ProjectDraft.owner_user_id.in_(users))
    collaborations = select(ProjectCollaboration.id).where(
        ProjectCollaboration.project_id.in_(projects)
    )
    transfers = select(ProjectTransfer.id).where(
        ProjectTransfer.project_id.in_(projects)
    )
    achievements = select(AchievementDraft.id).where(
        AchievementDraft.project_id.in_(projects)
    )
    proofs = select(AchievementEvidence.id).where(
        AchievementEvidence.achievement_id.in_(achievements)
    )
    boundaries = (
        (
            ProjectIntroduction,
            (
                ProjectIntroduction.project_id.in_(projects),
                ProjectIntroduction.created_by.in_(users),
            ),
        ),
        (
            LifecycleReceipt,
            (
                LifecycleReceipt.project_id.in_(projects),
                LifecycleReceipt.actor_user_id.in_(users),
            ),
        ),
        (
            AchievementEvidence,
            (
                AchievementEvidence.achievement_id.in_(achievements),
                AchievementEvidence.uploaded_by_user_id.in_(users),
            ),
        ),
        (
            ProjectTransfer,
            (
                ProjectTransfer.project_id.in_(projects),
                ProjectTransfer.from_user_id.in_(users),
                ProjectTransfer.target_user_id.in_(users),
            ),
        ),
        (
            TransferReceipt,
            (
                TransferReceipt.transfer_id.in_(transfers),
                TransferReceipt.actor_user_id.in_(users),
            ),
        ),
        (
            TransferredEvidenceGrant,
            (
                TransferredEvidenceGrant.project_id.in_(projects),
                TransferredEvidenceGrant.transfer_id.in_(transfers),
                TransferredEvidenceGrant.evidence_id.in_(proofs),
            ),
        ),
        (
            ProjectDraft,
            (
                ProjectDraft.owner_user_id.in_(users),
                ProjectDraft.creator_user_id.in_(users),
            ),
        ),
        (
            ProjectCollaboration,
            (
                ProjectCollaboration.project_id.in_(projects),
                ProjectCollaboration.target_user_id.in_(users),
                ProjectCollaboration.invited_by.in_(users),
            ),
        ),
        (
            ProjectParticipation,
            (
                ProjectParticipation.project_id.in_(projects),
                ProjectParticipation.user_id.in_(users),
            ),
        ),
        (
            CollaborationReceipt,
            (
                CollaborationReceipt.resource_id.in_(collaborations),
                CollaborationReceipt.actor_user_id.in_(users),
            ),
        ),
        (
            WorkspaceCommandReceipt,
            (
                WorkspaceCommandReceipt.project_id.in_(projects),
                WorkspaceCommandReceipt.actor_user_id.in_(users),
            ),
        ),
        (
            CollaborationTarget,
            (
                CollaborationTarget.actor_user_id.in_(users),
                CollaborationTarget.target_user_id.in_(users),
            ),
        ),
    )
    for model, scopes in boundaries:
        external = await db.scalar(
            select(model.id).where(or_(*scopes), ~and_(*scopes)).limit(1)
        )
        if external is not None:
            raise RuntimeError(
                "Collaboration relationship or history belongs outside this world; "
                "include all participants explicitly before cleanup"
            )
    # All boundaries were checked before the first delete. DDL and data stay
    # in clean_world's transaction, so failures restore both history guards
    # and rows; no production API can disable these triggers.
    # Release only checked world's cyclic public pointer before immutable
    # introduction rows; all boundary checks above precede this first write.
    await db.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id.in_(projects))
        .values(public_introduction_id=None)
    )
    for model, scope in (
        (LifecycleReceipt, LifecycleReceipt.project_id.in_(projects)),
        (ProjectIntroduction, ProjectIntroduction.project_id.in_(projects)),
        (TransferredEvidenceGrant, TransferredEvidenceGrant.project_id.in_(projects)),
        (TransferReceipt, TransferReceipt.transfer_id.in_(transfers)),
        (WorkspaceCommandReceipt, WorkspaceCommandReceipt.project_id.in_(projects)),
        (CollaborationReceipt, CollaborationReceipt.resource_id.in_(collaborations)),
        (ProjectParticipation, ProjectParticipation.project_id.in_(projects)),
    ):
        table = model.__tablename__
        await db.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER USER"))
        await db.execute(delete(model).where(scope))
        await db.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER USER"))
    await db.execute(
        delete(ProjectTransfer).where(ProjectTransfer.project_id.in_(projects))
    )
    await db.execute(
        delete(ProjectCollaboration).where(
            ProjectCollaboration.project_id.in_(projects)
        )
    )
    await db.execute(
        delete(CollaborationTarget).where(
            CollaborationTarget.actor_user_id.in_(users),
            CollaborationTarget.target_user_id.in_(users),
        )
    )
