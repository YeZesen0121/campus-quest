"""R6 locks and immutable participation, shared by explicit use cases."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_models import (
    ProjectCollaboration,
    ProjectParticipation,
)
from app.modules.innovation.mentor_common import (
    active_accounts,
    conflict,
    forbidden,
    not_found,
)
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.innovation.review_models import AchievementReviewCase


async def lock_project(
    db: AsyncSession,
    actor: Actor,
    project_id: UUID,
    *others: UUID,
    owner_only: bool = True,
    require_others_active: bool = True,
) -> ProjectDraft:
    owner_id = await db.scalar(
        select(ProjectDraft.owner_user_id).where(ProjectDraft.id == project_id)
    )
    if owner_id is None:
        raise not_found()
    if actor.role != "STUDENT":
        raise forbidden()
    accounts = await active_accounts(
        db, actor, owner_id, *others, require_others_active=require_others_active
    )
    if require_others_active and accounts[owner_id].role != "STUDENT":
        raise not_found()
    project = await db.scalar(
        select(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if project is None:
        raise not_found()
    # Account locks were based on an unlocked identity hint. Never continue
    # using stale ownership after waiting behind a transfer transaction.
    if project.owner_user_id != owner_id:
        raise conflict("项目负责人已变更，请刷新后重新核对", kind="PROJECT_CHANGED")
    if owner_only and project.owner_user_id != actor.user_id:
        raise not_found()
    return project


async def require_project_editor(
    db: AsyncSession, actor: Actor, project_id: UUID
) -> ProjectDraft:
    project = await lock_project(db, actor, project_id, owner_only=False)
    if project.owner_user_id != actor.user_id:
        accepted = await db.scalar(
            select(ProjectCollaboration.id)
            .where(
                ProjectCollaboration.project_id == project_id,
                ProjectCollaboration.target_user_id == actor.user_id,
                ProjectCollaboration.kind == "MANAGER",
                ProjectCollaboration.status == "ACCEPTED",
            )
            .with_for_update()
        )
        if accepted is None:
            raise not_found()
    return project


async def record_participation(
    db: AsyncSession,
    *,
    project_id: UUID,
    user_id: UUID,
    kind: str,
    now: datetime,
) -> None:
    """Called under account and project locks; a fact also releases old claims."""
    await db.execute(
        pg_insert(ProjectParticipation)
        .values(project_id=project_id, user_id=user_id, kind=kind, created_at=now)
        .on_conflict_do_nothing(constraint="uq_ie_participation_fact")
    )
    cases = await db.scalars(
        select(AchievementReviewCase)
        .join(
            AchievementDraft,
            AchievementDraft.id == AchievementReviewCase.achievement_id,
        )
        .where(
            AchievementDraft.project_id == project_id,
            AchievementReviewCase.status == "SUBMITTED",
            AchievementReviewCase.assigned_user_id == user_id,
        )
        .order_by(AchievementReviewCase.id)
        .with_for_update(of=AchievementReviewCase)
        .execution_options(populate_existing=True)
    )
    for case in cases:
        case.assigned_user_id = None
        case.version += 1
