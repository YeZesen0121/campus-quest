"""The browser's three edge scenarios own their setup and cleanup."""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.modules.identity.models import User
from app.modules.notifications.models import Notification, NotificationDelivery
from app.modules.points.models import PointReservation, PointsLedger, PointWallet
from app.modules.tasks.models import Assignment, AssignmentClaim, Task
from tests.e2e import browser_world
from tests.e2e.factories import TaskFixture, clean_world, seed_claim, seed_student

pytestmark = pytest.mark.e2e


@pytest_asyncio.fixture
async def edge_world(db_factory):
    world = await browser_world._seed()
    unrelated = await seed_student(db_factory, run=uuid4().hex)
    try:
        yield world
    finally:
        current = json.loads(Path(world["world_file"]).read_text())
        try:
            await browser_world._clean(world["world_file"])
            async with db_factory() as db:
                assert await db.get(User, unrelated.user_id) is not None
                for identifier in current.get("edge_user_ids", []):
                    assert await db.get(User, UUID(identifier)) is None
                for identifier in current["task_ids"]:
                    assert await db.get(Task, UUID(identifier)) is None
        finally:
            await clean_world(db_factory, user_ids=[unrelated.user_id])


async def test_unread_preparation_is_fresh_after_previous_message_was_read(
    db_factory, edge_world
):
    first = await browser_world._main(["prepare-unread", edge_world["world_file"]])
    first_id = UUID(first["notification_id"])
    async with db_factory() as db:
        row = await db.get(Notification, first_id)
        assert row is not None and row.user_id == UUID(edge_world["student"]["id"])
        assert row.title == first["title"] and row.read_at is None
        delivery = await db.scalar(
            select(NotificationDelivery).where(
                NotificationDelivery.notification_id == first_id
            )
        )
        assert delivery is not None and delivery.channel == "IN_APP"
        assert delivery.status == "SENT" and delivery.last_error is None
        row.read_at = datetime.now(UTC)
        await db.commit()
    second = await browser_world._main(["prepare-unread", edge_world["world_file"]])
    assert second["notification_id"] != first["notification_id"]
    assert second["title"] != first["title"]
    async with db_factory() as db:
        prior = await db.get(Notification, first_id)
        fresh = await db.get(Notification, UUID(second["notification_id"]))
        assert prior is not None and prior.read_at is not None
        assert fresh is not None and fresh.read_at is None


async def test_poor_preparation_creates_independent_zero_balance_students(
    db_factory, edge_world
):
    actors = [
        await browser_world._main(["prepare-poor-student", edge_world["world_file"]])
        for _ in range(2)
    ]
    assert actors[0]["user_id"] != actors[1]["user_id"]
    for actor in actors:
        identifier = UUID(actor["user_id"])
        assert actor["credentials"] != edge_world["env"]["CQ_E2E_STUDENT"]
        assert actor["point_cost"] > 0 and actor["reward_name"]
        async with db_factory() as db:
            user = await db.get(User, identifier)
            assert (
                user is not None and user.role == "STUDENT" and user.status == "ACTIVE"
            )
            wallet = await db.get(PointWallet, identifier)
            assert wallet is None or wallet.available_points == 0
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(PointsLedger)
                    .where(PointsLedger.user_id == identifier)
                )
                == 0
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(PointReservation)
                    .where(PointReservation.user_id == identifier)
                )
                == 0
            )


