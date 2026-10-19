"""Retry identity, recipient qualifications and proof integrity stay independent."""

from dataclasses import replace
from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update

from app.integrations.errors import ProviderError
from app.modules.audit.models import AuditLog
from app.modules.identity.models import User
from app.modules.innovation.collaboration_models import CollaborationTarget
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.mentor_models import MentorProfile, ProjectMentorLink
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_achievement_evidence import PDF
from tests.integration.innovation.test_achievement_review_operations import account
from tests.integration.innovation.test_project_transfer import confirmation, proposed
from tests.integration.innovation.test_project_transfer_evidence import (
    facts,
    material_world,
)
from tests.integration.innovation.test_project_transfer_evidence import (
    material_client as material_client,
)

pytestmark = pytest.mark.integration


async def test_pending_transfer_history_is_minimal_and_outsider_cannot_open_detail(
    client, db_session, clock
):
    _, _, oh, _, th, _, _, row = await proposed(client, db_session, clock)
    _, _, outsider, _ = await world(db_session, clock)
    await db_session.commit()
    for headers in (oh, th):
        history = await client.get("/api/v1/ie/me/transfers", headers=headers)
        assert history.status_code == 200, history.text
        pending = history.json()["items"][0]
        assert pending["status"] == "PENDING" and pending["id"] == row["id"]
        assert pending["current_summary"] is None and pending["initial_summary"] is None
        assert pending["evidence"] == []
    denied = await client.get(f"/api/v1/ie/transfers/{row['id']}", headers=outsider)
    assert denied.status_code == 404, denied.text
    assert "PRIVATE_PROJECT_SENTINEL" not in denied.text


async def test_transfer_creation_key_cannot_be_reused_with_different_selection(
    client, db_session, clock
):
    _, _, oh, _, _, base, payload, _ = await proposed(client, db_session, clock)
    changed = await client.post(
        base, headers=oh, json={**payload, "allow_preview": True}
    )
    assert changed.status_code == 409, changed.text
    assert changed.json()["error"]["details"]["kind"] == "REQUEST_REUSE"


@pytest.mark.parametrize(
    "invalid", ["missing", "expired", "self", "unqualified", "promoted", "wrong-proof"]
)
async def test_transfer_revalidates_target_and_exact_material_scope(
    client, db_session, clock, invalid
):
    owner, project, oh, target, _, base, payload, _ = await proposed(
        client, db_session, clock
    )
    owner_id, target_id = owner.id, target.id
    payload = {**payload, "request_id": str(uuid4())}
    if invalid == "missing":
        payload["target_ref"] = str(uuid4())
    elif invalid == "expired":
        object.__setattr__(clock, "current", clock.now() + timedelta(minutes=15))
    elif invalid == "self":
        reference = CollaborationTarget(
            actor_user_id=owner_id,
            target_user_id=owner_id,
            expires_at=clock.now() + timedelta(minutes=15),
        )
        db_session.add(reference)
        await db_session.flush()
        payload["target_ref"] = str(reference.id)
        await db_session.commit()
    elif invalid == "unqualified":
        await db_session.execute(
            update(OwnerQualification)
            .where(OwnerQualification.user_id == target_id)
            .values(status="PENDING", approved_by=None, approved_at=None)
        )
        await db_session.commit()
    elif invalid == "promoted":
        await db_session.execute(
            update(User).where(User.id == target_id).values(role="TEACHER")
        )
        await db_session.commit()
    else:
        payload["evidence_ids"] = [str(uuid4())]
    denied = await client.post(base, headers=oh, json=payload)
    assert denied.status_code == 409, denied.text
    if invalid in {"unqualified", "promoted"}:
        assert (
            denied.json()["error"]["details"]["kind"] == "TARGET_QUALIFICATION_REQUIRED"
        )
    assert "PRIVATE_PROJECT_SENTINEL" not in denied.text


async def test_transfer_action_receipt_rejects_changed_body_under_same_key(
    client, db_session, clock
):
    _, _, _, _, th, _, _, row = await proposed(client, db_session, clock)
    path = f"/api/v1/ie/transfers/{row['id']}/accept"
    payload = confirmation(row)
    accepted = await client.post(path, headers=th, json=payload)
    assert accepted.status_code == 200, accepted.text
    changed = await client.post(
        path, headers=th, json={**payload, "version": payload["version"] + 1}
    )
    assert changed.status_code == 409, changed.text
    assert changed.json()["error"]["details"]["kind"] == "REQUEST_REUSE"


