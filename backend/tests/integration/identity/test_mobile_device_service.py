"""The mobile service's remembered credential and challenge security boundaries.

Unified HTTP routing has its own tests. These exercise the still-public service
legs with real PostgreSQL/Redis: valid remembered credentials renew sessions,
while an invalid population/state/challenge cannot mint sessions or audit success.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select

from app.core.clock import FrozenClock
from app.core.config import get_settings
from app.core.errors import BusinessError
from app.modules.audit.models import AuditLog
from app.modules.identity.dependencies import get_access_token_codec
from app.modules.identity.device_credentials import issue, list_for_user, validate
from app.modules.identity.enums import Role, UserStatus
from app.modules.identity.login_failure_guard import LoginFailureGuard
from app.modules.identity.models import (
    LoginMobileChallenge,
    TotpCredential,
    User,
    UserSession,
)
from app.modules.identity.providers import get_mobile_login_service
from app.modules.identity.session_service import SessionService
from tests.integration.identity.test_mobile_code_login_api import api_redis as api_redis
from tests.integration.identity.test_mobile_code_login_api import api_sms as api_sms

pytestmark = pytest.mark.integration
PHONE = "+8613800510001"


@pytest.fixture
def clock():
    return FrozenClock(datetime.now(UTC).replace(microsecond=0))


@pytest.fixture
def guard(api_redis):
    return LoginFailureGuard(redis=api_redis)


@pytest.fixture
def service(api_sms, api_redis, clock, guard):
    return get_mobile_login_service(
        sms_sender=api_sms,
        clock=clock,
        settings=get_settings(),
        redis=api_redis,
        sessions=SessionService(clock=clock, access_codec=get_access_token_codec()),
        guard=guard,
    )


async def seed_user(db, role, status=UserStatus.ACTIVE):
    user = User(
        username=f"mobile-device-{uuid4().hex}",
        password_hash="unused",
        nickname="设备边界测试",
        phone_e164=PHONE,
        role=role.value,
        status=status.value,
    )
    db.add(user)
    await db.flush()
    return user


@pytest.mark.parametrize("role", [Role.STUDENT, Role.TEACHER, Role.ADMIN])
async def test_remembered_mobile_credential_renews_session_and_device(
    db_session, service, api_sms, clock, guard, role
):
    user = await seed_user(db_session, role)
    if role is Role.ADMIN:
        db_session.add(
            TotpCredential(
                user_id=user.id,
                secret_encrypted=b"unused-on-remembered-device-leg",
                confirmed_at=clock.now() - timedelta(days=2),
            )
        )
    original = await issue(
        db_session, user.id, clock=FrozenClock(clock.now() - timedelta(days=1))
    )
    await db_session.commit()
    await guard.record_failure(user.id)
    verify = service.verify_code if role is Role.STUDENT else service.verify_staff_code
    result = await verify(db_session, phone=None, code=None, device_cookie=original)
    assert result.tokens is not None
    claims = get_access_token_codec().decode(result.tokens.access_token)
    assert UUID(claims.sub) == user.id
    assert claims.role == role.value
    session = await db_session.get(UserSession, UUID(claims.sid))
    assert session is not None and session.user_id == user.id
    assert session.revoked_at is None
    assert result.device_cookie and result.device_cookie != original
    assert await validate(db_session, result.device_cookie, clock=clock) == user.id
    devices = await list_for_user(db_session, user.id)
    assert len(devices) == 2
    assert max(device.expires_at for device in devices) == clock.now() + timedelta(
        days=30
    )
    assert api_sms.messages == []
    audit = await db_session.scalar(
        select(AuditLog).where(AuditLog.actor_user_id == user.id)
    )
    assert audit is not None and audit.action == "MOBILE_LOGIN_SUCCEEDED"
    assert audit.after_snapshot == {
        "channel": "mobile_code+device"
        if role is Role.STUDENT
        else "staff_mobile_code+device"
    }
    if role is Role.STUDENT:
        assert await guard.retry_after_seconds(user.id) is None


@pytest.mark.parametrize(
    ("staff", "role", "status"),
    [
        (False, Role.TEACHER, UserStatus.ACTIVE),
        (False, Role.ADMIN, UserStatus.ACTIVE),
        (False, Role.STUDENT, UserStatus.SUSPENDED),
        (True, Role.STUDENT, UserStatus.ACTIVE),
        (True, Role.MENTOR, UserStatus.ACTIVE),
        (True, Role.TEACHER, UserStatus.SUSPENDED),
        (True, Role.TEACHER, UserStatus.BANNED),
    ],
)
async def test_remembered_credential_does_not_cross_population_or_status_gate(
    db_session, service, clock, staff, role, status
):
    user = await seed_user(db_session, role, status)
    cookie = await issue(db_session, user.id, clock=clock)
    await db_session.commit()
    verify = service.verify_staff_code if staff else service.verify_code
    with pytest.raises(BusinessError) as refused:
        await verify(db_session, phone=None, code=None, device_cookie=cookie)
    assert refused.value.code == "MOBILE_CODE_INVALID"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == user.id)
        )
        == 0
    )
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.actor_user_id == user.id)
        )
        == 0
    )


@pytest.mark.parametrize("staff", [False, True])
@pytest.mark.parametrize("cookie", [None, "unknown-remembered-credential"])
async def test_missing_or_unknown_mobile_device_never_opens_a_session(
    db_session, service, staff, cookie
):
    before = await db_session.scalar(select(func.count()).select_from(UserSession))
    verify = service.verify_staff_code if staff else service.verify_code
    with pytest.raises(BusinessError) as refused:
        await verify(db_session, phone=None, code=None, device_cookie=cookie)
    assert refused.value.code == "MOBILE_CODE_INVALID"
    assert (
        await db_session.scalar(select(func.count()).select_from(UserSession)) == before
    )


@pytest.mark.parametrize("staff", [False, True])
@pytest.mark.parametrize("phone", [None, "not-a-phone"])
async def test_mobile_code_without_valid_phone_cannot_select_a_challenge(
    db_session, service, staff, phone
):
    before = await db_session.scalar(select(func.count()).select_from(UserSession))
    verify = service.verify_staff_code if staff else service.verify_code
    with pytest.raises(BusinessError) as refused:
        await verify(db_session, phone=phone, code="123456")
    assert refused.value.code == "MOBILE_CODE_INVALID"
    assert (
        await db_session.scalar(select(func.count()).select_from(UserSession)) == before
    )


@pytest.mark.parametrize("staff", [False, True])
@pytest.mark.parametrize(
    "invalidated_by", ["expiry_boundary", "past_expiry", "attempt_limit"]
)
async def test_expired_or_exhausted_mobile_challenge_cannot_mint_tokens(
    db_session, service, api_sms, clock, guard, staff, invalidated_by
):
    user = await seed_user(db_session, Role.TEACHER if staff else Role.STUDENT)
    request = service.request_staff_code if staff else service.request_code
    await request(db_session, PHONE)
    code = str(api_sms.messages[-1].variables["code"])
    challenge = await db_session.scalar(
        select(LoginMobileChallenge).where(LoginMobileChallenge.phone_e164 == PHONE)
    )
    assert challenge is not None
    if invalidated_by == "expiry_boundary":
        challenge.expires_at = clock.now()
    elif invalidated_by == "past_expiry":
        challenge.expires_at = clock.now() - timedelta(seconds=1)
    else:
        challenge.attempts = 5
    await db_session.commit()
    # Four genuine prior failures are still below the shared account lock;
    # rejecting this challenge must count the fifth without opening a session.
    for _ in range(4):
        await guard.record_failure(user.id)
    verify = service.verify_staff_code if staff else service.verify_code
    with pytest.raises(BusinessError) as refused:
        await verify(db_session, phone=PHONE, code=code)
    assert refused.value.code == "MOBILE_CODE_INVALID"
    assert (
        await db_session.scalar(
            select(func.count())
            .select_from(UserSession)
            .where(UserSession.user_id == user.id)
        )
        == 0
    )
    assert await guard.is_locked(user.id)
    retry_after = await guard.retry_after_seconds(user.id)
    assert retry_after is not None and 0 < retry_after <= 900
