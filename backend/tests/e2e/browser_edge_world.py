"""Per-case prerequisites; never add rows to the default pixel seed."""

from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.modules.notifications.enums import (
    DeliveryStatus,
    NotificationChannel,
    NotificationEventType,
)
from app.modules.notifications.models import Notification, NotificationDelivery
from app.modules.points.models import RewardItem
from tests.e2e.browser_world import _dispose, _factory
from tests.e2e.factories import (
    clean_world,
    seed_claim,
    seed_student,
    seed_task_with_assignments,
)

_ACTIONS = {"prepare-unread", "prepare-poor-student", "prepare-empty-task"}


def _load_world(world_path: str) -> tuple[Path, dict[str, Any]]:
    from db_guard import require_test_database

    if os.environ.get("CQ_E2E") != "1":
        raise ValueError("edge preparation requires CQ_E2E=1")
    require_test_database(get_settings().database_url)
    path = Path(world_path).resolve()
    world = json.loads(path.read_text(encoding="utf-8"))
    run = world.get("run", "")
    if (
        re.fullmatch(r"[0-9a-f]{12}", run) is None
        or path.name != "world.json"
        or path.parent.parent != Path(tempfile.gettempdir()).resolve()
        or not path.parent.name.startswith(f"cq-e2e-{run}-")
    ):
        raise ValueError("edge preparation requires its disposable browser world")
    return path, world


def _save_world(path: Path, world: dict[str, Any]) -> None:
    pending = path.with_suffix(".pending")
    pending.write_text(json.dumps(world), encoding="utf-8")
    pending.replace(path)


async def _new_actor(
    factory: async_sessionmaker[AsyncSession], path: Path, world: dict[str, Any]
) -> tuple[UUID, str]:
    actor = await seed_student(factory, run=uuid4().hex)
    try:
        world.setdefault("edge_user_ids", []).append(str(actor.user_id))
        _save_world(path, world)
    except Exception:
        # A committed actor must not escape cleanup if its file write fails.
        await clean_world(factory, user_ids=[actor.user_id])
        raise
    return actor.user_id, f"{actor.username}:{actor.password}"


async def prepare_edge_case(action: str, world_path: str) -> dict[str, Any]:
    if action not in _ACTIONS:
        raise ValueError("unknown browser edge preparation")
    path, world = _load_world(world_path)
    factory = _factory()
    try:
        if action == "prepare-unread":
            now = datetime.now(UTC)
            marker = uuid4().hex
            event_key = f"e2e:{world['run']}:unread:{marker}"
            async with factory() as db:
                notification = Notification(
                    user_id=UUID(world["student"]["id"]),
                    event_key=event_key,
                    event_type=NotificationEventType.ACCOUNT_SECURITY.value,
                    title=f"端到端未读通知{marker[:8]}",
                    body="本地模拟通知，用于验证明确的已读操作。",
                )
                db.add(notification)
                await db.flush()
                db.add(
                    NotificationDelivery(
                        notification_id=notification.id,
                        user_id=notification.user_id,
                        event_key=event_key,
                        channel=NotificationChannel.IN_APP.value,
                        status=DeliveryStatus.SENT.value,
                        scheduled_at=now,
                        sent_at=now,
                        attempts=1,
                        updated_at=now,
                    )
                )
                await db.commit()
                return {
                    "notification_id": str(notification.id),
                    "title": notification.title,
                }

        actor_id, credentials = await _new_actor(factory, path, world)
        if action == "prepare-poor-student":
            async with factory() as db:
                reward = await db.get(RewardItem, UUID(world["reward_item_id"]))
                assert reward is not None and reward.point_cost > 0
                return {
                    "user_id": str(actor_id),
                    "credentials": credentials,
                    "reward_name": reward.name,
                    "point_cost": reward.point_cost,
                }

        task = await seed_task_with_assignments(
            factory,
            teacher_id=UUID(world["teacher_id"]),
            run=uuid4().hex,
            assignment_count=1,
        )
        try:
            world["task_ids"].append(str(task.task_id))
            _save_world(path, world)
        except Exception:
            await clean_world(factory, task_ids=[task.task_id])
            raise
        await seed_claim(factory, task=task, student_id=actor_id)
        requester_id, requester_credentials = await _new_actor(factory, path, world)
        return {
            "task_id": str(task.task_id),
            "task_path": f"/tasks/{task.task_id}",
            "holder_id": str(actor_id),
            "requester_id": str(requester_id),
            "credentials": requester_credentials,
        }
    finally:
        await _dispose(factory)
