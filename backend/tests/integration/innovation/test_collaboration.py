"""R6 consent is specific to a purpose, recipient, version and expiry."""

from datetime import timedelta
from uuid import uuid4

import pytest

from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import world
from tests.integration.innovation.test_achievement_review_operations import account

pytestmark = pytest.mark.integration


def command(row):
    return {"request_id": str(uuid4()), "version": row["version"]}


async def invite(client, db, clock, *, kind="MANAGER", **content):
    owner, project, oh, _ = await world(db, clock)
    target, th = await account(db, clock)
    target.username = str(uuid4().int)[:12]
    await db.commit()
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=oh,
        json={"account": target.username},
    )
    assert resolved.status_code == 200, resolved.text
    assert set(resolved.json()) == {"target_ref", "nickname", "expires_at"}
    assert target.username not in resolved.text
    base = f"/api/v1/ie/me/project-drafts/{project.id}/collaborators"
    payload = {
        "request_id": str(uuid4()),
        "target_ref": resolved.json()["target_ref"],
        "kind": kind,
        **content,
    }
    result = await client.post(base, headers=oh, json=payload)
    assert result.status_code == 200, result.text
    return owner, project, oh, target, th, base, payload, result.json()


async def test_only_target_can_accept_and_manager_does_not_create_public_name(
    client, db_session, clock
):
    _, project, oh, _, th, base, _, row = await invite(client, db_session, clock)
    project_id = str(project.id)
    action = f"/api/v1/ie/collaborations/{row['id']}"
    denied = await client.post(action + "/accept", headers=oh, json=command(row))
    assert denied.status_code == 403
    mine = await client.get("/api/v1/ie/me/collaborations", headers=th)
    assert mine.json()["total"] == 1
    assert mine.json()["items"][0]["status"] == "PENDING"
    accepted = await client.post(action + "/accept", headers=th, json=command(row))
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "ACCEPTED"
    # The owner-only endpoint stays owner-only; workspace authorization is task3.
    assert (await client.get(base, headers=th)).status_code == 404
    assert accepted.json()["public_name"] is None
    assert accepted.json()["project_id"] == project_id


async def test_member_can_consent_without_getting_management_and_replay_cannot_revive(
    client, db_session, clock
):
    _, _, oh, _, th, base, payload, row = await invite(
        client,
        db_session,
        clock,
        kind="MEMBER",
        public_name="本人确认名",
        division="调研",
    )
    same = await client.post(base, headers=oh, json=payload)
    assert same.json()["id"] == row["id"]
    reused = await client.post(
        base, headers=oh, json={**payload, "division": "未经同意"}
    )
    assert reused.status_code == 409
    action = f"/api/v1/ie/collaborations/{row['id']}"
    original = command(row)
    accepted = await client.post(action + "/accept", headers=th, json=original)
    assert accepted.status_code == 200, accepted.text
    row = accepted.json()
    assert row["kind"] == "MEMBER"
    ended = await client.post(action + "/revoke", headers=th, json=command(row))
    assert ended.status_code == 200, ended.text
    replay = await client.post(action + "/accept", headers=th, json=original)
    assert replay.status_code == 200
    assert replay.json()["status"] == "REVOKED"


