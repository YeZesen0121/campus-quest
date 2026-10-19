"""R6 defensive consent boundaries and complete shared-editor journeys on PG."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update

from app.core.errors import BusinessError
from app.modules.audit.context import AuditContext
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.innovation.collaboration_common import lock_project
from app.modules.innovation.collaboration_models import ProjectCollaboration
from app.modules.innovation.collaboration_schemas import (
    CollaborationVersionCommand,
    TargetResolveCommand,
)
from app.modules.innovation.collaboration_service import CollaborationService
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import fields, world
from tests.integration.innovation.test_achievement_review_operations import account
from tests.integration.innovation.test_collaboration import command, invite
from tests.integration.innovation.test_collaboration_workspace import manager

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("own_account", [False, True])
async def test_target_resolution_never_reveals_missing_or_self_account(
    client, db_session, clock, own_account
):
    owner, _, headers, _ = await world(db_session, clock)
    owner.username = str(uuid4().int)[:12]
    account_number = owner.username if own_account else "99999999999999999999"
    await db_session.commit()
    result = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=headers,
        json={"account": account_number},
    )
    assert result.status_code == 404, result.text
    assert account_number not in result.text


@pytest.mark.parametrize("kind", ["MANAGER", "MEMBER"])
async def test_pending_candidate_blocks_duplicate_but_expiry_allows_fresh_round(
    client, db_session, clock, kind
):
    content = (
        {"public_name": "本人候选", "division": "研究"} if kind == "MEMBER" else {}
    )
    _, _, oh, target, _, base, payload, first = await invite(
        client, db_session, clock, kind=kind, **content
    )
    target_account = target.username
    duplicate = await client.post(
        base, headers=oh, json={**payload, "request_id": str(uuid4())}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["error"]["details"]["kind"] == "INVITATION_EXISTS"
    object.__setattr__(clock, "current", clock.now() + timedelta(days=7))
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=oh,
        json={"account": target_account},
    )
    assert resolved.status_code == 200, resolved.text
    replacement = await client.post(
        base,
        headers=oh,
        json={
            **payload,
            "target_ref": resolved.json()["target_ref"],
            "request_id": str(uuid4()),
        },
    )
    assert replacement.status_code == 200, replacement.text
    assert replacement.json()["id"] != first["id"]
    rows = (await client.get(base, headers=oh)).json()["items"]
    assert {row["id"]: row["status"] for row in rows} == {
        first["id"]: "EXPIRED",
        replacement.json()["id"]: "PENDING",
    }
    old = await db_session.get(ProjectCollaboration, UUID(first["id"]))
    assert old.status == "EXPIRED" and old.version == 2


async def test_accepted_manager_cannot_be_invited_for_same_purpose_again(
    client, db_session, clock
):
    _, _, oh, _, th, base, payload, row = await invite(client, db_session, clock)
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=th, json=command(row)
    )
    assert accepted.status_code == 200, accepted.text
    repeated = await client.post(
        base, headers=oh, json={**payload, "request_id": str(uuid4())}
    )
    assert repeated.status_code == 409, repeated.text
    assert repeated.json()["error"]["details"]["kind"] == "RELATION_EXISTS"


@pytest.mark.parametrize("action", ["accept", "reject", "revoke"])
async def test_new_command_cannot_reconfirm_or_revoke_an_ended_purpose(
    client, db_session, clock, action
):
    _, _, _, _, th, _, _, row = await invite(client, db_session, clock)
    path = f"/api/v1/ie/collaborations/{row['id']}"
    accepted = await client.post(path + "/accept", headers=th, json=command(row))
    assert accepted.status_code == 200, accepted.text
    current = accepted.json()
    if action == "revoke":
        ended = await client.post(path + "/revoke", headers=th, json=command(current))
        assert ended.status_code == 200, ended.text
        current = ended.json()
    denied = await client.post(path + "/" + action, headers=th, json=command(current))
    assert denied.status_code == 409, denied.text
    assert denied.json()["error"]["details"]["kind"] == "INVITATION_ENDED"


async def test_resolved_reference_does_not_authorize_newly_promoted_target(
    client, db_session, clock
):
    _, _, oh, target, _, base, payload, _ = await invite(client, db_session, clock)
    target_id = target.id
    await db_session.execute(
        update(User).where(User.id == target_id).values(role="TEACHER")
    )
    await db_session.commit()
    denied = await client.post(
        base, headers=oh, json={**payload, "request_id": str(uuid4())}
    )
    assert denied.status_code == 403, denied.text


async def test_unknown_collaboration_cannot_be_acted_on(client, db_session, clock):
    _, _, headers, _ = await world(db_session, clock)
    await db_session.commit()
    response = await client.post(
        f"/api/v1/ie/collaborations/{uuid4()}/accept",
        headers=headers,
        json={"request_id": str(uuid4()), "version": 1},
    )
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("operation", ["resolve", "list", "project"])
async def test_domain_student_boundary_is_enforced_without_router_dependency(
    db_session, clock, operation
):
    user, _ = await account(db_session, clock, role="TEACHER")
    _, project, _, _ = await world(db_session, clock)
    actor, project_id = Actor(user.id, "TEACHER"), project.id
    await db_session.commit()
    service = CollaborationService(clock=clock)
    with pytest.raises(BusinessError) as denied:
        if operation == "resolve":
            await service.resolve(
                db_session,
                actor=actor,
                payload=TargetResolveCommand(account="123456"),
                context=AuditContext(None, None),
            )
        elif operation == "list":
            await service.list_mine(db_session, actor=actor, limit=20, offset=0)
        else:
            await lock_project(db_session, actor, project_id)
    assert denied.value.status_code == 403


async def test_missing_project_is_safe_at_domain_boundary(db_session, clock):
    user, _, _, _ = await world(db_session, clock)
    actor = Actor(user.id, "STUDENT")
    await db_session.commit()
    with pytest.raises(BusinessError) as denied:
        await lock_project(db_session, actor, uuid4())
    assert denied.value.status_code == 404
    await db_session.rollback()


async def test_domain_rejects_unrecognized_consent_action(client, db_session, clock):
    _, _, _, target, _, _, _, row = await invite(client, db_session, clock)
    actor = Actor(target.id, "STUDENT")
    with pytest.raises(BusinessError) as denied:
        await CollaborationService(clock=clock).act(
            db_session,
            actor=actor,
            collaboration_id=UUID(row["id"]),
            action="replace",
            payload=CollaborationVersionCommand(**command(row)),
            context=AuditContext(None, None),
        )
    assert denied.value.status_code == 403
    status = await db_session.scalar(
        select(ProjectCollaboration.status).where(
            ProjectCollaboration.id == UUID(row["id"])
        )
    )
    assert status == "PENDING"


async def test_qualified_manager_complete_recruitment_journey_uses_scoped_routes(
    client, db_session, clock
):
    base, _, headers, _, _, _, _ = await manager(
        client, db_session, clock, qualified=True
    )
    path = base + "/recruitments"
    created = await client.post(
        path, headers=headers, json={"request_id": str(uuid4()), "fields": fields()}
    )
    assert created.status_code == 201, created.text
    row = created.json()
    detail = path + "/" + row["id"]
    listed = await client.get(path, headers=headers)
    assert listed.status_code == 200 and listed.json()["total"] == 1
    got = await client.get(detail, headers=headers)
    assert got.status_code == 200 and got.json() == row
    edited = await client.patch(
        detail,
        headers=headers,
        json={**command(row), "fields": {**fields(), "role_name": "共管核对后的岗位"}},
    )
    assert edited.status_code == 200, edited.text
    row = edited.json()
    for operation in ("publish", "confirm-active", "close", "reopen"):
        result = await client.post(
            detail + "/" + operation, headers=headers, json=command(row)
        )
        assert result.status_code == 200, result.text
        row = result.json()["current"]
    revoked = await client.post(
        detail + "/revoke-contact",
        headers=headers,
        json={**command(row), "channel": "WECHAT", "close_if_last": True},
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["current"]["status"] == "CLOSED"
    assert revoked.json()["current"]["public_contact_channels"] == []


async def test_manager_can_list_and_read_only_their_project_achievement_text(
    client, db_session, clock
):
    base, _, headers, _, _, _, _ = await manager(client, db_session, clock)
    created = await client.post(
        base + "/achievements",
        headers=headers,
        json={"request_id": str(uuid4()), "title": "独立文字"},
    )
    assert created.status_code == 201, created.text
    achievement = created.json()
    listing = await client.get(base + "/achievements", headers=headers)
    assert listing.status_code == 200 and listing.json()["total"] == 1
    found = await client.get(
        base + "/achievements/" + achievement["id"], headers=headers
    )
    assert found.status_code == 200 and found.json() == achievement
    assert not {"evidence", "object_key", "owner_profile"}.intersection(found.json())
