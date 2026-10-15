"""Withdrawal wins over any concurrently accepted display association."""

import asyncio
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.errors import BusinessError
from app.modules.innovation.mentor_link_service import MentorLinkService
from app.modules.innovation.mentor_models import MentorProfile, ProjectMentorLink
from app.modules.innovation.mentor_schemas import (
    MentorVersionCommand,
    ProjectMentorCreateCommand,
)
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.test_mentor_races import CONTEXT, create, publish
from tests.integration.innovation.test_mentor_races import committed as committed

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("trial", range(3))
async def test_accept_racing_with_profile_withdrawal_cannot_leave_a_live_link(
    committed, trial
):
    sessions, service, data = committed
    owner, mentor, *_ = data
    profile = await publish(
        sessions, service, data, await create(sessions, service, data)
    )
    async with sessions() as db:
        db.add(
            OwnerQualification(
                user_id=owner.user_id,
                status="APPROVED",
                version=1,
                profile_version=1,
                name="模拟负责人",
                student_no="123456",
                major="示例",
                grade="2026",
                requested_at=service.clock.now(),
                approved_at=service.clock.now(),
                approved_by=owner.user_id,
            )
        )
        project = ProjectDraft(
            owner_user_id=owner.user_id,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="a" * 64,
            title="并发私有项目",
            summary="私有摘要",
            direction="学习",
            stage="",
            team_status="",
            version=1,
            created_at=service.clock.now(),
            updated_at=service.clock.now(),
        )
        db.add(project)
        await db.commit()
        project_id = project.id
    links = MentorLinkService(clock=service.clock)
    async with sessions() as db:
        link = await links.request(
            db,
            actor=owner,
            project_id=project_id,
            payload=ProjectMentorCreateCommand(
                request_id=uuid4(), mentor_id=profile.id
            ),
            context=CONTEXT,
        )
    accept_command = MentorVersionCommand(request_id=uuid4(), version=link.version)
    barrier = asyncio.Barrier(2)
    connection_pids = []

    async def accept():
        async with sessions() as db:
            connection_pids.append(await db.scalar(text("SELECT pg_backend_pid()")))
            await barrier.wait()
            try:
                return await links.act(
                    db,
                    actor=mentor,
                    link_id=link.id,
                    action="accept",
                    payload=accept_command,
                    context=CONTEXT,
                )
            except BusinessError as error:
                assert error.status_code == 409
                return None

    async def withdraw():
        async with sessions() as db:
            connection_pids.append(await db.scalar(text("SELECT pg_backend_pid()")))
            await barrier.wait()
            return await service.act(
                db,
                actor=mentor,
                action="withdraw",
                payload=MentorVersionCommand(
                    request_id=uuid4(), version=profile.version
                ),
                context=CONTEXT,
            )

    accepted, withdrawn = await asyncio.wait_for(
        asyncio.gather(accept(), withdraw()), 15
    )
    assert len(set(connection_pids)) == 2
    assert withdrawn.current.visibility == "HIDDEN"
    async with sessions() as db:
        stored_profile = await db.scalar(
            select(MentorProfile).where(MentorProfile.id == profile.id)
        )
        stored_link = await db.get(ProjectMentorLink, link.id)
        assert stored_profile.visibility == "HIDDEN"
        assert stored_profile.authorized_fields == []
        assert stored_profile.accepting_contact is False
        assert stored_link.status == "REVOKED"
    if accepted is not None:
        async with sessions() as db:
            replay = await links.act(
                db,
                actor=mentor,
                link_id=link.id,
                action="accept",
                payload=accept_command,
                context=CONTEXT,
            )
        assert replay.status == "REVOKED"