async def test_rejected_member_update_keeps_prior_consent_but_end_cancels_candidates(
    client, db_session, clock
):
    _, _, oh, _, th, base, payload, first = await invite(
        client,
        db_session,
        clock,
        kind="MEMBER",
        public_name="已同意名",
        division="调研",
    )
    first_path = f"/api/v1/ie/collaborations/{first['id']}"
    accepted = await client.post(
        first_path + "/accept", headers=th, json=command(first)
    )
    assert accepted.status_code == 200, accepted.text
    first = accepted.json()
    updated = await client.post(
        base,
        headers=oh,
        json={**payload, "request_id": str(uuid4()), "public_name": "新候选名"},
    )
    assert updated.status_code == 200, updated.text
    candidate = updated.json()
    candidate_path = f"/api/v1/ie/collaborations/{candidate['id']}"
    rejected = await client.post(
        candidate_path + "/reject", headers=th, json=command(candidate)
    )
    assert rejected.status_code == 200, rejected.text
    current = (await client.get(base, headers=oh)).json()["items"]
    assert [
        (x["public_name"], x["status"]) for x in current if x["status"] == "ACCEPTED"
    ] == [("已同意名", "ACCEPTED")]
    next_candidate = (
        await client.post(
            base, headers=oh, json={**payload, "request_id": str(uuid4())}
        )
    ).json()
    ended = await client.post(first_path + "/revoke", headers=oh, json=command(first))
    assert ended.status_code == 200
    late = await client.post(
        f"/api/v1/ie/collaborations/{next_candidate['id']}/accept",
        headers=th,
        json=command(next_candidate),
    )
    assert late.status_code == 409


async def test_invitation_expires_at_boundary_without_worker(client, db_session, clock):
    _, _, _, _, th, _, _, row = await invite(client, db_session, clock)
    object.__setattr__(clock, "current", clock.now() + timedelta(days=7))
    result = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert result.status_code == 409
    assert result.json()["error"]["details"]["kind"] == "INVITATION_EXPIRED"


async def test_target_reference_is_bound_to_inviter_and_member_fields_are_required(
    client, db_session, clock
):
    _, _, _, _, th, _, payload, _ = await invite(client, db_session, clock)
    _, other_project, _, _ = await world(db_session, clock)
    db_session.add(other_project)
    await db_session.commit()
    other_base = f"/api/v1/ie/me/project-drafts/{other_project.id}/collaborators"
    # Guessing a target ref under another authenticated identity cannot use it.
    result = await client.post(
        other_base,
        headers=th,
        json={**payload, "request_id": str(uuid4())},
    )
    assert result.status_code == 404
    invalid = await client.post(
        other_base,
        headers=th,
        json={**payload, "request_id": str(uuid4()), "kind": "MEMBER"},
    )
    assert invalid.status_code == 422


async def test_ending_management_keeps_independent_member_consent(
    client, db_session, clock
):
    _, _, oh, _, th, base, payload, manager = await invite(client, db_session, clock)
    management_path = f"/api/v1/ie/collaborations/{manager['id']}"
    manager = (
        await client.post(
            management_path + "/accept", headers=th, json=command(manager)
        )
    ).json()
    member = await client.post(
        base,
        headers=oh,
        json={
            **payload,
            "request_id": str(uuid4()),
            "kind": "MEMBER",
            "public_name": "本人名字",
            "division": "产品",
        },
    )
    assert member.status_code == 200, member.text
    member = member.json()
    member_path = f"/api/v1/ie/collaborations/{member['id']}"
    assert (
        await client.post(member_path + "/accept", headers=th, json=command(member))
    ).status_code == 200
    assert (
        await client.post(
            management_path + "/revoke", headers=oh, json=command(manager)
        )
    ).status_code == 200
    states = (await client.get("/api/v1/ie/me/collaborations", headers=th)).json()[
        "items"
    ]
    assert {(r["kind"], r["status"]) for r in states} == {
        ("MANAGER", "REVOKED"),
        ("MEMBER", "ACCEPTED"),
    }


async def test_candidate_and_participation_history_cannot_be_forged(
    client, db_session, clock
):
    from sqlalchemy import update
    from sqlalchemy.exc import DBAPIError

    from app.modules.innovation.collaboration_models import (
        ProjectCollaboration,
        ProjectParticipation,
    )

    _, _, _, _, th, _, _, row = await invite(
        client, db_session, clock, kind="MEMBER", public_name="已同意", division="调研"
    )
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert accepted.status_code == 200, accepted.text
    with pytest.raises(DBAPIError):
        async with db_session.begin_nested():
            await db_session.execute(
                update(ProjectCollaboration)
                .where(ProjectCollaboration.id == row["id"])
                .values(public_name="伪造")
            )
    with pytest.raises(DBAPIError):
        async with db_session.begin_nested():
            await db_session.execute(update(ProjectParticipation).values(kind="OWNER"))


