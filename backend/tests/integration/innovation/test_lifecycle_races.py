"""Real parent/account locks fence transfer against every lifecycle command."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.errors import BusinessError
from app.modules.innovation.lifecycle_schemas import (
    IntroductionFields,
    IntroductionPreviewCommand,
    IntroductionPublishCommand,
    LifecycleCommand,
)
from app.modules.innovation.lifecycle_service import LifecycleService
from app.modules.innovation.models import ProjectDraft
from app.modules.innovation.recruitment_schemas import (
    RecruitmentDraftCreate,
    RecruitmentFields,
    RecruitmentVersionCommand,
)
from app.modules.innovation.recruitment_service import RecruitmentService
from app.modules.innovation.transfer_service import TransferService
from tests.fakes.integrations import FakeObjectStorage
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import fields
from tests.integration.innovation.test_collaboration_races import CONTEXT
from tests.integration.innovation.test_collaboration_write_races import (
    HeldAudit,
    blocked,
)
from tests.integration.innovation.test_project_transfer_races import command, proposals
from tests.integration.innovation.test_project_transfer_races import (
    transfer_world as transfer_world,
)

pytestmark = pytest.mark.integration


async def prepared(sessions, data, clock, action):
    lifecycle = LifecycleService(clock=clock)
    recruitments = RecruitmentService(clock=clock)
    async with sessions() as db:
        job, _ = await recruitments.create(
            db,
            actor=data["owner"],
            project_id=data["project"],
            payload=RecruitmentDraftCreate(
                request_id=uuid4(), fields=RecruitmentFields.model_validate(fields())
            ),
            context=CONTEXT,
        )
        await recruitments.publish(
            db,
            actor=data["owner"],
            project_id=data["project"],
            recruitment_id=job.id,
            payload=RecruitmentVersionCommand(request_id=uuid4(), version=job.version),
            context=CONTEXT,
        )
        state = await lifecycle.read(
            db, actor=data["owner"], project_id=data["project"], context=CONTEXT
        )
        if action != "complete":
            await lifecycle.act(
                db,
                actor=data["owner"],
                project_id=data["project"],
                action="complete",
                payload=LifecycleCommand(
                    request_id=uuid4(),
                    version=state.version,
                    confirmation_digest=state.confirmation_digest,
                ),
                context=CONTEXT,
            )
            state = await lifecycle.read(
                db, actor=data["owner"], project_id=data["project"], context=CONTEXT
            )
        if action == "publish":
            content = IntroductionFields(
                title="公开更正", summary="明确预览发布", direction="教育", stage="结项"
            )
            preview = await lifecycle.preview(
                db,
                actor=data["owner"],
                project_id=data["project"],
                payload=IntroductionPreviewCommand(
                    version=state.version, fields=content
                ),
                context=CONTEXT,
            )
            payload = IntroductionPublishCommand(
                request_id=uuid4(),
                version=state.version,
                fields=content,
                preview_digest=preview.preview_digest,
            )
        else:
            payload = LifecycleCommand(
                request_id=uuid4(),
                version=state.version,
                confirmation_digest=state.confirmation_digest,
            )
    _, rows = await proposals(sessions, data, clock)
    return rows[0], payload


@pytest.mark.parametrize("action", ["complete", "resume", "publish"])
@pytest.mark.parametrize("first", ["transfer", "lifecycle"])
async def test_transfer_and_lifecycle_waiters_recheck_authority_and_confirmation(
    transfer_world, clock, action, first
):
    sessions, data = transfer_world
    row, payload = await prepared(sessions, data, clock, action)
    hold = HeldAudit()
    transfers = TransferService(
        clock=clock,
        storage=FakeObjectStorage(clock=clock),
        audit=hold if first == "transfer" else None,
    )
    lifecycle = LifecycleService(
        clock=clock, audit=hold if first == "lifecycle" else None
    )
    pid_ready = asyncio.Future()

    async def run(kind, follower=False):
        async with sessions() as db:
            if follower:
                pid_ready.set_result(await db.scalar(select(func.pg_backend_pid())))
            try:
                if kind == "transfer":
                    return await transfers.act(
                        db,
                        actor=data["targets"][0],
                        transfer_id=row.id,
                        action="accept",
                        payload=command(row),
                        context=CONTEXT,
                    )
                if action == "publish":
                    return await lifecycle.publish(
                        db,
                        actor=data["owner"],
                        project_id=data["project"],
                        payload=payload,
                        context=CONTEXT,
                    )
                return await lifecycle.act(
                    db,
                    actor=data["owner"],
                    project_id=data["project"],
                    action=action,
                    payload=payload,
                    context=CONTEXT,
                )
            except BusinessError as exc:
                return exc

    leader = asyncio.create_task(run(first))
    follower = None
    try:
        await asyncio.wait_for(hold.entered.wait(), timeout=10)
        follower = asyncio.create_task(
            run("lifecycle" if first == "transfer" else "transfer", True)
        )
        await blocked(sessions, await asyncio.wait_for(pid_ready, timeout=10))
        hold.release.set()
        a, b = await asyncio.wait_for(asyncio.gather(leader, follower), timeout=20)
        assert not isinstance(a, BusinessError)
        assert isinstance(b, BusinessError) and b.status_code in {404, 409}
        async with sessions() as db:
            project = await db.get(ProjectDraft, data["project"])
            assert project.owner_user_id == (
                data["targets"][0].user_id
                if first == "transfer"
                else data["owner"].user_id
            )
            assert project.ownership_generation == (2 if first == "transfer" else 1)
            if first == "transfer" and action == "complete":
                assert project.public_introduction_id is None
                assert project.lifecycle == "ACTIVE"
    finally:
        hold.release.set()
        await asyncio.gather(
            *([leader, follower] if follower else [leader]), return_exceptions=True
        )
