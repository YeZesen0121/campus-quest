"""Project disclosure requires a current mentor and a current pending decision."""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select, update

from app.core.errors import BusinessError
from app.modules.audit.context import AuditContext
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation.mentor_models import (
    MentorConsent,
    MentorProfile,
    MentorReceipt,
    ProjectMentorLink,
)
from app.modules.innovation.mentor_schemas import MentorVersionCommand
from app.modules.innovation.mentor_service import MentorService
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import command, confirm, prepared
from tests.integration.innovation.recruitment_support import world

pytestmark = pytest.mark.integration


async def pending_link(client, db, clock):
    _, _, mentor_user, mh, _, _, mentor = await prepared(client, db, clock)
    mentor_user_id = mentor_user.id
    mentor = await confirm(client, mh, mentor)
    _, project, ph, _ = await world(db, clock)
    base = f"/api/v1/ie/me/project-drafts/{project.id}/mentors"
    await db.commit()
    requested = await client.post(
        base,
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
    )
    assert requested.status_code == 200, requested.text
    return ph, mh, requested.json(), mentor, mentor_user_id, base


async def test_unknown_mentor_cannot_receive_project_disclosure(
    client, db_session, clock
):
    _, project, ph, _ = await world(db_session, clock)
    project_id = project.id
    await db_session.commit()
    response = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/mentors",
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": str(uuid4())},
    )
    assert response.status_code == 404, response.text
    assert "PRIVATE_PROJECT_SENTINEL" not in response.text
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ProjectMentorLink)
            .where(ProjectMentorLink.project_id == project_id)
        )
        == 0
    )


@pytest.mark.parametrize("state", ["hidden", "taken_down"])
async def test_nonpublic_mentor_cannot_receive_a_new_project_disclosure(
    client, db_session, clock, state
):
    _, _, _, mh, _, _, mentor = await prepared(client, db_session, clock)
    if state == "taken_down":
        mentor = await confirm(client, mh, mentor)
        await db_session.execute(
            update(MentorProfile)
            .where(MentorProfile.id == UUID(mentor["id"]))
            .values(moderation_state="TAKEN_DOWN")
        )
    _, project, ph, _ = await world(db_session, clock)
    project_id = project.id
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
            .where(ProjectMentorLink.project_id == project_id)
        )
        == 0
    )