async def test_database_rejects_member_candidate_without_confirmation_fields(
    client, db_session, clock
):
    from sqlalchemy import insert
    from sqlalchemy.exc import IntegrityError

    from app.modules.innovation.collaboration_models import ProjectCollaboration

    owner, project, _, target, _, _, _, _ = await invite(client, db_session, clock)
    with pytest.raises(IntegrityError):
        async with db_session.begin_nested():
            await db_session.execute(
                insert(ProjectCollaboration).values(
                    project_id=project.id,
                    target_user_id=target.id,
                    invited_by=owner.id,
                    kind="MEMBER",
                    status="PENDING",
                    version=1,
                    project_snapshot={"title": "test"},
                    created_at=clock.now(),
                    updated_at=clock.now(),
                    expires_at=clock.now() + timedelta(days=7),
                )
            )


async def test_personal_history_paginates_past_two_hundred(client, db_session, clock):
    from sqlalchemy import insert

    from app.modules.innovation.collaboration_models import ProjectCollaboration

    owner, project, _, target, th, _, _, first = await invite(client, db_session, clock)
    await db_session.execute(
        insert(ProjectCollaboration),
        [
            {
                "project_id": project.id,
                "target_user_id": target.id,
                "invited_by": owner.id,
                "kind": "MANAGER",
                "status": "REJECTED",
                "version": 2,
                "project_snapshot": {
                    "title": f"历史{i}",
                    "summary": "",
                    "direction": "",
                },
                "expires_at": clock.now() + timedelta(days=7),
                "created_at": clock.now(),
                "updated_at": clock.now(),
            }
            for i in range(201)
        ],
    )
    await db_session.commit()
    rows = []
    for offset in (0, 100, 200):
        response = await client.get(
            f"/api/v1/ie/me/collaborations?limit=100&offset={offset}", headers=th
        )
        assert response.status_code == 200, response.text
        assert response.json()["total"] == 202
        rows.extend(response.json()["items"])
    assert len({r["id"] for r in rows}) == 202
    assert first["id"] in {r["id"] for r in rows}


async def test_audit_failure_rolls_back_confirmation_and_participation(
    client, db_session, clock
):
    from sqlalchemy import func, select

    from app.modules.audit.context import AuditContext
    from app.modules.audit.service import AuditLogWriter
    from app.modules.identity.enums import Role
    from app.modules.identity.events import Actor
    from app.modules.innovation.collaboration_models import (
        ProjectCollaboration,
        ProjectParticipation,
    )
    from app.modules.innovation.collaboration_schemas import CollaborationVersionCommand
    from app.modules.innovation.collaboration_service import CollaborationService

    class FailingAudit(AuditLogWriter):
        async def append(self, *args, **kwargs):
            raise RuntimeError("audit unavailable")

    _, project, _, target, _, _, _, row = await invite(client, db_session, clock)
    project_id, target_id = project.id, target.id
    with pytest.raises(RuntimeError, match="audit unavailable"):
        await CollaborationService(clock=clock, audit=FailingAudit()).act(
            db_session,
            actor=Actor(target_id, Role.STUDENT),
            collaboration_id=row["id"],
            action="accept",
            payload=CollaborationVersionCommand(**command(row)),
            context=AuditContext(None, None),
        )
    current = await db_session.scalar(
        select(ProjectCollaboration.status).where(ProjectCollaboration.id == row["id"])
    )
    assert current == "PENDING"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(ProjectParticipation)
            .where(ProjectParticipation.project_id == project_id)
        )
        == 0
    )
