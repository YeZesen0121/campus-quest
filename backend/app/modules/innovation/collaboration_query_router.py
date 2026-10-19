"""Read contracts separate personal purposes from public confirmed names."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.collaboration_query_service import CollaborationQueryService
from app.modules.innovation.collaboration_schemas import (
    PersonalProjectListResponse,
    ProjectRole,
    PublicProjectMembersResponse,
)
from app.modules.innovation.public_achievement_router import Viewer
from app.modules.innovation.router import Database, Student, _private_response

router = APIRouter(
    prefix="/ie",
    tags=["innovation collaboration queries"],
    dependencies=[Depends(_private_response)],
)


def get_queries(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> CollaborationQueryService:
    return CollaborationQueryService(clock=clock)


Service = Annotated[CollaborationQueryService, Depends(get_queries)]


@router.get("/me/collaboration-projects")
async def personal(
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
    role: ProjectRole = "OWNER",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PersonalProjectListResponse:
    return await service.list_projects(
        db,
        actor=actor,
        role=role,
        limit=limit,
        offset=offset,
        context=AuditContext.from_request(request),
    )


@router.get("/projects/{project_id}/members")
async def members(
    project_id: UUID, db: Database, actor: Viewer, service: Service
) -> PublicProjectMembersResponse:
    return await service.public_members(db, actor=actor, project_id=project_id)
