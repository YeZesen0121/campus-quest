"""Test-only mentor teardown, scoped to all participants in the same world."""

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import and_, delete, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.innovation.mentor_models import (
    MentorConsent,
    MentorProfile,
    MentorReceipt,
    MentorRevision,
    ProjectMentorLink,
)
from app.modules.innovation.models import ProjectDraft
from tests.integration.db_guard import require_test_database


async def clean_mentor_world(db: AsyncSession, users: Sequence[UUID]) -> None:
    """Use the caller's transaction; never broaden scope to absorb outsiders.

    Disabling history triggers is exclusively a guarded test operation. A later
    failure in clean_world rolls these DDL changes back with the row changes.
    """
    if not users:
        return
    require_test_database(get_settings().database_url)
    require_test_database(str(db.get_bind().engine.url))

    profiles = select(MentorProfile.id).where(MentorProfile.user_id.in_(users))
    projects = select(ProjectDraft.id).where(ProjectDraft.owner_user_id.in_(users))
    link_scopes = (
        ProjectMentorLink.project_id.in_(projects),
        ProjectMentorLink.mentor_id.in_(profiles),
        ProjectMentorLink.requested_by.in_(users),
    )
    # Each link has three owners; each historical action has both an actor
    # and a profile owner. Either endpoint in this world requires all of them.
    boundaries = [
        (ProjectMentorLink, link_scopes),
        (
            MentorReceipt,
            (
                MentorReceipt.profile_id.in_(profiles),
                MentorReceipt.actor_user_id.in_(users),
            ),
        ),
        (
            MentorConsent,
            (
                MentorConsent.profile_id.in_(profiles),
                MentorConsent.actor_user_id.in_(users),
            ),
        ),
    ]
    for model, scopes in boundaries:
        external = await db.scalar(
            select(model.id).where(or_(*scopes), ~and_(*scopes)).limit(1)
        )
        if external is not None:
            raise RuntimeError(
                "Mentor relationship or history belongs outside this world; "
                "include all participants explicitly before cleanup"
            )

    await db.execute(
        update(MentorProfile)
        .where(MentorProfile.user_id.in_(users))
        .values(visibility="HIDDEN", public_revision_id=None)
    )
    await db.execute(delete(ProjectMentorLink).where(*link_scopes))
    for model, scope in (
        (
            MentorReceipt,
            and_(
                MentorReceipt.profile_id.in_(profiles),
                MentorReceipt.actor_user_id.in_(users),
            ),
        ),
        (MentorRevision, MentorRevision.profile_id.in_(profiles)),
        (
            MentorConsent,
            and_(
                MentorConsent.profile_id.in_(profiles),
                MentorConsent.actor_user_id.in_(users),
            ),
        ),
    ):
        table = model.__tablename__
        await db.execute(text(f"ALTER TABLE {table} DISABLE TRIGGER USER"))
        await db.execute(delete(model).where(scope))
        await db.execute(text(f"ALTER TABLE {table} ENABLE TRIGGER USER"))
    await db.execute(delete(MentorProfile).where(MentorProfile.user_id.in_(users)))
