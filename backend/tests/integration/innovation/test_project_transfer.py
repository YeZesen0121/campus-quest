"""Transfers bind explicit confirmation to current state and return durable results."""

from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, update

from app.modules.innovation.models import ProjectDraft
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world

pytestmark = pytest.mark.integration


async def proposed(client, db, clock):
    owner, project, oh, _ = await world(db, clock)
    target, _, th, _ = await world(db, clock)
    target.username = str(uuid4().int)[:12]
    owner.nickname, target.nickname = "发起人昵称", "接任者昵称"
    await db.commit()
    reference = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=oh,
        json={"account": target.username},
    )
    payload = {
        "request_id": str(uuid4()),
        "target_ref": reference.json()["target_ref"],
        "evidence_ids": [],
        "allow_preview": False,
    }
    base = f"/api/v1/ie/me/project-drafts/{project.id}/transfers"
    result = await client.post(base, headers=oh, json=payload)
    assert result.status_code == 200, result.text
    return owner, project, oh, target, th, base, payload, result.json()


def confirmation(row):
    return {
        "request_id": str(uuid4()),
        "version": row["version"],
        "confirmation_digest": row["confirmation_digest"],
    }


async def test_transfer_history_identifies_counterparty_without_private_identity(
    client, db_session, clock
):
    _, _, oh, _, th, _, _, row = await proposed(client, db_session, clock)
    assert row["counterpart_nickname"] == "接任者昵称"
    path = f"/api/v1/ie/transfers/{row['id']}"
    incoming = await client.get(path, headers=th)
    assert incoming.json()["counterpart_nickname"] == "发起人昵称"
    accepted = await client.post(path + "/accept", headers=th, json=confirmation(row))
    assert accepted.status_code == 200, accepted.text
    for headers, name in ((oh, "接任者昵称"), (th, "发起人昵称")):
        history = await client.get("/api/v1/ie/me/transfers", headers=headers)
        assert history.json()["items"][0]["counterpart_nickname"] == name
        assert "PRIVATE_PROJECT_SENTINEL" not in history.text
        assert (
            "target_user_id" not in history.text and "from_user_id" not in history.text
        )


async def test_transfer_only_target_confirms_and_retry_reconciles_minimal_result(
    client,
    db_session,
    clock,
):
    owner, project, oh, target, th, base, original, row = await proposed(
        client, db_session, clock
    )
    path = f"/api/v1/ie/transfers/{row['id']}"
    denied = await client.post(path + "/accept", headers=oh, json=confirmation(row))
    assert denied.status_code == 403
    command = confirmation(row)
    result = await client.post(path + "/accept", headers=th, json=command)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "ACCEPTED"
    assert "PRIVATE_PROJECT_SENTINEL" not in result.text
    retry = await client.post(path + "/accept", headers=th, json=command)
    assert retry.status_code == 200, retry.text
    assert retry.json() == result.json()
    again = await client.post(base, headers=oh, json=original)
    assert again.status_code == 200, again.text
    assert again.json()["status"] == "ACCEPTED"
    assert "PRIVATE_PROJECT_SENTINEL" not in again.text
    await db_session.refresh(project)
    assert project.owner_user_id == target.id
    assert project.creator_user_id == owner.id
    assert project.ownership_generation == 2
    for headers in (oh, th):
        history = await client.get("/api/v1/ie/me/transfers", headers=headers)
        assert history.status_code == 200
        assert history.json()["total"] == 1
        assert "PRIVATE_PROJECT_SENTINEL" not in history.text


async def test_changed_project_requires_refresh_and_new_confirmation(
    client, db_session, clock
):
    _, project, _, _, th, _, _, row = await proposed(client, db_session, clock)
    path = f"/api/v1/ie/transfers/{row['id']}"
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project.id)
        .values(summary="changed private text", version=2)
    )
    await db_session.commit()
    stale = await client.post(path + "/accept", headers=th, json=confirmation(row))
    assert stale.status_code == 409
    refreshed = await client.get(path, headers=th)
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["confirmation_digest"] != row["confirmation_digest"]
    accepted = await client.post(
        path + "/accept", headers=th, json=confirmation(refreshed.json())
    )
    assert accepted.status_code == 200, accepted.text


@pytest.mark.parametrize("action", ["cancel", "reject", "expire"])
async def test_ended_transfer_cannot_be_confirmed(client, db_session, clock, action):
    owner, project, oh, _, th, _, _, row = await proposed(client, db_session, clock)
    owner_id, project_id = owner.id, project.id
    path = f"/api/v1/ie/transfers/{row['id']}"
    if action == "expire":
        object.__setattr__(clock, "current", clock.now() + timedelta(days=7))
    else:
        result = await client.post(
            path + "/" + action,
            headers=oh if action == "cancel" else th,
            json=confirmation(row),
        )
        assert result.status_code == 200, result.text
    late = await client.post(path + "/accept", headers=th, json=confirmation(row))
    assert late.status_code == 409, late.text
    current = await db_session.scalar(
        select(ProjectDraft.owner_user_id).where(ProjectDraft.id == project_id)
    )
    assert current == owner_id