async def test_empty_task_preparation_has_no_available_unit_or_primary_claim(
    db_factory, edge_world
):
    # The browser claim flow can consume the shared student's third slot.
    open_task_id = UUID(edge_world["task_open"]["task_id"])
    async with db_factory() as db:
        assignment_ids = list(
            await db.scalars(
                select(Assignment.id).where(Assignment.task_id == open_task_id)
            )
        )
    await seed_claim(
        db_factory,
        task=TaskFixture(open_task_id, assignment_ids, UUID(edge_world["teacher_id"])),
        student_id=UUID(edge_world["student"]["id"]),
    )
    scenario = await browser_world._main(
        ["prepare-empty-task", edge_world["world_file"]]
    )
    task_id = UUID(scenario["task_id"])
    assert scenario["task_path"] == f"/tasks/{task_id}"
    assert scenario["holder_id"] != edge_world["student"]["id"]
    assert scenario["requester_id"] not in {
        scenario["holder_id"],
        edge_world["student"]["id"],
    }
    assert scenario["credentials"] != edge_world["env"]["CQ_E2E_STUDENT"]
    current = json.loads(Path(edge_world["world_file"]).read_text())
    assert str(task_id) in current["task_ids"]
    assert scenario["holder_id"] in current["edge_user_ids"]
    assert scenario["requester_id"] in current["edge_user_ids"]
    async with db_factory() as db:
        assert (
            await db.scalar(
                select(func.count())
                .select_from(AssignmentClaim)
                .where(AssignmentClaim.user_id == UUID(scenario["requester_id"]))
            )
            == 0
        )
        task = await db.get(Task, task_id)
        assert task is not None and task.status == "PUBLISHED"
        assignments = list(
            await db.scalars(select(Assignment).where(Assignment.task_id == task_id))
        )
        assert (
            len(assignments) == 1 and assignments[0].availability_status == "OCCUPIED"
        )
        claims = list(
            await db.scalars(
                select(AssignmentClaim).where(AssignmentClaim.task_id == task_id)
            )
        )
        assert len(claims) == 1 and str(claims[0].user_id) == scenario["holder_id"]
        assert claims[0].status == "CLAIMED"


@pytest.mark.parametrize(
    "action", ["prepare-unread", "prepare-poor-student", "prepare-empty-task"]
)
async def test_edge_preparation_requires_enabled_owned_disposable_world(
    edge_world, tmp_path, monkeypatch, action
):
    from tests.e2e.browser_edge_world import prepare_edge_case

    with monkeypatch.context() as patch:
        patch.setenv("CQ_E2E", "0")
        with pytest.raises(ValueError, match="requires CQ_E2E=1"):
            await prepare_edge_case(action, edge_world["world_file"])
    foreign_path = tmp_path / "world.json"
    original = Path(edge_world["world_file"]).read_bytes()
    foreign_path.write_bytes(original)
    with pytest.raises(ValueError, match="requires its disposable browser world"):
        await prepare_edge_case(action, str(foreign_path))
    assert foreign_path.read_bytes() == original
    assert Path(edge_world["world_file"]).read_bytes() == original


async def test_failed_actor_manifest_write_compensates_and_retry_is_clean(
    db_factory, edge_world, monkeypatch
):
    from tests.e2e import browser_edge_world

    actor_ids = []
    original_seed = browser_edge_world.seed_student
    original_manifest = Path(edge_world["world_file"]).read_bytes()

    async def record_actor(*args, **kwargs):
        actor = await original_seed(*args, **kwargs)
        actor_ids.append(actor.user_id)
        return actor

    def fail_manifest(*_args):
        raise OSError("simulated edge manifest failure")

    with monkeypatch.context() as patch:
        patch.setattr(browser_edge_world, "seed_student", record_actor)
        patch.setattr(browser_edge_world, "_save_world", fail_manifest)
        with pytest.raises(OSError, match="simulated edge manifest failure"):
            await browser_edge_world.prepare_edge_case(
                "prepare-poor-student", edge_world["world_file"]
            )
    assert len(actor_ids) == 1
    assert Path(edge_world["world_file"]).read_bytes() == original_manifest
    async with db_factory() as db:
        assert await db.get(User, actor_ids[0]) is None
        assert await db.get(User, UUID(edge_world["student"]["id"])) is not None
    recovered = await browser_edge_world.prepare_edge_case(
        "prepare-poor-student", edge_world["world_file"]
    )
    assert recovered["user_id"] != str(actor_ids[0])
    async with db_factory() as db:
        assert await db.get(User, UUID(recovered["user_id"])) is not None