@pytest.mark.parametrize("state", ["PENDING", "ACCEPTED"])
async def test_new_request_id_cannot_duplicate_an_open_project_mentor_pair(
    client, db_session, clock, state
):
    ph, mh, row, mentor, _, base = await pending_link(client, db_session, clock)
    if state == "ACCEPTED":
        accepted = await client.post(
            f"/api/v1/ie/mentor-links/{row['id']}/accept",
            headers=mh,
            json=command(row),
        )
        assert accepted.status_code == 200, accepted.text
        row = accepted.json()
    duplicate = await client.post(
        base,
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["details"]["kind"] == "LINK_EXISTS"
    own = await client.get(base, headers=ph)
    assert own.status_code == 200, own.text
    assert own.json()["total"] == 1
    assert own.json()["items"][0] == row


async def test_unknown_link_decisions_return_not_found(client, db_session, clock):
    _, _, _, mh, _, _, _ = await prepared(client, db_session, clock)
    missing = str(uuid4())
    for action in ("accept", "reject", "revoke"):
        response = await client.post(
            f"/api/v1/ie/mentor-links/{missing}/{action}",
            headers=mh,
            json=command({"version": 1}),
        )
        assert response.status_code == 404, response.text
        assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_pending_link_cannot_be_accepted_after_mentor_role_revocation(
    client, db_session, clock
):
    _, mh, row, _, mentor_user_id, _ = await pending_link(client, db_session, clock)
    await db_session.execute(
        update(User).where(User.id == mentor_user_id).values(role="STUDENT")
    )
    await db_session.commit()
    rejected = await client.post(
        f"/api/v1/ie/mentor-links/{row['id']}/accept",
        headers=mh,
        json=command(row),
    )
    assert rejected.status_code == 403, rejected.text
    assert rejected.json()["error"]["code"] == "PERMISSION_DENIED"
    current = await db_session.get(ProjectMentorLink, UUID(row["id"]))
    assert current.status == "PENDING" and current.version == row["version"]


async def test_accepted_link_is_not_a_pending_decision_again(client, db_session, clock):
    ph, mh, row, _, _, base = await pending_link(client, db_session, clock)
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    accepted = await client.post(link + "/accept", headers=mh, json=command(row))
    assert accepted.status_code == 200, accepted.text
    row = accepted.json()
    for action in ("accept", "reject"):
        response = await client.post(link + "/" + action, headers=mh, json=command(row))
        assert response.status_code == 409, response.text
    own = await client.get(base, headers=ph)
    assert own.json()["items"][0] == row


async def test_governance_takedown_blocks_accepting_an_already_pending_link(
    client, db_session, clock
):
    _, mh, row, mentor, _, _ = await pending_link(client, db_session, clock)
    await db_session.execute(
        update(MentorProfile)
        .where(MentorProfile.id == UUID(mentor["id"]))
        .values(moderation_state="TAKEN_DOWN")
    )
    await db_session.commit()
    response = await client.post(
        f"/api/v1/ie/mentor-links/{row['id']}/accept",
        headers=mh,
        json=command(row),
    )
    assert response.status_code == 409, response.text
    current = await db_session.get(ProjectMentorLink, UUID(row["id"]))
    assert current.status == "PENDING" and current.version == row["version"]


@pytest.mark.parametrize("end_action", ["reject", "revoke"])
async def test_finished_links_cannot_be_revoked_again(
    client, db_session, clock, end_action
):
    ph, mh, row, _, _, base = await pending_link(client, db_session, clock)
    link = f"/api/v1/ie/mentor-links/{row['id']}"
    finished = await client.post(
        link + "/" + end_action,
        headers=mh if end_action == "reject" else ph,
        json=command(row),
    )
    assert finished.status_code == 200, finished.text
    row = finished.json()
    repeated = await client.post(link + "/revoke", headers=ph, json=command(row))
    assert repeated.status_code == 409, repeated.text
    own = await client.get(base, headers=ph)
    assert own.json()["items"][0] == row


@pytest.mark.parametrize(
    "changed_identity", [{"status": "SUSPENDED"}, {"role": "STUDENT"}]
)
async def test_domain_rechecks_previously_authenticated_actor_before_consent_write(
    client, db_session, clock, changed_identity
):
    _, _, user, mh, _, _, mentor = await prepared(client, db_session, clock)
    user_id = user.id
    old_actor = Actor(user_id, Role.MENTOR)
    mentor = await confirm(client, mh, mentor)
    profile_id = UUID(mentor["id"])
    before = await db_session.scalar(
        select(func.count())
        .select_from(MentorConsent)
        .where(MentorConsent.profile_id == profile_id)
    )
    await db_session.execute(
        update(User).where(User.id == user_id).values(**changed_identity)
    )
    await db_session.commit()
    request_id = uuid4()
    # Model the identity changing after an outer caller resolved its Actor.
    # No HTTP guard runs here: the real domain transaction must reject it.
    with pytest.raises(BusinessError) as rejected:
        await MentorService(clock=clock).act(
            db_session,
            actor=old_actor,
            action="withdraw",
            payload=MentorVersionCommand(
                request_id=request_id, version=mentor["version"]
            ),
            context=AuditContext(None, None),
        )
    assert rejected.value.code == "ACCOUNT_NOT_ACTIVE"
    assert rejected.value.status_code == 403
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(MentorConsent)
            .where(MentorConsent.profile_id == profile_id)
        )
        == before
    )
    assert (
        await db_session.scalar(
            select(MentorReceipt.id).where(
                MentorReceipt.actor_user_id == user_id,
                MentorReceipt.request_id == request_id,
            )
        )
        is None
    )
    current = await db_session.get(MentorProfile, profile_id)
    assert current.visibility == "VISIBLE" and current.version == mentor["version"]
