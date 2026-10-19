"""Shared project text only; other workflows keep their own authority checks."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.innovation.achievement_service import _FIELDS as ACHIEVEMENT_FIELDS
from app.modules.innovation.achievement_service import _response as achievement_response
from app.modules.innovation.collaboration_common import require_project_editor
from app.modules.innovation.collaboration_models import WorkspaceCommandReceipt
from app.modules.innovation.collaboration_schemas import (
    CollaborationAchievementSaveCommand,
    CollaborationProjectSaveCommand,
    ProjectWorkspaceResponse,
    WorkspaceAchievementSaveResult,
)
from app.modules.innovation.mentor_common import (
    conflict,
    fingerprint,
    mutation,
    not_found,
)
from app.modules.innovation.models import (
    AchievementDraft,
    OwnerQualification,
    ProjectDraft,
)
from app.modules.innovation.service import _response
from app.modules.innovation.workflow_guards import require_editable


class CollaborationWorkspaceService:
    def __init__(self, *, clock: Clock, audit: AuditLogWriter | None = None) -> None:
        self.clock = clock
        self.audit = audit or AuditLogWriter()

    async def response(
        self, db: AsyncSession, actor: Actor, project: ProjectDraft
    ) -> ProjectWorkspaceResponse:
        qualified = set(
            await db.scalars(
                select(OwnerQualification.user_id).where(
                    OwnerQualification.user_id.in_(
                        {actor.user_id, project.owner_user_id}
                    ),
                    OwnerQualification.status == "APPROVED",
                )
            )
        )
        return ProjectWorkspaceResponse(
            draft=_response(project),
            role="OWNER" if project.owner_user_id == actor.user_id else "MANAGER",
            can_publish_recruitment={actor.user_id, project.owner_user_id}.issubset(
                qualified
            ),
        )

    async def read(
        self, db: AsyncSession, *, actor: Actor, project_id: UUID, context: AuditContext
    ) -> ProjectWorkspaceResponse:
        async with mutation(db):
            project = await require_project_editor(db, actor, project_id)
            result = await self.response(db, actor, project)
            await self.record(db, actor, project, "read", context)
            return result

    async def save(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: CollaborationProjectSaveCommand,
        context: AuditContext,
    ) -> ProjectWorkspaceResponse:
        async with mutation(db):
            project = await require_project_editor(db, actor, project_id)
            digest = fingerprint(
                {
                    "action": "PROJECT_SAVE",
                    "project_id": str(project_id),
                    **payload.model_dump(mode="json"),
                }
            )
            prior = await self.receipt(db, actor, payload.request_id, digest)
            if prior:
                return (await self.response(db, actor, project)).model_copy(
                    update={"replayed": True, "applied_version": prior.applied_version}
                )
            if project.version != payload.version:
                raise conflict(
                    "项目已被其他人更新，请读取最新版本；保留当前输入重新核对",
                    kind="PROJECT_VERSION_CONFLICT",
                )
            for key, value in payload.model_dump(
                exclude={"version", "request_id"}
            ).items():
                setattr(project, key, value)
            project.version += 1
            project.updated_at = self.clock.now()
            self.remember(
                db,
                actor,
                payload.request_id,
                project_id,
                None,
                "PROJECT_SAVE",
                digest,
                project.version,
            )
            await self.record(db, actor, project, "save", context)
            return (await self.response(db, actor, project)).model_copy(
                update={"applied_version": project.version}
            )

    async def receipt(
        self, db: AsyncSession, actor: Actor, request_id: UUID, digest: str
    ) -> WorkspaceCommandReceipt | None:
        receipt = await db.scalar(
            select(WorkspaceCommandReceipt).where(
                WorkspaceCommandReceipt.actor_user_id == actor.user_id,
                WorkspaceCommandReceipt.request_id == request_id,
            )
        )
        if receipt is not None and receipt.fingerprint != digest:
            raise conflict(
                "该保存请求已用于不同内容，请核对原操作", kind="REQUEST_REUSE"
            )
        return receipt

    def remember(
        self,
        db: AsyncSession,
        actor: Actor,
        request_id: UUID,
        project_id: UUID,
        achievement_id: UUID | None,
        action: str,
        digest: str,
        version: int,
    ) -> None:
        db.add(
            WorkspaceCommandReceipt(
                actor_user_id=actor.user_id,
                request_id=request_id,
                project_id=project_id,
                achievement_id=achievement_id,
                action=action,
                fingerprint=digest,
                applied_version=version,
                created_at=self.clock.now(),
            )
        )

    async def save_achievement(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        achievement_id: UUID,
        payload: CollaborationAchievementSaveCommand,
        context: AuditContext,
    ) -> WorkspaceAchievementSaveResult:
        async with mutation(db):
            await require_project_editor(db, actor, project_id)
            row = await db.scalar(
                select(AchievementDraft)
                .where(
                    AchievementDraft.id == achievement_id,
                    AchievementDraft.project_id == project_id,
                )
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            if row is None:
                raise not_found()
            digest = fingerprint(
                {
                    "action": "ACHIEVEMENT_SAVE",
                    "project_id": str(project_id),
                    "achievement_id": str(achievement_id),
                    **payload.model_dump(mode="json"),
                }
            )
            prior = await self.receipt(db, actor, payload.request_id, digest)
            if prior:
                return WorkspaceAchievementSaveResult(
                    current=achievement_response(row),
                    replayed=True,
                    applied_version=prior.applied_version,
                )
            await require_editable(db, achievement_id)
            if row.version != payload.version:
                raise conflict(
                    "成果已更新，请读取最新版本；保留当前输入重新核对",
                    kind="ACHIEVEMENT_VERSION_CONFLICT",
                )
            for key, value in payload.model_dump(
                include=set(ACHIEVEMENT_FIELDS)
            ).items():
                setattr(row, key, value)
            row.version += 1
            row.updated_at = self.clock.now()
            self.remember(
                db,
                actor,
                payload.request_id,
                project_id,
                achievement_id,
                "ACHIEVEMENT_SAVE",
                digest,
                row.version,
            )
            await self.audit.append(
                db,
                actor=actor,
                action="ie.collaboration.achievement.save",
                target_type="ie_achievement_draft",
                target_id=str(row.id),
                after_snapshot={"version": row.version},
                request_id=context.request_id,
                ip_address=context.ip_address,
            )
            return WorkspaceAchievementSaveResult(
                current=achievement_response(row),
                replayed=False,
                applied_version=row.version,
            )

    async def record(
        self,
        db: AsyncSession,
        actor: Actor,
        project: ProjectDraft,
        action: str,
        context: AuditContext,
    ) -> None:
        await self.audit.append(
            db,
            actor=actor,
            action=f"ie.collaboration.project.{action}",
            target_type="ie_project_draft",
            target_id=str(project.id),
            after_snapshot={"version": project.version} if action == "save" else None,
            request_id=context.request_id,
            ip_address=context.ip_address,
        )
