"""Card text follows the same explicit publication boundary as other fields."""

from uuid import UUID

import pytest
from sqlalchemy import select, update

from app.modules.innovation.talent_models import TalentProfile, TalentRevision
from tests.integration.innovation.talent_support import BASE, command, saved
from tests.integration.innovation.talent_support import client as client
from tests.integration.innovation.talent_support import clock as clock

pytestmark = pytest.mark.integration


async def test_missing_card_sentence_cannot_save_a_draft(client, db_session, clock):
    _, headers, row, _ = await saved(client, db_session, clock)
    for value in ["", "  ", "🌱" * 41]:
        response = await client.put(
            BASE,
            headers=headers,
            json={**command(row), "fields": {**row["fields"], "headline": value}},
        )
        assert response.status_code == 422, response.text
    after = (await client.get(BASE, headers=headers)).json()["profile"]
    assert after["version"] == row["version"]


async def test_card_sentence_search_waits_for_explicit_publication(
    client, db_session, clock
):
    _, headers, row, _ = await saved(
        client, db_session, clock, patch={"headline": "PUBLIC_CARD_SENTENCE"}
    )
    published = await client.post(BASE + "/publish", headers=headers, json=command(row))
    assert published.status_code == 200, published.text
    row = published.json()["current"]
    result = await client.put(
        BASE,
        headers=headers,
        json={
            **command(row),
            "fields": {**row["fields"], "headline": "PRIVATE_CARD_SENTENCE"},
        },
    )
    assert result.status_code == 200, result.text
    row = result.json()["current"]
    private = await client.get(
        "/api/v1/ie/talents?q=PRIVATE_CARD_SENTENCE", headers=headers
    )
    assert private.json()["total"] == 0
    public = await client.get(
        "/api/v1/ie/talents?q=PUBLIC_CARD_SENTENCE", headers=headers
    )
    assert public.json()["items"][0]["headline"] == "PUBLIC_CARD_SENTENCE"
    updated = await client.post(BASE + "/publish", headers=headers, json=command(row))
    assert updated.status_code == 200, updated.text
    detail = await client.get("/api/v1/ie/talents/" + row["id"], headers=headers)
    assert detail.json()["content"]["headline"] == "PRIVATE_CARD_SENTENCE"
    public = await client.get(
        "/api/v1/ie/talents?q=PRIVATE_CARD_SENTENCE", headers=headers
    )
    assert public.json()["items"][0]["headline"] == "PRIVATE_CARD_SENTENCE"


async def test_legacy_draft_and_public_snapshot_remain_readable(
    client, db_session, clock
):
    _, headers, row, _ = await saved(client, db_session, clock)
    published = await client.post(BASE + "/publish", headers=headers, json=command(row))
    assert published.status_code == 200, published.text
    profile = await db_session.get(TalentProfile, UUID(row["id"]))
    revision = await db_session.scalar(
        select(TalentRevision).where(TalentRevision.id == profile.public_revision_id)
    )
    # Test-only reconstruction of pre-field JSON; no production record backfill.
    old_fields = {k: v for k, v in profile.fields.items() if k != "headline"}
    old_content = {k: v for k, v in revision.content.items() if k != "headline"}
    legacy = TalentRevision(
        profile_id=profile.id,
        number=revision.number + 1,
        content=old_content,
        contacts=revision.contacts,
        created_at=revision.created_at,
    )
    db_session.add(legacy)
    await db_session.flush()
    await db_session.execute(
        update(TalentProfile)
        .where(TalentProfile.id == profile.id)
        .values(
            fields=old_fields,
            public_revision_id=legacy.id,
            public_version=profile.public_version + 1,
        )
    )
    await db_session.commit()
    own = (await client.get(BASE, headers=headers)).json()["profile"]
    assert own["fields"]["headline"] == ""
    assert own["has_unpublished_changes"] is False
    detail = await client.get("/api/v1/ie/talents/" + row["id"], headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["content"]["headline"] == ""
    listed = await client.get("/api/v1/ie/talents", headers=headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["headline"] == ""
    rejected = await client.put(
        BASE, headers=headers, json={**command(own), "fields": old_fields}
    )
    assert rejected.status_code == 422
    hidden = await client.post(BASE + "/hide", headers=headers, json=command(own))
    assert hidden.status_code == 200, hidden.text
