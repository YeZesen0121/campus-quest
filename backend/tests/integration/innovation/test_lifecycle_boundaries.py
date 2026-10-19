"""Lifecycle retries and introduction publication cannot bypass current authority."""

from uuid import uuid4

import pytest
from sqlalchemy import func, select, update

from app.modules.innovation.lifecycle_models import ProjectIntroduction
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import command, created
from tests.integration.innovation.test_project_lifecycle import (
    completed_public,
    lifecycle_command,
)

pytestmark = pytest.mark.integration

INTRO = {
    "title": "核对后的模拟介绍",
    "summary": "明确发布的四项文字",
    "direction": "学习",
    "stage": "已结项",
}


async def test_lifecycle_receipt_rejects_changed_version_under_same_request_key(
    client, db_session, clock
):
    _, headers, base, _, _, _, payload, _ = await completed_public(
        client, db_session, clock
    )
    changed = await client.post(
        base + "/complete",
        headers=headers,
        json={**payload, "version": payload["version"] + 1},
    )
    assert changed.status_code == 409, changed.text
    assert changed.json()["error"]["details"]["kind"] == "REQUEST_REUSE"


@pytest.mark.parametrize("action", ["complete", "resume"])
async def test_fresh_lifecycle_command_cannot_repeat_already_applied_transition(
    client, db_session, clock, action
):
    _, headers, base, _, _, _, _, _ = await completed_public(client, db_session, clock)
    if action == "resume":
        resumed = await client.post(
            base + "/resume",
            headers=headers,
            json=await lifecycle_command(client, base, headers),
        )
        assert resumed.status_code == 200, resumed.text
    denied = await client.post(
        base + "/" + action,
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert denied.status_code == 409, denied.text
    assert denied.json()["error"]["details"]["kind"] == "LIFECYCLE_CHANGED"


async def test_introduction_wrong_preview_digest_does_not_publish_or_advance_revision(
    client, db_session, clock
):
    _, headers, base, public, _, _, _, result = await completed_public(
        client, db_session, clock
    )
    payload = {"version": result["version"], "fields": INTRO}
    preview = await client.post(
        base + "/introduction/preview", headers=headers, json=payload
    )
    assert preview.status_code == 200 and preview.json()["can_publish"] is True
    denied = await client.post(
        base + "/introduction/publish",
        headers=headers,
        json={**payload, "request_id": str(uuid4()), "preview_digest": "0" * 64},
    )
    assert denied.status_code == 409, denied.text
    assert denied.json()["error"]["details"]["kind"] == "INTRODUCTION_CHANGED"
    shown = await client.get(public, headers=headers)
    assert shown.json()["project"]["introduction_revision"] == 1
    assert shown.json()["project"]["title"] != INTRO["title"]


async def test_recruitment_archive_requires_its_owners_current_qualification(
    client, db_session, clock
):
    project_id, headers, base, public, _, _, _, result = await completed_public(
        client, db_session, clock
    )
    owner_id = await db_session.scalar(
        select(ProjectDraft.owner_user_id).where(ProjectDraft.id == project_id)
    )
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == owner_id)
        .values(status="PENDING", approved_at=None, approved_by=None)
    )
    await db_session.commit()
    payload = {"version": result["version"], "fields": INTRO}
    preview = await client.post(
        base + "/introduction/preview", headers=headers, json=payload
    )
    assert preview.status_code == 409, preview.text
    assert (
        preview.json()["error"]["details"]["kind"] == "INTRODUCTION_SOURCE_RESTRICTED"
    )
    # An unreviewed recruitment source retains its original qualification gate.
    shown = await client.get(public, headers=headers)
    assert shown.status_code == 404, shown.text


async def test_intro_governance_before_completion_prevents_capturing_public_archive(
    client, db_session, clock
):
    _, project, headers, job_path, job = await created(client, db_session, clock)
    project_id = project.id
    published = await client.post(
        job_path + "/publish", headers=headers, json=command(job)
    )
    assert published.status_code == 200, published.text
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(introduction_moderation_state="TAKEN_DOWN")
    )
    await db_session.commit()
    base = f"/api/v1/ie/me/project-drafts/{project_id}"
    done = await client.post(
        base + "/complete",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert done.status_code == 200, done.text
    assert (
        await client.get(f"/api/v1/ie/projects/{project_id}", headers=headers)
    ).status_code == 404
    total = await db_session.scalar(
        select(func.count())
        .select_from(ProjectIntroduction)
        .where(ProjectIntroduction.project_id == project_id)
    )
    assert total == 0
