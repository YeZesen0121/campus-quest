"""Authenticated browsing from confirmed snapshots and separately audited contacts."""

from typing import Any
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.innovation.mentor_common import (
    USERS,
    active_accounts,
    conflict,
    mutation,
    not_found,
)
from app.modules.innovation.mentor_models import MentorProfile, MentorRevision
from app.modules.innovation.mentor_schemas import (
    MentorContactReadCommand,
    MentorContactsResponse,
    MentorQuery,
    PublicMentorListResponse,
    PublicMentorResponse,
    PublicMentorSummary,
)
from app.modules.innovation.public_recruitment_service import pattern


class PublicMentorService:
    def __init__(self, *, clock: Clock, audit: AuditLogWriter | None = None) -> None:
        self.clock = clock
        self.audit = audit if audit is not None else AuditLogWriter()

    @staticmethod
    def query() -> Select[Any]:
        return (
            select(MentorProfile, MentorRevision)
            .join(MentorRevision, MentorRevision.id == MentorProfile.public_revision_id)
            .join(USERS, USERS.c.id == MentorProfile.user_id)
            .where(
                MentorProfile.visibility == "VISIBLE",
                MentorProfile.moderation_state == "NORMAL",
                USERS.c.status == "ACTIVE",
                USERS.c.role.in_(["MENTOR", "TEACHER"]),
            )
        )

    @staticmethod
    def summary(
        profile: MentorProfile, revision: MentorRevision
    ) -> PublicMentorSummary:
        return PublicMentorSummary.model_validate(
            {
                **revision.content,
                "id": profile.id,
                "accepting_contact": profile.accepting_contact,
                "public_version": profile.public_version,
            }
        )

    async def list_visible(
        self, db: AsyncSession, *, actor: Actor, query: MentorQuery
    ) -> PublicMentorListResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            stmt = self.query()
            if query.q:
                stmt = stmt.where(
                    or_(
                        *(
                            MentorRevision.content[key].astext.ilike(
                                pattern(query.q), escape="\\"
                            )
                            for key in (
                                "name",
                                "unit",
                                "introduction",
                                "directions",
                                "project_types",
                            )
                        )
                    )
                )
            if query.direction:
                stmt = stmt.where(
                    MentorRevision.content["directions"].astext.ilike(
                        pattern(query.direction), escape="\\"
                    )
                )
            if query.accepting_contact is not None:
                stmt = stmt.where(
                    MentorProfile.accepting_contact == query.accepting_contact
                )
            total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
            rows = (
                await db.execute(
                    stmt.order_by(MentorProfile.updated_at.desc(), MentorProfile.id)
                    .limit(query.limit)
                    .offset(query.offset)
                )
            ).all()
            return PublicMentorListResponse(
                items=[self.summary(row[0], row[1]) for row in rows],
                total=total or 0,
                limit=query.limit,
                offset=query.offset,
            )

    async def locked_visible(
        self, db: AsyncSession, *, actor: Actor, profile_id: UUID
    ) -> tuple[MentorProfile, MentorRevision]:
        owner_id = await db.scalar(
            select(MentorProfile.user_id).where(MentorProfile.id == profile_id)
        )
        if owner_id is None:
            raise not_found()
        await active_accounts(db, actor, owner_id)
        # Lock the aggregate after accounts, then read its current snapshot. A
        # withdrawal or pause cannot slip between authorization and contact read.
        await db.execute(
            select(MentorProfile.id)
            .where(MentorProfile.id == profile_id)
            .with_for_update()
        )
        row = (
            await db.execute(
                self.query()
                .where(MentorProfile.id == profile_id)
                .execution_options(populate_existing=True)
            )
        ).one_or_none()
        if row is None:
            raise not_found()
        return row[0], row[1]

    async def detail(
        self, db: AsyncSession, *, actor: Actor, profile_id: UUID
    ) -> PublicMentorResponse:
        async with mutation(db):
            row, revision = await self.locked_visible(
                db, actor=actor, profile_id=profile_id
            )
            return PublicMentorResponse.model_validate(
                {
                    "id": row.id,
                    "content": revision.content,
                    "accepting_contact": row.accepting_contact,
                    "contact_channels": [c["channel"] for c in revision.contacts]
                    if row.accepting_contact
                    else [],
                    "public_version": row.public_version,
                    "published_at": revision.created_at,
                }
            )

    async def contacts(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        profile_id: UUID,
        payload: MentorContactReadCommand,
        context: AuditContext,
    ) -> MentorContactsResponse:
        async with mutation(db):
            row, revision = await self.locked_visible(
                db, actor=actor, profile_id=profile_id
            )
            if row.public_version != payload.expected_public_version:
                raise conflict("导师资料或联系授权已变化，请刷新后重新查看")
            if not row.accepting_contact or not revision.contacts:
                raise conflict(
                    "导师当前暂停联系或没有授权渠道", kind="CONTACT_UNAVAILABLE"
                )
            await self.audit.append(
                db,
                actor=actor,
                action="ie.mentor.contacts.read",
                target_type="ie_mentor",
                target_id=str(row.id),
                details={
                    "public_version": row.public_version,
                    "channels": [c["channel"] for c in revision.contacts],
                },
                request_id=context.request_id,
                ip_address=context.ip_address,
            )
            return MentorContactsResponse.model_validate(
                {"public_version": row.public_version, "contacts": revision.contacts}
            )
