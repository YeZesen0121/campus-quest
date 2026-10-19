"""Selected proofs are explicit rights; preview reads become durable conflict facts."""

from datetime import timedelta
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy import select

from app.db.session import get_db_session
from app.main import create_app
from app.modules.audit.models import AuditLog
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.collaboration_models import ProjectParticipation
from app.modules.innovation.evidence_router import get_evidence_service
from app.modules.innovation.evidence_service import EvidenceService
from app.modules.innovation.transfer_router import get_transfer_service
from app.modules.innovation.transfer_service import TransferService
from tests.fakes.integrations import FakeObjectStorage
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.test_achievement_evidence import (
    PDF,
    Scanner,
    ready,
    world,
)
from tests.integration.innovation.test_project_transfer import confirmation

pytestmark = pytest.mark.integration


@pytest.fixture
async def material_client(db_session, clock):
    app = create_app()
    storage = FakeObjectStorage(clock=clock)
    service = TransferService(clock=clock, storage=storage)

    async def db():
        yield db_session

    app.dependency_overrides[get_db_session] = db
    app.dependency_overrides[get_business_clock] = lambda: clock
    app.dependency_overrides[get_transfer_service] = lambda: service
    app.dependency_overrides[get_evidence_service] = lambda: EvidenceService(
        clock=clock, storage=storage, scanner=Scanner()
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        yield client, storage, service


async def material_world(material_client, db, clock, *, preview=True):
    client, storage, service = material_client
    owner, project, achievement, oh = await world(db, clock)
    target, _, _, th = await world(db, clock)
    owner.username, target.username = str(uuid4().int)[:12], str(uuid4().int)[:12]
    owner_id, target_id, project_id, achievement_id = (
        owner.id,
        target.id,
        project.id,
        achievement.id,
    )
    usernames = owner.username, target.username
    await db.commit()
    selected = await ready(client, project, achievement, oh, storage)
    unselected = await ready(client, project, achievement, oh, storage)
    reference = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=oh,
            json={"account": usernames[1]},
        )
    ).json()["target_ref"]
    request_body = {
        "request_id": str(uuid4()),
        "target_ref": reference,
        "evidence_ids": [selected["id"]],
        "allow_preview": preview,
    }
    response = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/transfers",
        headers=oh,
        json=request_body,
    )
    assert response.status_code == 200, response.text
    return {
        "client": client,
        "storage": storage,
        "service": service,
        "owner": owner_id,
        "target": target_id,
        "project": project_id,
        "achievement": achievement_id,
        "oh": oh,
        "th": th,
        "usernames": usernames,
        "selected": selected,
        "unselected": unselected,
        "row": response.json(),
    }


async def facts(db, w):
    return list(
        await db.scalars(
            select(ProjectParticipation.kind).where(
                ProjectParticipation.project_id == w["project"],
                ProjectParticipation.user_id == w["target"],
            )
        )
    )


@pytest.mark.parametrize("ended_by", ["cancel", "reject", "expire"])
async def test_preview_checks_target_selection_and_permission(
    material_client, db_session, clock, ended_by
):
    w = await material_world(material_client, db_session, clock)
    client, row = w["client"], w["row"]
    base = f"/api/v1/ie/transfers/{row['id']}/evidence"
    assert await facts(db_session, w) == []  # Sending a proposal is no participation.
    assert (
        await client.get(f"{base}/{w['unselected']['id']}?version=1", headers=w["th"])
    ).status_code == 404
    assert (
        await client.get(f"{base}/{w['selected']['id']}?version=1", headers=w["oh"])
    ).status_code == 404
    assert await facts(db_session, w) == []
    read = await client.get(f"{base}/{w['selected']['id']}?version=1", headers=w["th"])
    assert read.status_code == 200, read.text
    assert read.content == PDF
    assert read.headers["cache-control"] == "private, no-store"
    assert read.headers["content-disposition"].startswith("attachment;")
    assert await facts(db_session, w) == ["EVIDENCE_READER"]
    audit = await db_session.scalar(
        select(AuditLog.after_snapshot).where(
            AuditLog.action == "ie.transfer.evidence_read",
            AuditLog.target_id == row["id"],
        )
    )
    assert audit["evidence_id"] == w["selected"]["id"]
    if ended_by == "expire":
        object.__setattr__(clock, "current", clock.now() + timedelta(days=7))
    else:
        ended = await client.post(
            f"/api/v1/ie/transfers/{row['id']}/{ended_by}",
            headers=w["oh"] if ended_by == "cancel" else w["th"],
            json=confirmation(row),
        )
        assert ended.status_code == 200, ended.text
    assert (
        await client.get(f"{base}/{w['selected']['id']}?version=1", headers=w["th"])
    ).status_code == (409 if ended_by == "expire" else 404)
    assert await facts(db_session, w) == ["EVIDENCE_READER"]


