"""Post-transfer ownership, consent, qualification and recruitment consequences."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update

from app.modules.innovation.collaboration_models import ProjectCollaboration
from app.modules.innovation.models import OwnerQualification
from app.modules.innovation.recruitment_models import RecruitmentContactAuthorization
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import command as job_command
from tests.integration.innovation.recruitment_support import fields, world
from tests.integration.innovation.test_achievement_workflow import prepared
from tests.integration.innovation.test_project_transfer import confirmation
from tests.integration.innovation.test_project_transfer_evidence import (
    material_client as material_client,
)
from tests.integration.innovation.test_project_transfer_evidence import material_world

pytestmark = pytest.mark.integration


async def test_transfer_retains_accepted_consent_ends_pending_and_requires_new_contact(
    material_client,
    db_session,
    clock,
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    colleague, _, ch, _ = await world(db_session, clock)
    colleague.username = str(uuid4().int)[:12]
    colleague_username = colleague.username
    await db_session.commit()
    ref = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=w["oh"],
            json={"account": colleague_username},
        )
    ).json()["target_ref"]
    collaboration_path = f"/api/v1/ie/me/project-drafts/{w['project']}/collaborators"
    accepted_ids = []
    for kind in ("MANAGER", "MEMBER"):
        content = (
            {"public_name": "我确认", "division": "调研"} if kind == "MEMBER" else {}
        )
        candidate = await client.post(
            collaboration_path,
            headers=w["oh"],
            json={
                "request_id": str(uuid4()),
                "target_ref": ref,
                "kind": kind,
                **content,
            },
        )
        assert candidate.status_code == 200, candidate.text
        row = candidate.json()
        accepted = await client.post(
            f"/api/v1/ie/collaborations/{row['id']}/accept",
            headers=ch,
            json=job_command(row),
        )
        assert accepted.status_code == 200, accepted.text
        accepted_ids.append(UUID(row["id"]))
    pending = await client.post(
        collaboration_path,
        headers=w["oh"],
        json={
            "request_id": str(uuid4()),
            "target_ref": ref,
            "kind": "MEMBER",
            "public_name": "未确认新名",
            "division": "调研",
        },
    )
    assert pending.status_code == 200
    pending_row = pending.json()
    # A latent manager relation left by an earlier owner cycle must not keep
    # the outgoing owner in the editor set after this handover.
    latent = ProjectCollaboration(
        project_id=w["project"],
        target_user_id=w["owner"],
        invited_by=w["target"],
        kind="MANAGER",
        status="ACCEPTED",
        public_name=None,
        division=None,
        project_snapshot={"title": "旧同意", "summary": "", "direction": ""},
        version=2,
        expires_at=clock.now() + timedelta(days=7),
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db_session.add(latent)
    await db_session.flush()
    latent_id = latent.id
    await db_session.commit()
    jobs = f"/api/v1/ie/me/project-drafts/{w['project']}/recruitments"
    created = await client.post(
        jobs, headers=w["oh"], json={"request_id": str(uuid4()), "fields": fields()}
    )
    assert created.status_code == 201, created.text
    job_id = created.json()["id"]
    published = await client.post(
        f"{jobs}/{job_id}/publish", headers=w["oh"], json=job_command(created.json())
    )
    assert published.status_code == 200, published.text
    contact_ids = list(
        await db_session.scalars(
            select(RecruitmentContactAuthorization.id).where(
                RecruitmentContactAuthorization.recruitment_id == UUID(job_id)
            )
        )
    )
    transfer = f"/api/v1/ie/transfers/{w['row']['id']}"
    current = await client.get(transfer, headers=w["th"])
    accepted = await client.post(
        transfer + "/accept", headers=w["th"], json=confirmation(current.json())
    )
    assert accepted.status_code == 200, accepted.text
    assert (
        await client.get(
            f"/api/v1/ie/collaboration/projects/{w['project']}", headers=w["oh"]
        )
    ).status_code == 404
    assert (
        await client.get(
            f"/api/v1/ie/collaboration/projects/{w['project']}", headers=ch
        )
    ).status_code == 200
    assert (
        await db_session.get(ProjectCollaboration, latent_id, populate_existing=True)
    ).status == "REVOKED"
    for relation_id in accepted_ids:
        assert (
            await db_session.get(
                ProjectCollaboration, relation_id, populate_existing=True
            )
        ).status == "ACCEPTED"
    denied = await client.post(
        f"/api/v1/ie/collaborations/{pending_row['id']}/accept",
        headers=ch,
        json=job_command(pending_row),
    )
    assert denied.status_code == 409
    read = await client.get(f"{jobs}/{job_id}", headers=w["th"])
    assert read.status_code == 200, read.text
    assert read.json()["status"] == "CLOSED"
    assert read.json()["fields"]["contacts"] == []
    assert "demo_partner" not in read.text
    assert all(
        value is not None
        for value in await db_session.scalars(
            select(RecruitmentContactAuthorization.revoked_at).where(
                RecruitmentContactAuthorization.id.in_(contact_ids)
            )
        )
    )
    blocked = await client.post(
        f"{jobs}/{job_id}/reopen", headers=w["th"], json=job_command(read.json())
    )
    assert blocked.status_code == 422 and "授权联系渠道" in blocked.text
    new_fields = {
        **fields(),
        "contacts": [{"channel": "EMAIL", "value": "new@example.edu"}],
    }
    saved = await client.patch(
        f"{jobs}/{job_id}",
        headers=w["th"],
        json={**job_command(read.json()), "fields": new_fields},
    )
    assert saved.status_code == 200, saved.text
    reopened = await client.post(
        f"{jobs}/{job_id}/reopen", headers=w["th"], json=job_command(saved.json())
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["current"]["status"] == "OPEN"
    assert "demo_partner" not in reopened.text


async def test_pending_review_and_target_qualification_block_transfer(
    material_client, db_session, clock
):
    client, storage, _ = material_client
    _, project, _, oh, achievement_path, submit_command = await prepared(
        db_session, clock, client, storage
    )
    target, _, th, _ = await world(db_session, clock)
    target.username = str(uuid4().int)[:12]
    target_id, target_username, project_id = target.id, target.username, project.id
    await db_session.commit()
    ref = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=oh,
            json={"account": target_username},
        )
    ).json()["target_ref"]
    path = f"/api/v1/ie/me/project-drafts/{project_id}/transfers"
    payload = {
        "request_id": str(uuid4()),
        "target_ref": ref,
        "evidence_ids": submit_command["evidence_ids"],
        "allow_preview": True,
    }
    created = await client.post(path, headers=oh, json=payload)
    assert created.status_code == 200, created.text
    row = created.json()
    transfer = f"/api/v1/ie/transfers/{row['id']}"
    submitted = await client.post(
        achievement_path + "/submit", headers=oh, json=submit_command
    )
    assert submitted.status_code == 200, submitted.text
    case = submitted.json()["review_case"]
    assert (
        await client.post(
            path, headers=oh, json={**payload, "request_id": str(uuid4())}
        )
    ).status_code == 409
    assert (
        await client.post(transfer + "/accept", headers=th, json=confirmation(row))
    ).status_code == 409
    read = await client.get(
        f"{transfer}/evidence/{payload['evidence_ids'][0]}?version=1", headers=th
    )
    assert read.status_code == 409
    withdrawn = await client.post(
        achievement_path + "/withdraw",
        headers=oh,
        json={
            "workflow_version": submitted.json()["version"],
            "case_id": case["id"],
            "case_version": case["version"],
        },
    )
    assert withdrawn.status_code == 200, withdrawn.text
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == target_id)
        .values(status="PENDING", approved_at=None, approved_by=None, version=2)
    )
    await db_session.commit()
    fresh = await client.get(transfer, headers=th)
    assert fresh.status_code == 200
    assert fresh.json()["blockers"] == ["TARGET_QUALIFICATION_REQUIRED"]
    assert (
        await client.post(
            transfer + "/accept", headers=th, json=confirmation(fresh.json())
        )
    ).status_code == 409


async def test_real_transfer_keeps_creation_replay_bound_to_original_creator(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    original = {"request_id": str(uuid4()), "title": "创建记录"}
    created = await client.post(
        "/api/v1/ie/me/project-drafts", headers=w["oh"], json=original
    )
    assert created.status_code == 201, created.text
    project_id = created.json()["id"]
    ref = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=w["oh"],
            json={"account": w["usernames"][1]},
        )
    ).json()["target_ref"]
    proposal = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/transfers",
        headers=w["oh"],
        json={
            "request_id": str(uuid4()),
            "target_ref": ref,
            "evidence_ids": [],
            "allow_preview": False,
        },
    )
    assert proposal.status_code == 200
    accepted = await client.post(
        f"/api/v1/ie/transfers/{proposal.json()['id']}/accept",
        headers=w["th"],
        json=confirmation(proposal.json()),
    )
    assert accepted.status_code == 200, accepted.text
    replay = await client.post(
        "/api/v1/ie/me/project-drafts", headers=w["oh"], json=original
    )
    assert replay.status_code == 200 and replay.json() == {
        "id": project_id,
        "ownership": "TRANSFERRED",
    }
    successor = await client.post(
        "/api/v1/ie/me/project-drafts", headers=w["th"], json=original
    )
    assert successor.status_code == 201 and successor.json()["id"] != project_id
