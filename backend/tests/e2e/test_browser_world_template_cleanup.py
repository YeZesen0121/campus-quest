"""Browser template cleanup follows creation ownership, not edit actors."""

from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete

from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.notifications.models import NotificationTemplate
from app.modules.notifications.template_admin import NotificationTemplateAdminService
from tests.e2e import browser_world

pytestmark = pytest.mark.e2e


async def test_cleanup_removes_created_template_and_preserves_unrelated_edit(
    db_factory,
):
    world = await browser_world._seed()
    actor = Actor(user_id=UUID(world["browser_admin_id"]), role=Role.ADMIN)
    service = NotificationTemplateAdminService()
    owned_id = None
    unrelated_id = uuid4()
    cleaned = False
    try:
        async with db_factory() as db:
            owned = await service.create(
                db,
                actor=actor,
                event_type="ASSIGNMENT_DEADLINE_24H",
                channel="EMAIL",
                title="当前浏览器测试模板",
                template_body="仅在独立测试世界使用。",
            )
            owned_id = owned.id
            db.add(
                NotificationTemplate(
                    id=unrelated_id,
                    event_type="ASSIGNMENT_DEADLINE_4H",
                    channel="EMAIL",
                    title="其他世界的模板",
                    template_body="不属于当前创建者。",
                    enabled=False,
                    version=1,
                )
            )
            await db.commit()
            await service.update(
                db,
                actor=actor,
                template_id=unrelated_id,
                title="被当前管理员编辑的其他模板",
                template_body="编辑不会转移测试数据归属。",
            )
        await browser_world._clean(world["world_file"])
        cleaned = True
        async with db_factory() as db:
            assert await db.get(NotificationTemplate, owned_id) is None
            unrelated = await db.get(NotificationTemplate, unrelated_id)
            assert unrelated is not None
            assert unrelated.version == 2
    finally:
        if not cleaned:
            await browser_world._clean(world["world_file"])
        async with db_factory() as db:
            ids = [unrelated_id] + ([owned_id] if owned_id is not None else [])
            await db.execute(
                delete(NotificationTemplate).where(NotificationTemplate.id.in_(ids))
            )
            await db.commit()
