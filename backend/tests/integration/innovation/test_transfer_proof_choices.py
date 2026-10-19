"""Transfer-only metadata stays owner scoped without inheriting publication gates."""

from uuid import uuid4

import pytest
from sqlalchemy import update

from app.modules.innovation.models import OwnerQualification
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_collaboration import command
from tests.integration.innovation.test_project_transfer import confirmation
from tests.integration.innovation.test_project_transfer_evidence import (
    material_client as material_client,
)
from tests.integration.innovation.test_project_transfer_evidence import (
    material_world,
)

pytestmark = pytest.mark.integration


async def test_lapsed_owner_can_select_exact_ready_proofs_without_old_proof_access(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == w["owner"])
        .values(status="PENDING", approved_at=None, approved_by=None)
    )
    await db_session.commit()
    root = f"/api/v1/ie/me/project-drafts/{w['project']}"
    choices = root + "/transfer-proofs"
    rows = []
    for offset in (0, 1):
        page = await client.get(
            choices, headers=w["oh"], params={"limit": 1, "offset": offset}
        )
        assert page.status_code == 200, page.text
        data = page.json()
        assert (data["total"], data["limit"], data["offset"]) == (2, 1, offset)
        assert len(data["items"]) == 1
        row = data["items"][0]
        assert set(row) == {"id", "achievement_title", "content_type", "size"}
        assert row["content_type"] == "application/pdf" and row["size"] > 0
        assert row["achievement_title"]
        rows.append(row)
    assert {row["id"] for row in rows} == {w["selected"]["id"], w["unselected"]["id"]}
    existing = root + f"/achievements/{w['achievement']}/evidence"
    assert (await client.get(existing, headers=w["oh"])).status_code == 403
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=w["oh"],
        json={"account": w["usernames"][1]},
    )
    assert resolved.status_code == 200, resolved.text
    proposal = await client.post(
        root + "/transfers",
        headers=w["oh"],
        json={
            "request_id": str(uuid4()),
            "target_ref": resolved.json()["target_ref"],
            "evidence_ids": [w["selected"]["id"]],
            "allow_preview": False,
        },
    )
    assert proposal.status_code == 200, proposal.text
    assert [row["id"] for row in proposal.json()["evidence"]] == [w["selected"]["id"]]


async def test_transfer_choices_do_not_grant_manager_material_metadata(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=w["oh"],
        json={"account": w["usernames"][1]},
    )
    assert resolved.status_code == 200, resolved.text
    invitation = await client.post(
        f"/api/v1/ie/me/project-drafts/{w['project']}/collaborators",
        headers=w["oh"],
        json={
            "request_id": str(uuid4()),
            "target_ref": resolved.json()["target_ref"],
            "kind": "MANAGER",
        },
    )
    assert invitation.status_code == 200, invitation.text
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{invitation.json()['id']}/accept",
        headers=w["th"],
        json=command(invitation.json()),
    )
    assert accepted.status_code == 200, accepted.text
    denied = await client.get(
        f"/api/v1/ie/me/project-drafts/{w['project']}/transfer-proofs", headers=w["th"]
    )
    assert denied.status_code == 404, denied.text


async def test_transfer_choices_follow_selected_current_generation_and_do_not_revive(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    client = w["client"]
    transfer = f"/api/v1/ie/transfers/{w['row']['id']}"
    accepted = await client.post(
        transfer + "/accept", headers=w["th"], json=confirmation(w["row"])
    )
    assert accepted.status_code == 200, accepted.text
    root = f"/api/v1/ie/me/project-drafts/{w['project']}"
    choices = await client.get(root + "/transfer-proofs", headers=w["th"])
    assert choices.status_code == 200, choices.text
    assert [item["id"] for item in choices.json()["items"]] == [w["selected"]["id"]]
    assert (
        await client.get(root + "/transfer-proofs", headers=w["oh"])
    ).status_code == 404
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=w["th"],
        json={"account": w["usernames"][0]},
    )
    assert resolved.status_code == 200, resolved.text
    returned = await client.post(
        root + "/transfers",
        headers=w["th"],
        json={
            "request_id": str(uuid4()),
            "target_ref": resolved.json()["target_ref"],
            "evidence_ids": [],
            "allow_preview": False,
        },
    )
    assert returned.status_code == 200, returned.text
    final = await client.post(
        f"/api/v1/ie/transfers/{returned.json()['id']}/accept",
        headers=w["oh"],
        json=confirmation(returned.json()),
    )
    assert final.status_code == 200, final.text
    none = await client.get(root + "/transfer-proofs", headers=w["oh"])
    assert none.status_code == 200, none.text
    assert none.json()["items"] == [] and none.json()["total"] == 0


async def test_transfer_choices_exclude_removed_and_not_ready_materials(
    material_client, db_session, clock
):
    w = await material_world(material_client, db_session, clock)
    proof_root = (
        f"/api/v1/ie/me/project-drafts/{w['project']}/achievements/"
        f"{w['achievement']}/evidence"
    )
    for old in (w["selected"], w["unselected"]):
        removed = await w["client"].delete(
            proof_root + "/" + old["id"], headers=w["oh"]
        )
        assert removed.status_code == 204, removed.text
    pending = await w["client"].post(
        proof_root,
        headers=w["oh"],
        json={"request_id": str(uuid4()), "content_type": "application/pdf", "size": 1},
    )
    assert pending.status_code == 201, pending.text
    assert pending.json()["evidence"]["state"] == "PENDING"
    result = await w["client"].get(
        f"/api/v1/ie/me/project-drafts/{w['project']}/transfer-proofs", headers=w["oh"]
    )
    assert result.status_code == 200, result.text
    assert result.json()["items"] == [] and result.json()["total"] == 0


async def test_never_qualified_owner_can_get_an_empty_transfer_material_choice_list(
    client, db_session, clock
):
    _, project, headers, _ = await world(db_session, clock, qualified=False)
    project_id = project.id
    await db_session.commit()
    result = await client.get(
        f"/api/v1/ie/me/project-drafts/{project_id}/transfer-proofs", headers=headers
    )
    assert result.status_code == 200, result.text
    assert result.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}
    assert result.headers["cache-control"] == "private, no-store"
