"""Version-bound mentor consent, delegated edits and immediate revocation."""

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.audit.service import AuditLogWriter
from app.modules.identity.events import Actor
from app.modules.innovation.mentor_common import (
    USERS,
    active_accounts,
    conflict,
    fingerprint,
    forbidden,
    lock_profile,
    mutation,
    operator,
    receipt,
)
from app.modules.innovation.mentor_models import (
    MentorConsent,
    MentorProfile,
    MentorReceipt,
    MentorRevision,
    ProjectMentorLink,
)
from app.modules.innovation.mentor_schemas import (
    MentorActionResult,
    MentorConfirmCommand,
    MentorContactStateCommand,
    MentorCreateCommand,
    MentorFields,
    MentorOperationsListResponse,
    MentorOperationsSummary,
    MentorProfileReadResponse,
    MentorProfileResponse,
    MentorRevokeContactCommand,
    MentorSaveCommand,
    MentorScopeCommand,
    MentorVersionCommand,
)


class MentorService:
    def __init__(self, *, clock: Clock, audit: AuditLogWriter | None = None) -> None:
        self.clock = clock
        self.audit = audit if audit is not None else AuditLogWriter()

    async def response(
        self, db: AsyncSession, row: MentorProfile
    ) -> MentorProfileResponse:
        revision = (
            await db.get(MentorRevision, row.public_revision_id)
            if row.public_revision_id
            else None
        )
        return MentorProfileResponse.model_validate(
            {
                "id": row.id,
                "fields": row.fields,
                "version": row.version,
                "confirmation_state": row.confirmation_state,
                "visibility": row.visibility,
                "moderation_state": row.moderation_state,
                "accepting_contact": row.accepting_contact,
                "authorized_fields": row.authorized_fields,
                "public_version": row.public_version,
                "public_content": revision.content if revision else None,
                "public_contact_channels": [c["channel"] for c in revision.contacts]
                if revision
                else [],
                "updated_at": row.updated_at,
            }
        )

    async def result(
        self,
        db: AsyncSession,
        row: MentorProfile,
        saved: MentorReceipt,
        *,
        replayed: bool = False,
    ) -> MentorActionResult:
        return MentorActionResult(
            action=saved.action,
            replayed=replayed,
            applied_version=saved.applied_version,
            current=await self.response(db, row),
        )

    async def record(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        row: MentorProfile,
        action: str,
        context: AuditContext,
    ) -> None:
        await self.audit.append(
            db,
            actor=actor,
            action=f"ie.mentor.{action}",
            target_type="ie_mentor",
            target_id=str(row.id),
            details={
                "version": row.version,
                "public_version": row.public_version,
                "visibility": row.visibility,
            },
            request_id=context.request_id,
            ip_address=context.ip_address,
        )

    def add_receipt(
        self,
        db: AsyncSession,
        actor: Actor,
        row: MentorProfile,
        request_id: UUID,
        digest: str,
        action: str,
        *,
        resource_id: UUID | None = None,
        version: int | None = None,
    ) -> MentorReceipt:
        value = MentorReceipt(
            actor_user_id=actor.user_id,
            request_id=request_id,
            profile_id=row.id,
            resource_id=resource_id or row.id,
            action=action,
            fingerprint=digest,
            applied_version=version if version is not None else row.version,
            created_at=self.clock.now(),
        )
        db.add(value)
        return value

    @staticmethod
    def version(row: MentorProfile, expected: int) -> None:
        if row.version != expected:
            raise conflict("资料或授权已变化，请保留输入并刷新后核对")

    async def consent(
        self,
        db: AsyncSession,
        actor: Actor,
        row: MentorProfile,
        action: str,
        scope: dict[str, Any],
    ) -> UUID:
        event = MentorConsent(
            id=uuid4(),
            profile_id=row.id,
            actor_user_id=actor.user_id,
            draft_version=row.version,
            action=action,
            scope=scope,
            created_at=self.clock.now(),
        )
        db.add(event)
        await db.flush()
        return event.id

    async def revision(
        self,
        db: AsyncSession,
        row: MentorProfile,
        *,
        content: dict[str, Any],
        contacts: list[dict[str, str]],
        consent_id: UUID,
    ) -> None:
        row.public_version += 1
        version = MentorRevision(
            id=uuid4(),
            profile_id=row.id,
            consent_id=consent_id,
            number=row.public_version,
            content=content,
            contacts=contacts,
            created_at=self.clock.now(),
        )
        db.add(version)
        await db.flush()
        row.public_revision_id = version.id

    async def read(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        profile_id: UUID | None = None,
        operations: bool = False,
        context: AuditContext | None = None,
    ) -> MentorProfileReadResponse:
        async with mutation(db):
            if not operations:
                await active_accounts(db, actor)
                if not await db.scalar(
                    select(MentorProfile.id).where(
                        MentorProfile.user_id == actor.user_id
                    )
                ):
                    return MentorProfileReadResponse(profile=None)
            # Operations reads and writes must lock the complete account set
            # in one UUID order; pre-locking only the operator inverts it.
            row = await lock_profile(db, actor, profile_id, operations=operations)
            if operations:
                await self.record(
                    db,
                    actor=actor,
                    row=row,
                    action="read",
                    context=context
                    if context is not None
                    else AuditContext(None, None),
                )
            return MentorProfileReadResponse(profile=await self.response(db, row))

    async def list_operations(
        self, db: AsyncSession, *, actor: Actor, limit: int, offset: int
    ) -> MentorOperationsListResponse:
        async with mutation(db):
            await active_accounts(db, actor)
            await operator(db, actor)
            total = await db.scalar(select(func.count()).select_from(MentorProfile))
            rows = list(
                await db.scalars(
                    select(MentorProfile)
                    .order_by(MentorProfile.updated_at.desc(), MentorProfile.id)
                    .limit(limit)
                    .offset(offset)
                )
            )
            return MentorOperationsListResponse(
                items=[
                    MentorOperationsSummary.model_validate(
                        {
                            "id": r.id,
                            "name": r.fields["name"],
                            "unit": r.fields["unit"],
                            "version": r.version,
                            "confirmation_state": r.confirmation_state,
                            "visibility": r.visibility,
                            "moderation_state": r.moderation_state,
                            "updated_at": r.updated_at,
                        }
                    )
                    for r in rows
                ],
                total=total or 0,
                limit=limit,
                offset=offset,
            )

    async def create(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        payload: MentorCreateCommand,
        context: AuditContext,
    ) -> MentorActionResult:
        async with mutation(db):
            target = await db.scalar(
                select(USERS.c.id).where(USERS.c.username == payload.mentor_username)
            )
            accounts = await active_accounts(db, actor, *([target] if target else []))
            await operator(db, actor)
            if target is None or accounts[target].role not in {"MENTOR", "TEACHER"}:
                raise conflict(
                    "未找到可绑定的校内导师账号，请先核对账号",
                    kind="MENTOR_ACCOUNT_UNAVAILABLE",
                )
            digest = fingerprint(
                {"action": "create", **payload.model_dump(mode="json")}
            )
            saved = await receipt(db, actor, payload.request_id, digest)
            if saved:
                row = await lock_profile(db, actor, saved.profile_id, operations=True)
                return await self.result(db, row, saved, replayed=True)
            if await db.scalar(
                select(MentorProfile.id).where(MentorProfile.user_id == target)
            ):
                raise conflict(
                    "该导师已有档案，请从列表进入维护", kind="PROFILE_EXISTS"
                )
            row = MentorProfile(
                id=uuid4(),
                user_id=target,
                fields=payload.fields.model_dump(mode="json"),
                version=1,
                public_version=0,
                confirmation_state="PENDING",
                visibility="HIDDEN",
                moderation_state="NORMAL",
                accepting_contact=False,
                authorized_fields=[],
                created_at=self.clock.now(),
                updated_at=self.clock.now(),
            )
            db.add(row)
            await db.flush()
            saved = self.add_receipt(
                db, actor, row, payload.request_id, digest, "create"
            )
            await self.record(
                db, actor=actor, row=row, action="create", context=context
            )
            return await self.result(db, row, saved)

    async def save(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        profile_id: UUID,
        payload: MentorSaveCommand,
        context: AuditContext,
    ) -> MentorActionResult:
        async with mutation(db):
            row = await lock_profile(db, actor, profile_id, operations=True)
            digest = fingerprint(
                {
                    "action": "save",
                    "profile_id": str(profile_id),
                    **payload.model_dump(mode="json"),
                }
            )
            saved = await receipt(db, actor, payload.request_id, digest)
            if saved:
                return await self.result(db, row, saved, replayed=True)
            self.version(row, payload.version)
            new_fields = payload.fields.model_dump(mode="json")
            changed = {
                key for key in new_fields if new_fields[key] != row.fields.get(key)
            }
            if not changed:
                raise conflict("没有需要保存的变化", kind="NO_CHANGE")
            auto = (
                row.confirmation_state == "CONFIRMED"
                and row.visibility == "VISIBLE"
                and changed <= set(row.authorized_fields)
            )
            row.fields = new_fields
            if auto:
                try:
                    payload.fields.validate_publication()
                except ValueError as exc:
                    raise conflict(str(exc), kind="INCOMPLETE_PROFILE") from exc
                previous = await db.get(MentorRevision, row.public_revision_id)
                if previous is None:
                    raise conflict("公开版本不存在，请本人重新确认")
                latest_consent = await db.scalar(
                    select(MentorConsent.id)
                    .where(
                        MentorConsent.profile_id == row.id,
                        MentorConsent.action.in_(["confirm", "maintenance-scope"]),
                    )
                    .order_by(MentorConsent.draft_version.desc())
                    .limit(1)
                )
                await self.revision(
                    db,
                    row,
                    content=payload.fields.model_dump(
                        mode="json", exclude={"contacts"}
                    ),
                    contacts=previous.contacts,
                    consent_id=latest_consent or previous.consent_id,
                )
            else:
                row.confirmation_state = "PENDING"
            row.version += 1
            row.updated_at = self.clock.now()
            saved = self.add_receipt(db, actor, row, payload.request_id, digest, "save")
            await self.record(db, actor=actor, row=row, action="save", context=context)
            return await self.result(db, row, saved)

    async def act(
        self,
        db: AsyncSession,
        *,
        actor: Actor,
        action: str,
        payload: MentorVersionCommand,
        context: AuditContext,
    ) -> MentorActionResult:
        async with mutation(db):
            row = await lock_profile(db, actor)
            digest = fingerprint({"action": action, **payload.model_dump(mode="json")})
            saved = await receipt(db, actor, payload.request_id, digest)
            if saved:
                return await self.result(db, row, saved, replayed=True)
            self.version(row, payload.version)
            previous = (
                await db.get(MentorRevision, row.public_revision_id)
                if row.public_revision_id
                else None
            )
            if action == "confirm" and isinstance(payload, MentorConfirmCommand):
                fields = MentorFields.model_validate(row.fields)
                try:
                    fields.validate_publication()
                except ValueError as exc:
                    raise conflict(str(exc), kind="INCOMPLETE_PROFILE") from exc
                if not set(payload.contact_channels) <= {
                    c.channel for c in fields.contacts
                }:
                    raise conflict(
                        "所选联系渠道已变化，请重新核对", kind="CONTACT_CHANGED"
                    )
                consent_id = await self.consent(
                    db,
                    actor,
                    row,
                    action,
                    {
                        "authorized_fields": payload.authorized_fields,
                        "contact_channels": payload.contact_channels,
                        "accepting_contact": payload.accepting_contact,
                    },
                )
                row.authorized_fields = list(payload.authorized_fields)
                row.accepting_contact = payload.accepting_contact
                await self.revision(
                    db,
                    row,
                    content=fields.model_dump(mode="json", exclude={"contacts"}),
                    contacts=[
                        c.model_dump(mode="json")
                        for c in fields.contacts
                        if c.channel in payload.contact_channels
                    ],
                    consent_id=consent_id,
                )
                row.visibility = "VISIBLE"
                row.confirmation_state = "CONFIRMED"
            elif action == "reject":
                if row.confirmation_state != "PENDING":
                    raise conflict("当前没有待确认版本")
                await self.consent(db, actor, row, action, {})
                row.confirmation_state = "REJECTED"
            elif action == "withdraw":
                if row.visibility != "VISIBLE":
                    raise conflict("档案当前未展示")
                await self.consent(db, actor, row, action, {})
                row.visibility = "HIDDEN"
                row.accepting_contact = False
                row.authorized_fields = []
                row.confirmation_state = "PENDING"
                links = await db.scalars(
                    select(ProjectMentorLink)
                    .where(
                        ProjectMentorLink.mentor_id == row.id,
                        ProjectMentorLink.status.in_(["PENDING", "ACCEPTED"]),
                    )
                    .order_by(ProjectMentorLink.id)
                    .with_for_update()
                )
                for link in links:
                    link.status = "REVOKED"
                    link.version += 1
                    link.updated_at = self.clock.now()
            elif action in {"contact-state", "maintenance-scope", "revoke-contact"}:
                if row.visibility != "VISIBLE" or previous is None:
                    raise conflict("请先本人确认公开档案")
                if action == "contact-state" and isinstance(
                    payload, MentorContactStateCommand
                ):
                    if payload.accepting_contact and not previous.contacts:
                        raise conflict(
                            "请先确认至少一种联系渠道", kind="CONTACT_REQUIRED"
                        )
                    row.accepting_contact = payload.accepting_contact
                    await self.consent(
                        db,
                        actor,
                        row,
                        action,
                        {"accepting_contact": payload.accepting_contact},
                    )
                    await self.revision(
                        db,
                        row,
                        content=previous.content,
                        contacts=previous.contacts,
                        consent_id=previous.consent_id,
                    )
                elif action == "maintenance-scope" and isinstance(
                    payload, MentorScopeCommand
                ):
                    await self.consent(
                        db,
                        actor,
                        row,
                        action,
                        {"authorized_fields": payload.authorized_fields},
                    )
                    row.authorized_fields = list(payload.authorized_fields)
                elif action == "revoke-contact" and isinstance(
                    payload, MentorRevokeContactCommand
                ):
                    contacts = [
                        c for c in previous.contacts if c["channel"] != payload.channel
                    ]
                    if len(contacts) == len(previous.contacts):
                        raise conflict("该渠道已撤回或未授权")
                    await self.consent(
                        db, actor, row, action, {"channel": payload.channel}
                    )
                    await self.revision(
                        db,
                        row,
                        content=previous.content,
                        contacts=contacts,
                        consent_id=previous.consent_id,
                    )
                    row.fields = {
                        **row.fields,
                        "contacts": [
                            c
                            for c in row.fields["contacts"]
                            if c["channel"] != payload.channel
                        ],
                    }
                    if not contacts:
                        row.accepting_contact = False
                else:
                    raise forbidden()
            else:
                raise forbidden()
            row.version += 1
            row.updated_at = self.clock.now()
            saved = self.add_receipt(db, actor, row, payload.request_id, digest, action)
            await self.record(db, actor=actor, row=row, action=action, context=context)
            return await self.result(db, row, saved)
