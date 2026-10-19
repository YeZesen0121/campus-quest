"""Current-generation material scope; reacquiring ownership revives no old rights."""

from uuid import UUID

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.innovation.transfer_models import TransferredEvidenceGrant


def evidence_scope(actor_id: UUID, *, upload_only: bool = False) -> ColumnElement[bool]:
    own = and_(
        AchievementEvidence.uploaded_by_user_id == actor_id,
        AchievementEvidence.uploaded_owner_generation
        == ProjectDraft.ownership_generation,
    )
    selected = (
        exists()
        .where(
            TransferredEvidenceGrant.project_id == ProjectDraft.id,
            TransferredEvidenceGrant.ownership_generation
            == ProjectDraft.ownership_generation,
            TransferredEvidenceGrant.evidence_id == AchievementEvidence.id,
        )
        .correlate(ProjectDraft, AchievementEvidence)
    )
    return exists(
        select(ProjectDraft.id)
        .join(AchievementDraft, AchievementDraft.project_id == ProjectDraft.id)
        .where(
            AchievementDraft.id == AchievementEvidence.achievement_id,
            ProjectDraft.owner_user_id == actor_id,
            own if upload_only else or_(own, selected),
        )
        .correlate(AchievementEvidence)
    )
