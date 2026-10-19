"""A real accepted relationship ends review authority, including after exit."""

from uuid import uuid4

import pytest
from sqlalchemy import select, update

from app.modules.innovation.review_models import AchievementReviewCase
from tests.integration.innovation.test_achievement_review_operations import (
    OPS,
    account,
    claim,
    review,
)
from tests.integration.innovation.test_achievement_review_operations import (
    client as client,
)
from tests.integration.innovation.test_achievement_review_operations import (
    clock as clock,
)
from tests.integration.innovation.test_achievement_review_operations import (
    scanner as scanner,
)
from tests.integration.innovation.test_achievement_review_operations import (
    storage as storage,
)
from tests.integration.innovation.test_collaboration import command

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("kind", ["MANAGER", "MEMBER"])
async def test_new_participant_loses_claim_and_all_review_entry_points(
    client, db_session, clock, storage, kind
):
    _, parent, _, oh, _, saved_command, workflow = await review(
        client, db_session, clock, storage
    )
    project_id = parent.id
    operator, op = await account(db_session, clock, operator=True)
    operator.username = str(uuid4().int)[:12]
    username, operator_id = operator.username, operator.id
    await db_session.commit()
    case = workflow["review_case"]
    resolved = await client.post(
        "/api/v1/ie/collaboration/targets/resolve",
        headers=oh,
        json={"account": username},
    )
    assert resolved.status_code == 200, resolved.text
    invitation = await client.post(
        f"/api/v1/ie/me/project-drafts/{project_id}/collaborators",
        headers=oh,
        json={
            "request_id": str(uuid4()),
            "target_ref": resolved.json()["target_ref"],
            "kind": kind,
            **({"public_name": "本人", "division": "调研"} if kind == "MEMBER" else {}),
        },
    )
    assert invitation.status_code == 200, invitation.text
    row = invitation.json()
    # Receiving an invitation is not participation: claiming is still allowed.
    case = await claim(client, case, op)
    assert (
        await db_session.scalar(
            select(AchievementReviewCase.assigned_user_id).where(
                AchievementReviewCase.id == case["id"]
            )
        )
        == operator_id
    )
    accepted = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/accept", headers=op, json=command(row)
    )
    assert accepted.status_code == 200, accepted.text
    assert (
        await db_session.scalar(
            select(AchievementReviewCase.assigned_user_id).where(
                AchievementReviewCase.id == case["id"]
            )
        )
        is None
    )
    queue = await client.get(OPS, headers=op)
    assert queue.status_code == 200
    assert case["id"] not in {r["id"] for r in queue.json()["items"]}
    # Also defend against a stale legacy assignment: private read and decision
    # must check participation themselves, rather than rely on release alone.
    await db_session.execute(
        update(AchievementReviewCase)
        .where(AchievementReviewCase.id == case["id"])
        .values(assigned_user_id=operator_id)
    )
    await db_session.commit()
    assert (await client.get(f"{OPS}/{case['id']}", headers=op)).status_code == 403
    current_version = await db_session.scalar(
        select(AchievementReviewCase.version).where(
            AchievementReviewCase.id == case["id"]
        )
    )
    evidence_id = saved_command["evidence_ids"][0]
    assert (
        await client.get(
            f"{OPS}/{case['id']}/evidence/{evidence_id}/content", headers=op
        )
    ).status_code == 403
    decision = await client.post(
        f"{OPS}/{case['id']}/decision",
        headers=op,
        json={
            "version": current_version,
            "request_id": str(uuid4()),
            "revision_id": case["revision_id"],
            "decision": "APPROVED",
        },
    )
    assert decision.status_code == 403, decision.text
    assert (
        await client.post(
            f"{OPS}/{case['id']}/claim", headers=op, json={"version": current_version}
        )
    ).status_code == 403
    removed = await client.post(
        f"/api/v1/ie/collaborations/{row['id']}/revoke",
        headers=op,
        json=command(accepted.json()),
    )
    assert removed.status_code == 200, removed.text
    queue = await client.get(OPS, headers=op)
    assert case["id"] not in {r["id"] for r in queue.json()["items"]}
    _, other_headers = await account(db_session, clock, operator=True)
    await db_session.commit()
    available = await client.get(OPS, headers=other_headers)
    assert case["id"] in {r["id"] for r in available.json()["items"]}
    reclaimed = await client.post(
        f"{OPS}/{case['id']}/claim",
        headers=other_headers,
        json={"version": current_version},
    )
    assert reclaimed.status_code == 200, reclaimed.text
