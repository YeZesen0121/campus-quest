"""Transport-only mentor APIs; authority and transactions live in services."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.mentor_schemas import (
    MentorActionResult,
    MentorConfirmCommand,
    MentorContactReadCommand,
    MentorContactsResponse,
    MentorContactStateCommand,
    MentorCreateCommand,
    MentorOperationsListResponse,
    MentorProfileReadResponse,
    MentorProfileResponse,
    MentorQuery,
    MentorRevokeContactCommand,
    MentorSaveCommand,
    MentorScopeCommand,
    MentorVersionCommand,
    PublicMentorListResponse,
    PublicMentorResponse,
)
from app.modules.innovation.mentor_service import MentorService
from app.modules.innovation.public_achievement_router import Viewer
from app.modules.innovation.public_mentor_service import PublicMentorService
from app.modules.innovation.router import Database, _private_response

router = APIRouter(
    prefix="/ie", tags=["innovation mentors"], dependencies=[Depends(_private_response)]
)


def get_mentor_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> MentorService:
    return MentorService(clock=clock)


def get_public_mentor_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> PublicMentorService:
    return PublicMentorService(clock=clock)


Service = Annotated[MentorService, Depends(get_mentor_service)]
PublicService = Annotated[PublicMentorService, Depends(get_public_mentor_service)]


@router.get("/operations/mentors")
async def list_operations(
    db: Database,
    actor: Viewer,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MentorOperationsListResponse:
    return await service.list_operations(db, actor=actor, limit=limit, offset=offset)


@router.post("/operations/mentors")
async def create(
    payload: MentorCreateCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.create(
        db, actor=actor, payload=payload, context=AuditContext.from_request(request)
    )


@router.get("/operations/mentors/{profile_id}")
async def read_operation(
    profile_id: UUID, request: Request, db: Database, actor: Viewer, service: Service
) -> MentorProfileResponse:
    result = await service.read(
        db,
        actor=actor,
        profile_id=profile_id,
        operations=True,
        context=AuditContext.from_request(request),
    )
    assert result.profile is not None
    return result.profile


@router.patch("/operations/mentors/{profile_id}")
async def save(
    profile_id: UUID,
    payload: MentorSaveCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.save(
        db,
        actor=actor,
        profile_id=profile_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/me/mentor")
async def read_me(
    db: Database, actor: Viewer, service: Service
) -> MentorProfileReadResponse:
    return await service.read(db, actor=actor)


@router.post("/me/mentor/confirm")
async def confirm(
    payload: MentorConfirmCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="confirm",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/me/mentor/reject")
async def reject(
    payload: MentorVersionCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="reject",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/me/mentor/withdraw")
async def withdraw(
    payload: MentorVersionCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="withdraw",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/me/mentor/contact-state")
async def contact_state(
    payload: MentorContactStateCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="contact-state",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/me/mentor/maintenance-scope")
async def scope(
    payload: MentorScopeCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="maintenance-scope",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/me/mentor/revoke-contact")
async def revoke_contact(
    payload: MentorRevokeContactCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> MentorActionResult:
    return await service.act(
        db,
        actor=actor,
        action="revoke-contact",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/mentors")
async def list_public(
    query: Annotated[MentorQuery, Query()],
    db: Database,
    actor: Viewer,
    service: PublicService,
) -> PublicMentorListResponse:
    return await service.list_visible(db, actor=actor, query=query)


@router.get("/mentors/{profile_id}")
async def detail(
    profile_id: UUID, db: Database, actor: Viewer, service: PublicService
) -> PublicMentorResponse:
    return await service.detail(db, actor=actor, profile_id=profile_id)


@router.post("/mentors/{profile_id}/contacts")
async def contacts(
    profile_id: UUID,
    payload: MentorContactReadCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: PublicService,
) -> MentorContactsResponse:
    return await service.contacts(
        db,
        actor=actor,
        profile_id=profile_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )
