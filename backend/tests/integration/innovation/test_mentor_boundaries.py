"""R5 authority, snapshot search and invalid decisions over real HTTP/PG.

These cases follow the confirmed mentor design's user-visible boundaries.
Fixtures create identities; consent and publication always use product APIs.
"""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, update

from app.modules.identity.models import User
from app.modules.innovation.mentor_models import MentorProfile, ProjectMentorLink
from app.modules.innovation.models import OperationsGrant, OwnerQualification
from tests.integration.innovation.mentor_support import (
    ME,
    OPS,
    PUBLIC,
    command,
    confirm,
    fields,
    prepared,
)
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_achievement_review_operations import account

pytestmark = pytest.mark.integration


def confirmation(row, **changes):
    return {
        **command(row),
        "confirm_profile": True,
        "contact_channels": ["EMAIL"],
        "authorized_fields": ["directions"],
        "accepting_contact": True,
        **changes,
    }


def assert_conflict(response, kind):
    assert response.status_code == 409, response.text
    assert response.json()["error"]["details"]["kind"] == kind


async def create_profile(client, operator_headers, username, content=None):
    response = await client.post(
        OPS,
        headers=operator_headers,
        json={
            "request_id": str(uuid4()),
            "mentor_username": username,
            "fields": fields() if content is None else content,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["current"]


async def test_existing_teacher_can_confirm_own_profile_without_role_conversion(
    client, db_session, clock
):
    _, oh = await account(db_session, clock, operator=True)
    teacher, th = await account(db_session, clock, role="TEACHER")
    teacher_id, username = teacher.id, teacher.username
    await db_session.commit()
    row = await create_profile(client, oh, username)
    row = await confirm(client, th, row)
    own = await client.get(ME, headers=th)
    assert own.status_code == 200, own.text
    assert own.json()["profile"]["id"] == row["id"]
    assert own.json()["profile"]["confirmation_state"] == "CONFIRMED"
    assert await db_session.scalar(select(User.role).where(User.id == teacher_id)) == (
        "TEACHER"
    )
    assert (await client.get(f"{PUBLIC}/{row['id']}", headers=th)).status_code == 200


async def test_unbound_mentor_has_empty_home_but_no_fabricated_profile_actions(
    client, db_session, clock
):
    _, mh = await account(db_session, clock, role="MENTOR")
    _, oh = await account(db_session, clock, operator=True)
    await db_session.commit()
    own = await client.get(ME, headers=mh)
    assert own.status_code == 200 and own.json() == {"profile": None}
    links = await client.get(ME + "/project-links", headers=mh)
    assert links.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}
    assert (
        await client.post(
            ME + "/confirm", headers=mh, json=confirmation({"version": 1})
        )
    ).status_code == 404
    missing = str(uuid4())
    assert (await client.get(f"{OPS}/{missing}", headers=oh)).status_code == 404
    assert (await client.get(f"{PUBLIC}/{missing}", headers=mh)).status_code == 404


@pytest.mark.parametrize("role", ["ADMIN", "MENTOR"])
async def test_account_role_does_not_imply_operations_authority(
    client, db_session, clock, role
):
    _, _, _, _, _, _, row = await prepared(client, db_session, clock)
    _, headers = await account(db_session, clock, role=role)
    await db_session.commit()
    for path in (OPS, f"{OPS}/{row['id']}", f"{OPS}/{uuid4()}"):
        denied = await client.get(path, headers=headers)
        assert denied.status_code == 403, denied.text
        assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
        assert "mentor@example.com" not in denied.text


async def test_revoked_operator_cannot_read_list_create_or_replay_private_work(
    client, db_session, clock
):
    operator, oh = await account(db_session, clock, operator=True)
    mentor, _ = await account(db_session, clock, role="MENTOR")
    operator_id, username = operator.id, mentor.username
    await db_session.commit()
    payload = {
        "request_id": str(uuid4()),
        "mentor_username": username,
        "fields": fields(),
    }
    created = await client.post(OPS, headers=oh, json=payload)
    assert created.status_code == 200, created.text
    row = created.json()["current"]
    await db_session.execute(
        update(OperationsGrant)
        .where(OperationsGrant.user_id == operator_id)
        .values(enabled=False)
    )
    await db_session.commit()
    for path in (OPS, f"{OPS}/{row['id']}"):
        assert (await client.get(path, headers=oh)).status_code == 403
    for request_id in (payload["request_id"], str(uuid4())):
        denied = await client.post(
            OPS, headers=oh, json={**payload, "request_id": request_id}
        )
        assert denied.status_code == 403, denied.text
        assert "mentor@example.com" not in denied.text


@pytest.mark.parametrize("target_role", [None, "STUDENT", "ADMIN"])
async def test_binding_requires_an_existing_mentor_or_teacher_identity(
    client, db_session, clock, target_role
):
    _, oh = await account(db_session, clock, operator=True)
    if target_role:
        target, _ = await account(db_session, clock, role=target_role)
        username = target.username
    else:
        username = "nonexistent-mentor"
    await db_session.commit()
    rejected = await client.post(
        OPS,
        headers=oh,
        json={
            "request_id": str(uuid4()),
            "mentor_username": username,
            "fields": fields(),
        },
    )
    assert_conflict(rejected, "MENTOR_ACCOUNT_UNAVAILABLE")
    assert await db_session.scalar(select(func.count()).select_from(MentorProfile)) == 0


async def test_create_replay_retains_one_binding_and_rejects_new_payload(
    client, db_session, clock
):
    _, oh = await account(db_session, clock, operator=True)
    mentor, mh = await account(db_session, clock, role="MENTOR")
    username = mentor.username
    await db_session.commit()
    payload = {
        "request_id": str(uuid4()),
        "mentor_username": username,
        "fields": fields(),
    }
    original = await client.post(OPS, headers=oh, json=payload)
    assert original.status_code == 200, original.text
    row = await confirm(client, mh, original.json()["current"])
    replay = await client.post(OPS, headers=oh, json=payload)
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    assert replay.json()["current"]["version"] == row["version"]
    assert replay.json()["current"]["visibility"] == "VISIBLE"
    changed = await client.post(
        OPS, headers=oh, json={**payload, "fields": {**fields(), "unit": "另一个单位"}}
    )
    assert_conflict(changed, "REQUEST_REUSE")
    duplicate = await client.post(
        OPS, headers=oh, json={**payload, "request_id": str(uuid4())}
    )
    assert_conflict(duplicate, "PROFILE_EXISTS")


async def test_public_search_filters_and_paging_use_confirmed_snapshots_only(
    client, db_session, clock
):
    _, oh = await account(db_session, clock, operator=True)
    first, first_headers = await account(db_session, clock, role="MENTOR")
    second, second_headers = await account(db_session, clock, role="MENTOR")
    hidden, _ = await account(db_session, clock, role="MENTOR")
    first_name, second_name, hidden_name = (
        first.username,
        second.username,
        hidden.username,
    )
    await db_session.commit()
    first_row = await create_profile(
        client,
        oh,
        first_name,
        {**fields(), "name": "模拟导师甲100%", "directions": "AI_教育"},
    )
    first_row = await confirm(client, first_headers, first_row)
    second_row = await create_profile(
        client,
        oh,
        second_name,
        {**fields(), "name": "模拟导师乙1000", "directions": "AI学习"},
    )
    await confirm(
        client,
        second_headers,
        second_row,
        contact_channels=[],
        accepting_contact=False,
    )
    await create_profile(client, oh, hidden_name, {**fields(), "name": "隐藏模拟导师"})
    pending = await client.patch(
        f"{OPS}/{first_row['id']}",
        headers=oh,
        json={
            **command(first_row),
            "fields": {
                **first_row["fields"],
                "name": "未确认私稿姓名",
                "directions": "未确认私稿方向",
            },
        },
    )
    assert pending.status_code == 200, pending.text
    for params, expected_ids in (
        ({"q": "%"}, {first_row["id"]}),
        ({"direction": "_"}, {first_row["id"]}),
        ({"q": "未确认私稿"}, set()),
        ({"q": "隐藏模拟导师"}, set()),
        ({"direction": "AI", "accepting_contact": "false"}, {second_row["id"]}),
        ({"accepting_contact": "true"}, {first_row["id"]}),
    ):
        response = await client.get(PUBLIC, headers=oh, params=params)
        assert response.status_code == 200, response.text
        assert {item["id"] for item in response.json()["items"]} == expected_ids
        assert response.json()["total"] == len(expected_ids)
        assert "mentor@example.com" not in response.text
    pages = []
    for offset in (0, 1, 2):
        response = await client.get(
            PUBLIC, headers=oh, params={"limit": 1, "offset": offset}
        )
        data = response.json()
        assert (data["total"], data["limit"], data["offset"]) == (2, 1, offset)
        pages.extend(item["id"] for item in data["items"])
    assert len(pages) == len(set(pages)) == 2


async def test_operations_pages_include_pending_work_without_contact_values(
    client, db_session, clock
):
    _, oh, _, _, _, _, first = await prepared(client, db_session, clock)
    second, _ = await account(db_session, clock, role="MENTOR")
    username = second.username
    await db_session.commit()
    second_row = await create_profile(client, oh, username)
    ids = []
    for offset in (0, 1, 2):
        response = await client.get(
            OPS, headers=oh, params={"limit": 1, "offset": offset}
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert (data["total"], data["limit"], data["offset"]) == (2, 1, offset)
        assert "mentor@example.com" not in response.text
        ids.extend(item["id"] for item in data["items"])
    assert set(ids) == {first["id"], second_row["id"]} and len(ids) == 2
    for path in (OPS, PUBLIC):
        for params in ({"limit": 51}, {"offset": -1}):
            assert (
                await client.get(path, headers=oh, params=params)
            ).status_code == 422


async def test_save_rejects_no_change_and_stale_version_and_replay_is_current(
    client, db_session, clock
):
    _, oh, _, mh, _, _, row = await prepared(client, db_session, clock)
    no_change = await client.patch(
        f"{OPS}/{row['id']}",
        headers=oh,
        json={**command(row), "fields": row["fields"]},
    )
    assert_conflict(no_change, "NO_CHANGE")
    payload = {**command(row), "fields": {**row["fields"], "unit": "候选单位"}}
    saved = await client.patch(f"{OPS}/{row['id']}", headers=oh, json=payload)
    assert saved.status_code == 200, saved.text
    current = await confirm(client, mh, saved.json()["current"])
    replay = await client.patch(f"{OPS}/{row['id']}", headers=oh, json=payload)
    assert replay.status_code == 200 and replay.json()["replayed"] is True
    assert replay.json()["current"]["version"] == current["version"]
    stale = await client.patch(
        f"{OPS}/{row['id']}",
        headers=oh,
        json={**payload, "request_id": str(uuid4())},
    )
    assert_conflict(stale, "VERSION_CONFLICT")


@pytest.mark.parametrize("stage", ["confirm", "delegated_save"])
async def test_required_public_fields_cannot_be_removed_by_consent_or_delegation(
    client, db_session, clock, stage
):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    if stage == "delegated_save":
        row = await confirm(client, mh, row)
    saved = await client.patch(
        f"{OPS}/{row['id']}",
        headers=oh,
        json={**command(row), "fields": {**row["fields"], "directions": "   "}},
    )
    if stage == "confirm":
        assert saved.status_code == 200, saved.text
        row = saved.json()["current"]
        denied = await client.post(ME + "/confirm", headers=mh, json=confirmation(row))
        assert_conflict(denied, "INCOMPLETE_PROFILE")
        assert (
            await client.get(f"{PUBLIC}/{row['id']}", headers=vh)
        ).status_code == 404
    else:
        assert_conflict(saved, "INCOMPLETE_PROFILE")
        own = (await client.get(ME, headers=mh)).json()["profile"]
        assert own["version"] == row["version"]
        assert own["fields"]["directions"] == row["fields"]["directions"]
        public = (await client.get(f"{PUBLIC}/{row['id']}", headers=vh)).json()
        assert public["content"]["directions"] == row["fields"]["directions"]


async def test_confirmation_requires_existing_channels_and_well_formed_scope(
    client, db_session, clock
):
    _, _, _, mh, _, _, row = await prepared(client, db_session, clock)
    missing_channel = await client.post(
        ME + "/confirm",
        headers=mh,
        json=confirmation(row, contact_channels=["WECHAT"]),
    )
    assert_conflict(missing_channel, "CONTACT_CHANGED")
    for changes in (
        {"contact_channels": ["EMAIL", "EMAIL"]},
        {"contact_channels": [], "accepting_contact": True},
        {"authorized_fields": ["name"]},
        {"confirm_profile": False},
    ):
        invalid = await client.post(
            ME + "/confirm", headers=mh, json=confirmation(row, **changes)
        )
        assert invalid.status_code == 422, invalid.text
    own = (await client.get(ME, headers=mh)).json()["profile"]
    assert own["version"] == row["version"] and own["visibility"] == "HIDDEN"


async def test_hidden_or_finished_decisions_cannot_reapply_old_permissions(
    client, db_session, clock
):
    _, _, _, mh, _, _, row = await prepared(client, db_session, clock)
    for action, extra in (
        ("withdraw", {}),
        ("contact-state", {"accepting_contact": True}),
        ("maintenance-scope", {"authorized_fields": ["directions"]}),
        ("revoke-contact", {"channel": "EMAIL"}),
    ):
        invalid = await client.post(
            ME + "/" + action, headers=mh, json={**command(row), **extra}
        )
        assert invalid.status_code == 409, invalid.text
    rejected = await client.post(ME + "/reject", headers=mh, json=command(row))
    assert rejected.status_code == 200, rejected.text
    row = rejected.json()["current"]
    assert (
        await client.post(ME + "/reject", headers=mh, json=command(row))
    ).status_code == 409
    row = await confirm(client, mh, row)
    assert (
        await client.post(ME + "/reject", headers=mh, json=command(row))
    ).status_code == 409
    missing = await client.post(
        ME + "/revoke-contact", headers=mh, json={**command(row), "channel": "WECHAT"}
    )
    assert missing.status_code == 409, missing.text


async def test_old_contact_version_never_reveals_new_contact_permission(
    client, db_session, clock
):
    _, _, _, mh, _, vh, row = await prepared(client, db_session, clock)
    row = await confirm(client, mh, row)
    old_public_version = row["public_version"]
    paused = await client.post(
        ME + "/contact-state",
        headers=mh,
        json={**command(row), "accepting_contact": False},
    )
    assert paused.status_code == 200, paused.text
    current = paused.json()["current"]
    resumed = await client.post(
        ME + "/contact-state",
        headers=mh,
        json={**command(current), "accepting_contact": True},
    )
    assert resumed.status_code == 200, resumed.text
    path = f"{PUBLIC}/{row['id']}/contacts"
    stale = await client.post(
        path, headers=vh, json={"expected_public_version": old_public_version}
    )
    assert_conflict(stale, "VERSION_CONFLICT")
    assert "mentor@example.com" not in stale.text
    current_read = await client.post(
        path,
        headers=vh,
        json={"expected_public_version": resumed.json()["current"]["public_version"]},
    )
    assert current_read.status_code == 200, current_read.text


async def test_losing_mentor_role_removes_private_maintenance_and_public_listing(
    client, db_session, clock
):
    _, oh, mentor, mh, _, vh, row = await prepared(client, db_session, clock)
    mentor_user_id = mentor.id
    row = await confirm(client, mh, row)
    await db_session.execute(
        update(User).where(User.id == mentor_user_id).values(role="STUDENT")
    )
    await db_session.commit()
    for path, headers in (
        (ME, mh),
        (f"{OPS}/{row['id']}", oh),
        (f"{PUBLIC}/{row['id']}", vh),
    ):
        assert (await client.get(path, headers=headers)).status_code == 404
    assert (await client.get(PUBLIC, headers=vh)).json()["total"] == 0
    denied = await client.post(ME + "/confirm", headers=mh, json=confirmation(row))
    assert denied.status_code == 404, denied.text


async def test_owner_qualification_revocation_blocks_requests_but_allows_unlink(
    client, db_session, clock
):
    _, _, _, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    owner, project, ph, _ = await world(db_session, clock)
    owner_id, project_id = owner.id, project.id
    await db_session.commit()
    base = f"/api/v1/ie/me/project-drafts/{project_id}/mentors"
    payload = {"request_id": str(uuid4()), "mentor_id": mentor["id"]}
    requested = await client.post(base, headers=ph, json=payload)
    assert requested.status_code == 200, requested.text
    row = requested.json()
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == owner_id)
        .values(status="PENDING", approved_at=None, approved_by=None)
    )
    await db_session.commit()
    for request_id in (payload["request_id"], str(uuid4())):
        denied = await client.post(
            base, headers=ph, json={**payload, "request_id": request_id}
        )
        assert denied.status_code == 403, denied.text
    owned = await client.get(base, headers=ph)
    assert owned.status_code == 200 and owned.json()["items"][0]["id"] == row["id"]
    removed = await client.post(
        f"/api/v1/ie/mentor-links/{row['id']}/revoke", headers=ph, json=command(row)
    )
    assert removed.status_code == 200 and removed.json()["status"] == "REVOKED"


