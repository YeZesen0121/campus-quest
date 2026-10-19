"""Current-state confirmation, atomic handover and minimal durable recovery."""

import asyncio
import hashlib
from datetime import timedelta
from typing import Any, Literal, cast
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.integrations.errors import ProviderError
from app.integrations.evidence_scanner import MAX_EVIDENCE_BYTES
from app.integrations.object_storage import ObjectStorage, StoredObject
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation.collaboration_common import (
    lock_project,
    record_participation,
)
from app.modules.innovation.collaboration_models import (
    CollaborationTarget,
    ProjectCollaboration,
)
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.evidence_scope import evidence_scope
from app.modules.innovation.lifecycle_models import ProjectIntroduction
from app.modules.innovation.mentor_common import (
    active_accounts,
    conflict,
    fingerprint,
    forbidden,
    mutation,
    not_found,
)
from app.modules.innovation.mentor_models import (
    MentorProfile,
    MentorRevision,
    ProjectMentorLink,
)
from app.modules.innovation.models import (
    AchievementDraft,
    OwnerQualification,
    ProjectDraft,
)
from app.modules.innovation.recruitment_models import (
    RecruitmentContactAuthorization,
    RecruitmentDraft,
    RecruitmentRevision,
)
from app.modules.innovation.review_models import (
    AchievementReviewCase,
    AchievementWorkflow,
)
from app.modules.innovation.transfer_models import (
    ProjectTransfer,
    TransferReceipt,
    TransferredEvidenceGrant,
)
from app.modules.innovation.transfer_schemas import (
    TransferCommand,
    TransferCreate,
    TransferListResponse,
    TransferProof,
    TransferProofChoice,
    TransferProofChoicesResponse,
    TransferResponse,
    TransferSummary,
)


