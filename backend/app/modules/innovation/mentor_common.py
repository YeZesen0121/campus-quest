"""Consistent actor locks and mentor request receipts within service transactions."""

from typing import Any
from uuid import UUID

from sqlalchemy import String, Uuid, column, select, table
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.error_codes import ErrorCode
from app.core.errors import BusinessError
from app.modules.identity.events import Actor
from app.modules.innovation.mentor_models import MentorProfile, MentorReceipt
from app.modules.innovation.models import OperationsGrant
from app.modules.innovation.talent_common import (
    conflict,
    fingerprint,
    mutation,
    not_found,
)

__all__ = [
    "USERS",
    "active_accounts",
    "operator",
    "lock_profile",
    "receipt",
    "forbidden",
    "conflict",
    "fingerprint",
    "mutation",
    "not_found",
]

USERS = table(
    "users",
    column("id", Uuid),
    column("role", String),
    column("status", String),
    column("username", String),
)


def forbidden() -> BusinessError:
    return BusinessError(
        ErrorCode.PERMISSION_DENIED, "当前账号没有此操作权限", status_code=403
    )


async def active_accounts(
    db: AsyncSession,
    actor: Actor,
    *others: UUID,
    require_others_active: bool = True,
) -> dict[UUID, Any]:
    values = (
        await db.execute(
            select(USERS)
            .where(USERS.c.id.in_({actor.user_id, *others}))
            .order_by(USERS.c.id)
            .with_for_update()
        )
    ).all()
    accounts = {value.id: value for value in values}
    account = accounts.get(actor.user_id)
    if account is None or account.role != actor.role or account.status != "ACTIVE":
        raise BusinessError(
            ErrorCode.ACCOUNT_NOT_ACTIVE, "账号当前不可用，请重新登录", status_code=403
        )
    for other in others:
        if other not in accounts or (
            require_others_active and accounts[other].status != "ACTIVE"
        ):
            raise not_found()
    return accounts


async def operator(db: AsyncSession, actor: Actor) -> None:
    if actor.role != "STUDENT":
        raise forbidden()
    enabled = await db.scalar(
        select(OperationsGrant.enabled)
        .where(OperationsGrant.user_id == actor.user_id)
        .with_for_update()
    )
    if enabled is not True:
        raise forbidden()


async def lock_profile(
    db: AsyncSession,
    actor: Actor,
    profile_id: UUID | None = None,
    *,
    operations: bool = False,
) -> MentorProfile:
    predicate = (
        MentorProfile.id == profile_id
        if profile_id
        else MentorProfile.user_id == actor.user_id
    )
    identity = (
        await db.execute(
            select(MentorProfile.id, MentorProfile.user_id).where(predicate)
        )
    ).one_or_none()
    if identity is None:
        if operations:
            await active_accounts(db, actor)
            await operator(db, actor)
        raise not_found()
    accounts = await active_accounts(db, actor, identity.user_id)
    if accounts[identity.user_id].role not in {"MENTOR", "TEACHER"}:
        raise not_found()
    if operations:
        await operator(db, actor)
    elif actor.user_id != identity.user_id:
        raise forbidden()
    row = await db.scalar(
        select(MentorProfile)
        .where(MentorProfile.id == identity.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise not_found()
    return row


async def receipt(
    db: AsyncSession, actor: Actor, request_id: UUID, digest: str
) -> MentorReceipt | None:
    value = await db.scalar(
        select(MentorReceipt).where(
            MentorReceipt.actor_user_id == actor.user_id,
            MentorReceipt.request_id == request_id,
        )
    )
    if value and value.fingerprint != digest:
        raise conflict("该请求已用于不同操作，请刷新后重试", kind="REQUEST_REUSE")
    return value
