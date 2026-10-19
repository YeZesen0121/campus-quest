"""Explicit lifecycle confirmation and source-bound introduction publication."""

from dataclasses import dataclass
from typing import Any, Literal, cast
from uuid import UUID

from sqlalchemy import func, literal, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_common import (
    lock_project,
    require_project_editor,
)
from app.modules.innovation.lifecycle_models import (
    LifecycleReceipt,
    ProjectIntroduction,
)
from app.modules.innovation.lifecycle_schemas import (
    ClosingRecruitment,
    IntroductionFields,
    IntroductionPreviewCommand,
    IntroductionPreviewResponse,
    IntroductionPublishCommand,
    LifecycleCommand,
    LifecycleResult,
    LifecycleStateResponse,
)
from app.modules.innovation.lifecycle_visibility import visible_introductions
from app.modules.innovation.mentor_common import (
    conflict,
    fingerprint,
    forbidden,
    mutation,
)
from app.modules.innovation.models import (
    AchievementDraft,
    OwnerQualification,
    ProjectDraft,
)
from app.modules.innovation.recruitment_models import (
    RecruitmentDraft,
    RecruitmentRevision,
)
from app.modules.innovation.review_models import (
    AchievementRevision,
    AchievementWorkflow,
)

SourceKind = Literal["ACHIEVEMENT", "RECRUITMENT"]


@dataclass(frozen=True)
class PriorSource:
    kind: SourceKind
    id: UUID
    revision_id: UUID
    fields: IntroductionFields

    def snapshot(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "id": str(self.id),
            "revision_id": str(self.revision_id),
            "fields": self.fields.model_dump(),
        }


