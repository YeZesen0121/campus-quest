"""Independent PG locks pin permission rechecks and the saved submission version."""

import asyncio
import hashlib
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text

from app.core.errors import BusinessError
from app.modules.audit.service import AuditLogWriter
from app.modules.innovation.collaboration_schemas import (
    CollaborationAchievementSaveCommand,
    CollaborationInviteCommand,
    CollaborationProjectSaveCommand,
    CollaborationVersionCommand,
)
from app.modules.innovation.collaboration_service import CollaborationService
from app.modules.innovation.collaboration_workspace_service import (
    CollaborationWorkspaceService,
)
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.models import AchievementDraft, OwnerProfile, ProjectDraft
from app.modules.innovation.review_models import (
    AchievementReviewCase,
    AchievementRevision,
    AchievementWorkflow,
)
from app.modules.innovation.review_schemas import SavedRevisionCommand
from app.modules.innovation.review_service import AchievementReviewService
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.test_achievement_evidence import PDF
from tests.integration.innovation.test_collaboration_races import CONTEXT
from tests.integration.innovation.test_collaboration_races import committed as committed

pytestmark = pytest.mark.integration


async def test_public_members_wait_for_source_closure_then_deny_disclosure(
    committed, clock
):
    from app.modules.innovation.collaboration_models import ProjectCollaboration
    from app.modules.innovation.collaboration_query_service import (
        CollaborationQueryService,
    )
    from app.modules.innovation.recruitment_schemas import (
        RecruitmentDraftCreate,
        RecruitmentFields,
        RecruitmentVersionCommand,
    )
    from app.modules.innovation.recruitment_service import RecruitmentService
    from tests.integration.innovation.recruitment_support import fields

    sessions, _, project_id, owner, target, _ = committed
    recruitments = RecruitmentService(clock=clock)
    async with sessions() as db:
        draft, _ = await recruitments.create(
            db,
            actor=owner,
            project_id=project_id,
            payload=RecruitmentDraftCreate(
                request_id=uuid4(), fields=RecruitmentFields.model_validate(fields())
            ),
            context=CONTEXT,
        )
        published = await recruitments.publish(
            db,
            actor=owner,
            project_id=project_id,
            recruitment_id=draft.id,
            payload=RecruitmentVersionCommand(
                request_id=uuid4(), version=draft.version
            ),
            context=CONTEXT,
        )
        db.add(
            ProjectCollaboration(
                project_id=project_id,
                target_user_id=target.user_id,
                invited_by=owner.user_id,
                kind="MEMBER",
                status="ACCEPTED",
                public_name="同意展示",
                division="调研",
                project_snapshot={"title": "模拟"},
                version=2,
                expires_at=clock.now() + timedelta(days=7),
                created_at=clock.now(),
                updated_at=clock.now(),
            )
        )
        await db.commit()
    hold = HeldAudit()
    closing_service = RecruitmentService(clock=clock, audit=hold)
    queries = CollaborationQueryService(clock=clock)
    pid_ready = asyncio.Future()

    async def close():
        async with sessions() as db:
            return await closing_service.close(
                db,
                actor=owner,
                project_id=project_id,
                recruitment_id=draft.id,
                payload=RecruitmentVersionCommand(
                    request_id=uuid4(), version=published.current.version
                ),
                context=CONTEXT,
            )

    async def read():
        async with sessions() as db:
            pid_ready.set_result(await db.scalar(text("SELECT pg_backend_pid()")))
            try:
                return await queries.public_members(
                    db, actor=target, project_id=project_id
                )
            except BusinessError as error:
                return error

    closing = asyncio.create_task(close())
    reading = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        reading = asyncio.create_task(read())
        pid = await pid_ready
        async with asyncio.timeout(10):
            async with sessions() as db:
                while not await db.scalar(
                    text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": pid}
                ):
                    assert not reading.done(), (
                        "Member disclosure bypassed the source transition lock"
                    )
                    await asyncio.sleep(0.01)
    finally:
        hold.release.set()
        results = await asyncio.gather(
            closing, *([reading] if reading else []), return_exceptions=True
        )
    assert results[0].current.status == "CLOSED"
    assert isinstance(results[1], BusinessError) and results[1].status_code == 404


