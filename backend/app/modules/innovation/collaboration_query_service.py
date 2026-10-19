"""Purpose-scoped personal lists and public names from current valid consent."""

from uuid import UUID

from sqlalchemy import false, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation.collaboration_models import ProjectCollaboration
from app.modules.innovation.collaboration_schemas import (
    PersonalProjectListResponse,
    PersonalProjectSummary,
    ProjectRole,
    PublicProjectMember,
    PublicProjectMembersResponse,
)
from app.modules.innovation.mentor_common import (
    active_accounts,
    forbidden,
    mutation,
    not_found,
)
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from app.modules.innovation.public_project_service import PublicProjectService
from app.modules.innovation.recruitment_schemas import PublicProjectFilters


class CollaborationQueryService:
    def __init__(self, *, clock: Clock, audit: AuditLogWriter | None = None) -> None:
        self.clock = clock
        self.audit = audit or AuditLogWriter()

    async def list_projects(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        role: ProjectRole,
        limit: int,
        offset: int,
        context: AuditContext,
    ) -> PersonalProjectListResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            if actor.role != "STUDENT":
                raise forbidden()
            query = select(
                ProjectDraft, ProjectCollaboration, User.status, User.role
            ).join(User, User.id == ProjectDraft.owner_user_id)
            if role == "OWNER":
                query = query.outerjoin(ProjectCollaboration, false()).where(
                    ProjectDraft.owner_user_id == actor.user_id
                )
            else:
                query = query.join(
                    ProjectCollaboration,
                    ProjectCollaboration.project_id == ProjectDraft.id,
                ).where(
                    ProjectCollaboration.target_user_id == actor.user_id,
                    ProjectCollaboration.kind == role,
                    ProjectCollaboration.status == "ACCEPTED",
                )
                if role == "MANAGER":
                    query = query.where(ProjectDraft.owner_user_id != actor.user_id)
            total = await db.scalar(select(func.count()).select_from(query.subquery()))
            rows = (
                await db.execute(
                    query.order_by(
                        ProjectDraft.updated_at.desc(), ProjectDraft.id.desc()
                    )
                    .limit(limit)
                    .offset(offset)
                )
            ).all()
            ids = [row[0].id for row in rows]
            public = (
                PublicProjectService(clock=self.clock)
                .query(PublicProjectFilters())
                .subquery()
            )
            visible = (
                set(await db.scalars(select(public.c.id).where(public.c.id.in_(ids))))
                if ids
                else set()
            )
            owner_ids = {row[0].owner_user_id for row in rows}
            qualified = set(
                await db.scalars(
                    select(OwnerQualification.user_id).where(
                        OwnerQualification.user_id.in_({actor.user_id, *owner_ids}),
                        OwnerQualification.status == "APPROVED",
                    )
                )
            )
            items = []
            for project, relation, owner_status, owner_role in rows:
                can_edit = (
                    role != "MEMBER"
                    and owner_status == "ACTIVE"
                    and owner_role == "STUDENT"
                )
                frozen = relation.project_snapshot if relation is not None else {}
                items.append(
                    PersonalProjectSummary(
                        project_id=project.id,
                        collaboration_id=relation.id if relation is not None else None,
                        role=role,
                        title=project.title
                        if can_edit
                        else frozen.get("title", "项目"),
                        summary=project.summary
                        if can_edit
                        else frozen.get("summary", ""),
                        direction=project.direction
                        if can_edit
                        else frozen.get("direction", ""),
                        public_name=relation.public_name
                        if relation is not None
                        else None,
                        division=relation.division if relation is not None else None,
                        can_edit=can_edit,
                        can_publish_recruitment=can_edit
                        and {actor.user_id, project.owner_user_id}.issubset(qualified),
                        can_open_public=project.id in visible,
                    )
                )
            await self.audit.append(
                db,
                actor=actor,
                action="ie.collaboration.projects.read",
                target_type="ie_personal_projects",
                target_id=str(actor.user_id),
                details={"role": role, "limit": limit, "offset": offset},
                request_id=context.request_id,
                ip_address=context.ip_address,
            )
            return PersonalProjectListResponse(
                items=items, total=total or 0, limit=limit, offset=offset
            )

    async def public_members(
        self, db: AsyncSession, *, actor: Actor, project_id: UUID
    ) -> PublicProjectMembersResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            # Source visibility and consent must be read under the same project
            # lock used by recruitment, consent and ownership transitions.
            await db.execute(
                select(ProjectDraft.id)
                .where(ProjectDraft.id == project_id)
                .with_for_update()
            )
            public = (
                PublicProjectService(clock=self.clock)
                .query(PublicProjectFilters())
                .subquery()
            )
            if (
                await db.scalar(select(public.c.id).where(public.c.id == project_id))
                is None
            ):
                raise not_found()
            members = await db.scalars(
                select(ProjectCollaboration)
                .join(User, User.id == ProjectCollaboration.target_user_id)
                .where(
                    ProjectCollaboration.project_id == project_id,
                    ProjectCollaboration.kind == "MEMBER",
                    ProjectCollaboration.status == "ACCEPTED",
                    User.status == "ACTIVE",
                )
                .order_by(ProjectCollaboration.created_at, ProjectCollaboration.id)
            )
            items = []
            for member in members:
                if member.public_name is None or member.division is None:
                    raise RuntimeError("Confirmed member has no consent fields")
                items.append(
                    PublicProjectMember(
                        public_name=member.public_name, division=member.division
                    )
                )
            return PublicProjectMembersResponse(items=items)
