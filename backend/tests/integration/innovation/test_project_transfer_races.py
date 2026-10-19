"""Separate PG sessions prove single acceptance and late authority rechecks."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.core.errors import BusinessError
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_schemas import (
    CollaborationProjectSaveCommand,
    TargetResolveCommand,
)
from app.modules.innovation.collaboration_service import CollaborationService
from app.modules.innovation.collaboration_workspace_service import (
    CollaborationWorkspaceService,
)
from app.modules.innovation.mentor_link_service import MentorLinkService
from app.modules.innovation.mentor_models import MentorProfile, ProjectMentorLink
from app.modules.innovation.mentor_schemas import MentorVersionCommand
from app.modules.innovation.models import ProjectDraft
from app.modules.innovation.transfer_models import ProjectTransfer, TransferReceipt
from app.modules.innovation.transfer_schemas import TransferCommand, TransferCreate
from app.modules.innovation.transfer_service import TransferService
from tests.e2e.factories import clean_world
from tests.fakes.integrations import FakeObjectStorage
from tests.integration.db_guard import require_test_database
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_achievement_review_operations import account
from tests.integration.innovation.test_collaboration_races import CONTEXT
from tests.integration.innovation.test_collaboration_write_races import (
    HeldAudit,
    blocked,
)

pytestmark = pytest.mark.integration


@pytest.fixture
async def transfer_world(db_engine, clock):
    require_test_database(get_settings().database_url)
    sessions = async_sessionmaker(db_engine, expire_on_commit=False)
    async with sessions() as db:
        owner, project, _, _ = await world(db, clock)
        a, _, _, _ = await world(db, clock)
        b, _, _, _ = await world(db, clock)
        teacher, _ = await account(db, clock, role="TEACHER")
        for user in (owner, a, b):
            user.username = str(uuid4().int)[:12]
        mentor = MentorProfile(
            user_id=teacher.id,
            fields={"name": "已同意导师"},
            version=1,
            public_version=0,
            confirmation_state="PENDING",
            visibility="HIDDEN",
            moderation_state="NORMAL",
            accepting_contact=False,
            authorized_fields=[],
            created_at=clock.now(),
            updated_at=clock.now(),
        )
        db.add(mentor)
        await db.flush()
        link = ProjectMentorLink(
            project_id=project.id,
            mentor_id=mentor.id,
            requested_by=owner.id,
            project_snapshot={
                "title": "公开已同意",
                "summary": "已公开简介",
                "direction": "教育",
            },
            status="ACCEPTED",
            version=2,
            created_at=clock.now(),
            updated_at=clock.now(),
        )
        db.add(link)
        await db.flush()
        users = [owner.id, a.id, b.id, teacher.id]
        data = {
            "project": project.id,
            "owner": Actor(owner.id, Role.STUDENT),
            "targets": [Actor(a.id, Role.STUDENT), Actor(b.id, Role.STUDENT)],
            "usernames": [a.username, b.username],
            "link": link.id,
        }
        await db.commit()
    try:
        yield sessions, data
    finally:
        await clean_world(sessions, user_ids=users)


async def proposals(sessions, data, clock):
    collaboration = CollaborationService(clock=clock)
    transfers = TransferService(clock=clock, storage=FakeObjectStorage(clock=clock))
    rows = []
    async with sessions() as db:
        for username in data["usernames"]:
            ref = await collaboration.resolve(
                db,
                actor=data["owner"],
                payload=TargetResolveCommand(account=username),
                context=CONTEXT,
            )
            rows.append(
                await transfers.request(
                    db,
                    actor=data["owner"],
                    project_id=data["project"],
                    payload=TransferCreate(
                        request_id=uuid4(),
                        target_ref=ref.target_ref,
                        evidence_ids=[],
                        allow_preview=False,
                    ),
                    context=CONTEXT,
                )
            )
    return transfers, rows


def command(row):
    return TransferCommand(
        request_id=uuid4(),
        version=row.version,
        confirmation_digest=row.confirmation_digest,
    )


async def test_two_successors_confirm_simultaneously_only_one_becomes_owner(
    transfer_world, clock
):
    sessions, data = transfer_world
    service, rows = await proposals(sessions, data, clock)
    barrier = asyncio.Barrier(2)

    async def accept(index):
        async with sessions() as db:
            await barrier.wait()
            try:
                return await service.act(
                    db,
                    actor=data["targets"][index],
                    transfer_id=rows[index].id,
                    action="accept",
                    payload=command(rows[index]),
                    context=CONTEXT,
                )
            except BusinessError as exc:
                return exc

    results = await asyncio.wait_for(asyncio.gather(accept(0), accept(1)), timeout=20)
    assert (
        sum(isinstance(r, BusinessError) and r.status_code == 409 for r in results) == 1
    )
    async with sessions() as db:
        project = await db.get(ProjectDraft, data["project"])
        assert project.owner_user_id in {a.user_id for a in data["targets"]}
        assert project.ownership_generation == 2
        assert list(
            await db.scalars(
                select(ProjectTransfer.status)
                .where(ProjectTransfer.project_id == data["project"])
                .order_by(ProjectTransfer.status)
            )
        ) == ["ACCEPTED", "INVALIDATED"]
        assert (
            await db.scalar(
                select(func.count())
                .select_from(TransferReceipt)
                .where(TransferReceipt.transfer_id.in_([r.id for r in rows]))
            )
            == 1
        )


@pytest.mark.parametrize("late_action", ["save", "mentor_revoke"])
async def test_transfer_commits_before_old_owner_waiting_action_rechecks_authority(
    transfer_world, clock, late_action
):
    sessions, data = transfer_world
    _, rows = await proposals(sessions, data, clock)
    row = rows[0]
    held = HeldAudit()
    service = TransferService(
        clock=clock, storage=FakeObjectStorage(clock=clock), audit=held
    )
    pid_ready = asyncio.Future()

    async def accept():
        async with sessions() as db:
            return await service.act(
                db,
                actor=data["targets"][0],
                transfer_id=row.id,
                action="accept",
                payload=command(row),
                context=CONTEXT,
            )

    async def late():
        async with sessions() as db:
            pid_ready.set_result(await db.scalar(select(func.pg_backend_pid())))
            try:
                if late_action == "mentor_revoke":
                    return await MentorLinkService(clock=clock).act(
                        db,
                        actor=data["owner"],
                        link_id=data["link"],
                        action="revoke",
                        payload=MentorVersionCommand(request_id=uuid4(), version=2),
                        context=CONTEXT,
                    )
                return await CollaborationWorkspaceService(clock=clock).save(
                    db,
                    actor=data["owner"],
                    project_id=data["project"],
                    payload=CollaborationProjectSaveCommand(
                        request_id=uuid4(),
                        version=1,
                        title="OLD_OWNER_LATE_WRITE",
                        summary="",
                        direction="",
                        stage="",
                        team_status="",
                    ),
                    context=CONTEXT,
                )
            except BusinessError as exc:
                return exc

    leader = asyncio.create_task(accept())
    follower = None
    try:
        await asyncio.wait_for(held.entered.wait(), timeout=10)
        follower = asyncio.create_task(late())
        await blocked(sessions, await asyncio.wait_for(pid_ready, timeout=10))
        held.release.set()
        first, second = await asyncio.wait_for(
            asyncio.gather(leader, follower), timeout=20
        )
        assert first.status == "ACCEPTED"
        assert isinstance(second, BusinessError) and second.status_code in {404, 409}
        async with sessions() as db:
            project = await db.get(ProjectDraft, data["project"])
            assert project.title != "OLD_OWNER_LATE_WRITE"
            assert (await db.get(ProjectMentorLink, data["link"])).status == "ACCEPTED"
    finally:
        held.release.set()
        await asyncio.gather(
            *([leader, follower] if follower else [leader]), return_exceptions=True
        )


async def test_saving_before_waiting_acceptance_requires_new_confirmation(
    transfer_world, clock
):
    sessions, data = transfer_world
    service, rows = await proposals(sessions, data, clock)
    hold = HeldAudit()
    workspace = CollaborationWorkspaceService(clock=clock, audit=hold)
    pid_ready = asyncio.Future()

    async def save():
        async with sessions() as db:
            return await workspace.save(
                db,
                actor=data["owner"],
                project_id=data["project"],
                payload=CollaborationProjectSaveCommand(
                    request_id=uuid4(),
                    version=1,
                    title="已保存新标题",
                    summary="",
                    direction="",
                    stage="",
                    team_status="",
                ),
                context=CONTEXT,
            )

    async def accept():
        async with sessions() as db:
            pid_ready.set_result(await db.scalar(select(func.pg_backend_pid())))
            try:
                return await service.act(
                    db,
                    actor=data["targets"][0],
                    transfer_id=rows[0].id,
                    action="accept",
                    payload=command(rows[0]),
                    context=CONTEXT,
                )
            except BusinessError as exc:
                return exc

    leader = asyncio.create_task(save())
    follower = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        follower = asyncio.create_task(accept())
        await blocked(sessions, await asyncio.wait_for(pid_ready, timeout=10))
        hold.release.set()
        results = await asyncio.wait_for(asyncio.gather(leader, follower), timeout=20)
        assert isinstance(results[1], BusinessError) and results[1].status_code == 409
        async with sessions() as db:
            project = await db.get(ProjectDraft, data["project"])
            assert project.owner_user_id == data["owner"].user_id
            assert project.title == "已保存新标题"
    finally:
        hold.release.set()
        await asyncio.gather(
            *([leader, follower] if follower else [leader]), return_exceptions=True
        )


async def test_cancel_while_storage_reads_never_returns_bytes_and_keeps_read_fact(
    transfer_world, clock, monkeypatch
):
    import threading

    from app.modules.innovation.collaboration_models import ProjectParticipation
    from app.modules.innovation.evidence_schemas import EvidenceIntentCreate
    from app.modules.innovation.evidence_service import EvidenceService
    from app.modules.innovation.models import AchievementDraft
    from tests.integration.innovation.test_achievement_evidence import PDF, Scanner

    sessions, data = transfer_world
    storage = FakeObjectStorage(clock=clock)
    evidence_service = EvidenceService(clock=clock, storage=storage, scanner=Scanner())
    transfers = TransferService(clock=clock, storage=storage)
    async with sessions() as db:
        achievement = AchievementDraft(
            project_id=data["project"],
            creation_request_id=uuid4(),
            creation_payload_fingerprint="a" * 64,
            title="证明",
        )
        db.add(achievement)
        await db.flush()
        achievement_id = achievement.id
        await db.commit()
        signed, _ = await evidence_service.create_intent(
            db,
            actor=data["owner"],
            project_id=data["project"],
            achievement_id=achievement_id,
            payload=EvidenceIntentCreate(
                request_id=uuid4(), content_type="application/pdf", size=len(PDF)
            ),
        )
        storage.put_object(object_key=storage.upload_urls[-1].object_key, content=PDF)
        checked = await evidence_service.complete(
            db,
            actor=data["owner"],
            project_id=data["project"],
            achievement_id=achievement_id,
            evidence_id=signed.evidence.id,
        )
        ref = await CollaborationService(clock=clock).resolve(
            db,
            actor=data["owner"],
            payload=TargetResolveCommand(account=data["usernames"][0]),
            context=CONTEXT,
        )
        row = await transfers.request(
            db,
            actor=data["owner"],
            project_id=data["project"],
            payload=TransferCreate(
                request_id=uuid4(),
                target_ref=ref.target_ref,
                evidence_ids=[checked.id],
                allow_preview=True,
            ),
            context=CONTEXT,
        )
    storage_entered, storage_release = asyncio.Event(), threading.Event()
    original_read = storage.read_bounded_object
    loop = asyncio.get_running_loop()

    def paused_read(**kwargs):
        loop.call_soon_threadsafe(storage_entered.set)
        if not storage_release.wait(timeout=15):
            raise TimeoutError("test did not release external read")
        return original_read(**kwargs)

    monkeypatch.setattr(storage, "read_bounded_object", paused_read)

    async def read():
        async with sessions() as db:
            try:
                return await transfers.read_evidence(
                    db,
                    actor=data["targets"][0],
                    transfer_id=row.id,
                    evidence_id=checked.id,
                    version=row.version,
                    context=CONTEXT,
                )
            except BusinessError as exc:
                return exc

    reading = asyncio.create_task(read())
    try:
        await asyncio.wait_for(storage_entered.wait(), timeout=10)
        # An independent connection observes the committed audit-side fact
        # before the provider is allowed to return even one byte to the service.
        async with sessions() as db:
            assert (
                await db.scalar(
                    select(ProjectParticipation.id).where(
                        ProjectParticipation.project_id == data["project"],
                        ProjectParticipation.user_id == data["targets"][0].user_id,
                        ProjectParticipation.kind == "EVIDENCE_READER",
                    )
                )
                is not None
            )
            await transfers.act(
                db,
                actor=data["owner"],
                transfer_id=row.id,
                action="cancel",
                payload=command(row),
                context=CONTEXT,
            )
        storage_release.set()
        result = await asyncio.wait_for(reading, timeout=15)
        assert isinstance(result, BusinessError) and result.status_code == 404
    finally:
        storage_release.set()
        await asyncio.gather(reading, return_exceptions=True)


@pytest.mark.parametrize("first", ["submit", "transfer"])
async def test_transfer_and_submission_cannot_use_stale_owner_or_review_state(
    transfer_world, clock, first
):
    import hashlib
    from datetime import timedelta

    from app.modules.innovation.evidence_models import AchievementEvidence
    from app.modules.innovation.models import AchievementDraft, OwnerProfile
    from app.modules.innovation.review_models import (
        AchievementReviewCase,
        AchievementWorkflow,
    )
    from app.modules.innovation.review_schemas import SavedRevisionCommand
    from app.modules.innovation.review_service import AchievementReviewService
    from tests.integration.innovation.test_achievement_evidence import PDF

    sessions, data = transfer_world
    async with sessions() as db:
        project = await db.get(ProjectDraft, data["project"])
        project.summary, project.direction, project.stage, project.team_status = (
            "保存概况",
            "教育",
            "原型",
            "团队",
        )
        db.add(
            OwnerProfile(
                user_id=data["owner"].user_id,
                name="本人",
                student_no="000123",
                major="专业",
                grade="2026",
            )
        )
        achievement = AchievementDraft(
            project_id=data["project"],
            creation_request_id=uuid4(),
            creation_payload_fingerprint="a" * 64,
            title="成果",
            description="已保存成果",
        )
        db.add(achievement)
        await db.flush()
        achievement_id = achievement.id
        proof = AchievementEvidence(
            achievement_id=achievement_id,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="b" * 64,
            object_key=f"r6-transfer-submit/{uuid4()}.pdf",
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
        db.add_all([proof, AchievementWorkflow(achievement_id=achievement_id)])
        await db.flush()
        proof_id = proof.id
        await db.commit()
    _, rows = await proposals(sessions, data, clock)
    hold = HeldAudit()
    transfers = TransferService(
        clock=clock,
        storage=FakeObjectStorage(clock=clock),
        audit=hold if first == "transfer" else None,
    )
    reviews = AchievementReviewService(
        clock=clock, audit=hold if first == "submit" else None
    )
    pid_ready = asyncio.Future()

    async def run(action, waiting=False):
        async with sessions() as db:
            if waiting:
                pid_ready.set_result(await db.scalar(select(func.pg_backend_pid())))
            try:
                if action == "transfer":
                    return await transfers.act(
                        db,
                        actor=data["targets"][0],
                        transfer_id=rows[0].id,
                        action="accept",
                        payload=command(rows[0]),
                        context=CONTEXT,
                    )
                return await reviews.submit(
                    db,
                    actor=data["owner"],
                    project_id=data["project"],
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
            except BusinessError as error:
                return error

    leader = asyncio.create_task(run(first))
    follower = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        follower = asyncio.create_task(
            run("submit" if first == "transfer" else "transfer", True)
        )
        await blocked(sessions, await asyncio.wait_for(pid_ready, timeout=10))
        hold.release.set()
        results = await asyncio.wait_for(asyncio.gather(leader, follower), timeout=20)
        assert not isinstance(results[0], BusinessError)
        assert isinstance(results[1], BusinessError) and results[1].status_code in {
            404,
            409,
        }
        async with sessions() as db:
            project = await db.get(ProjectDraft, data["project"])
            assert project.owner_user_id == (
                data["targets"][0].user_id
                if first == "transfer"
                else data["owner"].user_id
            )
            count = await db.scalar(
                select(func.count())
                .select_from(AchievementReviewCase)
                .where(AchievementReviewCase.achievement_id == achievement_id)
            )
            assert count == (0 if first == "transfer" else 1)
    finally:
        hold.release.set()
        await asyncio.gather(
            *([leader, follower] if follower else [leader]), return_exceptions=True
        )
