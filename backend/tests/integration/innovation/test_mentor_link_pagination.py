"""Old actionable links remain reachable after more than 200 newer records."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest

from app.modules.identity.enums import Role
from app.modules.identity.models import User
from app.modules.innovation.mentor_models import MentorProfile, ProjectMentorLink
from app.modules.innovation.models import ProjectDraft
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import (
    command,
    confirm,
    fields,
    prepared,
)
from tests.integration.innovation.recruitment_support import world

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("side", ["mentor", "owner"])
async def test_paging_reaches_old_pending_and_accepted_links(
    client, db_session, clock, side
):
    _, _, _, mh, _, _, profile = await prepared(client, db_session, clock)
    profile = await confirm(client, mh, profile)
    owner, project, ph, _ = await world(db_session, clock)
    owner_id, project_id = owner.id, project.id
    mentor_id = UUID(profile["id"])
    old_links = []
    for index in range(202):
        linked_project, linked_mentor = project_id, mentor_id
        if side == "mentor":
            draft = ProjectDraft(
                owner_user_id=owner_id,
                creation_request_id=uuid4(),
                creation_payload_fingerprint="a" * 64,
                title=f"分页模拟项目{index}",
                summary="测试摘要",
                direction="学习",
                stage="",
                team_status="",
                version=1,
                created_at=clock.now(),
                updated_at=clock.now(),
            )
            db_session.add(draft)
            await db_session.flush()
            linked_project = draft.id
        else:
            user = User(
                username=f"page-mentor-{uuid4().hex}",
                password_hash="unused",
                nickname="分页模拟导师",
                role=Role.MENTOR,
                status="ACTIVE",
            )
            db_session.add(user)
            await db_session.flush()
            mentor = MentorProfile(
                user_id=user.id,
                fields=fields(),
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
            db_session.add(mentor)
            await db_session.flush()
            linked_mentor = mentor.id
        link = ProjectMentorLink(
            project_id=linked_project,
            mentor_id=linked_mentor,
            requested_by=owner_id,
            project_snapshot={
                "title": f"分页模拟项目{index}",
                "summary": "测试摘要",
                "direction": "学习",
            },
            status=("PENDING" if index == 0 else "ACCEPTED")
            if index < 2
            else "REVOKED",
            version=1,
            created_at=clock.now(),
            updated_at=clock.now() + timedelta(seconds=index),
        )
        db_session.add(link)
        await db_session.flush()
        if index < 2:
            old_links.append(str(link.id))
    await db_session.commit()
    base = (
        "/api/v1/ie/me/mentor/project-links"
        if side == "mentor"
        else f"/api/v1/ie/me/project-drafts/{project_id}/mentors"
    )
    headers = mh if side == "mentor" else ph
    response = await client.get(
        base, headers=headers, params={"limit": 100, "offset": 200}
    )
    assert response.status_code == 200, response.text
    page = response.json()
    assert {row["id"] for row in page["items"]} == set(old_links)
    assert (page["total"], page["limit"], page["offset"]) == (202, 100, 200)
    for row in page["items"]:
        action = (
            "accept" if side == "mentor" and row["status"] == "PENDING" else "revoke"
        )
        result = await client.post(
            f"/api/v1/ie/mentor-links/{row['id']}/{action}",
            headers=headers,
            json=command(row),
        )
        assert result.status_code == 200, result.text
    assert (
        await client.get(base, headers=headers, params={"limit": 101})
    ).status_code == 422
    assert (
        await client.get(base, headers=headers, params={"offset": -1})
    ).status_code == 422
