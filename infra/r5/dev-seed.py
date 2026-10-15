"""Explicit demo identities and one operator grant; no mentor consent writes."""

import asyncio

from app.core.clock import SystemClock
from app.core.config import get_settings
from app.modules.identity.models import User
from app.modules.innovation.models import OperationsGrant
from scripts.seed_demo_accounts import main as seed_accounts
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def main() -> None:
    settings = get_settings()
    if not settings.database_url.endswith(":16436/campusquest_r5_dev"):
        raise SystemExit("Refusing demo seed outside the isolated R5 dev database")
    await seed_accounts()
    engine = create_async_engine(settings.database_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as db:
            operator = await db.scalar(select(User).where(User.username == "20250001"))
            admin = await db.scalar(
                select(User).where(User.username == "admin@campus.example.edu")
            )
            if operator is None or admin is None:
                raise RuntimeError("Expected demo identities were not created")
            grant = await db.get(OperationsGrant, operator.id)
            if grant is None:
                db.add(
                    OperationsGrant(
                        user_id=operator.id,
                        enabled=True,
                        version=1,
                        changed_by=admin.id,
                        updated_at=SystemClock().now(),
                    )
                )
            # Stable demo labels do not change roles, account status or consent.
            operator.nickname = "模拟运营（演示）"
            viewer = await db.scalar(select(User).where(User.username == "20250002"))
            if viewer is not None:
                viewer.nickname = "模拟学生（演示）"
            await db.commit()
    finally:
        await engine.dispose()
    print("R5_DEV_SEED=PASS identities and operator grant only")
    print("模拟运营：20250001 / student-demo-2026")
    print("模拟学生：20250002 / student-demo-2026")
    print("模拟导师：mentor@campus.example.edu / mentor-demo-2026")
    print("导师资料录入、本人确认和项目挂名仍须使用真实 UI/API。")


if __name__ == "__main__":
    asyncio.run(main())
