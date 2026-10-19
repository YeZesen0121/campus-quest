"""Shared text preparation never grants owner or evidence authority."""

from uuid import uuid4

import pytest
from sqlalchemy import update

from app.modules.innovation.models import OwnerQualification
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import fields
from tests.integration.innovation.test_collaboration import command, invite

pytestmark = pytest.mark.integration


async def manager(client, db, clock, *, qualified=False):
    owner, project, oh, target, th, _, _, row = await invite(client, db, clock)
    owner_id, project_id, target_id = owner.id, project.id, target.id
    if qualified:
        db.add(
            OwnerQualification(
                user_id=target_id,
                status="APPROVED",
                version=1,
                profile_version=1,
                name="共管私有姓名",
                student_no="PRIVATE_STUDENT_NUMBER",
                major="示例",
                grade="2026",
                requested_at=clock.now(),
                approved_at=clock.now(),
                approved_by=owner_id,
            )
        )
        await db.commit()
    base = f"/api/v1/ie/collaboration/projects/{project_id}"
    denied = await client.get(base, headers=th)
    assert denied.status_code == 404
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert accepted.status_code == 200, accepted.text
    return base, oh, th, owner_id, target_id, project_id, accepted.json()


async def test_manager_can_prepare_text_and_stale_save_does_not_overwrite(
    client, db_session, clock
):
    base, oh, th, _, _, project_id, row = await manager(client, db_session, clock)
    response = await client.get(base, headers=th)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    project = response.json()
    assert project["role"] == "MANAGER"
    assert not project["can_publish_recruitment"]
    assert set(project["draft"]) == {
        "id",
        "title",
        "summary",
        "direction",
        "stage",
        "team_status",
        "lifecycle",
        "version",
        "created_at",
        "updated_at",
    }
    assert not {"student_no", "evidence", "owner_profile", "contacts"}.intersection(
        project
    )
    payload = {
        k: project["draft"][k]
        for k in ("title", "summary", "direction", "stage", "team_status", "version")
    }
    saved = await client.patch(
        base,
        headers=th,
        json={**payload, "request_id": str(uuid4()), "title": "共管已保存"},
    )
    assert saved.status_code == 200, saved.text
    conflict = await client.patch(
        base,
        headers=th,
        json={**payload, "request_id": str(uuid4()), "title": "旧版本不得覆盖"},
    )
    assert conflict.status_code == 409
    assert (await client.get(base, headers=th)).json()["draft"]["title"] == "共管已保存"
    ended = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/revoke", headers=oh, json=command(row)
    )
    assert ended.status_code == 200
    assert (await client.get(base, headers=th)).status_code == 404
    assert (
        await client.get(f"/api/v1/ie/me/project-drafts/{project_id}", headers=th)
    ).status_code == 404


async def test_manager_can_prepare_achievement_without_proof_or_submission_right(
    client, db_session, clock
):
    base, _, th, _, _, project_id, _ = await manager(client, db_session, clock)
    created = await client.post(
        base + "/achievements",
        headers=th,
        json={"request_id": str(uuid4()), "title": "共管文字"},
    )
    assert created.status_code == 201, created.text
    achievement = created.json()
    assert set(achievement) == {
        "id",
        "title",
        "description",
        "work_url",
        "award_text",
        "version",
        "created_at",
        "updated_at",
    }
    owned = (
        f"/api/v1/ie/me/project-drafts/{project_id}/achievements/{achievement['id']}"
    )
    assert (await client.get(owned + "/evidence", headers=th)).status_code == 404
    denied = await client.post(
        owned + "/submit",
        headers=th,
        json={
            "request_id": str(uuid4()),
            "workflow_version": 1,
            "achievement_version": achievement["version"],
            "project_version": 1,
            "evidence_ids": [str(uuid4())],
        },
    )
    assert denied.status_code in {403, 404}
    # This confirms no submit route was exposed on the text-only workspace.
    assert (
        await client.post(
            base + f"/achievements/{achievement['id']}/submit", headers=th, json={}
        )
    ).status_code == 404


@pytest.mark.parametrize("qualified", [False, True])
async def test_recruitment_publication_checks_manager_qualification(
    client, db_session, clock, qualified
):
    base, _, th, owner_id, _, _, _ = await manager(
        client, db_session, clock, qualified=qualified
    )
    created = await client.post(
        base + "/recruitments",
        headers=th,
        json={"request_id": str(uuid4()), "fields": fields()},
    )
    assert created.status_code == 201, created.text
    recruitment = created.json()
    action = base + f"/recruitments/{recruitment['id']}"
    published = await client.post(
        action + "/publish", headers=th, json=command(recruitment)
    )
    assert published.status_code == (200 if qualified else 403), published.text
    if qualified:
        recruitment = published.json()["current"]
        await db_session.execute(
            update(OwnerQualification)
            .where(OwnerQualification.user_id == owner_id)
            .values(status="PENDING", approved_at=None, approved_by=None)
        )
        await db_session.commit()
        denied = await client.post(
            action + "/publish", headers=th, json=command(recruitment)
        )
        assert denied.status_code == 403, denied.text
        # Closing is still possible even when publication conditions fail.
        closed = await client.post(
            action + "/close", headers=th, json=command(recruitment)
        )
        assert closed.status_code == 200, closed.text


async def test_project_save_reconciles_original_command_and_rejects_key_reuse(
    client, db_session, clock
):
    base, _, th, _, _, _, _ = await manager(client, db_session, clock)
    draft = (await client.get(base, headers=th)).json()["draft"]
    payload = {
        k: draft[k]
        for k in ("title", "summary", "direction", "stage", "team_status", "version")
    }
    payload.update(request_id=str(uuid4()), title="原命令已保存")
    first = await client.patch(base, headers=th, json=payload)
    assert first.status_code == 200, first.text
    retry = await client.patch(base, headers=th, json=payload)
    assert retry.status_code == 200, retry.text
    assert retry.json()["replayed"]
    assert retry.json()["applied_version"] == draft["version"] + 1
    assert retry.json()["draft"]["version"] == draft["version"] + 1
    assert (
        await client.patch(base, headers=th, json={**payload, "title": "同键不同内容"})
    ).status_code == 409


async def test_achievement_save_retry_preserves_single_version(
    client, db_session, clock
):
    base, _, th, _, _, _, _ = await manager(client, db_session, clock)
    result = await client.post(
        base + "/achievements",
        headers=th,
        json={"request_id": str(uuid4()), "title": "待整理"},
    )
    assert result.status_code == 201
    draft = result.json()
    payload = {
        k: draft[k]
        for k in ("title", "description", "work_url", "award_text", "version")
    }
    payload.update(request_id=str(uuid4()), title="已整理")
    path = base + f"/achievements/{draft['id']}"
    first = await client.patch(path, headers=th, json=payload)
    assert first.status_code == 200, first.text
    retry = await client.patch(path, headers=th, json=payload)
    assert retry.status_code == 200, retry.text
    assert retry.json()["replayed"]
    assert retry.json()["applied_version"] == draft["version"] + 1
    assert retry.json()["current"]["version"] == draft["version"] + 1