class HeldAudit(AuditLogWriter):
    def __init__(self):
        super().__init__()
        self.entered = asyncio.Event()
        self.release = asyncio.Event()

    async def append(self, *args, **kwargs):
        self.entered.set()
        await self.release.wait()
        return await super().append(*args, **kwargs)


async def accepted(committed):
    sessions, service, project_id, owner, target, reference = committed
    async with sessions() as db:
        row = await service.invite(
            db,
            actor=owner,
            project_id=project_id,
            payload=CollaborationInviteCommand(
                request_id=uuid4(), target_ref=reference, kind="MANAGER"
            ),
            context=CONTEXT,
        )
        return await service.act(
            db,
            actor=target,
            collaboration_id=row.id,
            action="accept",
            payload=CollaborationVersionCommand(
                request_id=uuid4(), version=row.version
            ),
            context=CONTEXT,
        )


async def blocked(sessions, pid):
    async with asyncio.timeout(10):
        async with sessions() as db:
            while not await db.scalar(
                text("SELECT cardinality(pg_blocking_pids(:pid)) > 0"), {"pid": pid}
            ):
                await asyncio.sleep(0.01)


async def test_revocation_commits_before_waiting_save_rechecks_management(
    committed, clock
):
    sessions, _, project_id, owner, target, _ = committed
    relation = await accepted(committed)
    hold = HeldAudit()
    revoke_service = CollaborationService(clock=clock, audit=hold)
    workspace = CollaborationWorkspaceService(clock=clock)
    pid_ready = asyncio.Future()

    async def revoke():
        async with sessions() as db:
            return await revoke_service.act(
                db,
                actor=owner,
                collaboration_id=relation.id,
                action="revoke",
                payload=CollaborationVersionCommand(
                    request_id=uuid4(), version=relation.version
                ),
                context=CONTEXT,
            )

    async def save():
        async with sessions() as db:
            pid_ready.set_result(await db.scalar(text("SELECT pg_backend_pid()")))
            try:
                return await workspace.save(
                    db,
                    actor=target,
                    project_id=project_id,
                    payload=CollaborationProjectSaveCommand(
                        request_id=uuid4(),
                        version=1,
                        title="LATE_WRITE",
                        summary="",
                        direction="",
                        stage="",
                        team_status="",
                    ),
                    context=CONTEXT,
                )
            except BusinessError as error:
                return error

    revoking = asyncio.create_task(revoke())
    saving = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        saving = asyncio.create_task(save())
        await blocked(sessions, await pid_ready)
    finally:
        hold.release.set()
        results = await asyncio.gather(
            revoking, *([saving] if saving else []), return_exceptions=True
        )
    assert results[0].status == "REVOKED"
    assert isinstance(results[1], BusinessError) and results[1].status_code == 404
    async with sessions() as db:
        assert (
            await db.scalar(
                select(ProjectDraft.title).where(ProjectDraft.id == project_id)
            )
            == "私有项目"
        )


async def test_owner_and_manager_same_version_save_cannot_overwrite_each_other(
    committed, clock
):
    sessions, _, project_id, owner, target, _ = committed
    await accepted(committed)
    barrier = asyncio.Barrier(2)
    workspace = CollaborationWorkspaceService(clock=clock)

    async def run(actor, title):
        async with sessions() as db:
            await barrier.wait()
            try:
                return await workspace.save(
                    db,
                    actor=actor,
                    project_id=project_id,
                    payload=CollaborationProjectSaveCommand(
                        request_id=uuid4(),
                        version=1,
                        title=title,
                        summary="",
                        direction="",
                        stage="",
                        team_status="",
                    ),
                    context=CONTEXT,
                )
            except BusinessError as error:
                return error

    results = await asyncio.wait_for(
        asyncio.gather(run(owner, "OWNER_SAVE"), run(target, "MANAGER_SAVE")),
        timeout=15,
    )
    assert sum(isinstance(result, BusinessError) for result in results) == 1
    async with sessions() as db:
        project = await db.get(ProjectDraft, project_id)
        assert project.version == 2
        assert project.title in {"OWNER_SAVE", "MANAGER_SAVE"}


