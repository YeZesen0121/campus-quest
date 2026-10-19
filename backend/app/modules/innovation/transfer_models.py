"""Versioned transfer proposals and generation-scoped evidence grants."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectTransfer(Base):
    __tablename__ = "ie_project_transfers"
    __table_args__ = (
        UniqueConstraint(
            "from_user_id", "creation_request_id", name="uq_ie_transfer_creation"
        ),
        CheckConstraint(
            "status IN ('PENDING','ACCEPTED','REJECTED',"
            "'CANCELED','EXPIRED','INVALIDATED')",
            name="status_valid",
        ),
        CheckConstraint(
            "version > 0 AND from_generation > 0 AND expires_at > created_at "
            "AND from_user_id <> target_user_id",
            name="proposal_valid",
        ),
        Index("ix_ie_transfer_target", "target_user_id", "created_at", "id"),
        Index("ix_ie_transfer_project", "project_id", "created_at", "id"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    from_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    from_generation: Mapped[int] = mapped_column(Integer)
    creation_request_id: Mapped[UUID]
    creation_fingerprint: Mapped[str] = mapped_column(String(64))
    evidence_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    initial_snapshot: Mapped[dict[str, Any]] = mapped_column(JSONB)
    allow_preview: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(16))
    version: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TransferReceipt(Base):
    __tablename__ = "ie_transfer_receipts"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "request_id", name="uq_ie_transfer_receipt"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    request_id: Mapped[UUID]
    transfer_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_transfers.id"))
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TransferredEvidenceGrant(Base):
    __tablename__ = "ie_transferred_evidence_grants"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "ownership_generation",
            "evidence_id",
            name="uq_ie_transfer_evidence_scope",
        ),
        CheckConstraint("ownership_generation > 1", name="generation_valid"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    ownership_generation: Mapped[int] = mapped_column(Integer)
    evidence_id: Mapped[UUID] = mapped_column(ForeignKey("ie_achievement_evidence.id"))
    transfer_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_transfers.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
