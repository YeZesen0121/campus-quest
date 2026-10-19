"""Mentor display consent also creates lasting conflict history."""

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.modules.innovation.review_conflicts import review_conflict_exists
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import command, confirm, prepared
from tests.integration.innovation.recruitment_support import world

pytestmark = pytest.mark.integration


async def test_accepted_mentor_remains_conflicted_after_owner_ends_display(
    client, db_session, clock
):
    _, _, mentor_user, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor_user_id = mentor_user.id
    mentor = await confirm(client, mh, mentor)
    _, project, ph, _ = await world(db_session, clock)
    project_id = project.id
    await db_session.commit()
    request = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/mentors",
        headers=ph,
        json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
    )
    assert request.status_code == 200, request.text
    row = request.json()
    assert not await db_session.scalar(
        select(review_conflict_exists(project_id, mentor_user_id))
    )
    path = f"/api/v1/ie/mentor-links/{row['id']}"
    accepted = await client.post(path + "/accept", headers=mh, json=command(row))
    assert accepted.status_code == 200, accepted.text
    removed = await client.post(
        path + "/revoke", headers=ph, json=command(accepted.json())
    )
    assert removed.status_code == 200, removed.text
    assert await db_session.scalar(
        select(review_conflict_exists(project_id, mentor_user_id))
    )
