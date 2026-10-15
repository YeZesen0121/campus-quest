"""Project display consent; these actions grant no collaboration permissions."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.mentor_link_service import MentorLinkService
from app.modules.innovation.mentor_schemas import (
    MentorVersionCommand,
    ProjectMentorCreateCommand,
    ProjectMentorListResponse,
    ProjectMentorResponse,
    PublicProjectMentorsResponse,
)
from app.modules.innovation.public_achievement_router import Viewer
from app.modules.innovation.router import Database, _private_response

router = APIRouter(
    prefix="/ie",
    tags=["innovation mentor links"],
    dependencies=[Depends(_private_response)],
)


def get_mentor_link_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> MentorLinkService:
    return MentorLinkService(clock=clock)


Service = Annotated[MentorLinkService, Depends(get_mentor_link_service)]


@router.get("/me/project-drafts/{project_id}/mentors")
async def list_owned(
    project_id: UUID,
    db: Database,
    actor: Viewer,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProjectMentorListResponse:
    return await service.list_owned(
        db, actor=actor, project_id=project_id, limit=limit, offset=offset
    )


@router.post("/me/project-drafts/{project_id}/mentors")
async def request_link(
    project_id: UUID,
    payload: ProjectMentorCreateCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> ProjectMentorResponse:
    return await service.request(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/me/mentor/project-links")
async def list_mentor(
    db: Database,
    actor: Viewer,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ProjectMentorListResponse:
    return await service.list_owned(db, actor=actor, limit=limit, offset=offset)


@router.post("/mentor-links/{link_id}/accept")
async def accept(
    link_id: UUID,
    payload: MentorVersionCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> ProjectMentorResponse:
    return await service.act(
        db,
        actor=actor,
        link_id=link_id,
        action="accept",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/mentor-links/{link_id}/reject")
async def reject(
    link_id: UUID,
    payload: MentorVersionCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> ProjectMentorResponse:
    return await service.act(
        db,
        actor=actor,
        link_id=link_id,
        action="reject",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/mentor-links/{link_id}/revoke")
async def revoke(
    link_id: UUID,
    payload: MentorVersionCommand,
    request: Request,
    db: Database,
    actor: Viewer,
    service: Service,
) -> ProjectMentorResponse:
    return await service.act(
        db,
        actor=actor,
        link_id=link_id,
        action="revoke",
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/projects/{project_id}/mentors")
async def public_links(
    project_id: UUID, db: Database, actor: Viewer, service: Service
) -> PublicProjectMentorsResponse:
    return await service.public_links(db, actor=actor, project_id=project_id)
