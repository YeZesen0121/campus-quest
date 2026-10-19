"""Browser-created rewards are owned by their audited creator's test world."""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.models import AuditLog
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.identity.models import User
from app.modules.points.admin_service import RewardAdminService, RewardItemChanges
from app.modules.points.models import PointReservation, RewardItem, RewardRedemption
from tests.e2e import browser_world
from tests.e2e.factories import clean_world, seed_reward_item, seed_student

pytestmark = pytest.mark.e2e


async def test_cleanup_removes_created_rewards_and_preserves_unrelated_items(
    db_factory,
):
    world = await browser_world._seed()
    unrelated = await seed_reward_item(db_factory, run=uuid4().hex)
    created_id = None
    cleaned = False
    try:
        async with db_factory() as db:
            created = await RewardAdminService().create_reward_item(
                db,
                Actor(user_id=UUID(world["browser_admin_id"]), role=Role.ADMIN),
                name="仅属于当前浏览器测试的奖励",
                point_cost=10,
                reason="验证测试工件清理",
            )
            created_id = created.id
            await RewardAdminService().update_reward_item(
                db,
                Actor(user_id=UUID(world["browser_admin_id"]), role=Role.ADMIN),
                unrelated.reward_item_id,
                RewardItemChanges(point_cost=11),
                reason="编辑其他奖励不改变测试数据归属",
            )
        await browser_world._clean(world["world_file"])
        cleaned = True
        async with db_factory() as db:
            assert await db.get(RewardItem, created_id) is None
            assert await db.get(RewardItem, unrelated.reward_item_id) is not None
    finally:
        if not cleaned:
            await browser_world._clean(world["world_file"])
        await clean_world(
            db_factory,
            reward_item_ids=[unrelated.reward_item_id]
            + ([created_id] if created_id is not None else []),
        )


async def test_cross_world_reward_redemption_refuses_cleanup_and_keeps_audit(
    db_factory,
):
    world = await browser_world._seed()
    foreign = await seed_student(db_factory, run=uuid4().hex)
    created_id = None
    try:
        async with db_factory() as db:
            created = await RewardAdminService().create_reward_item(
                db,
                Actor(UUID(world["browser_admin_id"]), Role.ADMIN),
                name="有其他世界兑换的本轮奖励",
                point_cost=10,
                reason="验证拒绝跨世界清理",
            )
            created_id = created.id
            redemption = RewardRedemption(
                user_id=foreign.user_id,
                reward_item_id=created_id,
                status="REQUESTED",
                term_key="cleanup-boundary",
                points=10,
            )
            db.add(redemption)
            await db.flush()
            redemption_id = redemption.id
            reservation = PointReservation(
                user_id=foreign.user_id,
                redemption_id=redemption_id,
                points=10,
                status="ACTIVE",
            )
            db.add(reservation)
            await db.commit()
        with pytest.raises(RuntimeError, match="outside this world"):
            await browser_world._clean(world["world_file"])
        with pytest.raises(RuntimeError, match="outside this world"):
            await clean_world(
                db_factory,
                user_ids=[UUID(world["browser_admin_id"])],
                reward_item_ids=[created_id],
            )
        async with db_factory() as db:
            assert await db.get(RewardItem, created_id) is not None
            assert await db.get(RewardRedemption, redemption_id) is not None
            assert (
                await db.scalar(
                    select(PointReservation.id).where(
                        PointReservation.redemption_id == redemption_id
                    )
                )
                is not None
            )
            assert (
                await db.scalar(
                    select(AuditLog.id).where(
                        AuditLog.action == "REWARD_ITEM_CREATED",
                        AuditLog.target_id == str(created_id),
                    )
                )
                is not None
            )
    finally:
        # Both scopes were created by this test; explicitly combine them.
        await clean_world(
            db_factory,
            user_ids=[foreign.user_id],
            reward_item_ids=[created_id] if created_id is not None else [],
        )
        await browser_world._clean(world["world_file"])


async def test_storage_failure_keeps_creation_ownership_for_cleanup_retry(
    db_factory, monkeypatch
):
    from app.integrations import object_storage_s3

    world = await browser_world._seed()
    created_id = None
    try:
        async with db_factory() as db:
            created = await RewardAdminService().create_reward_item(
                db,
                Actor(UUID(world["browser_admin_id"]), Role.ADMIN),
                name="存储失败后重试清理的奖励",
                point_cost=10,
                reason="验证创建归属可以重试",
            )
            created_id = created.id

        def unavailable(_settings):
            raise RuntimeError("simulated storage unavailable")

        with monkeypatch.context() as patch:
            patch.setattr(object_storage_s3, "S3ObjectStorage", unavailable)
            with pytest.raises(RuntimeError, match="simulated storage unavailable"):
                await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            assert (
                await db.scalar(
                    select(AuditLog.id).where(
                        AuditLog.action == "REWARD_ITEM_CREATED",
                        AuditLog.target_id == str(created_id),
                    )
                )
                is not None
            )
        await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            assert await db.get(RewardItem, created_id) is None
    finally:
        await clean_world(
            db_factory,
            reward_item_ids=[created_id] if created_id is not None else [],
        )
        await browser_world._clean(world["world_file"])


async def test_graph_success_then_audit_failure_keeps_drift_actor_for_retry(
    db_factory, monkeypatch
):
    world = await browser_world._seed()
    drift = await seed_student(db_factory, run=uuid4().hex)
    audit_id = None
    try:
        async with db_factory() as db:
            user = await db.get(User, drift.user_id)
            user.username = browser_world._registered_number(world["run"]) + "7"
            audit = AuditLog(
                actor_user_id=drift.user_id,
                actor_role="STUDENT",
                action="STAFF_INVITATION_ACCEPTED",
                target_type="user",
                target_id=str(drift.user_id),
            )
            db.add(audit)
            await db.commit()
            audit_id = audit.id

        original_execute = AsyncSession.execute

        async def fail_audit_delete(db, statement, *args, **kwargs):
            if (
                getattr(statement, "is_delete", False)
                and statement.table.name == "audit_logs"
            ):
                raise RuntimeError("simulated post-graph audit failure")
            return await original_execute(db, statement, *args, **kwargs)

        with monkeypatch.context() as patch:
            patch.setattr(AsyncSession, "execute", fail_audit_delete)
            with pytest.raises(
                RuntimeError, match="simulated post-graph audit failure"
            ):
                await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            assert await db.get(User, drift.user_id) is None
            assert await db.get(AuditLog, audit_id) is not None
        await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            assert await db.get(AuditLog, audit_id) is None
    finally:
        if audit_id is not None:
            async with db_factory() as db:
                await db.execute(delete(AuditLog).where(AuditLog.id == audit_id))
                await db.commit()
        await clean_world(db_factory, user_ids=[drift.user_id])
        await browser_world._clean(world["world_file"])
