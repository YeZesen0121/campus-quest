"""Completion preserves only a prior public whitelist under its source governance."""

from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select, update

from app.modules.innovation.lifecycle_models import ProjectIntroduction
from app.modules.innovation.models import OwnerQualification, ProjectDraft
from app.modules.innovation.recruitment_models import (
    RecruitmentDraft,
    RecruitmentRevision,
)
from tests.integration.innovation.recruitment_support import client as client
from tests.integration.innovation.recruitment_support import clock as clock
from tests.integration.innovation.recruitment_support import command, created, world
from tests.integration.innovation.recruitment_support import fields as job_fields
from tests.integration.innovation.test_project_transfer_evidence import (
    material_client as material_client,
)

pytestmark = pytest.mark.integration


async def lifecycle_command(client, base, headers):
    state = await client.get(base + "/lifecycle", headers=headers)
    assert state.status_code == 200, state.text
    current = state.json()
    return {
        "request_id": str(uuid4()),
        "version": current["version"],
        "confirmation_digest": current["confirmation_digest"],
    }


async def completed_public(client, db, clock):
    _, project, headers, job_path, job = await created(client, db, clock)
    project_id = project.id
    assert (
        await client.post(job_path + "/publish", headers=headers, json=command(job))
    ).status_code == 200
    public = f"/api/v1/ie/projects/{project_id}"
    previous = (await client.get(public, headers=headers)).json()
    assert previous["project"]["source_kind"] == "RECRUITMENT"
    # Changing the private parent must not become a public archive by completion.
    await db.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(
            title="PRIVATE_UNPUBLISHED_TITLE",
            summary="PRIVATE_UNPUBLISHED_SUMMARY",
            version=2,
        )
    )
    await db.commit()
    base = f"/api/v1/ie/me/project-drafts/{project_id}"
    payload = await lifecycle_command(client, base, headers)
    assert payload["version"] == 2
    result = await client.post(base + "/complete", headers=headers, json=payload)
    assert result.status_code == 200, result.text
    return project_id, headers, base, public, job_path, previous, payload, result.json()


