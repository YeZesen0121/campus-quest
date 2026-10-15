"""Demo seeding creates a marked mentor identity, never consent or staff access."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.security import verify_password
from app.modules.identity.models import TotpCredential, User
from app.modules.innovation.mentor_models import MentorProfile
from scripts import seed_demo_accounts

pytestmark = pytest.mark.integration


async def test_demo_mentor_is_marked_identity_only_and_idempotent(
    db_engine: AsyncEngine,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Replace only the connection factory: the script's real queries, hashes
    # and commits run inside the integration fixture's rollback transaction.
    @asynccontextmanager
    async def session() -> AsyncIterator[AsyncSession]:
        yield db_session

    monkeypatch.setattr(seed_demo_accounts, "create_async_engine", lambda *_: db_engine)
    monkeypatch.setattr(
        seed_demo_accounts, "async_sessionmaker", lambda *_, **__: session
    )
    await seed_demo_accounts.main()
    mentor = await db_session.scalar(
        select(User).where(User.username == "mentor@campus.example.edu")
    )
    assert mentor is not None, "demo must include a dedicated mentor identity"
    assert mentor.role == "MENTOR"
    assert "模拟" in mentor.nickname and "演示" in mentor.nickname
    assert verify_password("mentor-demo-2026", mentor.password_hash)
    assert await db_session.get(TotpCredential, mentor.id) is None
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(MentorProfile)
            .where(MentorProfile.user_id == mentor.id)
        )
        == 0
    )
    await seed_demo_accounts.main()
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.username == "mentor@campus.example.edu")
        )
        == 1
    )
