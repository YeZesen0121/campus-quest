"""Explicit consent actions with current authority and service-owned commits."""

from datetime import timedelta
from typing import cast
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation.collaboration_common import (
    lock_project,
    record_participation,
)
from app.modules.innovation.collaboration_models import (
    CollaborationReceipt,
    CollaborationTarget,
    ProjectCollaboration,
)
from app.modules.innovation.collaboration_schemas import (
    CollaborationInviteCommand,
    CollaborationListResponse,
    CollaborationResponse,
    CollaborationVersionCommand,
    Kind,
    Status,
    TargetResolveCommand,
    TargetResponse,
)
from app.modules.innovation.mentor_common import (
    active_accounts,
    conflict,
    fingerprint,
    forbidden,
    mutation,
    not_found,
)


class CollaborationService:
    def __init__(
        self,
        *,
        clock: Clock,
        audit: AuditLogWriter | None = None,
        invitation_days: int = 7,
    ) -> None:
        self.clock = clock
        self.audit = audit or AuditLogWriter()
        self.invitation_period = timedelta(days=invitation_days)

    async def response(
        self, db: AsyncSession, actor: Actor, row: ProjectCollaboration
    ) -> CollaborationResponse:
        nickname = await db.scalar(
            select(User.nickname).where(User.id == row.target_user_id)
        )
        status = (
            "EXPIRED"
            if row.status == "PENDING" and self.clock.now() >= row.expires_at
            else row.status
        )
        return CollaborationResponse(
            id=row.id,
            project_id=row.project_id,
            project_title=row.project_snapshot["title"],
            project_summary=row.project_snapshot["summary"],
            project_direction=row.project_snapshot["direction"],
            target_nickname=nickname or "同学",
            is_target=row.target_user_id == actor.user_id,
            kind=cast(Kind, row.kind),
            status=cast(Status, status),
            public_name=row.public_name,
            division=row.division,
            version=row.version,
            expires_at=row.expires_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    async def record(
        self,
        db: AsyncSession,
        actor: Actor,
        target_id: UUID,
        action: str,
        context: AuditContext,
    ) -> None:
        await self.audit.append(
            db,
            actor=actor,
            action=f"ie.collaboration.{action}",
            target_type="ie_project_collaboration",
            target_id=str(target_id),
            request_id=context.request_id,
            ip_address=context.ip_address,
        )

    async def saved(
        self, db: AsyncSession, actor: Actor, request_id: UUID, digest: str
    ) -> CollaborationReceipt | None:
        row = await db.scalar(
            select(CollaborationReceipt).where(
                CollaborationReceipt.actor_user_id == actor.user_id,
                CollaborationReceipt.request_id == request_id,
            )
        )
        if row is not None and row.fingerprint != digest:
            raise conflict("该请求已用于不同内容，请核对原操作", kind="REQUEST_REUSE")
        return row

    def add_receipt(
        self,
        db: AsyncSession,
        actor: Actor,
        row: ProjectCollaboration,
        request_id: UUID,
        digest: str,
    ) -> None:
        db.add(
            CollaborationReceipt(
                actor_user_id=actor.user_id,
                request_id=request_id,
                resource_id=row.id,
                fingerprint=digest,
                created_at=self.clock.now(),
            )
        )

    async def resolve(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        payload: TargetResolveCommand,
        context: AuditContext,
    ) -> TargetResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            if actor.role != "STUDENT":
                raise forbidden()
            user = (
                await db.execute(
                    select(User.id, User.nickname).where(
                        User.username == payload.account,
                        User.role == "STUDENT",
                        User.status == "ACTIVE",
                    )
                )
            ).one_or_none()
            if user is None or user.id == actor.user_id:
                raise not_found()
            reference = CollaborationTarget(
                actor_user_id=actor.user_id,
                target_user_id=user.id,
                expires_at=self.clock.now() + timedelta(minutes=15),
            )
            db.add(reference)
            await db.flush()
            # Do not put the entered account number into the audit record.
            await self.record(db, actor, reference.id, "resolve", context)
            return TargetResponse(
                target_ref=reference.id,
                nickname=user.nickname,
                expires_at=reference.expires_at,
            )

    async def invite(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: CollaborationInviteCommand,
        context: AuditContext,
    ) -> CollaborationResponse:
        async with mutation(db):
            digest = fingerprint(
                {
                    "action": "invite",
                    "project_id": str(project_id),
                    **payload.model_dump(mode="json"),
                }
            )
            saved = await self.saved(db, actor, payload.request_id, digest)
            if saved:
                await active_accounts(db, actor)
                # A replay reads only the frozen invitation and its current
                # status, even when the inviter has since lost project access.
                row = await db.get(ProjectCollaboration, saved.resource_id)
                if row is None:
                    raise not_found()
                return await self.response(db, actor, row)
            reference = await db.get(CollaborationTarget, payload.target_ref)
            if (
                reference is None
                or reference.actor_user_id != actor.user_id
                or self.clock.now() >= reference.expires_at
            ):
                raise not_found()
            project = await lock_project(
                db, actor, project_id, reference.target_user_id
            )
            saved = await self.saved(db, actor, payload.request_id, digest)
            if saved:
                existing = await db.get(ProjectCollaboration, saved.resource_id)
                if existing is None:
                    raise not_found()
                return await self.response(db, actor, existing)
            if self.clock.now() >= reference.expires_at:
                raise not_found()
            target_role = await db.scalar(
                select(User.role).where(User.id == reference.target_user_id)
            )
            if target_role != "STUDENT" or reference.target_user_id == actor.user_id:
                raise forbidden()
            # Expired candidates no longer block a new round, regardless of
            # whether a worker has run. Accepted consent remains independent.
            pending = await db.scalars(
                select(ProjectCollaboration)
                .where(
                    ProjectCollaboration.project_id == project_id,
                    ProjectCollaboration.target_user_id == reference.target_user_id,
                    ProjectCollaboration.kind == payload.kind,
                    ProjectCollaboration.status == "PENDING",
                )
                .with_for_update()
            )
            for candidate in pending:
                if self.clock.now() < candidate.expires_at:
                    raise conflict(
                        "已有待确认邀请，请先撤销或等待处理", kind="INVITATION_EXISTS"
                    )
                candidate.status = "EXPIRED"
                candidate.version += 1
                candidate.updated_at = self.clock.now()
            if payload.kind == "MANAGER" and await db.scalar(
                select(ProjectCollaboration.id).where(
                    ProjectCollaboration.project_id == project_id,
                    ProjectCollaboration.target_user_id == reference.target_user_id,
                    ProjectCollaboration.kind == "MANAGER",
                    ProjectCollaboration.status == "ACCEPTED",
                )
            ):
                raise conflict("对方已接受共同管理", kind="RELATION_EXISTS")
            await db.flush()
            row = ProjectCollaboration(
                project_id=project_id,
                target_user_id=reference.target_user_id,
                invited_by=actor.user_id,
                kind=payload.kind,
                status="PENDING",
                public_name=payload.public_name,
                division=payload.division,
                project_snapshot={
                    "title": project.title,
                    "summary": project.summary,
                    "direction": project.direction,
                },
                version=1,
                expires_at=self.clock.now() + self.invitation_period,
                created_at=self.clock.now(),
                updated_at=self.clock.now(),
            )
            db.add(row)
            await db.flush()
            self.add_receipt(db, actor, row, payload.request_id, digest)
            await self.record(db, actor, row.id, "invite", context)
            return await self.response(db, actor, row)

    async def act(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        collaboration_id: UUID,
        action: str,
        payload: CollaborationVersionCommand,
        context: AuditContext,
    ) -> CollaborationResponse:
        async with mutation(db):
            identity = (
                await db.execute(
                    select(
                        ProjectCollaboration.project_id,
                        ProjectCollaboration.target_user_id,
                    ).where(ProjectCollaboration.id == collaboration_id)
                )
            ).one_or_none()
            if identity is None:
                raise not_found()
            project = await lock_project(
                db,
                actor,
                identity.project_id,
                identity.target_user_id,
                owner_only=False,
                require_others_active=action == "accept",
            )
            if actor.user_id not in {
                project.owner_user_id,
                identity.target_user_id,
            } or (
                action in {"accept", "reject"}
                and actor.user_id != identity.target_user_id
            ):
                raise forbidden()
            row = await db.scalar(
                select(ProjectCollaboration)
                .where(ProjectCollaboration.id == collaboration_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if row is None:
                raise not_found()
            digest = fingerprint(
                {"action": action, "id": str(row.id), **payload.model_dump(mode="json")}
            )
            if await self.saved(db, actor, payload.request_id, digest):
                return await self.response(db, actor, row)
            if row.version != payload.version:
                raise conflict("邀请或同意已变化，请刷新后重新核对")
            if action in {"accept", "reject"}:
                if row.status != "PENDING":
                    raise conflict(
                        "此邀请已结束，不能再次确认", kind="INVITATION_ENDED"
                    )
                if self.clock.now() >= row.expires_at:
                    raise conflict(
                        "邀请已过期，请联系负责人重新邀请", kind="INVITATION_EXPIRED"
                    )
                if action == "accept":
                    if (
                        await db.scalar(
                            select(User.role).where(User.id == row.target_user_id)
                        )
                        != "STUDENT"
                    ):
                        raise forbidden()
                    previous = await db.scalars(
                        select(ProjectCollaboration)
                        .where(
                            ProjectCollaboration.project_id == row.project_id,
                            ProjectCollaboration.target_user_id == row.target_user_id,
                            ProjectCollaboration.kind == row.kind,
                            ProjectCollaboration.status == "ACCEPTED",
                        )
                        .with_for_update()
                    )
                    for old in previous:
                        old.status = "REVOKED"
                        old.version += 1
                        old.updated_at = self.clock.now()
                    await db.flush()
                    await record_participation(
                        db,
                        project_id=row.project_id,
                        user_id=row.target_user_id,
                        kind=row.kind,
                        now=self.clock.now(),
                    )
                row.status = "ACCEPTED" if action == "accept" else "REJECTED"
            elif action == "revoke":
                if row.status not in {"PENDING", "ACCEPTED"}:
                    raise conflict("此关系已经结束", kind="INVITATION_ENDED")
                # Ending a purpose cancels its unconfirmed replacement too.
                related = await db.scalars(
                    select(ProjectCollaboration)
                    .where(
                        ProjectCollaboration.project_id == row.project_id,
                        ProjectCollaboration.target_user_id == row.target_user_id,
                        ProjectCollaboration.kind == row.kind,
                        ProjectCollaboration.id != row.id,
                        ProjectCollaboration.status.in_(["PENDING", "ACCEPTED"]),
                    )
                    .order_by(ProjectCollaboration.id)
                    .with_for_update()
                )
                for other in related:
                    other.status = "REVOKED"
                    other.version += 1
                    other.updated_at = self.clock.now()
                row.status = "REVOKED"
            else:
                raise forbidden()
            row.version += 1
            row.updated_at = self.clock.now()
            self.add_receipt(db, actor, row, payload.request_id, digest)
            await self.record(db, actor, row.id, action, context)
            return await self.response(db, actor, row)

    async def list_mine(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        limit: int,
        offset: int,
        project_id: UUID | None = None,
    ) -> CollaborationListResponse:
        async with mutation(db):
            if actor.role != "STUDENT":
                raise forbidden()
            query = select(ProjectCollaboration)
            if project_id is not None:
                await lock_project(db, actor, project_id)
                query = query.where(ProjectCollaboration.project_id == project_id)
            else:
                await active_accounts(db, actor)
                # Invited users and former managers need no project edit right.
                query = query.where(
                    or_(
                        ProjectCollaboration.target_user_id == actor.user_id,
                        ProjectCollaboration.invited_by == actor.user_id,
                    )
                )
            total = await db.scalar(select(func.count()).select_from(query.subquery()))
            rows = await db.scalars(
                query.order_by(
                    ProjectCollaboration.updated_at.desc(),
                    ProjectCollaboration.id.desc(),
                )
                .limit(limit)
                .offset(offset)
            )
            return CollaborationListResponse(
                items=[await self.response(db, actor, row) for row in rows],
                total=total or 0,
                limit=limit,
                offset=offset,
            )