async def test_without_preview_permission_no_private_read_or_conflict_fact(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock, preview=False)
    response = await w["client"].get(
        f"/api/v1/ie/transfers/{w['row']['id']}/evidence/{w['selected']['id']}?version=1",
        headers=w["th"],
    )
    assert response.status_code == 404
    assert await facts(db_session, w) == []


async def test_handover_never_replays_old_upload_signing_contract(
    material_client, db_session, clock
):
    from app.modules.innovation.evidence_models import AchievementEvidence

    w = await material_world(material_client, db_session, clock)
    original = await db_session.get(AchievementEvidence, UUID(w["selected"]["id"]))
    payload = {
        "request_id": str(original.creation_request_id),
        "content_type": "application/pdf",
        "size": len(PDF),
    }
    client = w["client"]
    accepted = await client.post(
        f"/api/v1/ie/transfers/{w['row']['id']}/accept",
        headers=w["th"],
        json=confirmation(w["row"]),
    )
    assert accepted.status_code == 200, accepted.text
    base = (
        f"/api/v1/ie/me/project-drafts/{w['project']}"
        f"/achievements/{w['achievement']}/evidence"
    )
    count = len(w["storage"].upload_urls)
    for headers, expected in ((w["oh"], 404), (w["th"], 409)):
        denied = await client.post(base, headers=headers, json=payload)
        assert denied.status_code == expected, denied.text
        assert "upload_url" not in denied.text
    assert len(w["storage"].upload_urls) == count