@pytest.mark.parametrize("first", ["submit", "save"])
async def test_saved_achievement_and_owner_submission_serialize_without_stale_snapshot(
    committed, clock, first
):
    sessions, _, project_id, owner, target, _ = committed
    await accepted(committed)
    async with sessions() as db:
        project = await db.get(ProjectDraft, project_id)
        project.summary, project.direction, project.stage, project.team_status = (
            "简介",
            "教育",
            "原型",
            "团队",
        )
        db.add(
            OwnerProfile(
                user_id=owner.user_id,
                name="模拟负责人",
                student_no="000123",
                major="示例",
                grade="2026",
            )
        )
        achievement = AchievementDraft(
            project_id=project_id,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="a" * 64,
            title="成果",
            description="SAVED_DESCRIPTION",
        )
        db.add(achievement)
        await db.flush()
        achievement_id = achievement.id
        evidence = AchievementEvidence(
            achievement_id=achievement_id,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="b" * 64,
            object_key=f"r6-race/{uuid4()}.pdf",
            content_type="application/pdf",
            size=len(PDF),
            state="READY",
            sha256=hashlib.sha256(PDF).hexdigest(),
            version=1,
            upload_url="https://example.invalid/upload",
            client_headers={},
            upload_expires_at=clock.now() + timedelta(minutes=5),
            expires_at=clock.now() + timedelta(hours=1),
            created_at=clock.now(),
            updated_at=clock.now(),
        )
        db.add_all([evidence, AchievementWorkflow(achievement_id=achievement_id)])
        await db.flush()
        proof_id = evidence.id
        await db.commit()
    hold = HeldAudit()
    review = AchievementReviewService(
        clock=clock, audit=hold if first == "submit" else None
    )
    workspace = CollaborationWorkspaceService(
        clock=clock, audit=hold if first == "save" else None
    )
    pid_ready = asyncio.Future()

    async def run(action, waiting=False):
        async with sessions() as db:
            if waiting:
                pid_ready.set_result(await db.scalar(text("SELECT pg_backend_pid()")))
            try:
                if action == "submit":
                    return await review.submit(
                        db,
                        actor=owner,
                        project_id=project_id,
                        achievement_id=achievement_id,
                        payload=SavedRevisionCommand(
                            request_id=uuid4(),
                            workflow_version=1,
                            project_version=1,
                            achievement_version=1,
                            evidence_ids=[proof_id],
                        ),
                        context=CONTEXT,
                    )
                return await workspace.save_achievement(
                    db,
                    actor=target,
                    project_id=project_id,
                    achievement_id=achievement_id,
                    payload=CollaborationAchievementSaveCommand(
                        request_id=uuid4(),
                        version=1,
                        title="成果",
                        description="NEW_DESCRIPTION",
                        work_url="",
                        award_text="",
                    ),
                    context=CONTEXT,
                )
            except BusinessError as error:
                await db.rollback()
                return error

    leading = asyncio.create_task(run(first))
    following = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        following = asyncio.create_task(
            run("save" if first == "submit" else "submit", True)
        )
        await blocked(sessions, await pid_ready)
    finally:
        hold.release.set()
        results = await asyncio.gather(
            leading, *([following] if following else []), return_exceptions=True
        )
    assert not isinstance(results[0], BaseException)
    assert isinstance(results[1], BusinessError) and results[1].status_code == 409
    async with sessions() as db:
        count = await db.scalar(
            select(func.count())
            .select_from(AchievementReviewCase)
            .where(AchievementReviewCase.achievement_id == achievement_id)
        )
        row = await db.get(AchievementDraft, achievement_id)
        assert count == (1 if first == "submit" else 0)
        assert row.description == (
            "SAVED_DESCRIPTION" if first == "submit" else "NEW_DESCRIPTION"
        )
        if first == "submit":
            revision = await db.scalar(
                select(AchievementRevision).where(
                    AchievementRevision.achievement_id == achievement_id
                )
            )
            assert revision.achievement_content["description"] == "SAVED_DESCRIPTION"
