"""Independent consent to display a project association, without project powers."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_common import record_participation
from app.modules.innovation.mentor_common import (
    active_accounts,
    conflict,
    fingerprint,
    forbidden,
    mutation,
    not_found,
    receipt,
)
from app.modules.innovation.mentor_models import (
    MentorProfile,
    MentorRevision,
    ProjectMentorLink,
)
from app.modules.innovation.mentor_schemas import (
    MentorVersionCommand,
    ProjectMentorCreateCommand,
    ProjectMentorListResponse,
    ProjectMentorResponse,
    PublicProjectMentorsResponse,
)
from app.modules.innovation.mentor_service import MentorService
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from app.modules.innovation.public_mentor_service import PublicMentorService
from app.modules.innovation.public_project_service import PublicProjectService
from app.modules.innovation.recruitment_schemas import PublicProjectFilters


class MentorLinkService:
    def __init__(self, *, clock: Clock) -> None:
        self.clock = clock
        self.mentors = MentorService(clock=clock)
        self.public = PublicMentorService(clock=clock)

    async def response(
        self, db: AsyncSession, row: ProjectMentorLink
    ) -> ProjectMentorResponse:
        mentor = await db.get(MentorProfile, row.mentor_id)
        if mentor is None:
            raise not_found()
        revision = (
            await db.get(MentorRevision, mentor.public_revision_id)
            if mentor.public_revision_id
            else None
        )
        return ProjectMentorResponse.model_validate(
            {
                "id": row.id,
                "project_id": row.project_id,
                "mentor_id": row.mentor_id,
                "mentor_name": revision.content["name"]
                if revision
                else mentor.fields["name"],
                "project_title": row.project_snapshot["title"],
                "project_summary": row.project_snapshot["summary"],
                "project_direction": row.project_snapshot["direction"],
                "status": row.status,
                "version": row.version,
                "created_at": row.created_at,
            }
        )

    async def project(
        self,
        db: AsyncSession,
        actor: Actor,
        project_id: UUID,
        *,
        qualified: bool = False,
    ) -> ProjectDraft:
        if actor.role != "STUDENT":
            raise forbidden()
        if qualified:
            state = await db.scalar(
                select(OwnerQualification.status)
                .where(OwnerQualification.user_id == actor.user_id)
                .with_for_update()
            )
            if state != "APPROVED":
                raise forbidden()
        row = await db.scalar(
            select(ProjectDraft)
            .where(
                ProjectDraft.id == project_id,
                ProjectDraft.owner_user_id == actor.user_id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if row is None:
            raise not_found()
        return row

    async def list_owned(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> ProjectMentorListResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            query = select(ProjectMentorLink)
            if project_id:
                await self.project(db, actor, project_id)
                query = query.where(ProjectMentorLink.project_id == project_id)
            else:
                query = query.join(
                    MentorProfile, MentorProfile.id == ProjectMentorLink.mentor_id
                ).where(MentorProfile.user_id == actor.user_id)
            total = await db.scalar(select(func.count()).select_from(query.subquery()))
            rows = await db.scalars(
                query.order_by(
                    ProjectMentorLink.updated_at.desc(), ProjectMentorLink.id
                )
                .limit(limit)
                .offset(offset)
            )
            return ProjectMentorListResponse(
                items=[await self.response(db, row) for row in rows],
                total=total or 0,
                limit=limit,
                offset=offset,
            )

    async def request(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: ProjectMentorCreateCommand,
        context: AuditContext,
    ) -> ProjectMentorResponse:
        async with mutation(db):
            mentor_user = await db.scalar(
                select(MentorProfile.user_id).where(
                    MentorProfile.id == payload.mentor_id
                )
            )
            if mentor_user is None:
                raise not_found()
            accounts = await active_accounts(db, actor, mentor_user)
            if accounts[mentor_user].role not in {"MENTOR", "TEACHER"}:
                raise not_found()
            project = await self.project(db, actor, project_id, qualified=True)
            mentor = await db.scalar(
                select(MentorProfile)
                .where(MentorProfile.id == payload.mentor_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if mentor is None:
                raise not_found()
            digest = fingerprint(
                {
                    "action": "link.request",
                    "project_id": str(project_id),
                    **payload.model_dump(mode="json"),
                }
            )
            saved = await receipt(db, actor, payload.request_id, digest)
            if saved:
                existing = await db.get(ProjectMentorLink, saved.resource_id)
                if existing is None:
                    raise not_found()
                return await self.response(db, existing)
            if mentor.visibility != "VISIBLE" or mentor.moderation_state != "NORMAL":
                raise not_found()
            row = await db.scalar(
                select(ProjectMentorLink)
                .where(
                    ProjectMentorLink.project_id == project_id,
                    ProjectMentorLink.mentor_id == mentor.id,
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if row is not None and row.status in {"PENDING", "ACCEPTED"}:
                raise conflict(
                    "该项目已有待确认或已同意的挂名，请查看当前状态", kind="LINK_EXISTS"
                )
            snapshot = {
                "title": project.title,
                "summary": project.summary,
                "direction": project.direction,
            }
            if row is None:
                row = ProjectMentorLink(
                    project_id=project_id,
                    mentor_id=mentor.id,
                    requested_by=actor.user_id,
                    project_snapshot=snapshot,
                    status="PENDING",
                    version=1,
                    created_at=self.clock.now(),
                    updated_at=self.clock.now(),
                )
                db.add(row)
                await db.flush()
            else:
                row.status = "PENDING"
                row.project_snapshot = snapshot
                row.requested_by = actor.user_id
                row.version += 1
                row.updated_at = self.clock.now()
            self.mentors.add_receipt(
                db,
                actor,
                mentor,
                payload.request_id,
                digest,
                "link.request",
                resource_id=row.id,
                version=row.version,
            )
            await self.audit(db, actor, row, "request", context)
            return await self.response(db, row)

    async def act(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        link_id: UUID,
        action: str,
        payload: MentorVersionCommand,
        context: AuditContext,
    ) -> ProjectMentorResponse:
        async with mutation(db):
            identity = (
                await db.execute(
                    select(
                        ProjectMentorLink.project_id,
                        ProjectMentorLink.mentor_id,
                        MentorProfile.user_id,
                        ProjectDraft.owner_user_id,
                    )
                    .join(
                        MentorProfile, MentorProfile.id == ProjectMentorLink.mentor_id
                    )
                    .join(ProjectDraft, ProjectDraft.id == ProjectMentorLink.project_id)
                    .where(ProjectMentorLink.id == link_id)
                )
            ).one_or_none()
            if identity is None:
                raise not_found()
            if actor.user_id not in {identity.user_id, identity.owner_user_id} or (
                action in {"accept", "reject"} and actor.user_id != identity.user_id
            ):
                raise forbidden()
            accounts = await active_accounts(
                db,
                actor,
                identity.user_id,
                identity.owner_user_id,
                require_others_active=action == "accept",
            )
            if action == "accept" and accounts[identity.user_id].role not in {
                "MENTOR",
                "TEACHER",
            }:
                raise forbidden()
            # All link changes follow accounts -> project -> mentor -> link.
            # Withdrawal locks the mentor before links, and account locks
            # serialize it with this path before either takes a project lock.
            current_owner = await db.scalar(
                select(ProjectDraft.owner_user_id)
                .where(ProjectDraft.id == identity.project_id)
                .with_for_update()
            )
            if current_owner != identity.owner_user_id:
                raise conflict(
                    "项目负责人已变化，请刷新后重新核对", kind="PROJECT_CHANGED"
                )
            mentor = await db.scalar(
                select(MentorProfile)
                .where(MentorProfile.id == identity.mentor_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            row = await db.scalar(
                select(ProjectMentorLink)
                .where(ProjectMentorLink.id == link_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if row is None or mentor is None:
                raise not_found()
            digest = fingerprint(
                {
                    "action": f"link.{action}",
                    "link_id": str(link_id),
                    **payload.model_dump(mode="json"),
                }
            )
            saved = await receipt(db, actor, payload.request_id, digest)
            if saved:
                return await self.response(db, row)
            if row.version != payload.version:
                raise conflict("挂名确认已变化，请刷新后重新核对")
            if action in {"accept", "reject"}:
                if row.status != "PENDING":
                    raise conflict("当前没有待确认的项目挂名")
                if action == "accept" and (
                    mentor.visibility != "VISIBLE"
                    or mentor.moderation_state != "NORMAL"
                ):
                    raise conflict("请先确认导师档案并恢复可展示状态")
                row.status = "ACCEPTED" if action == "accept" else "REJECTED"
            elif action == "revoke":
                if row.status not in {"PENDING", "ACCEPTED"}:
                    raise conflict("该挂名已经结束")
                row.status = "REVOKED"
            else:
                raise forbidden()
            if action == "accept":
                await record_participation(
                    db,
                    project_id=row.project_id,
                    user_id=identity.user_id,
                    kind="MENTOR",
                    now=self.clock.now(),
                )
            row.version += 1
            row.updated_at = self.clock.now()
            self.mentors.add_receipt(
                db,
                actor,
                mentor,
                payload.request_id,
                digest,
                f"link.{action}",
                resource_id=row.id,
                version=row.version,
            )
            await self.audit(db, actor, row, action, context)
            return await self.response(db, row)

    async def audit(
        self,
        db: AsyncSession,
        actor: Actor,
        row: ProjectMentorLink,
        action: str,
        context: AuditContext,
    ) -> None:
        await self.mentors.audit.append(
            db,
            actor=actor,
            action=f"ie.mentor.link.{action}",
            target_type="ie_project_mentor",
            target_id=str(row.id),
            details={
                "project_id": str(row.project_id),
                "mentor_id": str(row.mentor_id),
                "version": row.version,
                "status": row.status,
            },
            request_id=context.request_id,
            ip_address=context.ip_address,
        )

    async def public_links(
        self, db: AsyncSession, *, actor: Actor, project_id: UUID
    ) -> PublicProjectMentorsResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            await db.execute(
                select(ProjectDraft.id)
                .where(ProjectDraft.id == project_id)
                .with_for_update()
            )
            query = PublicProjectService(clock=self.clock).query(PublicProjectFilters())
            exists = (
                await db.execute(query.where(query.selected_columns.id == project_id))
            ).first()
            if exists is None:
                raise not_found()
            rows = (
                await db.execute(
                    self.public.query()
                    .join(
                        ProjectMentorLink,
                        ProjectMentorLink.mentor_id == MentorProfile.id,
                    )
                    .where(
                        ProjectMentorLink.project_id == project_id,
                        ProjectMentorLink.status == "ACCEPTED",
                    )
                    .order_by(MentorProfile.id)
                )
            ).all()
            return PublicProjectMentorsResponse(
                items=[self.public.summary(row[0], row[1]) for row in rows]
            )
