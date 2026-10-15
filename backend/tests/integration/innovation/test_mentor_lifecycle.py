"""R5 public snapshots, exact-version consent and live revocation."""

from uuid import UUID

import pytest
from sqlalchemy import update

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

pytestmark = pytest.mark.integration


async def test_only_target_mentor_can_confirm_and_public_payload_excludes_contacts(
    client, db_session, clock
):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    assert (await client.get(PUBLIC, headers=vh)).json()["total"] == 0
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).status_code == 404
    assert (await client.get(OPS + "/" + row["id"], headers=vh)).status_code == 403
    bad = await client.post(
        ME + "/confirm",
        headers=oh,
        json={
            **command(row),
            "confirm_profile": True,
            "contact_channels": ["EMAIL"],
            "authorized_fields": [],
            "accepting_contact": True,
        },
    )
    assert bad.status_code in (403, 404)
    row = await confirm(client, mh, row)
    public = await client.get(PUBLIC + "/" + row["id"], headers=vh)
    assert public.status_code == 200
    assert "mentor@example.com" not in public.text
    assert public.headers["cache-control"] == "private, no-store"
    contact = await client.post(
        PUBLIC + "/" + row["id"] + "/contacts",
        headers=vh,
        json={"expected_public_version": row["public_version"]},
    )
    assert contact.status_code == 200, contact.text
    assert contact.json()["contacts"] == [
        {"channel": "EMAIL", "value": "mentor@example.com"}
    ]


async def test_scoped_edit_publishes_but_mixed_or_contact_changes_wait(
    client, db_session, clock
):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    row = await confirm(client, mh, row)
    response = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={**command(row), "fields": {**row["fields"], "directions": "新方向"}},
    )
    assert response.status_code == 200, response.text
    row = response.json()["current"]
    assert row["confirmation_state"] == "CONFIRMED"
    assert row["public_content"]["directions"] == "新方向"
    response = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={
            **command(row),
            "fields": {**row["fields"], "unit": "新单位", "directions": "未确认方向"},
        },
    )
    row = response.json()["current"]
    assert row["confirmation_state"] == "PENDING"
    public = (await client.get(PUBLIC + "/" + row["id"], headers=vh)).json()
    assert public["content"]["unit"] == "模拟学院"
    assert public["content"]["directions"] == "新方向"
    row = await confirm(client, mh, row)
    response = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={
            **command(row),
            "fields": {
                **row["fields"],
                "contacts": [{"channel": "EMAIL", "value": "new@example.com"}],
            },
        },
    )
    row = response.json()["current"]
    assert row["confirmation_state"] == "PENDING"
    contact = await client.post(
        PUBLIC + "/" + row["id"] + "/contacts",
        headers=vh,
        json={"expected_public_version": row["public_version"]},
    )
    assert contact.json()["contacts"][0]["value"] == "mentor@example.com"


async def test_stale_confirmation_and_replay_never_reopen_withdrawn_profile(
    client, db_session, clock
):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    payload = {
        **command(row),
        "confirm_profile": True,
        "contact_channels": ["EMAIL"],
        "authorized_fields": ["directions"],
        "accepting_contact": True,
    }
    edited = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={**command(row), "fields": {**row["fields"], "unit": "新单位"}},
    )
    assert edited.status_code == 200
    assert (
        await client.post(ME + "/confirm", headers=mh, json=payload)
    ).status_code == 409
    payload.update(command(edited.json()["current"]))
    accepted = await client.post(ME + "/confirm", headers=mh, json=payload)
    row = accepted.json()["current"]
    withdrawn = await client.post(ME + "/withdraw", headers=mh, json=command(row))
    assert withdrawn.status_code == 200
    replay = await client.post(ME + "/confirm", headers=mh, json=payload)
    assert replay.status_code == 200, replay.text
    assert replay.json()["replayed"] is True
    assert replay.json()["current"]["visibility"] == "HIDDEN"
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).status_code == 404