async def test_changed_selected_material_requires_a_new_transfer(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    path = f"/api/v1/ie/transfers/{w['row']['id']}"
    base = (
        f"/api/v1/ie/me/project-drafts/{w['project']}"
        f"/achievements/{w['achievement']}/evidence"
    )
    assert (
        await client.delete(f"{base}/{w['selected']['id']}", headers=w["oh"])
    ).status_code == 204
    read = await client.get(
        f"{path}/evidence/{w['selected']['id']}?version=1", headers=w["th"]
    )
    assert read.status_code == 409
    refreshed = await client.get(path, headers=w["th"])
    assert refreshed.json()["blockers"] == ["MATERIAL_CHANGED_CREATE_NEW_TRANSFER"]
    assert (
        await client.post(
            path + "/accept", headers=w["th"], json=confirmation(refreshed.json())
        )
    ).status_code == 409


async def test_current_owner_may_submit_selected_proof_but_cannot_reuse_unselected(
    material_client, db_session, clock
):
    from app.modules.innovation.models import (
        AchievementDraft,
        OwnerProfile,
        ProjectDraft,
    )

    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    assert (
        await client.post(
            f"/api/v1/ie/transfers/{w['row']['id']}/accept",
            headers=w["th"],
            json=confirmation(w["row"]),
        )
    ).status_code == 200
    project = await db_session.get(ProjectDraft, w["project"])
    achievement = await db_session.get(AchievementDraft, w["achievement"])
    project.summary, project.direction, project.stage, project.team_status = (
        "概况",
        "教育",
        "原型",
        "已确认团队",
    )
    achievement.description = "可运行原型"
    db_session.add(
        OwnerProfile(
            user_id=w["target"],
            name="接任本人",
            student_no="001234",
            major="专业",
            grade="2026",
        )
    )
    await db_session.commit()
    base = (
        f"/api/v1/ie/me/project-drafts/{w['project']}/achievements/{w['achievement']}"
    )
    workflow = (await client.get(base + "/workflow", headers=w["th"])).json()
    command = {
        "request_id": str(uuid4()),
        "workflow_version": workflow["version"],
        "project_version": project.version,
        "achievement_version": achievement.version,
        "evidence_ids": [w["unselected"]["id"]],
    }
    denied = await client.post(base + "/submit", headers=w["th"], json=command)
    assert denied.status_code == 409, denied.text
    command.update(request_id=str(uuid4()), evidence_ids=[w["selected"]["id"]])
    accepted = await client.post(base + "/submit", headers=w["th"], json=command)
    assert accepted.status_code == 200, accepted.text


async def test_transfer_and_reacquisition_never_restore_unselected_proofs(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    base = (
        f"/api/v1/ie/me/project-drafts/{w['project']}"
        f"/achievements/{w['achievement']}/evidence"
    )
    result = await client.post(
        f"/api/v1/ie/transfers/{w['row']['id']}/accept",
        headers=w["th"],
        json=confirmation(w["row"]),
    )
    assert result.status_code == 200, result.text
    listed = await client.get(base, headers=w["th"])
    assert listed.status_code == 200, listed.text
    assert [(e["id"], e["read_only"]) for e in listed.json()["items"]] == [
        (w["selected"]["id"], True)
    ]
    assert (await client.get(base, headers=w["oh"])).status_code == 404
    for evidence_id, expected in (
        (w["selected"]["id"], 200),
        (w["unselected"]["id"], 404),
    ):
        read = await client.get(f"{base}/{evidence_id}/content", headers=w["th"])
        assert read.status_code == expected, read.text
    assert (
        await client.delete(f"{base}/{w['selected']['id']}", headers=w["th"])
    ).status_code == 404
    assert (
        await client.post(f"{base}/{w['selected']['id']}/complete", headers=w["th"])
    ).status_code == 404
    # Hand back WITHOUT selecting any old material. A user-only origin check
    # would silently restore the original owner's two old proofs here.
    ref = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=w["th"],
            json={"account": w["usernames"][0]},
        )
    ).json()["target_ref"]
    proposal = await client.post(
        f"/api/v1/ie/me/project-drafts/{w['project']}/transfers",
        headers=w["th"],
        json={
            "request_id": str(uuid4()),
            "target_ref": ref,
            "evidence_ids": [],
            "allow_preview": False,
        },
    )
    assert proposal.status_code == 200, proposal.text
    back = await client.post(
        f"/api/v1/ie/transfers/{proposal.json()['id']}/accept",
        headers=w["oh"],
        json=confirmation(proposal.json()),
    )
    assert back.status_code == 200, back.text
    assert (await client.get(base, headers=w["oh"])).json()["items"] == []
    assert (
        await client.get(f"{base}/{w['selected']['id']}/content", headers=w["oh"])
    ).status_code == 404


async def test_preview_audit_failure_never_reads_storage_or_leaves_participation(
    material_client, db_session, clock, monkeypatch
):
    w = await material_world(material_client, db_session, clock)
    calls = []

    def read(**kwargs):
        calls.append(kwargs)
        raise AssertionError("storage must not be read before durable audit")

    monkeypatch.setattr(w["storage"], "read_bounded_object", read)

    async def audit(*args, **kwargs):
        raise RuntimeError("audit unavailable")

    monkeypatch.setattr(w["service"].audit, "append", audit)
    result = await w["client"].get(
        f"/api/v1/ie/transfers/{w['row']['id']}/evidence/{w['selected']['id']}?version=1",
        headers=w["th"],
    )
    assert result.status_code == 500
    assert calls == []
    assert await facts(db_session, w) == []
