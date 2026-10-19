"""Creation identity survives a change of current owner (C14 persistence seam)."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, update

from app.modules.innovation.models import ProjectDraft
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.test_achievement_review_operations import account

pytestmark = pytest.mark.integration
BASE = "/api/v1/ie/me/project-drafts"


async def test_old_creation_retry_returns_minimum_and_successor_same_key_is_independent(
    client, db_session, clock
):
    creator, ch = await account(db_session, clock)
    successor, sh = await account(db_session, clock)
    payload = {"request_id": str(uuid4()), "title": "创建时的项目"}
    created = await client.post(BASE, headers=ch, json=payload)
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    # This test isolates the creation contract; atomic transfer itself has its
    # own production-API and concurrency tests in task4.
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(
            owner_user_id=successor.id,
            title="CURRENT_PRIVATE_SENTINEL",
            summary="PRIVATE_CONTENT_SENTINEL",
        )
    )
    await db_session.commit()
    replay = await client.post(BASE, headers=ch, json=payload)
    assert replay.status_code == 200, replay.text
    assert replay.json() == {"id": project_id, "ownership": "TRANSFERRED"}
    assert "SENTINEL" not in replay.text
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ProjectDraft)
            .where(ProjectDraft.creation_request_id == payload["request_id"])
        )
    ) == 1
    other = await client.post(BASE, headers=sh, json=payload)
    assert other.status_code == 201, other.text
    assert other.json()["id"] != project_id
    assert (
        await client.post(BASE, headers=ch, json={**payload, "title": "同键其他内容"})
    ).status_code == 409


async def test_creation_identity_and_payload_are_database_immutable(
    client, db_session, clock
):
    from sqlalchemy.exc import DBAPIError

    _, ch = await account(db_session, clock)
    successor, _ = await account(db_session, clock)
    created = await client.post(
        BASE, headers=ch, json={"request_id": str(uuid4()), "title": "创建记录"}
    )
    assert created.status_code == 201
    identity = created.json()["id"]
    for values in (
        {"creator_user_id": successor.id},
        {"creation_request_id": uuid4()},
        {"creation_payload_fingerprint": "f" * 64},
    ):
        with pytest.raises(DBAPIError):
            async with db_session.begin_nested():
                await db_session.execute(
                    update(ProjectDraft)
                    .where(ProjectDraft.id == identity)
                    .values(**values)
                )
