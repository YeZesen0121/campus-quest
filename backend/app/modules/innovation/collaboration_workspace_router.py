"""Shared text workspace, deliberately separate from owner-only operations."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.collaboration_schemas import (
    CollaborationProjectSaveCommand,
    ProjectWorkspaceResponse,
)
from app.modules.innovation.collaboration_workspace_service import (
    CollaborationWorkspaceService,
)
from app.modules.innovation.router import Database, Student, _private_response

router = APIRouter(
    prefix="/ie/collaboration/projects",
    tags=["innovation collaboration text"],
    dependencies=[Depends(_private_response)],
)


def get_workspace_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> CollaborationWorkspaceService:
    return CollaborationWorkspaceService(clock=clock)


Service = Annotated[CollaborationWorkspaceService, Depends(get_workspace_service)]


@router.get("/{project_id}")
async def read(
    project_id: UUID, request: Request, db: Database, actor: Student, service: Service
) -> ProjectWorkspaceResponse:
    return await service.read(
        db,
        actor=actor,
        project_id=project_id,
        context=AuditContext.from_request(request),
    )


@router.patch("/{project_id}")
async def save(
    project_id: UUID,
    payload: CollaborationProjectSaveCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> ProjectWorkspaceResponse:
    return await service.save(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )
