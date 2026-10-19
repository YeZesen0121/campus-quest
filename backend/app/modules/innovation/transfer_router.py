"""Explicit transfer confirmation and audited attachment-only preview."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.clock import Clock
from app.core.config import get_settings
from app.integrations.object_storage_s3 import S3ObjectStorage
from app.modules.audit.context import AuditContext
from app.modules.identity.dependencies import get_business_clock
from app.modules.innovation.router import Database, Student, _private_response
from app.modules.innovation.transfer_schemas import (
    TransferCommand,
    TransferCreate,
    TransferListResponse,
    TransferProofChoicesResponse,
    TransferResponse,
)
from app.modules.innovation.transfer_service import TransferService

router = APIRouter(
    prefix="/ie",
    tags=["innovation transfer"],
    dependencies=[Depends(_private_response)],
)


def get_transfer_service(
    clock: Annotated[Clock, Depends(get_business_clock)],
) -> TransferService:
    settings = get_settings()
    return TransferService(
        clock=clock,
        storage=S3ObjectStorage(settings, clock=clock),
        invitation_days=settings.ie_invitation_days,
    )


Service = Annotated[TransferService, Depends(get_transfer_service)]


@router.get("/me/project-drafts/{project_id}/transfer-proofs")
async def proof_choices(
    project_id: UUID,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransferProofChoicesResponse:
    return await service.list_proof_choices(
        db,
        actor=actor,
        project_id=project_id,
        limit=limit,
        offset=offset,
        context=AuditContext.from_request(request),
    )


@router.post("/me/project-drafts/{project_id}/transfers")
async def create(
    project_id: UUID,
    payload: TransferCreate,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> TransferResponse:
    return await service.request(
        db,
        actor=actor,
        project_id=project_id,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/me/transfers")
async def list_mine(
    db: Database,
    actor: Student,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TransferListResponse:
    return await service.list_mine(db, actor=actor, limit=limit, offset=offset)


@router.get("/transfers/{transfer_id}")
async def summary(
    transfer_id: UUID, request: Request, db: Database, actor: Student, service: Service
) -> TransferResponse:
    return await service.summary(
        db,
        actor=actor,
        transfer_id=transfer_id,
        context=AuditContext.from_request(request),
    )


@router.post("/transfers/{transfer_id}/{action}")
async def act(
    transfer_id: UUID,
    action: Literal["accept", "reject", "cancel"],
    payload: TransferCommand,
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> TransferResponse:
    return await service.act(
        db,
        actor=actor,
        transfer_id=transfer_id,
        action=action,
        payload=payload,
        context=AuditContext.from_request(request),
    )


@router.get("/transfers/{transfer_id}/evidence/{evidence_id}", response_class=Response)
async def evidence(
    transfer_id: UUID,
    evidence_id: UUID,
    version: Annotated[int, Query(ge=1)],
    request: Request,
    db: Database,
    actor: Student,
    service: Service,
) -> Response:
    obj = await service.read_evidence(
        db,
        actor=actor,
        transfer_id=transfer_id,
        evidence_id=evidence_id,
        version=version,
        context=AuditContext.from_request(request),
    )
    extension = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg"}[
        obj.content_type
    ]
    return Response(
        content=obj.content,
        media_type=obj.content_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="evidence.{extension}"',
        },
    )