async def test_pause_revoke_scope_and_contact_are_immediate(client, db_session, clock):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    row = await confirm(client, mh, row)
    paused = await client.post(
        ME + "/contact-state",
        headers=mh,
        json={**command(row), "accepting_contact": False},
    )
    row = paused.json()["current"]
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).json()[
        "contact_channels"
    ] == []
    assert (
        await client.post(
            PUBLIC + "/" + row["id"] + "/contacts",
            headers=vh,
            json={"expected_public_version": row["public_version"]},
        )
    ).status_code == 409
    scope = await client.post(
        ME + "/maintenance-scope",
        headers=mh,
        json={**command(row), "authorized_fields": []},
    )
    row = scope.json()["current"]
    edit = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={**command(row), "fields": {**row["fields"], "directions": "待确认"}},
    )
    row = edit.json()["current"]
    assert row["confirmation_state"] == "PENDING"
    revoked = await client.post(
        ME + "/revoke-contact", headers=mh, json={**command(row), "channel": "EMAIL"}
    )
    row = revoked.json()["current"]
    assert row["public_contact_channels"] == []
    assert (
        await client.post(
            ME + "/contact-state",
            headers=mh,
            json={**command(row), "accepting_contact": True},
        )
    ).status_code == 409


async def test_governance_and_account_status_survive_confirmation(
    client, db_session, clock
):
    from app.modules.identity.models import User
    from app.modules.innovation.mentor_models import MentorProfile

    _, _, mentor, mh, _, vh, row = await prepared(client, db_session, clock)
    mentor_user_id = mentor.id
    await db_session.execute(
        update(MentorProfile)
        .where(MentorProfile.id == UUID(row["id"]))
        .values(moderation_state="TAKEN_DOWN")
    )
    await db_session.commit()
    row = await confirm(client, mh, row)
    assert row["moderation_state"] == "TAKEN_DOWN"
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).status_code == 404
    await db_session.execute(
        update(MentorProfile)
        .where(MentorProfile.id == UUID(row["id"]))
        .values(moderation_state="NORMAL")
    )
    await db_session.execute(
        update(User).where(User.id == mentor_user_id).values(status="SUSPENDED")
    )
    await db_session.commit()
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).status_code == 404


async def test_request_reuse_and_operator_revocation_fail_closed(
    client, db_session, clock
):
    from app.modules.innovation.models import OperationsGrant

    operator, oh, _, mh, _, _, row = await prepared(client, db_session, clock)
    operator_id = operator.id
    payload = {**command(row), "fields": {**row["fields"], "unit": "演示单位"}}
    updated = await client.patch(OPS + "/" + row["id"], headers=oh, json=payload)
    assert updated.status_code == 200
    different = {**payload, "fields": fields()}
    assert (
        await client.patch(OPS + "/" + row["id"], headers=oh, json=different)
    ).status_code == 409
    await db_session.execute(
        update(OperationsGrant)
        .where(OperationsGrant.user_id == operator_id)
        .values(enabled=False)
    )
    await db_session.commit()
    assert (
        await client.patch(OPS + "/" + row["id"], headers=oh, json=payload)
    ).status_code == 403


async def test_decline_preserves_public_version_and_is_not_authorized_publish(
    client, db_session, clock
):
    _, oh, _, mh, _, vh, row = await prepared(client, db_session, clock)
    row = await confirm(client, mh, row)
    changed = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={**command(row), "fields": {**row["fields"], "unit": "不接受的新单位"}},
    )
    row = changed.json()["current"]
    declined = await client.post(ME + "/reject", headers=mh, json=command(row))
    row = declined.json()["current"]
    assert row["confirmation_state"] == "REJECTED"
    updated = await client.patch(
        OPS + "/" + row["id"],
        headers=oh,
        json={
            **command(row),
            "fields": {**row["fields"], "directions": "授权范围内但仍有未确认单位"},
        },
    )
    assert updated.json()["current"]["confirmation_state"] == "PENDING"
    assert (await client.get(PUBLIC + "/" + row["id"], headers=vh)).json()["content"][
        "unit"
    ] == "模拟学院"
