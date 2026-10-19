"""Personal project categories disclose only what each accepted purpose permits."""

from uuid import uuid4

import pytest
from sqlalchemy import update

from app.modules.innovation.models import ProjectDraft
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import (
    command as recruitment_command,
)
from tests.integration.innovation.recruitment_support import created
from tests.integration.innovation.test_achievement_review_operations import account
from tests.integration.innovation.test_collaboration import command, invite

pytestmark = pytest.mark.integration
PERSONAL = "/api/v1/ie/me/collaboration-projects"


@pytest.mark.parametrize("kind", ["MANAGER", "MEMBER"])
async def test_personal_category_requires_consent_and_member_never_gets_current_draft(
    client, db_session, clock, kind
):
    _, project, oh, _, th, _, _, row = await invite(
        client,
        db_session,
        clock,
        kind=kind,
        **({"public_name": "本人同意", "division": "调研"} if kind == "MEMBER" else {}),
    )
    project_id = project.id
    before = await client.get(PERSONAL, headers=th, params={"role": kind})
    assert before.status_code == 200, before.text
    assert before.json()["total"] == 0
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert accepted.status_code == 200
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(title="NEW_PRIVATE_TITLE", summary="NEW_PRIVATE_SUMMARY")
    )
    await db_session.commit()
    result = await client.get(PERSONAL, headers=th, params={"role": kind})
    assert result.status_code == 200, result.text
    assert result.json()["total"] == 1
    item = result.json()["items"][0]
    assert item["project_id"] == str(project_id)
    assert item["can_edit"] == (kind == "MANAGER")
    assert item["can_open_public"] is False
    if kind == "MEMBER":
        assert "NEW_PRIVATE" not in result.text
        assert item["public_name"] == "本人同意"
    else:
        assert item["title"] == "NEW_PRIVATE_TITLE"
    owned = await client.get(PERSONAL, headers=oh, params={"role": "OWNER"})
    assert owned.json()["total"] == 1
    assert owned.json()["items"][0]["can_edit"]
    ended = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/revoke",
        headers=th,
        json=command(accepted.json()),
    )
    assert ended.status_code == 200
    assert (await client.get(PERSONAL, headers=th, params={"role": kind})).json()[
        "total"
    ] == 0


async def test_public_members_only_show_confirmed_name_and_rejected_candidate_keeps_old(
    client, db_session, clock
):
    _, project, oh, rec_path, recruitment = await created(client, db_session, clock)
    project_id = project.id
    assert (
        await client.post(
            rec_path + "/publish", headers=oh, json=recruitment_command(recruitment)
        )
    ).status_code == 200
    target, th = await account(db_session, clock)
    target.username = str(uuid4().int)[:12]
    username = target.username
    await db_session.commit()
    reference = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=oh,
            json={"account": username},
        )
    ).json()["target_ref"]
    path = f"/api/v1/ie/me/project-drafts/{project_id}/collaborators"
    public = f"/api/v1/ie/projects/{project_id}/members"
    payload = {
        "request_id": str(uuid4()),
        "target_ref": reference,
        "kind": "MEMBER",
        "public_name": "本人确认名",
        "division": "调研",
    }
    candidate = (await client.post(path, headers=oh, json=payload)).json()
    empty = await client.get(public, headers=th)
    assert empty.status_code == 200, empty.text
    assert empty.json() == {"items": []}
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{candidate['id']}/accept",
        headers=th,
        json=command(candidate),
    )
    assert accepted.status_code == 200
    shown = await client.get(public, headers=th)
    assert shown.json() == {
        "items": [{"public_name": "本人确认名", "division": "调研"}]
    }
    assert username not in shown.text
    next_candidate = (
        await client.post(
            path,
            headers=oh,
            json={**payload, "request_id": str(uuid4()), "public_name": "未同意新名"},
        )
    ).json()
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{next_candidate['id']}/reject",
            headers=th,
            json=command(next_candidate),
        )
    ).status_code == 200
    assert (await client.get(public, headers=th)).json() == shown.json()
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{candidate['id']}/revoke",
            headers=oh,
            json=command(accepted.json()),
        )
    ).status_code == 200
    assert (await client.get(public, headers=th)).json() == {"items": []}


async def test_member_relationship_cannot_publish_a_private_project(
    client, db_session, clock
):
    _, project, _, _, th, _, _, row = await invite(
        client, db_session, clock, kind="MEMBER", public_name="成员", division="调研"
    )
    project_id = project.id
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{row['id']}/accept",
            headers=th,
            json=command(row),
        )
    ).status_code == 200
    assert (
        await client.get(f"/api/v1/ie/projects/{project_id}/members", headers=th)
    ).status_code == 404


async def test_personal_projects_reach_old_pages_without_silent_truncation(
    client, db_session, clock
):
    owner, _, oh, _, _, _, _, _ = await invite(client, db_session, clock)
    db_session.add_all(
        [
            ProjectDraft(
                owner_user_id=owner.id,
                creation_request_id=uuid4(),
                creation_payload_fingerprint="a" * 64,
                title=f"历史项目{i}",
            )
            for i in range(201)
        ]
    )
    await db_session.commit()
    items = []
    for offset in (0, 100, 200):
        page = await client.get(
            PERSONAL,
            headers=oh,
            params={"role": "OWNER", "limit": 100, "offset": offset},
        )
        assert page.status_code == 200, page.text
        assert page.json()["total"] == 202
        items.extend(page.json()["items"])
    assert len({item["project_id"] for item in items}) == 202


async def test_inactive_owner_still_leaves_manager_an_exit_without_current_private_text(
    client, db_session, clock
):
    from app.modules.identity.models import User

    owner, project, _, _, th, _, _, row = await invite(client, db_session, clock)
    owner_id, project_id = owner.id, project.id
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert accepted.status_code == 200
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(summary="INACTIVE_OWNER_NEW_PRIVATE")
    )
    await db_session.execute(
        update(User).where(User.id == owner_id).values(status="SUSPENDED")
    )
    await db_session.commit()
    page = await client.get(PERSONAL, headers=th, params={"role": "MANAGER"})
    assert page.status_code == 200, page.text
    assert page.json()["total"] == 1
    assert not page.json()["items"][0]["can_edit"]
    assert "INACTIVE_OWNER_NEW_PRIVATE" not in page.text
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{row['id']}/revoke",
            headers=th,
            json=command(accepted.json()),
        )
    ).status_code == 200