async def test_project_summary_cannot_be_offered_by_a_nonowner_or_nonstudent(
    client, db_session, clock
):
    _, _, _, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    _, project, _, _ = await world(db_session, clock)
    _, _, other_owner_headers, _ = await world(db_session, clock)
    project_id = project.id
    await db_session.commit()
    base = f"/api/v1/ie/me/project-drafts/{project_id}/mentors"
    for headers, status in ((other_owner_headers, 404), (mh, 403)):
        rejected = await client.post(
            base,
            headers=headers,
            json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
        )
        assert rejected.status_code == status, rejected.text
        assert "PRIVATE_PROJECT_SENTINEL" not in rejected.text


async def test_demoted_mentor_cannot_receive_a_new_private_project_summary(
    client, db_session, clock
):
    # A known public id must stop accepting new private disclosures as soon
    # as its target loses mentor identity, even while an old tab retains it.
    _, _, mentor_user, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor_user_id = mentor_user.id
    mentor = await confirm(client, mh, mentor)
    _, project, ph, _ = await world(db_session, clock)
    project_id = project.id
    await db_session.execute(
        update(User).where(User.id == mentor_user_id).values(role="STUDENT")
    )
    await db_session.commit()
    result = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/mentors",
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
    )
    assert result.status_code == 404, result.text
    assert "PRIVATE_PROJECT_SENTINEL" not in result.text
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ProjectMentorLink)
            .where(
                ProjectMentorLink.project_id == project_id,
                ProjectMentorLink.mentor_id == UUID(mentor["id"]),
            )
        )
        == 0
    )
