"""R5 mentor sessions never grant student or staff task capabilities."""

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Annotated
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import FrozenClock
from app.core.security import hash_password
from app.db.session import get_db_session
from app.main import create_app
from app.modules.identity.dependencies import (
    get_business_clock,
    require_active_student_or_staff_management_actor,
)
from app.modules.identity.events import Actor
from app.modules.identity.models import User, UserSession
from app.modules.identity.providers import get_rate_limiter
from app.modules.identity.routing_common import CSRF_HEADER_NAME
from tests.fakes.integrations import FakeRateLimiter

pytestmark = pytest.mark.integration
_PASSWORD = "mentor-test-password"


@pytest_asyncio.fixture
async def mentor_client(db_session: AsyncSession) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app()

    async def session() -> AsyncIterator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db_session] = session
    app.dependency_overrides[get_business_clock] = lambda: FrozenClock(
        datetime.now(UTC)
    )
    app.dependency_overrides[get_rate_limiter] = FakeRateLimiter

    @app.get("/test/submission-access")
    async def submission_access(
        actor: Annotated[
            Actor, Depends(require_active_student_or_staff_management_actor)
        ],
    ) -> dict[str, str]:
        return {"role": actor.role}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="https://localhost"
    ) as client:
        yield client


async def seed(db: AsyncSession, role: str, status: str = "ACTIVE") -> User:
    user = User(
        username=f"{role.lower()}@mentor.example.edu",
        password_hash=hash_password(_PASSWORD),
        nickname="身份回归测试",
        role=role,
        status=status,
    )
    db.add(user)
    await db.flush()
    return user


@pytest.mark.parametrize("role", ["STUDENT", "TEACHER", "ADMIN"])
async def test_mentor_login_rejects_other_roles(
    db_session: AsyncSession, mentor_client: httpx.AsyncClient, role: str
) -> None:
    user = await seed(db_session, role)
    response = await mentor_client.post(
        "/api/v1/auth/mentor/login",
        json={"username": user.username, "password": _PASSWORD},
    )
    assert response.status_code == 401, response.text
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == user.id)
        )
        == 0
    )


async def test_mentor_login_refresh_logout_and_task_isolation(
    db_session: AsyncSession, mentor_client: httpx.AsyncClient
) -> None:
    user = await seed(db_session, "MENTOR")
    response = await mentor_client.post(
        "/api/v1/auth/mentor/login",
        json={"username": f" {user.username} ", "password": _PASSWORD},
    )
    assert response.status_code == 200, response.text
    tokens = response.json()
    assert set(tokens) == {"access_token", "csrf_token", "token_type"}
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = await mentor_client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200, me.text
    assert me.json()["role"] == "MENTOR"
    browsing = await mentor_client.get("/api/v1/ie/talents", headers=headers)
    assert browsing.status_code == 200, browsing.text
    for method, path in [
        ("GET", "/api/v1/me/claims"),
        ("GET", "/api/v1/teacher/tasks"),
        ("GET", "/api/v1/admin/users"),
        ("GET", "/test/submission-access"),
        ("POST", f"/api/v1/tasks/{uuid4()}/claim"),
    ]:
        denied = await mentor_client.request(method, path, headers=headers)
        assert denied.status_code == 403, (path, denied.text)
        assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
    rotated = await mentor_client.post(
        "/api/v1/auth/refresh", headers={CSRF_HEADER_NAME: tokens["csrf_token"]}
    )
    assert rotated.status_code == 200, rotated.text
    fresh = rotated.json()
    logged_out = await mentor_client.post(
        "/api/v1/auth/logout", headers={CSRF_HEADER_NAME: fresh["csrf_token"]}
    )
    assert logged_out.status_code == 204, logged_out.text
    after = await mentor_client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {fresh['access_token']}"}
    )
    assert after.status_code == 401


async def test_mentor_cannot_use_student_or_staff_login(
    db_session: AsyncSession, mentor_client: httpx.AsyncClient
) -> None:
    user = await seed(db_session, "MENTOR")
    for path, body, expected in [
        (
            "/api/v1/auth/login",
            {"identifier": user.username, "password": _PASSWORD},
            401,
        ),
        ("/api/v1/auth/login", {"username": user.username, "password": _PASSWORD}, 422),
        (
            "/api/v1/auth/staff/login",
            {"email": user.username, "password": _PASSWORD, "totp_code": "000000"},
            404,
        ),
    ]:
        response = await mentor_client.post(path, json=body)
        assert response.status_code == expected, response.text
        if expected == 401:
            assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == user.id)
        )
        == 0
    )


@pytest.mark.parametrize("status", ["SUSPENDED", "BANNED"])
async def test_unavailable_mentor_cannot_login(
    db_session: AsyncSession, mentor_client: httpx.AsyncClient, status: str
) -> None:
    user = await seed(db_session, "MENTOR", status)
    response = await mentor_client.post(
        "/api/v1/auth/mentor/login",
        json={"username": user.username, "password": _PASSWORD},
    )
    assert response.status_code == 403, response.text
    assert response.json()["error"]["code"] == "ACCOUNT_NOT_ACTIVE"
