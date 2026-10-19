"""Graph refusals preserve bytes; post-commit storage failure stays retryable."""

import asyncio
import contextlib
import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.integrations.object_storage_s3 import S3ObjectStorage
from app.modules.audit.models import AuditLog
from app.modules.identity.models import StudentWhitelist, User
from app.modules.innovation.collaboration_models import ProjectCollaboration
from app.modules.innovation.evidence_models import AchievementEvidence
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.system.models import SystemSetting
from tests.e2e import browser_world
from tests.e2e.factories import seed_student

pytestmark = pytest.mark.e2e


async def proofs(db_factory, world):
    owner = UUID(world["student"]["id"])
    now = datetime.now(UTC)
    storage = S3ObjectStorage(get_settings())
    keys = [f"r6-cleanup/{uuid4()}.pdf" for _ in range(2)]
    payload = b"%PDF-1.4\nR6 simulated cleanup fixture\n%%EOF"
    async with db_factory() as db:
        project = ProjectDraft(
            owner_user_id=owner,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="a" * 64,
            title="清理边界模拟项目",
        )
        db.add(project)
        await db.flush()
        achievement = AchievementDraft(
            project_id=project.id,
            creation_request_id=uuid4(),
            creation_payload_fingerprint="b" * 64,
            title="清理边界模拟成果",
        )
        db.add(achievement)
        await db.flush()
        for key in keys:
            db.add(
                AchievementEvidence(
                    achievement_id=achievement.id,
                    creation_request_id=uuid4(),
                    creation_payload_fingerprint="c" * 64,
                    object_key=key,
                    content_type="application/pdf",
                    size=len(payload),
                    state="READY",
                    sha256=sha256(payload).hexdigest(),
                    upload_url="fixture-not-url",
                    client_headers={},
                    upload_expires_at=now + timedelta(minutes=10),
                    expires_at=now + timedelta(minutes=15),
                    created_at=now,
                    updated_at=now,
                )
            )
            await asyncio.to_thread(
                storage._client.put_object,
                Bucket=storage._bucket,
                Key=key,
                Body=payload,
                ContentType="application/pdf",
            )
        await db.commit()
        return project.id, keys, storage


async def test_cross_world_graph_refusal_has_no_external_side_effects(
    db_factory, monkeypatch
):
    world = await browser_world._seed()
    foreign = await seed_student(db_factory, run=uuid4().hex)
    project_id, keys, storage = await proofs(db_factory, world)
    owner = UUID(world["student"]["id"])
    number = browser_world._registered_number(world["run"])
    now = datetime.now(UTC)
    try:
        async with db_factory() as db:
            db.add(
                ProjectCollaboration(
                    project_id=project_id,
                    target_user_id=foreign.user_id,
                    invited_by=owner,
                    kind="MEMBER",
                    status="ACCEPTED",
                    public_name="模拟外部成员",
                    division="调研",
                    project_snapshot={"title": "模拟"},
                    version=2,
                    expires_at=now + timedelta(days=7),
                    created_at=now,
                    updated_at=now,
                )
            )
            db.add(StudentWhitelist(student_number=number))
            term = await db.get(SystemSetting, "CURRENT_ACADEMIC_TERM")
            if term is None:
                db.add(
                    SystemSetting(
                        key="CURRENT_ACADEMIC_TERM",
                        value="F6-simulated-term",
                        updated_by_user_id=owner,
                    )
                )
            else:
                term.value = "F6-simulated-term"
            audit = AuditLog(
                actor_user_id=owner,
                actor_role="STUDENT",
                action="ie.project.create",
                target_type="ie_project",
                target_id=str(project_id),
            )
            db.add(audit)
            await db.commit()
            audit_id = audit.id

        async def state():
            async with db_factory() as db:
                term = await db.get(SystemSetting, "CURRENT_ACADEMIC_TERM")
                return {
                    "project": await db.get(ProjectDraft, project_id) is not None,
                    "foreign": await db.get(User, foreign.user_id) is not None,
                    "whitelist": await db.scalar(
                        select(StudentWhitelist.id).where(
                            StudentWhitelist.student_number == number
                        )
                    )
                    is not None,
                    "term": term.value if term else None,
                    "audit": await db.get(AuditLog, audit_id) is not None,
                    "objects": [
                        await asyncio.to_thread(storage.head_object, object_key=key)
                        is not None
                        for key in keys
                    ],
                }

        before = await state()
        calls = []
        original_delete = S3ObjectStorage.delete_object

        def observe_delete(self, *, object_key):
            calls.append(object_key)
            return original_delete(self, object_key=object_key)

        with monkeypatch.context() as patch:
            patch.setattr(S3ObjectStorage, "delete_object", observe_delete)
            with pytest.raises(RuntimeError, match="outside this world"):
                await browser_world._clean(world["world_file"])
        assert await state() == before
        assert calls == []
    finally:
        # The test explicitly owns both sides; only teardown combines them.
        path = Path(world["world_file"])
        manifest = json.loads(path.read_text())
        manifest["cleanup_user_ids"] = list(
            set(manifest.get("cleanup_user_ids", [])) | {str(foreign.user_id)}
        )
        path.write_text(json.dumps(manifest))
        await browser_world._clean(str(path))
        for key in keys:
            with contextlib.suppress(FileNotFoundError):
                await asyncio.to_thread(storage.delete_object, object_key=key)


async def test_post_graph_storage_failure_retries_from_durable_object_list(
    db_factory, monkeypatch
):
    world = await browser_world._seed()
    project_id, keys, storage = await proofs(db_factory, world)
    calls = []
    original_delete = S3ObjectStorage.delete_object

    def fail_second_owned_delete(self, *, object_key):
        if object_key in keys:
            calls.append(object_key)
            if len(calls) == 2:
                raise RuntimeError("simulated second object deletion failure")
        return original_delete(self, object_key=object_key)

    try:
        with monkeypatch.context() as patch:
            patch.setattr(S3ObjectStorage, "delete_object", fail_second_owned_delete)
            with pytest.raises(
                RuntimeError, match="simulated second object deletion failure"
            ):
                await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            assert await db.get(ProjectDraft, project_id) is None
        assert (
            sum(
                [
                    await asyncio.to_thread(storage.head_object, object_key=key)
                    is not None
                    for key in keys
                ]
            )
            == 1
        )
        await browser_world._clean(world["world_file"])
        assert all(
            [
                await asyncio.to_thread(storage.head_object, object_key=key) is None
                for key in keys
            ]
        )
    finally:
        await browser_world._clean(world["world_file"])
        for key in keys:
            with contextlib.suppress(FileNotFoundError):
                await asyncio.to_thread(storage.delete_object, object_key=key)
