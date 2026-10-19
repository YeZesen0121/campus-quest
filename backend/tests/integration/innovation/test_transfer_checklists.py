"""A pending successor needs actual safe checklists, not counts (review F1)."""

from uuid import uuid4

import pytest

from app.modules.innovation.transfer_service import TransferService
from tests.integration.innovation.mentor_support import client as client
from tests.integration.innovation.mentor_support import clock as clock
from tests.integration.innovation.mentor_support import command, confirm, prepared
from tests.integration.innovation.recruitment_support import fields, world
from tests.integration.innovation.test_project_transfer import confirmation, proposed

pytestmark = pytest.mark.integration


async def test_successor_sees_frozen_and_current_relationship_and_job_checklists(
    client, db_session, clock
):
    _, project, oh, _ = await world(db_session, clock)
    target, _, th, _ = await world(db_session, clock)
    colleague, _, ch, _ = await world(db_session, clock)
    target.username, colleague.username = str(uuid4().int)[:12], str(uuid4().int)[:12]
    colleague.nickname = "共管昵称"
    project_id = project.id
    accounts = target.username, colleague.username
    await db_session.commit()
    ref = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=oh,
            json={"account": accounts[1]},
        )
    ).json()["target_ref"]
    collaboration_path = f"/api/v1/ie/me/project-drafts/{project_id}/collaborators"
    for kind in ("MANAGER", "MEMBER"):
        row = (
            await client.post(
                collaboration_path,
                headers=oh,
                json={
                    "request_id": str(uuid4()),
                    "target_ref": ref,
                    "kind": kind,
                    **(
                        {"public_name": "确认姓名", "division": "确认分工"}
                        if kind == "MEMBER"
                        else {}
                    ),
                },
            )
        ).json()
        accepted = await client.post(
            f"/api/v1/ie/collaborations/{row['id']}/accept",
            headers=ch,
            json=command(row),
        )
        assert accepted.status_code == 200, accepted.text
    _, _, _, mh, _, _, mentor = await prepared(client, db_session, clock)
    mentor = await confirm(client, mh, mentor)
    link = (
        await client.post(
            f"/api/v1/ie/me/project-drafts/{project_id}/mentors",
            headers=oh,
            json={"request_id": str(uuid4()), "mentor_id": mentor["id"]},
        )
    ).json()
    accepted = await client.post(
        f"/api/v1/ie/mentor-links/{link['id']}/accept", headers=mh, json=command(link)
    )
    assert accepted.status_code == 200, accepted.text
    job_path = f"/api/v1/ie/me/project-drafts/{project_id}/recruitments"
    job = (
        await client.post(
            job_path, headers=oh, json={"request_id": str(uuid4()), "fields": fields()}
        )
    ).json()
    published = await client.post(
        f"{job_path}/{job['id']}/publish", headers=oh, json=command(job)
    )
    assert published.status_code == 200, published.text
    reference = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=oh,
            json={"account": accounts[0]},
        )
    ).json()["target_ref"]
    proposal = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/transfers",
        headers=oh,
        json={
            "request_id": str(uuid4()),
            "target_ref": reference,
            "evidence_ids": [],
            "allow_preview": False,
        },
    )
    assert proposal.status_code == 200, proposal.text
    path = f"/api/v1/ie/transfers/{proposal.json()['id']}"
    response = await client.get(path, headers=th)
    assert response.status_code == 200, response.text
    initial = response.json()["initial_summary"]
    assert initial["snapshot_version"] == 2
    relations = initial["relationships"]
    assert {(r["kind"], r["name"], r["division"], r["scope"]) for r in relations} == {
        ("MANAGER", "共管昵称", None, "TEXT_AND_RECRUITMENT"),
        ("MEMBER", "确认姓名", "确认分工", "PUBLIC_NAME_ONLY"),
        ("MENTOR", "模拟导师（演示）", None, "MENTOR_DISPLAY_ONLY"),
    }
    assert len({r["reference"] for r in relations}) == 3
    assert initial["closing_recruitments"] == [
        {
            "reference": job["id"],
            "role_name": "研究伙伴",
            "status": "OPEN",
            "deadline_at": None,
        }
    ]
    assert all(
        secret not in response.text
        for secret in (
            "demo_partner",
            "mentor@example.com",
            "student_no",
            "target_user_id",
            *accounts,
        )
    )
    assert (
        await client.get(f"/api/v1/ie/collaboration/projects/{project_id}", headers=th)
    ).status_code == 404
    replacement = (
        await client.post(
            collaboration_path,
            headers=oh,
            json={
                "request_id": str(uuid4()),
                "target_ref": ref,
                "kind": "MEMBER",
                "public_name": "重新确认的姓名",
                "division": "新的确认分工",
            },
        )
    ).json()
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{replacement['id']}/accept",
            headers=ch,
            json=command(replacement),
        )
    ).status_code == 200
    changed = (await client.get(path, headers=th)).json()
    assert changed["initial_summary"] == initial
    assert changed["current_summary"]["member_count"] == initial["member_count"]
    assert "重新确认的姓名" in str(changed["current_summary"]["relationships"])
    assert changed["confirmation_digest"] != response.json()["confirmation_digest"]
    assert (
        await client.post(
            path + "/accept", headers=th, json=confirmation(response.json())
        )
    ).status_code == 409


async def test_counts_only_immutable_legacy_snapshot_remains_unknown_not_reconstructed(
    client, db_session, clock, monkeypatch
):
    original = TransferService.snapshot

    async def legacy_snapshot(self, db, project):
        value = await original(self, db, project)
        for key in (
            "snapshot_version",
            "relationships",
            "closing_recruitments",
            "introduction_revision",
        ):
            value.pop(key, None)
        return value

    monkeypatch.setattr(TransferService, "snapshot", legacy_snapshot)
    _, _, _, _, th, _, _, row = await proposed(client, db_session, clock)
    monkeypatch.setattr(TransferService, "snapshot", original)
    result = await client.get(f"/api/v1/ie/transfers/{row['id']}", headers=th)
    assert result.status_code == 200, result.text
    assert result.json()["initial_summary"]["snapshot_version"] == 1
    assert result.json()["initial_summary"]["relationships"] is None
    assert result.json()["initial_summary"]["closing_recruitments"] is None
    assert result.json()["current_summary"]["snapshot_version"] == 2
    assert result.json()["current_summary"]["relationships"] == []
