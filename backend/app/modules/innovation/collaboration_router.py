"""Transport only; consent purposes remain explicit in validated commands."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.clock import Clock
from app.core.config import get_settings
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.collaboration_schemas import (
    CollaborationInviteCommand,
    CollaborationListResponse,
    CollaborationResponse,
    CollaborationVersionCommand,
    TargetResolveCommand,
    TargetResponse,
)
from app.modules.innovation.collaboration_service import CollaborationService
from app.modules.innovation.router import Database, Student, _private_response

router = APIRouter(
    prefix="/ie",
    tags=["innovation collaboration"],
    dependencies=[Depends(_private_response)],
)


def get_collaboration_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> CollaborationService:
    return CollaborationService(
        clock=clock, invitation_days=get_settings().ie_invitation_days
    )


Service = Annotated[CollaborationService, Depends(get_collaboration_service)]


@router.post("/collaboration/targets/resolve")
async def resolve_target(
    payload: TargetResolveCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> TargetResponse:
    return await service.resolve(
        db, actor=actor, payload=payload, context=AuditContext.from_request(request)
    )


@router.get("/me/collaborations")
async def list_mine(
    db: Database,
    actor: Student,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CollaborationListResponse:
    return await service.list_mine(db, actor=actor, limit=limit, offset=offset)


@router.get("/me/project-drafts/{project_id}/collaborators")
async def list_project(
    project_id: UUID,
    db: Database,
    actor: Student,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CollaborationListResponse:
    return await service.list_mine(
        db, actor=actor, project_id=project_id, limit=limit, offset=offset
    )


@router.post("/me/project-drafts/{project_id}/collaborators")
async def invite(
    project_id: UUID,
    payload: CollaborationInviteCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> CollaborationResponse:
    return await service.invite(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/collaborations/{collaboration_id}/{action}")
async def act(
    collaboration_id: UUID,
    action: Literal["accept", "reject", "revoke"],
    payload: CollaborationVersionCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> CollaborationResponse:
    return await service.act(
        db,
        actor=actor,
        collaboration_id=collaboration_id,
        action=action,
        payload=payload,
        context=AuditContext.from_request(request),
    )
