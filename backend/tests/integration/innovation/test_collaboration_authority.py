"""Acceptance rechecks the current account roles; exit remains available."""

import pytest
from sqlalchemy import update

from app.modules.identity.models import User
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.test_collaboration import command, invite

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("change", [{"status": "SUSPENDED"}, {"role": "TEACHER"}])
async def test_acceptance_cannot_use_an_invalid_owner_but_recipient_can_decline(
    client, db_session, clock, change
):
    owner, _, _, _, th, _, _, row = await invite(client, db_session, clock)
    await db_session.execute(update(User).where(User.id == owner.id).values(**change))
    await db_session.commit()
    path = f"/api/v1/ie/collaborations/{row['id']}"
    rejected = await client.post(path + "/accept", headers=th, json=command(row))
    assert rejected.status_code in {403, 404}, rejected.text
    ended = await client.post(path + "/reject", headers=th, json=command(row))
    assert ended.status_code == 200, ended.text
    assert ended.json()["status"] == "REJECTED"