async def test_stale_generation_detail_never_returns_private_summary(
    client, db_session, clock
):
    _, project, _, _, th, _, _, row = await proposed(client, db_session, clock)
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project.id)
        .values(ownership_generation=2)
    )
    await db_session.commit()
    result = await client.get(f"/api/v1/ie/transfers/{row['id']}", headers=th)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "INVALIDATED"
    assert (
        result.json()["current_summary"] is None
        and result.json()["initial_summary"] is None
    )
    assert result.json()["evidence"] == []
    assert "PRIVATE_PROJECT_SENTINEL" not in result.text


async def test_owner_role_change_prevents_target_from_accepting_old_proposal(
    client, db_session, clock
):
    owner, _, _, _, th, _, _, row = await proposed(client, db_session, clock)
    await db_session.execute(
        update(User).where(User.id == owner.id).values(role="TEACHER")
    )
    await db_session.commit()
    denied = await client.post(
        f"/api/v1/ie/transfers/{row['id']}/accept", headers=th, json=confirmation(row)
    )
    assert denied.status_code == 403, denied.text


@pytest.mark.parametrize("failure", [OSError, ProviderError, ValueError])
async def test_explicit_proof_read_storage_failure_is_safe_and_keeps_attempt_audit(
    material_client, db_session, clock, failure
):
    w = await material_world(material_client, db_session, clock)
    w["storage"].fail_with(failure("PRIVATE_PROVIDER_DETAIL"))
    result = await w["client"].get(
        f"/api/v1/ie/transfers/{w['row']['id']}/evidence/"
        f"{w['selected']['id']}?version=1",
        headers=w["th"],
    )
    assert result.status_code == 409, result.text
    assert "PRIVATE_PROVIDER_DETAIL" not in result.text
    assert await facts(db_session, w) == ["EVIDENCE_READER"]
    audits = list(
        await db_session.scalars(
            select(AuditLog.after_snapshot).where(
                AuditLog.action == "ie.transfer.evidence_read",
                AuditLog.target_id == w["row"]["id"],
            )
        )
    )
    assert len(audits) == 1 and audits[0]["evidence_id"] == w["selected"]["id"]


@pytest.mark.parametrize("changed", ["size", "type", "digest"])
async def test_preview_download_rejects_bytes_that_no_longer_match_checked_proof(
    material_client, db_session, clock, changed
):
    w = await material_world(material_client, db_session, clock)
    evidence = await db_session.get(AchievementEvidence, UUID(w["selected"]["id"]))
    key = evidence.object_key
    storage = w["storage"]
    if changed == "type":
        storage.objects[key] = replace(storage.objects[key], content_type="image/png")
    else:
        storage.put_object(
            object_key=key, content=PDF[:-1] if changed == "size" else b"X" * len(PDF)
        )
    await db_session.commit()
    response = await w["client"].get(
        f"/api/v1/ie/transfers/{w['row']['id']}/evidence/"
        f"{w['selected']['id']}?version=1",
        headers=w["th"],
    )
    assert response.status_code == 409, response.text
    assert "PRIVATE" not in response.text and key not in response.text
    assert await facts(db_session, w) == ["EVIDENCE_READER"]


async def test_handover_revokes_unaccepted_mentor_invitation_without_reviving_it(
    client, db_session, clock
):
    _, project, _, _, th, _, _, row = await proposed(client, db_session, clock)
    mentor_user, _ = await account(db_session, clock, role="MENTOR")
    profile = MentorProfile(
        user_id=mentor_user.id,
        fields={},
        version=1,
        public_version=0,
        confirmation_state="PENDING",
        visibility="HIDDEN",
        moderation_state="NORMAL",
        accepting_contact=False,
        authorized_fields=[],
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db_session.add(profile)
    await db_session.flush()
    link = ProjectMentorLink(
        project_id=project.id,
        mentor_id=profile.id,
        requested_by=project.owner_user_id,
        project_snapshot={"title": "模拟项目", "summary": "简介", "direction": "学习"},
        status="PENDING",
        version=1,
        created_at=clock.now(),
        updated_at=clock.now(),
    )
    db_session.add(link)
    await db_session.flush()
    link_id = link.id
    await db_session.commit()
    path = f"/api/v1/ie/transfers/{row['id']}"
    refreshed = await client.get(path, headers=th)
    assert refreshed.status_code == 200, refreshed.text
    accepted = await client.post(
        path + "/accept", headers=th, json=confirmation(refreshed.json())
    )
    assert accepted.status_code == 200, accepted.text
    current = await db_session.execute(
        select(ProjectMentorLink.status, ProjectMentorLink.version).where(
            ProjectMentorLink.id == link_id
        )
    )
    assert current.one() == ("REVOKED", 2)
