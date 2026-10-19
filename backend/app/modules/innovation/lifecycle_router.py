"""Lifecycle consequences are confirmed separately from free-form project stage."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from app.core.clock import Clock
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.lifecycle_schemas import (
    IntroductionPreviewCommand,
    IntroductionPreviewResponse,
    IntroductionPublishCommand,
    LifecycleCommand,
    LifecycleResult,
    LifecycleStateResponse,
)
from app.modules.innovation.lifecycle_service import LifecycleService
from app.modules.innovation.router import Database, Student, _private_response

router = APIRouter(
    prefix="/ie/me/project-drafts/{project_id}",
    tags=["innovation lifecycle"],
    dependencies=[Depends(_private_response)],
)


def get_lifecycle_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> LifecycleService:
    return LifecycleService(clock=clock)


Service = Annotated[LifecycleService, Depends(get_lifecycle_service)]


@router.get("/lifecycle")
async def state(
    project_id: UUID, request: Request, db: Database, actor: Student, service: Service
) -> LifecycleStateResponse:
    return await service.read(
        db,
        actor=actor,
        project_id=project_id,
        context=AuditContext.from_request(request),
    )


@router.post("/introduction/preview")
async def preview(
    project_id: UUID,
    payload: IntroductionPreviewCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> IntroductionPreviewResponse:
    return await service.preview(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/introduction/publish")
async def publish(
    project_id: UUID,
    payload: IntroductionPublishCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> LifecycleResult:
    return await service.publish(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.post("/{action}")
async def act(
    project_id: UUID,
    action: Literal["complete", "resume"],
    payload: LifecycleCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> LifecycleResult:
    return await service.act(
        db,
        actor=actor,
        project_id=project_id,
        action=action,
        payload=payload,
        context=AuditContext.from_request(request),
    )
