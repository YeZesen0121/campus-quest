"""Archive visibility retains original governance without reopening its source."""

from sqlalchemy import Select, exists, or_, select

from app.modules.identity.models import User
from app.modules.innovation.lifecycle_models import ProjectIntroduction
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from app.modules.innovation.recruitment_models import RecruitmentDraft
from app.modules.innovation.review_models import AchievementWorkflow


def visible_introductions() -> Select[tuple[ProjectIntroduction]]:
    achievement = (
        exists()
        .where(
            AchievementWorkflow.achievement_id == ProjectIntroduction.achievement_id,
            AchievementWorkflow.first_review_state == "APPROVED",
            AchievementWorkflow.moderation_state == "NORMAL",
        )
        .correlate(ProjectIntroduction)
    )
    recruitment = (
        exists()
        .where(
            RecruitmentDraft.id == ProjectIntroduction.recruitment_id,
            RecruitmentDraft.moderation_state == "NORMAL",
        )
        .correlate(ProjectIntroduction)
    )
    # The recruitment source's existing owner-account/qualification boundary
    # remains applicable; status, deadline and contact grants are not reopened.
    owner_available = exists(
        select(User.id)
        .join(OwnerQualification, OwnerQualification.user_id == User.id)
        .where(
            User.id == ProjectDraft.owner_user_id,
            User.status == "ACTIVE",
            User.role == "STUDENT",
            OwnerQualification.status == "APPROVED",
        )
    ).correlate(ProjectDraft)
    return (
        select(ProjectIntroduction)
        .join(ProjectDraft, ProjectDraft.id == ProjectIntroduction.project_id)
        .where(
            ProjectDraft.public_introduction_id == ProjectIntroduction.id,
            ProjectDraft.introduction_moderation_state == "NORMAL",
            or_(achievement, recruitment & owner_available),
        )
    )