class TransferService:
    def __init__(
        self,
        *,
        clock: Clock,
        storage: ObjectStorage,
        audit: AuditLogWriter | None = None,
        invitation_days: int = 7,
    ) -> None:
        self.clock, self.storage = clock, storage
        self.audit = audit or AuditLogWriter()
        self.period = timedelta(days=invitation_days)

    async def list_proof_choices(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        limit: int,
        offset: int,
        context: AuditContext,
    ) -> TransferProofChoicesResponse:
        async with mutation(db):
            # Handing over is independent of publication qualification. Keep
            # ownership and generation checks without granting old proof APIs.
            await lock_project(db, actor, project_id)
            query = (
                select(
                    AchievementEvidence.id,
                    AchievementDraft.title,
                    AchievementEvidence.content_type,
                    AchievementEvidence.size,
                )
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementEvidence.achievement_id,
                )
                .where(
                    AchievementDraft.project_id == project_id,
                    AchievementEvidence.state == "READY",
                    AchievementEvidence.removed_at.is_(None),
                    evidence_scope(actor.user_id),
                )
            )
            total = await db.scalar(select(func.count()).select_from(query.subquery()))
            rows = (
                await db.execute(
                    query.order_by(
                        AchievementEvidence.created_at, AchievementEvidence.id
                    )
                    .limit(limit)
                    .offset(offset)
                )
            ).all()
            items = [
                TransferProofChoice(
                    id=row.id,
                    achievement_title=row.title,
                    content_type=row.content_type,
                    size=row.size,
                )
                for row in rows
            ]
            await self.audit.append(
                db,
                actor=actor,
                action="ie.transfer.proof_choices",
                target_type="ie_project_draft",
                target_id=str(project_id),
                after_snapshot={
                    "limit": limit,
                    "offset": offset,
                    "returned": len(items),
                },
                request_id=context.request_id,
                ip_address=context.ip_address,
            )
            return TransferProofChoicesResponse(
                items=items, total=int(total or 0), limit=limit, offset=offset
            )

    async def record(
        self,
        db: AsyncSession,
        actor: Actor,
        row: ProjectTransfer,
        action: str,
        context: AuditContext,
        evidence_id: UUID | None = None,
    ) -> None:
        await self.audit.append(
            db,
            actor=actor,
            action=f"ie.transfer.{action}",
            target_type="ie_project_transfer",
            target_id=str(row.id),
            after_snapshot={
                "status": row.status,
                "version": row.version,
                **({"evidence_id": str(evidence_id)} if evidence_id else {}),
            },
            request_id=context.request_id,
            ip_address=context.ip_address,
        )

    async def qualified(self, db: AsyncSession, user_id: UUID) -> bool:
        return (
            await db.scalar(
                select(OwnerQualification.status)
                .where(OwnerQualification.user_id == user_id)
                .with_for_update()
            )
            == "APPROVED"
        )

    async def pending_review(self, db: AsyncSession, project_id: UUID) -> bool:
        return (
            await db.scalar(
                select(AchievementReviewCase.id)
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementReviewCase.achievement_id,
                )
                .where(
                    AchievementDraft.project_id == project_id,
                    AchievementReviewCase.status == "SUBMITTED",
                )
                .limit(1)
            )
            is not None
        )

    async def snapshot(self, db: AsyncSession, project: ProjectDraft) -> dict[str, Any]:
        """Parent lock serializes writes; hashes bind undisclosed private contents."""
        achievements = (
            await db.execute(
                select(AchievementDraft.id, AchievementDraft.version)
                .where(AchievementDraft.project_id == project.id)
                .order_by(AchievementDraft.id)
            )
        ).all()
        relations = (
            await db.execute(
                select(
                    ProjectCollaboration.id,
                    ProjectCollaboration.version,
                    ProjectCollaboration.status,
                    ProjectCollaboration.kind,
                    ProjectCollaboration.public_name,
                    ProjectCollaboration.division,
                    User.nickname,
                )
                .join(User, User.id == ProjectCollaboration.target_user_id)
                .where(ProjectCollaboration.project_id == project.id)
                .order_by(ProjectCollaboration.id)
            )
        ).all()
        mentors = (
            await db.execute(
                select(
                    ProjectMentorLink.id,
                    ProjectMentorLink.version,
                    ProjectMentorLink.status,
                    MentorRevision.content,
                )
                .join(MentorProfile, MentorProfile.id == ProjectMentorLink.mentor_id)
                .outerjoin(
                    MentorRevision,
                    MentorRevision.id == MentorProfile.public_revision_id,
                )
                .where(ProjectMentorLink.project_id == project.id)
                .order_by(ProjectMentorLink.id)
            )
        ).all()
        jobs = list(
            await db.scalars(
                select(RecruitmentDraft)
                .where(RecruitmentDraft.project_id == project.id)
                .order_by(RecruitmentDraft.id)
            )
        )
        contacts = (
            await db.execute(
                select(
                    RecruitmentContactAuthorization.id,
                    RecruitmentContactAuthorization.revoked_at,
                )
                .where(
                    RecruitmentContactAuthorization.recruitment_id.in_(
                        [job.id for job in jobs]
                    )
                )
                .order_by(RecruitmentContactAuthorization.id)
            )
        ).all()
        proofs = (
            await db.execute(
                select(
                    AchievementEvidence.id,
                    AchievementEvidence.version,
                    AchievementEvidence.state,
                    AchievementEvidence.removed_at,
                )
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementEvidence.achievement_id,
                )
                .where(AchievementDraft.project_id == project.id)
                .order_by(AchievementEvidence.id)
            )
        ).all()
        workflows = (
            await db.execute(
                select(
                    AchievementWorkflow.achievement_id,
                    AchievementWorkflow.version,
                    AchievementWorkflow.moderation_state,
                    AchievementWorkflow.public_revision_id,
                )
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementWorkflow.achievement_id,
                )
                .where(AchievementDraft.project_id == project.id)
                .order_by(AchievementWorkflow.achievement_id)
            )
        ).all()
        relationships = [
            {
                "reference": str(r.id),
                "kind": r.kind,
                "name": r.nickname if r.kind == "MANAGER" else r.public_name,
                "division": r.division if r.kind == "MEMBER" else None,
                "scope": "TEXT_AND_RECRUITMENT"
                if r.kind == "MANAGER"
                else "PUBLIC_NAME_ONLY",
            }
            for r in relations
            if r.status == "ACCEPTED"
        ] + [
            {
                "reference": str(m.id),
                "kind": "MENTOR",
                # Never use a newer, unconfirmed private profile draft.
                "name": str(m.content.get("name", "已同意挂名的导师"))
                if m.content
                else "已同意挂名的导师",
                "division": None,
                "scope": "MENTOR_DISPLAY_ONLY",
            }
            for m in mentors
            if m.status == "ACCEPTED"
        ]
        public_jobs = {
            revision.id: revision.content
            for revision in await db.scalars(
                select(RecruitmentRevision).where(
                    RecruitmentRevision.id.in_(
                        [j.public_revision_id for j in jobs if j.status == "OPEN"]
                    )
                )
            )
        }
        closing_recruitments = [
            {
                "reference": str(j.id),
                "role_name": str(
                    (
                        public_jobs.get(j.public_revision_id, j.fields)
                        if j.public_revision_id
                        else j.fields
                    ).get("role_name", "")
                ),
                "status": "OPEN",
                "deadline_at": j.deadline_at.isoformat() if j.deadline_at else None,
            }
            for j in jobs
            if j.status == "OPEN"
        ]
        introduction_revision = (
            await db.scalar(
                select(ProjectIntroduction.number).where(
                    ProjectIntroduction.id == project.public_introduction_id,
                    ProjectIntroduction.project_id == project.id,
                )
            )
            if project.public_introduction_id
            else None
        )
        state = {
            "relationships_disclosed": relationships,
            "closing_recruitments_disclosed": closing_recruitments,
            "lifecycle": project.lifecycle,
            "introduction": str(project.public_introduction_id),
            "introduction_moderation": project.introduction_moderation_state,
            "achievements": [[str(a.id), a.version] for a in achievements],
            "relations": [[str(r.id), r.version, r.status, r.kind] for r in relations],
            "mentors": [[str(m.id), m.version, m.status] for m in mentors],
            "jobs": [
                {
                    "id": str(j.id),
                    "version": j.version,
                    "status": j.status,
                    "fields": j.fields,
                    "moderation": j.moderation_state,
                    "public_revision": str(j.public_revision_id),
                }
                for j in jobs
            ],
            "contacts": [[str(c.id), str(c.revoked_at)] for c in contacts],
            "proofs": [
                [str(p.id), p.version, p.state, str(p.removed_at)] for p in proofs
            ],
            "workflows": [
                [
                    str(w.achievement_id),
                    w.version,
                    w.moderation_state,
                    str(w.public_revision_id),
                ]
                for w in workflows
            ],
        }
        return {
            "snapshot_version": 2,
            "relationships": relationships,
            "closing_recruitments": closing_recruitments,
            "introduction_revision": introduction_revision,
            "title": project.title,
            "lifecycle": project.lifecycle,
            "summary": project.summary,
            "direction": project.direction,
            "stage": project.stage,
            "team_status": project.team_status,
            "project_version": project.version,
            "ownership_generation": project.ownership_generation,
            "achievement_count": len(achievements),
            "manager_count": sum(
                r.kind == "MANAGER" and r.status == "ACCEPTED" for r in relations
            ),
            "member_count": sum(
                r.kind == "MEMBER" and r.status == "ACCEPTED" for r in relations
            ),
            "mentor_count": sum(m.status == "ACCEPTED" for m in mentors),
            "open_recruitment_count": sum(j.status == "OPEN" for j in jobs),
            "state_digest": fingerprint(state),
        }

    async def materials(
        self, db: AsyncSession, row: ProjectTransfer
    ) -> list[AchievementEvidence]:
        return list(
            await db.scalars(
                select(AchievementEvidence)
                .join(
                    AchievementDraft,
                    AchievementDraft.id == AchievementEvidence.achievement_id,
                )
                .where(
                    AchievementDraft.project_id == row.project_id,
                    AchievementEvidence.id.in_(
                        [UUID(e["id"]) for e in row.evidence_snapshot]
                    ),
                )
                .order_by(AchievementEvidence.id)
                .with_for_update(of=AchievementEvidence)
                .execution_options(populate_existing=True)
            )
        )

    @staticmethod
    def material_snapshot(rows: list[AchievementEvidence]) -> list[dict[str, Any]]:
        return [
            {
                "id": str(e.id),
                "version": e.version,
                "sha256": e.sha256,
                "size": e.size,
                "content_type": e.content_type,
                "state": e.state,
                "removed": e.removed_at is not None,
            }
            for e in rows
        ]

    async def response(
        self,
        db: AsyncSession,
        actor: Actor,
        row: ProjectTransfer,
        project: ProjectDraft | None = None,
        *,
        counterpart_nickname: str | None = None,
    ) -> TransferResponse:
        if counterpart_nickname is None:
            counterpart_nickname = await db.scalar(
                select(User.nickname).where(
                    User.id
                    == (
                        row.from_user_id
                        if actor.user_id == row.target_user_id
                        else row.target_user_id
                    )
                )
            )
        status = (
            "EXPIRED"
            if row.status == "PENDING" and self.clock.now() >= row.expires_at
            else row.status
        )
        result = TransferResponse(
            id=row.id,
            project_id=row.project_id,
            project_title=str(row.initial_snapshot["title"]),
            counterpart_nickname=counterpart_nickname or "同学",
            status=cast(Any, status),
            version=row.version,
            is_target=actor.user_id == row.target_user_id,
            expires_at=row.expires_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        if status != "PENDING":
            return result
        if (
            project is None
            or project.owner_user_id != row.from_user_id
            or project.ownership_generation != row.from_generation
        ):
            result.status = "INVALIDATED"
            return result
        current = await self.snapshot(db, project)
        materials = self.material_snapshot(await self.materials(db, row))
        result.initial_summary = TransferSummary.model_validate(row.initial_snapshot)
        result.current_summary = TransferSummary.model_validate(current)
        result.evidence = [
            TransferProof.model_validate(e) for e in row.evidence_snapshot
        ]
        result.allow_preview = row.allow_preview
        result.confirmation_digest = fingerprint(
            {
                "id": str(row.id),
                "version": row.version,
                "current": current,
                "materials": materials,
            }
        )
        if materials != row.evidence_snapshot:
            result.blockers.append("MATERIAL_CHANGED_CREATE_NEW_TRANSFER")
        if await self.pending_review(db, project.id):
            result.blockers.append("PENDING_REVIEW_WITHDRAW_OR_WAIT")
        if not await self.qualified(db, row.target_user_id):
            result.blockers.append("TARGET_QUALIFICATION_REQUIRED")
        return result

    async def locked(
        self, db: AsyncSession, actor: Actor, transfer_id: UUID
    ) -> tuple[ProjectTransfer, ProjectDraft]:
        hint = (
            await db.execute(
                select(
                    ProjectTransfer.project_id,
                    ProjectTransfer.from_user_id,
                    ProjectTransfer.target_user_id,
                ).where(ProjectTransfer.id == transfer_id)
            )
        ).one_or_none()
        if hint is None or actor.user_id not in {
            hint.from_user_id,
            hint.target_user_id,
        }:
            raise not_found()
        current_owner = await db.scalar(
            select(ProjectDraft.owner_user_id).where(ProjectDraft.id == hint.project_id)
        )
        if current_owner is None:
            raise not_found()
        await active_accounts(
            db,
            actor,
            hint.from_user_id,
            hint.target_user_id,
            current_owner,
            require_others_active=False,
        )
        project = await db.scalar(
            select(ProjectDraft)
            .where(ProjectDraft.id == hint.project_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        row = await db.scalar(
            select(ProjectTransfer)
            .where(ProjectTransfer.id == transfer_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if project is None or row is None:
            raise not_found()
        if project.owner_user_id != current_owner:
            raise conflict("项目负责人已变化，请刷新结果", kind="PROJECT_CHANGED")
        return row, project

    async def request(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        project_id: UUID,
        payload: TransferCreate,
        context: AuditContext,
    ) -> TransferResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            digest = fingerprint(
                {"project_id": str(project_id), **payload.model_dump(mode="json")}
            )
            saved_id = await db.scalar(
                select(ProjectTransfer.id).where(
                    ProjectTransfer.from_user_id == actor.user_id,
                    ProjectTransfer.creation_request_id == payload.request_id,
                )
            )
            if saved_id:
                # Release the initial actor-only lock before acquiring the complete
                # stable account set; no mutation happened in this transaction.
                await db.commit()
                previous, project = await self.locked(db, actor, saved_id)
                if previous.creation_fingerprint != digest:
                    raise conflict("原请求已用于不同的交接内容", kind="REQUEST_REUSE")
                return await self.response(db, actor, previous, project)
            # Identity reference is actor-bound and short lived; it grants no rights.
            reference = await db.scalar(
                select(CollaborationTarget).where(
                    CollaborationTarget.id == payload.target_ref,
                    CollaborationTarget.actor_user_id == actor.user_id,
                    CollaborationTarget.expires_at > self.clock.now(),
                )
            )
            if reference is None:
                raise conflict("目标确认已过期，请重新核对账号")
            target_id = reference.target_user_id
            reference_expires_at = reference.expires_at
            await db.commit()
            project = await lock_project(db, actor, project_id, target_id)
            if self.clock.now() >= reference_expires_at:
                raise conflict("目标确认已过期，请重新核对账号")
            if target_id == actor.user_id:
                raise conflict("不能把项目转交给自己")
            accounts = await active_accounts(db, actor, target_id)
            if accounts[target_id].role != "STUDENT" or not await self.qualified(
                db, target_id
            ):
                raise conflict(
                    "接任者须先开通负责人资格", kind="TARGET_QUALIFICATION_REQUIRED"
                )
            if await self.pending_review(db, project_id):
                raise conflict(
                    "仍有待核实成果，请等待结果或先撤回", kind="PENDING_REVIEW"
                )
            # Recheck idempotency after the complete lock set (concurrent retry).
            saved = await db.scalar(
                select(ProjectTransfer).where(
                    ProjectTransfer.from_user_id == actor.user_id,
                    ProjectTransfer.creation_request_id == payload.request_id,
                )
            )
            if saved:
                if saved.creation_fingerprint != digest:
                    raise conflict("原请求已用于不同的交接内容", kind="REQUEST_REUSE")
                return await self.response(db, actor, saved, project)
            evidence = list(
                await db.scalars(
                    select(AchievementEvidence)
                    .join(
                        AchievementDraft,
                        AchievementDraft.id == AchievementEvidence.achievement_id,
                    )
                    .where(
                        AchievementDraft.project_id == project_id,
                        AchievementEvidence.id.in_(payload.evidence_ids),
                        AchievementEvidence.state == "READY",
                        AchievementEvidence.removed_at.is_(None),
                        evidence_scope(actor.user_id),
                    )
                    .order_by(AchievementEvidence.id)
                    .with_for_update(of=AchievementEvidence)
                )
            )
            if len(evidence) != len(payload.evidence_ids):
                raise conflict("只能选择当前有权使用且已检查的项目证明")
            now = self.clock.now()
            row = ProjectTransfer(
                project_id=project_id,
                from_user_id=actor.user_id,
                target_user_id=target_id,
                from_generation=project.ownership_generation,
                creation_request_id=payload.request_id,
                creation_fingerprint=digest,
                evidence_snapshot=self.material_snapshot(evidence),
                initial_snapshot=await self.snapshot(db, project),
                allow_preview=payload.allow_preview,
                status="PENDING",
                version=1,
                expires_at=now + self.period,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
            await db.flush()
            await self.record(db, actor, row, "request", context)
            return await self.response(db, actor, row, project)

    async def summary(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        transfer_id: UUID,
        context: AuditContext,
    ) -> TransferResponse:
        async with mutation(db):
            row, project = await self.locked(db, actor, transfer_id)
            result = await self.response(db, actor, row, project)
            await self.record(db, actor, row, "summary", context)
            return result

    async def list_mine(
        self, db: AsyncSession, *, actor: Actor, limit: int, offset: int
    ) -> TransferListResponse:
        # Minimal result list never emits live private project contents.
        async with mutation(db):
            await active_accounts(db, actor)
            predicate = or_(
                ProjectTransfer.from_user_id == actor.user_id,
                ProjectTransfer.target_user_id == actor.user_id,
            )
            total = await db.scalar(
                select(func.count()).select_from(ProjectTransfer).where(predicate)
            )
            rows = list(
                await db.scalars(
                    select(ProjectTransfer)
                    .where(predicate)
                    .order_by(
                        ProjectTransfer.created_at.desc(), ProjectTransfer.id.desc()
                    )
                    .limit(limit)
                    .offset(offset)
                )
            )
            counterparts = {
                row.from_user_id
                if row.target_user_id == actor.user_id
                else row.target_user_id
                for row in rows
            }
            names = (
                dict(
                    (
                        await db.execute(
                            select(User.id, User.nickname).where(
                                User.id.in_(counterparts)
                            )
                        )
                    )
                    .tuples()
                    .all()
                )
                if counterparts
                else {}
            )
            items = []
            for row in rows:
                # Supplying no project deliberately returns only minimal metadata;
                # pending detail must pass locked current-authority checks.
                counterpart = (
                    row.from_user_id
                    if row.target_user_id == actor.user_id
                    else row.target_user_id
                )
                item = await self.response(
                    db,
                    actor,
                    row,
                    counterpart_nickname=names.get(counterpart) or "同学",
                )
                if row.status == "PENDING" and self.clock.now() < row.expires_at:
                    item.status = "PENDING"
                items.append(item)
            return TransferListResponse(
                items=items, total=total or 0, limit=limit, offset=offset
            )

    async def act(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        transfer_id: UUID,
        action: Literal["accept", "reject", "cancel"],
        payload: TransferCommand,
        context: AuditContext,
    ) -> TransferResponse:
        async with mutation(db):
            row, project = await self.locked(db, actor, transfer_id)
            if actor.user_id != (
                row.from_user_id if action == "cancel" else row.target_user_id
            ):
                raise forbidden()
            digest = fingerprint(
                {"id": str(row.id), "action": action, **payload.model_dump(mode="json")}
            )
            receipt = await db.scalar(
                select(TransferReceipt).where(
                    TransferReceipt.actor_user_id == actor.user_id,
                    TransferReceipt.request_id == payload.request_id,
                )
            )
            if receipt:
                if receipt.fingerprint != digest:
                    raise conflict("该请求已用于不同操作", kind="REQUEST_REUSE")
                return await self.response(db, actor, row, project)
            response = await self.response(db, actor, row, project)
            if response.status != "PENDING" or row.version != payload.version:
                raise conflict(
                    "交接已结束或版本变化，请刷新结果", kind="TRANSFER_CHANGED"
                )
            if action == "accept":
                accounts = await active_accounts(db, actor, row.from_user_id)
                if (
                    accounts[row.from_user_id].role != "STUDENT"
                    or actor.role != "STUDENT"
                ):
                    raise forbidden()
                if response.blockers:
                    raise conflict("请先处理交接阻塞事项", kind=response.blockers[0])
                if payload.confirmation_digest != response.confirmation_digest:
                    raise conflict(
                        "项目内容或关系已变化，请刷新摘要后重新确认",
                        kind="CONFIRMATION_CHANGED",
                    )
                await self.handover(db, project, row)
                row.status = "ACCEPTED"
            else:
                row.status = "CANCELED" if action == "cancel" else "REJECTED"
            row.version += 1
            row.updated_at = self.clock.now()
            db.add(
                TransferReceipt(
                    actor_user_id=actor.user_id,
                    request_id=payload.request_id,
                    transfer_id=row.id,
                    fingerprint=digest,
                    created_at=self.clock.now(),
                )
            )
            await self.record(db, actor, row, action, context)
            return await self.response(db, actor, row, project)

    async def handover(
        self, db: AsyncSession, project: ProjectDraft, row: ProjectTransfer
    ) -> None:
        now = self.clock.now()
        project.owner_user_id = row.target_user_id
        project.ownership_generation += 1
        project.version += 1
        project.updated_at = now
        relations = await db.scalars(
            select(ProjectCollaboration)
            .where(ProjectCollaboration.project_id == project.id)
            .order_by(ProjectCollaboration.id)
            .with_for_update()
        )
        for relation in relations:
            if relation.status == "PENDING" or (
                relation.kind == "MANAGER"
                and relation.target_user_id == row.from_user_id
                and relation.status == "ACCEPTED"
            ):
                relation.status, relation.updated_at = "REVOKED", now
                relation.version += 1
        mentors = await db.scalars(
            select(ProjectMentorLink)
            .where(
                ProjectMentorLink.project_id == project.id,
                ProjectMentorLink.status == "PENDING",
            )
            .order_by(ProjectMentorLink.id)
            .with_for_update()
        )
        for mentor in mentors:
            mentor.status, mentor.updated_at = "REVOKED", now
            mentor.version += 1
        jobs = list(
            await db.scalars(
                select(RecruitmentDraft)
                .where(RecruitmentDraft.project_id == project.id)
                .order_by(RecruitmentDraft.id)
                .with_for_update()
            )
        )
        for job in jobs:
            if job.status == "OPEN":
                job.status = "CLOSED"
            # Draft jobs have never been published and cannot have CLOSED state.
            job.fields = {**job.fields, "contacts": []}
            job.next_remind_at = None
            job.version += 1
            job.updated_at = now
        contacts = await db.scalars(
            select(RecruitmentContactAuthorization)
            .where(
                RecruitmentContactAuthorization.recruitment_id.in_(
                    [j.id for j in jobs]
                ),
                RecruitmentContactAuthorization.revoked_at.is_(None),
            )
            .order_by(RecruitmentContactAuthorization.id)
            .with_for_update()
        )
        for contact in contacts:
            contact.revoked_at = now
        others = await db.scalars(
            select(ProjectTransfer)
            .where(
                ProjectTransfer.project_id == project.id,
                ProjectTransfer.id != row.id,
                ProjectTransfer.status == "PENDING",
            )
            .order_by(ProjectTransfer.id)
            .with_for_update()
        )
        for other in others:
            other.status, other.updated_at = "INVALIDATED", now
            other.version += 1
        for evidence in row.evidence_snapshot:
            db.add(
                TransferredEvidenceGrant(
                    project_id=project.id,
                    ownership_generation=project.ownership_generation,
                    evidence_id=UUID(evidence["id"]),
                    transfer_id=row.id,
                    created_at=now,
                )
            )
        for user_id in (row.from_user_id, row.target_user_id):
            await record_participation(
                db, project_id=project.id, user_id=user_id, kind="OWNER", now=now
            )

    async def preview_scope(
        self,
        db: AsyncSession,
        actor: Actor,
        transfer_id: UUID,
        evidence_id: UUID,
        version: int,
    ) -> tuple[ProjectTransfer, AchievementEvidence]:
        row, project = await self.locked(db, actor, transfer_id)
        if (
            actor.user_id != row.target_user_id
            or not row.allow_preview
            or row.version != version
        ):
            raise not_found()
        response = await self.response(db, actor, row, project)
        if response.status != "PENDING" or response.blockers:
            raise conflict("提前查阅授权已失效，请重新核对交接")
        accounts = await active_accounts(db, actor, row.from_user_id)
        if actor.role != "STUDENT" or accounts[row.from_user_id].role != "STUDENT":
            raise forbidden()
        evidence = next(
            (e for e in await self.materials(db, row) if e.id == evidence_id), None
        )
        if evidence is None:
            raise not_found()
        return row, evidence

    async def read_evidence(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        transfer_id: UUID,
        evidence_id: UUID,
        version: int,
        context: AuditContext,
    ) -> StoredObject:
        async with mutation(db):
            row, evidence = await self.preview_scope(
                db, actor, transfer_id, evidence_id, version
            )
            key, digest, size, content_type = (
                evidence.object_key,
                evidence.sha256,
                evidence.size,
                evidence.content_type,
            )
            await record_participation(
                db,
                project_id=row.project_id,
                user_id=actor.user_id,
                kind="EVIDENCE_READER",
                now=self.clock.now(),
            )
            await self.record(db, actor, row, "evidence_read", context, evidence_id)
        # Authorization and durable audit commit before touching storage.
        try:
            obj = await asyncio.to_thread(
                self.storage.read_bounded_object,
                object_key=key,
                max_bytes=MAX_EVIDENCE_BYTES,
            )
        except (OSError, ProviderError, ValueError) as exc:
            raise conflict("材料暂不可读，请稍后重试") from exc
        if (
            len(obj.content) != size
            or obj.content_type != content_type
            or hashlib.sha256(obj.content).hexdigest() != digest
        ):
            raise conflict("材料与已检查版本不一致，禁止下载")
        async with mutation(db):
            await self.preview_scope(db, actor, transfer_id, evidence_id, version)
        return obj
