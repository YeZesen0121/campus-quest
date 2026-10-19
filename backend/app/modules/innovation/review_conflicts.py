"""One SQL predicate for declared conflicts and immutable participation."""

from uuid import UUID

from sqlalchemy import SQLColumnExpression, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.modules.innovation.collaboration_models import ProjectParticipation
from app.modules.innovation.review_models import ReviewConflict


def review_conflict_exists(
    project_id: UUID | SQLColumnExpression[UUID],
    user_id: UUID | SQLColumnExpression[UUID],
) -> ColumnElement[bool]:
    declared = (
        select(ReviewConflict.user_id)
        .where(
            ReviewConflict.project_id == project_id, ReviewConflict.user_id == user_id
        )
        .correlate_except(ReviewConflict)
        .exists()
    )
    participated = (
        select(ProjectParticipation.user_id)
        .where(
            ProjectParticipation.project_id == project_id,
            ProjectParticipation.user_id == user_id,
        )
        .correlate_except(ProjectParticipation)
        .exists()
    )
    return or_(declared, participated)