async def test_complete_retains_last_public_intro_and_resume_keeps_jobs_closed(
    client, db_session, clock
):
    (
        project_id,
        headers,
        base,
        public,
        job,
        previous,
        payload,
        result,
    ) = await completed_public(client, db_session, clock)
    assert result["lifecycle"] == "COMPLETED"
    retry = await client.post(base + "/complete", headers=headers, json=payload)
    assert retry.status_code == 200, retry.text
    assert retry.json()["replayed"] is True
    assert retry.json()["applied_version"] == result["applied_version"]
    shown = await client.get(public, headers=headers)
    assert shown.status_code == 200, shown.text
    data = shown.json()
    assert data["project"]["title"] == previous["project"]["title"]
    assert data["project"]["summary"] == previous["project"]["summary"]
    assert data["project"]["source_kind"] == "INTRODUCTION"
    assert data["project"]["introduction_source"] == "RECRUITMENT"
    assert data["project"]["lifecycle"] == "COMPLETED"
    assert data["project"]["achievement_count"] == 0
    assert data["project"]["recruitment_count"] == 0
    assert "PRIVATE_UNPUBLISHED" not in shown.text
    assert (await client.get(job, headers=headers)).json()["status"] == "CLOSED"
    resumed = await client.post(
        base + "/resume",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert resumed.status_code == 200, resumed.text
    after = await client.get(public, headers=headers)
    assert after.status_code == 200
    assert after.json()["project"]["lifecycle"] == "ACTIVE"
    assert after.json()["project"]["introduction_revision"] == 1
    assert after.json()["recruitments"]["total"] == 0


async def test_never_public_completion_cannot_publish_private_parent(
    client, db_session, clock
):
    _, project, headers, _ = await world(db_session, clock)
    project_id = project.id
    base = f"/api/v1/ie/me/project-drafts/{project_id}"
    completed = await client.post(
        base + "/complete",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert completed.status_code == 200, completed.text
    assert (
        await client.get(f"/api/v1/ie/projects/{project_id}", headers=headers)
    ).status_code == 404
    preview = await client.post(
        base + "/introduction/preview",
        headers=headers,
        json={
            "version": completed.json()["version"],
            "fields": {
                "title": "尝试首次公开",
                "summary": "私稿",
                "direction": "教育",
                "stage": "原型",
            },
        },
    )
    assert preview.status_code == 409, preview.text


async def test_source_takedown_hides_archive_and_resume_cannot_bypass(
    client, db_session, clock
):
    project_id, headers, base, public, _, _, _, result = await completed_public(
        client, db_session, clock
    )
    await db_session.execute(
        update(RecruitmentDraft)
        .where(RecruitmentDraft.project_id == project_id)
        .values(moderation_state="TAKEN_DOWN")
    )
    await db_session.commit()
    assert (await client.get(public, headers=headers)).status_code == 404
    fields = {
        "title": "更名不能绕过",
        "summary": "介绍",
        "direction": "教育",
        "stage": "已结项",
    }
    preview = await client.post(
        base + "/introduction/preview",
        headers=headers,
        json={"version": result["version"], "fields": fields},
    )
    assert preview.status_code == 409, preview.text
    resumed = await client.post(
        base + "/resume",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert resumed.status_code == 200
    assert (await client.get(public, headers=headers)).status_code == 404


async def test_intro_correction_requires_current_preview_and_keeps_source_snapshot(
    client, db_session, clock
):
    project_id, headers, base, public, _, previous, _, result = await completed_public(
        client, db_session, clock
    )
    original_sources = list(
        await db_session.scalars(
            select(RecruitmentRevision.content)
            .join(
                RecruitmentDraft,
                RecruitmentDraft.id == RecruitmentRevision.recruitment_id,
            )
            .where(RecruitmentDraft.project_id == project_id)
        )
    )
    fields = {
        "title": "更正后介绍",
        "summary": "明确发布的更正",
        "direction": "教育",
        "stage": "已结项",
    }
    preview_payload = {"version": result["version"], "fields": fields}
    preview = await client.post(
        base + "/introduction/preview", headers=headers, json=preview_payload
    )
    assert preview.status_code == 200, preview.text
    payload = {
        **preview_payload,
        "request_id": str(uuid4()),
        "preview_digest": preview.json()["preview_digest"],
    }
    published = await client.post(
        base + "/introduction/publish", headers=headers, json=payload
    )
    assert published.status_code == 200, published.text
    current = (await client.get(public, headers=headers)).json()["project"]
    assert current["title"] == fields["title"]
    assert current["introduction_revision"] == 2
    assert current["achievement_count"] == previous["project"]["achievement_count"] == 0
    assert (
        list(
            await db_session.scalars(
                select(RecruitmentRevision.content)
                .join(
                    RecruitmentDraft,
                    RecruitmentDraft.id == RecruitmentRevision.recruitment_id,
                )
                .where(RecruitmentDraft.project_id == project_id)
            )
        )
        == original_sources
    )
    retry = await client.post(
        base + "/introduction/publish", headers=headers, json=payload
    )
    assert retry.status_code == 200 and retry.json()["replayed"] is True
    other_payload = {**payload, "request_id": str(uuid4())}
    assert (
        await client.post(
            base + "/introduction/publish", headers=headers, json=other_payload
        )
    ).status_code == 409


@pytest.mark.parametrize("ended", ["closed", "expired"])
async def test_completion_retains_genuinely_published_ended_source(
    client, db_session, clock, ended
):
    _, project, headers, jobs = await world(db_session, clock)
    project_id = project.id
    fields = job_fields()
    fields["deadline_at"] = (clock.now() + timedelta(hours=1)).isoformat()
    drafted = await client.post(
        jobs, headers=headers, json={"request_id": str(uuid4()), "fields": fields}
    )
    assert drafted.status_code == 201
    path = f"{jobs}/{drafted.json()['id']}"
    published = await client.post(
        path + "/publish", headers=headers, json=command(drafted.json())
    )
    assert published.status_code == 200
    if ended == "closed":
        assert (
            await client.post(
                path + "/close",
                headers=headers,
                json=command(published.json()["current"]),
            )
        ).status_code == 200
    else:
        object.__setattr__(clock, "current", clock.now() + timedelta(hours=2))
    public = f"/api/v1/ie/projects/{project_id}"
    assert (await client.get(public, headers=headers)).status_code == 404
    base = f"/api/v1/ie/me/project-drafts/{project_id}"
    done = await client.post(
        base + "/complete",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert done.status_code == 200, done.text
    visible = await client.get(public, headers=headers)
    assert visible.status_code == 200, visible.text
    assert visible.json()["project"]["source_kind"] == "INTRODUCTION"
    assert visible.json()["project"]["title"] == fields["project_title"]
    assert visible.json()["project"]["recruitment_count"] == 0


async def test_later_approval_allows_intro_without_rewriting_review(
    material_client, db_session, clock
):
    from tests.integration.innovation.test_achievement_review_operations import (
        OPS,
        account,
        claim,
    )
    from tests.integration.innovation.test_achievement_workflow import prepared

    client, storage, _ = material_client
    _, project, achievement, headers, achievement_base, submission = await prepared(
        db_session, clock, client, storage
    )
    project_id, achievement_id = project.id, achievement.id
    base = f"/api/v1/ie/me/project-drafts/{project_id}"
    done = await client.post(
        base + "/complete",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert done.status_code == 200
    submission["project_version"] = done.json()["version"]
    submitted = await client.post(
        achievement_base + "/submit", headers=headers, json=submission
    )
    assert submitted.status_code == 200, submitted.text
    _, operator = await account(db_session, clock, operator=True)
    claimed = await claim(client, submitted.json()["review_case"], operator)
    decided = await client.post(
        f"{OPS}/{claimed['id']}/decision",
        headers=operator,
        json={
            "request_id": str(uuid4()),
            "version": claimed["version"],
            "revision_id": claimed["revision_id"],
            "decision": "APPROVED",
            "reason": "",
        },
    )
    assert decided.status_code == 200, decided.text
    public_achievement = f"/api/v1/ie/achievements/{achievement_id}"
    original = (await client.get(public_achievement, headers=headers)).json()
    content = {
        "title": "结项后明确更正",
        "summary": "经过预览发布",
        "direction": "教育",
        "stage": "已结项",
    }
    preview = await client.post(
        base + "/introduction/preview",
        headers=headers,
        json={"version": done.json()["version"], "fields": content},
    )
    assert preview.status_code == 200, preview.text
    published = await client.post(
        base + "/introduction/publish",
        headers=headers,
        json={
            "request_id": str(uuid4()),
            "version": done.json()["version"],
            "fields": content,
            "preview_digest": preview.json()["preview_digest"],
        },
    )
    assert published.status_code == 200, published.text
    assert (await client.get(public_achievement, headers=headers)).json() == original
    shown = await client.get(f"/api/v1/ie/projects/{project_id}", headers=headers)
    assert shown.json()["project"]["achievement_count"] == 1
    assert shown.json()["project"]["source_kind"] == "INTRODUCTION"

    # A second correction must retain the genuine approved achievement lineage,
    # rather than treating the first introduction as an unverified new source.
    second_fields = {**content, "title": "第二次明确更正"}
    second_payload = {"version": published.json()["version"], "fields": second_fields}
    second_preview = await client.post(
        base + "/introduction/preview", headers=headers, json=second_payload
    )
    assert second_preview.status_code == 200, second_preview.text
    assert second_preview.json()["source_kind"] == "ACHIEVEMENT"
    second = await client.post(
        base + "/introduction/publish",
        headers=headers,
        json={
            **second_payload,
            "request_id": str(uuid4()),
            "preview_digest": second_preview.json()["preview_digest"],
        },
    )
    assert second.status_code == 200, second.text
    assert (await client.get(public_achievement, headers=headers)).json() == original
    lineage = list(
        await db_session.scalars(
            select(ProjectIntroduction)
            .where(ProjectIntroduction.project_id == project_id)
            .order_by(ProjectIntroduction.number)
        )
    )
    assert [intro.number for intro in lineage] == [1, 2]
    for intro in lineage:
        assert intro.achievement_id == achievement_id
        assert intro.achievement_revision_id == UUID(claimed["revision_id"])
        assert intro.recruitment_id is None and intro.recruitment_revision_id is None
    corrected = (
        await client.get(f"/api/v1/ie/projects/{project_id}", headers=headers)
    ).json()["project"]
    assert (
        corrected["title"] == second_fields["title"]
        and corrected["introduction_revision"] == 2
    )

    owner_id = await db_session.scalar(
        select(ProjectDraft.owner_user_id).where(ProjectDraft.id == project_id)
    )
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == owner_id)
        .values(status="PENDING", approved_at=None, approved_by=None)
    )
    await db_session.commit()
    third_payload = {"version": second.json()["version"], "fields": content}
    limited_preview = await client.post(
        base + "/introduction/preview", headers=headers, json=third_payload
    )
    assert limited_preview.status_code == 200, limited_preview.text
    assert limited_preview.json()["can_publish"] is False
    denied = await client.post(
        base + "/introduction/publish",
        headers=headers,
        json={
            **third_payload,
            "request_id": str(uuid4()),
            "preview_digest": limited_preview.json()["preview_digest"],
        },
    )
    assert denied.status_code == 403, denied.text
    assert (await client.get(public_achievement, headers=headers)).json() == original


async def test_qualified_manager_can_preview_but_cannot_publish_or_resume(
    client, db_session, clock
):
    _, headers, base, _, _, _, _, result = await completed_public(
        client, db_session, clock
    )
    manager, _, mh, _ = await world(db_session, clock)
    manager.username = str(uuid4().int)[:12]
    username = manager.username
    await db_session.commit()
    reference = (
        await client.post(
            "/api/v1/ie/collaboration/targets/resolve",
            headers=headers,
            json={"account": username},
        )
    ).json()["target_ref"]
    candidate = await client.post(
        base + "/collaborators",
        headers=headers,
        json={"request_id": str(uuid4()), "target_ref": reference, "kind": "MANAGER"},
    )
    assert candidate.status_code == 200
    assert (
        await client.post(
            f"/api/v1/ie/collaborations/{candidate.json()['id']}/accept",
            headers=mh,
            json=command(candidate.json()),
        )
    ).status_code == 200
    content = {
        "title": "共管整理的介绍",
        "summary": "准备好交负责人发布",
        "direction": "教育",
        "stage": "结项",
    }
    payload = {"version": result["version"], "fields": content}
    preview = await client.post(
        base + "/introduction/preview", headers=mh, json=payload
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["can_publish"] is False
    publish = await client.post(
        base + "/introduction/publish",
        headers=mh,
        json={
            **payload,
            "request_id": str(uuid4()),
            "preview_digest": preview.json()["preview_digest"],
        },
    )
    assert publish.status_code == 404
    resume = await client.post(
        base + "/resume", headers=mh, json=await lifecycle_command(client, base, mh)
    )
    assert resume.status_code == 404


async def test_completion_blocks_new_opening_and_consequences_require_reconfirmation(
    client, db_session, clock
):
    _, headers, base, public, old_job, _, _, _ = await completed_public(
        client, db_session, clock
    )
    old_command = await lifecycle_command(client, base, headers)
    created = await client.post(
        base + "/recruitments",
        headers=headers,
        json={"request_id": str(uuid4()), "fields": job_fields()},
    )
    assert created.status_code == 201, created.text
    path = f"{base}/recruitments/{created.json()['id']}"
    denied = await client.post(
        path + "/publish", headers=headers, json=command(created.json())
    )
    assert denied.status_code == 409 and "PROJECT_COMPLETED" in denied.text
    stale = await client.post(base + "/resume", headers=headers, json=old_command)
    assert stale.status_code == 409
    resumed = await client.post(
        base + "/resume",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert resumed.status_code == 200
    assert (await client.get(public, headers=headers)).json()["recruitments"][
        "total"
    ] == 0
    assert (await client.get(old_job, headers=headers)).json()["status"] == "CLOSED"
    opened = await client.post(
        path + "/publish", headers=headers, json=command(created.json())
    )
    assert opened.status_code == 200, opened.text


async def test_intro_qualification_and_governance_cannot_be_reset_by_lifecycle(
    client, db_session, clock
):
    from app.modules.innovation.models import OwnerQualification

    project_id, headers, base, public, _, _, _, result = await completed_public(
        client, db_session, clock
    )
    content = {
        "title": "待发布",
        "summary": "介绍",
        "direction": "教育",
        "stage": "结项",
    }
    preview = await client.post(
        base + "/introduction/preview",
        headers=headers,
        json={"version": result["version"], "fields": content},
    )
    assert preview.status_code == 200
    owner_id = await db_session.scalar(
        select(ProjectDraft.owner_user_id).where(ProjectDraft.id == project_id)
    )
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == owner_id)
        .values(status="PENDING", approved_at=None, approved_by=None, version=2)
    )
    await db_session.commit()
    denied = await client.post(
        base + "/introduction/publish",
        headers=headers,
        json={
            "version": result["version"],
            "fields": content,
            "request_id": str(uuid4()),
            "preview_digest": preview.json()["preview_digest"],
        },
    )
    assert denied.status_code in {403, 409}
    await db_session.execute(
        update(OwnerQualification)
        .where(OwnerQualification.user_id == owner_id)
        .values(
            status="APPROVED", approved_at=clock.now(), approved_by=owner_id, version=3
        )
    )
    await db_session.execute(
        update(ProjectDraft)
        .where(ProjectDraft.id == project_id)
        .values(introduction_moderation_state="TAKEN_DOWN")
    )
    await db_session.commit()
    assert (await client.get(public, headers=headers)).status_code == 404
    resumed = await client.post(
        base + "/resume",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert resumed.status_code == 200
    again = await client.post(
        base + "/complete",
        headers=headers,
        json=await lifecycle_command(client, base, headers),
    )
    assert again.status_code == 200
    assert (await client.get(public, headers=headers)).status_code == 404
