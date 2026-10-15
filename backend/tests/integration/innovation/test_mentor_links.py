"""A display link is an independent consent, never a project permission."""

from uuid import uuid4

import pytest

from tests.integration.innovation.mentor_support import ME, command, confirm, prepared
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.recruitment_support import created, world

pytestmark = pytest.mark.integration


async def test_project_needs_separate_consent_and_unlink_is_immediate(
    client, db_session, clock
):
    _, _, _, mh, _, vh, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    _, project, ph, recruit_base, recruitment = await created(client, db_session, clock)
    project_id = project.id
    published = await client.post(
        recruit_base + "/publish", headers=ph, json=command(recruitment)
    )
    assert published.status_code == 200, published.text
    base = f"/api/v1/ie/me/project-drafts/{project.id}/mentors"
    public = f"/api/v1/ie/projects/{project.id}/mentors"
    requested = await client.post(
        base, headers=ph, json={"request_id": str(uuid4()), "mentor_id": mentor["id"]}
    )
    assert requested.status_code == 200, requested.text
    row = requested.json()
    assert row["status"] == "PENDING"
    assert (await client.get(public, headers=vh)).json()["items"] == []
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    assert (
        await client.post(link + "/accept", headers=vh, json=command(row))
    ).status_code == 403
    accepted = await client.post(link + "/accept", headers=mh, json=command(row))
    assert accepted.status_code == 200, accepted.text
    row = accepted.json()
    assert len((await client.get(public, headers=vh)).json()["items"]) == 1
    assert (
        await client.get(f"/api/v1/ie/me/project-drafts/{project_id}", headers=mh)
    ).status_code == 403
    removed = await client.post(link + "/revoke", headers=ph, json=command(row))
    assert removed.status_code == 200
    assert (await client.get(public, headers=vh)).json()["items"] == []


async def test_private_project_stays_private_and_withdrawal_cancels_links(
    client, db_session, clock
):
    _, _, _, mh, _, vh, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    _, project, ph, _ = await world(db_session, clock)
    await db_session.commit()
    base = f"/api/v1/ie/me/project-drafts/{project.id}/mentors"
    requested = await client.post(
        base, headers=ph, json={"request_id": str(uuid4()), "mentor_id": mentor["id"]}
    )
    assert requested.status_code == 200, requested.text
    row = requested.json()
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    payload = command(row)
    assert (
        await client.post(link + "/accept", headers=mh, json=payload)
    ).status_code == 200
    assert (
        await client.get(f"/api/v1/ie/projects/{project.id}/mentors", headers=vh)
    ).status_code == 404
    withdrawn = await client.post(ME + "/withdraw", headers=mh, json=command(mentor))
    assert withdrawn.status_code == 200, withdrawn.text
    replay = await client.post(link + "/accept", headers=mh, json=payload)
    assert replay.status_code in (200, 409)
    if replay.status_code == 200:
        assert replay.json()["status"] == "REVOKED"
    fresh = await confirm(client, mh, withdrawn.json()["current"])
    assert fresh["visibility"] == "VISIBLE"
    own = (await client.get(base, headers=ph)).json()["items"]
    assert own[0]["status"] == "REVOKED"


async def test_repeat_request_is_one_link_and_rejection_requires_new_round(
    client, db_session, clock
):
    _, _, _, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    _, project, ph, _ = await world(db_session, clock)
    await db_session.commit()
    base = f"/api/v1/ie/me/project-drafts/{project.id}/mentors"
    payload = {"request_id": str(uuid4()), "mentor_id": mentor["id"]}
    row = (await client.post(base, headers=ph, json=payload)).json()
    again = await client.post(base, headers=ph, json=payload)
    assert again.json()["id"] == row["id"]
    assert len((await client.get(base, headers=ph)).json()["items"]) == 1
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    rejected = await client.post(link + "/reject", headers=mh, json=command(row))
    assert rejected.status_code == 200
    old = await client.post(link + "/accept", headers=mh, json=command(row))
    assert old.status_code == 409
    renewed = await client.post(
        base, headers=ph, json={**payload, "request_id": str(uuid4())}
    )
    assert renewed.status_code == 200
    assert renewed.json()["status"] == "PENDING"


@pytest.mark.parametrize("inactive_side", ["owner", "mentor"])
async def test_either_party_can_end_display_when_other_account_is_inactive(
    client, db_session, clock, inactive_side
):
    from sqlalchemy import update

    from app.modules.identity.models import User

    _, _, mentor_user, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor_user_id = mentor_user.id
    mentor = await confirm(client, mh, mentor)
    owner, project, ph, _ = await world(db_session, clock)
    owner_id = owner.id
    base = f"/api/v1/ie/me/project-drafts/{project.id}/mentors"
    await db_session.commit()
    requested = await client.post(
        base,
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
    )
    row = requested.json()
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    row = (await client.post(link + "/accept", headers=mh, json=command(row))).json()
    await db_session.execute(
        update(User)
        .where(User.id == (owner_id if inactive_side == "owner" else mentor_user_id))
        .values(status="SUSPENDED")
    )
    await db_session.commit()
    removed = await client.post(
        link + "/revoke",
        headers=mh if inactive_side == "owner" else ph,
        json=command(row),
    )
    assert removed.status_code == 200, removed.text
    assert removed.json()["status"] == "REVOKED"