class LifecycleService:
    def __init__(self, *, clock: Clock, audit: AuditLogWriter | None = None) -> None:
        self.clock, self.audit = clock, audit or AuditLogWriter()

    async def prior_source(
        self, db: AsyncSession, project: ProjectDraft
    ) -> PriorSource | None:
        """Published history qualifies; private drafts and unreviewed work do not."""
        if project.introduction_moderation_state != "NORMAL":
            return None
        ac = AchievementRevision.project_content
        achievement = (
            select(
                literal(0).label("priority"),
                literal("ACHIEVEMENT").label("kind"),
                AchievementDraft.id.label("id"),
                AchievementRevision.id.label("revision_id"),
                ac["title"].astext.label("title"),
                ac["summary"].astext.label("summary"),
                ac["direction"].astext.label("direction"),
                ac["stage"].astext.label("stage"),
                AchievementWorkflow.latest_update_at.label("stamp"),
            )
            .select_from(AchievementWorkflow)
            .join(
                AchievementDraft,
                AchievementDraft.id == AchievementWorkflow.achievement_id,
            )
            .join(
                AchievementRevision,
                AchievementRevision.id == AchievementWorkflow.public_revision_id,
            )
            .where(
                AchievementDraft.project_id == project.id,
                AchievementWorkflow.first_review_state == "APPROVED",
                AchievementWorkflow.moderation_state == "NORMAL",
            )
        )
        rc = RecruitmentRevision.content
        recruitment = (
            select(
                literal(1).label("priority"),
                literal("RECRUITMENT").label("kind"),
                RecruitmentDraft.id.label("id"),
                RecruitmentRevision.id.label("revision_id"),
                rc["project_title"].astext.label("title"),
                rc["introduction"].astext.label("summary"),
                rc["direction"].astext.label("direction"),
                rc["stage"].astext.label("stage"),
                RecruitmentRevision.created_at.label("stamp"),
            )
            .select_from(RecruitmentDraft)
            .join(
                RecruitmentRevision,
                RecruitmentRevision.id == RecruitmentDraft.public_revision_id,
            )
            .where(
                RecruitmentDraft.project_id == project.id,
                RecruitmentDraft.moderation_state == "NORMAL",
            )
        )
        sources = union_all(achievement, recruitment).subquery()
        row = (
            await db.execute(
                select(sources)
                .order_by(
                    sources.c.priority, sources.c.stamp.desc(), sources.c.id.desc()
                )
                .limit(1)
            )
        ).one_or_none()
        if row is None:
            return None
        return PriorSource(
            cast(SourceKind, row.kind),
            row.id,
            row.revision_id,
            IntroductionFields(
                title=row.title,
                summary=row.summary,
                direction=row.direction,
                stage=row.stage,
            ),
        )

    async def introduction(
        self, db: AsyncSession, project: ProjectDraft
    ) -> ProjectIntroduction | None:
        return (
            await db.get(ProjectIntroduction, project.public_introduction_id)
            if project.public_introduction_id
            else None
        )

    async def state(
        self, db: AsyncSession, actor: Actor, project: ProjectDraft
    ) -> LifecycleStateResponse:
        intro = await self.introduction(db, project)
        visible = await db.scalar(
            visible_introductions()
            .with_only_columns(ProjectIntroduction.id)
            .where(ProjectIntroduction.project_id == project.id)
        )
        source = await self.prior_source(db, project) if intro is None else None
        jobs = list(
            await db.scalars(
                select(RecruitmentDraft)
                .where(RecruitmentDraft.project_id == project.id)
                .order_by(RecruitmentDraft.id)
            )
        )
        consequence: Literal["RETAIN_PRIOR_PUBLIC", "PRIVATE", "SOURCE_RESTRICTED"] = (
            "RETAIN_PRIOR_PUBLIC" if (visible or source) else "PRIVATE"
        )
        if (
            intro is not None and visible is None
        ) or project.introduction_moderation_state != "NORMAL":
            consequence = "SOURCE_RESTRICTED"
        digest = fingerprint(
            {
                "project_id": str(project.id),
                "version": project.version,
                "generation": project.ownership_generation,
                "lifecycle": project.lifecycle,
                "intro": str(project.public_introduction_id),
                "moderation": project.introduction_moderation_state,
                "consequence": consequence,
                "source": source.snapshot() if source else None,
                "jobs": [[str(j.id), j.version, j.status] for j in jobs],
            }
        )
        return LifecycleStateResponse(
            project_id=project.id,
            lifecycle=cast(Any, project.lifecycle),
            version=project.version,
            introduction_revision=intro.number if intro else None,
            closing_recruitments=[
                ClosingRecruitment(
                    id=j.id, role_name=str(j.fields["role_name"]), version=j.version
                )
                for j in jobs
                if j.status == "OPEN"
            ],
            public_consequence=consequence,
            can_transition=actor.user_id == project.owner_user_id,
            confirmation_digest=digest,
        )

    async def read(
        self, db: AsyncSession, *, actor: Actor, project_id: UUID, context: AuditContext
    ) -> LifecycleStateResponse:
        async with mutation(db):
            project = await require_project_editor(db, actor, project_id)
            result = await self.state(db, actor, project)
            await self.record(db, actor, project, "read", context)
            return result

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
            action=f"ie.lifecycle.{action}",
            target_type="ie_project_draft",
            target_id=str(project.id),
            after_snapshot={
                "lifecycle": project.lifecycle,
                "version": project.version,
                "introduction_id": str(project.public_introduction_id)
                if project.public_introduction_id
                else None,
            },
            request_id=context.request_id,
            ip_address=context.ip_address,
        )

    async def receipt(
        self, db: AsyncSession, actor: Actor, request_id: UUID, digest: str
    ) -> LifecycleReceipt | None:
        saved = await db.scalar(
            select(LifecycleReceipt).where(
                LifecycleReceipt.actor_user_id == actor.user_id,
                LifecycleReceipt.request_id == request_id,
            )
        )
        if saved and saved.fingerprint != digest:
            raise conflict("该请求已用于不同操作，请核对原结果", kind="REQUEST_REUSE")
        return saved

    def remember(
        self,
        db: AsyncSession,
        actor: Actor,
        project: ProjectDraft,
        request_id: UUID,
        digest: str,
        action: str,
    ) -> None:
        db.add(
            LifecycleReceipt(
                project_id=project.id,
                actor_user_id=actor.user_id,
                request_id=request_id,
                action=action,
                fingerprint=digest,
                applied_version=project.version,
                created_at=self.clock.now(),
            )
        )

    async def result(
        self,
        db: AsyncSession,
        project: ProjectDraft,
        *,
        replayed: bool,
        applied_version: int,
    ) -> LifecycleResult:
        intro = await self.introduction(db, project)
        return LifecycleResult(
            project_id=project.id,
            lifecycle=cast(Any, project.lifecycle),
            version=project.version,
            introduction_revision=intro.number if intro else None,
            replayed=replayed,
            applied_version=applied_version,
        )

    async def create_intro(
        self,
        db: AsyncSession,
        actor: Actor,
        project: ProjectDraft,
        source: PriorSource,
        fields: IntroductionFields,
    ) -> None:
        number = (
            await db.scalar(
                select(func.max(ProjectIntroduction.number)).where(
                    ProjectIntroduction.project_id == project.id
                )
            )
            or 0
        ) + 1
        intro = ProjectIntroduction(
            project_id=project.id,
            number=number,
            fields=fields.model_dump(),
            achievement_id=source.id if source.kind == "ACHIEVEMENT" else None,
            achievement_revision_id=source.revision_id
            if source.kind == "ACHIEVEMENT"
            else None,
            recruitment_id=source.id if source.kind == "RECRUITMENT" else None,
            recruitment_revision_id=source.revision_id
            if source.kind == "RECRUITMENT"
            else None,
            created_by=actor.user_id,
            created_at=self.clock.now(),
        )
        db.add(intro)
        await db.flush()
        project.public_introduction_id = intro.id

    async def act(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        action: Literal["complete", "resume"],
        payload: LifecycleCommand,
        context: AuditContext,
    ) -> LifecycleResult:
        async with mutation(db):
            project = await lock_project(db, actor, project_id)
            digest = fingerprint(
                {
                    "project_id": str(project_id),
                    "action": action,
                    **payload.model_dump(mode="json"),
                }
            )
            prior = await self.receipt(db, actor, payload.request_id, digest)
            if prior:
                return await self.result(
                    db, project, replayed=True, applied_version=prior.applied_version
                )
            state = await self.state(db, actor, project)
            if (
                project.version != payload.version
                or state.confirmation_digest != payload.confirmation_digest
            ):
                raise conflict(
                    "岗位或公开后果已变化，请刷新确认后重试", kind="LIFECYCLE_CHANGED"
                )
            if project.lifecycle != ("ACTIVE" if action == "complete" else "COMPLETED"):
                raise conflict(
                    "项目状态已变化，请查看当前结果", kind="LIFECYCLE_CHANGED"
                )
            if action == "complete":
                if project.public_introduction_id is None:
                    source = await self.prior_source(db, project)
                    if source:
                        await self.create_intro(
                            db, actor, project, source, source.fields
                        )
                jobs = await db.scalars(
                    select(RecruitmentDraft)
                    .where(
                        RecruitmentDraft.project_id == project.id,
                        RecruitmentDraft.status == "OPEN",
                    )
                    .order_by(RecruitmentDraft.id)
                    .with_for_update()
                )
                for job in jobs:
                    job.status, job.updated_at = "CLOSED", self.clock.now()
                    job.next_remind_at = None
                    job.version += 1
            project.lifecycle = "COMPLETED" if action == "complete" else "ACTIVE"
            project.version += 1
            project.updated_at = self.clock.now()
            self.remember(
                db, actor, project, payload.request_id, digest, action.upper()
            )
            await self.record(db, actor, project, action, context)
            return await self.result(
                db, project, replayed=False, applied_version=project.version
            )

    async def preview_locked(
        self,
        db: AsyncSession,
        actor: Actor,
        project: ProjectDraft,
        payload: IntroductionPreviewCommand,
    ) -> IntroductionPreviewResponse:
        if project.version != payload.version:
            raise conflict(
                "项目已变化，请保留输入并重新预览", kind="INTRODUCTION_CHANGED"
            )
        source, number = await self.editable_source(db, project)
        kind = source.kind
        qualification = await db.scalar(
            select(OwnerQualification.status)
            .where(OwnerQualification.user_id == actor.user_id)
            .with_for_update()
        )
        digest = fingerprint(
            {
                "project_id": str(project.id),
                "version": project.version,
                "generation": project.ownership_generation,
                "intro": str(project.public_introduction_id),
                "source": source.snapshot(),
                "fields": payload.fields.model_dump(),
                "moderation": project.introduction_moderation_state,
            }
        )
        return IntroductionPreviewResponse(
            project_id=project.id,
            version=project.version,
            fields=payload.fields,
            source_kind=kind,
            next_revision=number + 1,
            can_publish=actor.user_id == project.owner_user_id
            and qualification == "APPROVED",
            preview_digest=digest,
        )

    async def editable_source(
        self, db: AsyncSession, project: ProjectDraft
    ) -> tuple[PriorSource, int]:
        intro = await self.introduction(db, project)
        if intro is None:
            # A privately completed project may later earn its first genuine
            # approved publication. Explicit preview/publish can then use that
            # real source; completion itself still published no private draft.
            source = (
                await self.prior_source(db, project)
                if project.lifecycle == "COMPLETED"
                else None
            )
            if source is None:
                raise conflict(
                    "没有可维护的公开档案来源", kind="INTRODUCTION_SOURCE_RESTRICTED"
                )
            return source, 0
        visible = await db.scalar(
            visible_introductions()
            .with_only_columns(ProjectIntroduction.id)
            .where(ProjectIntroduction.project_id == project.id)
        )
        if visible is None:
            raise conflict(
                "没有可维护的公开档案，或原来源当前受限",
                kind="INTRODUCTION_SOURCE_RESTRICTED",
            )
        fields = IntroductionFields.model_validate(intro.fields)
        if intro.achievement_id:
            assert intro.achievement_revision_id is not None
            return PriorSource(
                "ACHIEVEMENT",
                intro.achievement_id,
                intro.achievement_revision_id,
                fields,
            ), intro.number
        assert intro.recruitment_id and intro.recruitment_revision_id
        return PriorSource(
            "RECRUITMENT", intro.recruitment_id, intro.recruitment_revision_id, fields
        ), intro.number

    async def preview(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: IntroductionPreviewCommand,
        context: AuditContext,
    ) -> IntroductionPreviewResponse:
        async with mutation(db):
            project = await require_project_editor(db, actor, project_id)
            result = await self.preview_locked(db, actor, project, payload)
            await self.record(db, actor, project, "preview", context)
            return result

    async def publish(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: IntroductionPublishCommand,
        context: AuditContext,
    ) -> LifecycleResult:
        async with mutation(db):
            project = await lock_project(db, actor, project_id)
            digest = fingerprint(
                {
                    "project_id": str(project_id),
                    "action": "introduction",
                    **payload.model_dump(mode="json"),
                }
            )
            prior = await self.receipt(db, actor, payload.request_id, digest)
            if prior:
                return await self.result(
                    db, project, replayed=True, applied_version=prior.applied_version
                )
            preview = await self.preview_locked(db, actor, project, payload)
            if not preview.can_publish:
                raise forbidden()
            if preview.preview_digest != payload.preview_digest:
                raise conflict(
                    "预览已变化，请重新核对后明确发布", kind="INTRODUCTION_CHANGED"
                )
            source, _ = await self.editable_source(db, project)
            await self.create_intro(db, actor, project, source, payload.fields)
            project.version += 1
            project.updated_at = self.clock.now()
            self.remember(
                db, actor, project, payload.request_id, digest, "INTRODUCTION"
            )
            await self.record(db, actor, project, "publish_introduction", context)
            return await self.result(
                db, project, replayed=False, applied_version=project.version
            )
