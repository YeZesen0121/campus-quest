"""Actual preview readers and former owners retain conflicts across all entries."""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update

from app.modules.innovation.models import (
    AchievementDraft,
    OperationsGrant,
    OwnerProfile,
    ProjectDraft,
)
from app.modules.innovation.review_models import AchievementReviewCase
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.test_achievement_review_operations import OPS, account
from tests.integration.innovation.test_project_transfer import confirmation
from tests.integration.innovation.test_project_transfer_evidence import (
    material_client as material_client,
)
from tests.integration.innovation.test_project_transfer_evidence import material_world

pytestmark = pytest.mark.integration


@pytest.mark.parametrize("history", ["OWNER", "EVIDENCE_READER", "INVITATION_ONLY"])
async def test_transfer_history_filters_queue_claim_detail_download_and_decision(
    material_client, db_session, clock, history
):
    w = await material_world(material_client, db_session, clock)
    client, row = w["client"], w["row"]
    transfer = f"/api/v1/ie/transfers/{row['id']}"
    if history == "OWNER":
        assert (
            await client.post(
                transfer + "/accept", headers=w["th"], json=confirmation(row)
            )
        ).status_code == 200
        current_owner, owner_headers = w["target"], w["th"]
        reviewer, reviewer_headers = w["owner"], w["oh"]
    else:
        if history == "EVIDENCE_READER":
            assert (
                await client.get(
                    f"{transfer}/evidence/{w['selected']['id']}?version=1",
                    headers=w["th"],
                )
            ).status_code == 200
        assert (
            await client.post(
                transfer + "/cancel", headers=w["oh"], json=confirmation(row)
            )
        ).status_code == 200
        current_owner, owner_headers = w["owner"], w["oh"]
        reviewer, reviewer_headers = w["target"], w["th"]
    project = await db_session.get(ProjectDraft, w["project"])
    achievement = await db_session.get(AchievementDraft, w["achievement"])
    project.summary, project.direction, project.stage, project.team_status = (
        "已保存概况",
        "教育",
        "原型",
        "团队",
    )
    achievement.description = "已保存原型成果"
    db_session.add_all(
        [
            OwnerProfile(
                user_id=current_owner,
                name="本人",
                student_no="001234",
                major="专业",
                grade="2026",
            ),
            OperationsGrant(
                user_id=reviewer,
                enabled=True,
                version=1,
                changed_by=reviewer,
                updated_at=clock.now(),
            ),
        ]
    )
    await db_session.commit()
    base = (
        f"/api/v1/ie/me/project-drafts/{w['project']}/achievements/{w['achievement']}"
    )
    workflow = (await client.get(base + "/workflow", headers=owner_headers)).json()
    submitted = await client.post(
        base + "/submit",
        headers=owner_headers,
        json={
            "request_id": str(uuid4()),
            "workflow_version": workflow["version"],
            "project_version": project.version,
            "achievement_version": achievement.version,
            "evidence_ids": [w["selected"]["id"]],
        },
    )
    assert submitted.status_code == 200, submitted.text
    case = submitted.json()["review_case"]
    queue = await client.get(OPS, headers=reviewer_headers)
    assert queue.status_code == 200, queue.text
    visible = case["id"] in {c["id"] for c in queue.json()["items"]}
    assert visible == (history == "INVITATION_ONLY")
    claimed = await client.post(
        f"{OPS}/{case['id']}/claim",
        headers=reviewer_headers,
        json={"version": case["version"]},
    )
    if history == "INVITATION_ONLY":
        assert claimed.status_code == 200, claimed.text
        return
    assert claimed.status_code == 403, claimed.text
    # Legacy/stale assignments still have to recheck the same immutable facts.
    await db_session.execute(
        update(AchievementReviewCase)
        .where(AchievementReviewCase.id == UUID(case["id"]))
        .values(assigned_user_id=reviewer)
    )
    await db_session.commit()
    assert (
        await client.get(f"{OPS}/{case['id']}", headers=reviewer_headers)
    ).status_code == 403
    assert (
        await client.get(
            f"{OPS}/{case['id']}/evidence/{w['selected']['id']}/content",
            headers=reviewer_headers,
        )
    ).status_code == 403
    decision = await client.post(
        f"{OPS}/{case['id']}/decision",
        headers=reviewer_headers,
        json={
            "request_id": str(uuid4()),
            "version": case["version"],
            "revision_id": case["revision_id"],
            "decision": "APPROVED",
        },
    )
    assert decision.status_code == 403, decision.text
    _, available = await account(db_session, clock, operator=True)
    await db_session.commit()
    other_queue = await client.get(OPS, headers=available)
    assert case["id"] in {c["id"] for c in other_queue.json()["items"]}
    assert (
        await db_session.scalar(
            select(AchievementReviewCase.status).where(
                AchievementReviewCase.id == UUID(case["id"])
            )
        )
    ) == "SUBMITTED"
