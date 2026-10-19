"""Purpose-specific invitations, immutable confirmations and participation facts."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CollaborationTarget(Base):
    __tablename__ = "ie_collaboration_targets"
    __table_args__ = (
        Index("ix_ie_collaboration_target_actor", "actor_user_id", "expires_at"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ProjectCollaboration(Base):
    """Each candidate has immutable content; it never overwrites an old consent."""

    __tablename__ = "ie_project_collaborations"
    __table_args__ = (
        CheckConstraint("kind IN ('MANAGER','MEMBER')", name="kind_valid"),
        CheckConstraint(
            "status IN ('PENDING','ACCEPTED','REJECTED','REVOKED','EXPIRED')",
            name="status_valid",
        ),
        CheckConstraint("version > 0", name="version_positive"),
        CheckConstraint("expires_at > created_at", name="expiry_valid"),
        CheckConstraint(
            "(kind = 'MANAGER' AND public_name IS NULL AND division IS NULL) OR "
            "(kind = 'MEMBER' AND public_name IS NOT NULL AND division IS NOT NULL "
            "AND char_length(public_name) BETWEEN 1 AND 80 "
            "AND btrim(public_name) <> '' "
            "AND char_length(division) BETWEEN 1 AND 120 AND btrim(division) <> '')",
            name="consent_fields",
        ),
        Index(
            "uq_ie_collaboration_pending",
            "project_id",
            "target_user_id",
            "kind",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
        Index(
            "uq_ie_collaboration_accepted",
            "project_id",
            "target_user_id",
            "kind",
            unique=True,
            postgresql_where=text("status = 'ACCEPTED'"),
        ),
        Index(
            "ix_ie_collaboration_target_updated", "target_user_id", "updated_at", "id"
        ),
        Index("ix_ie_collaboration_project_updated", "project_id", "updated_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    target_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    invited_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16))
    public_name: Mapped[str | None] = mapped_column(String(80))
    division: Mapped[str | None] = mapped_column(String(120))
    project_snapshot: Mapped[dict[str, str]] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ProjectParticipation(Base):
    """A durable fact; leaving or hiding a name does not remove conflicts."""

    __tablename__ = "ie_project_participation"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "user_id", "kind", name="uq_ie_participation_fact"
        ),
        CheckConstraint(
            "kind IN ('OWNER','MANAGER','MEMBER','MENTOR','EVIDENCE_READER')",
            name="kind_valid",
        ),
        Index("ix_ie_participation_user_project", "user_id", "project_id"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CollaborationReceipt(Base):
    __tablename__ = "ie_collaboration_receipts"
    __table_args__ = (
        UniqueConstraint(
            "actor_user_id", "request_id", name="uq_ie_collaboration_receipt"
        ),
        CheckConstraint("char_length(fingerprint) = 64", name="fingerprint_length"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    request_id: Mapped[UUID]
    resource_id: Mapped[UUID] = mapped_column(
        ForeignKey("ie_project_collaborations.id")
    )
    fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WorkspaceCommandReceipt(Base):
    """Text saves reconcile unknown outcomes without applying an old edit twice."""

    __tablename__ = "ie_workspace_command_receipts"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "request_id", name="uq_ie_workspace_command"),
        ForeignKeyConstraint(
            ["achievement_id", "project_id"],
            ["ie_achievement_drafts.id", "ie_achievement_drafts.project_id"],
            name="fk_ie_workspace_receipt_achievement",
        ),
        CheckConstraint(
            "char_length(fingerprint) = 64 AND applied_version > 0",
            name="receipt_valid",
        ),
        CheckConstraint(
            "(action = 'PROJECT_SAVE' AND achievement_id IS NULL) OR "
            "(action = 'ACHIEVEMENT_SAVE' AND achievement_id IS NOT NULL)",
            name="action_scope",
        ),
        Index("ix_ie_workspace_receipt_project", "project_id"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    request_id: Mapped[UUID]
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    achievement_id: Mapped[UUID | None]
    action: Mapped[str] = mapped_column(String(24))
    fingerprint: Mapped[str] = mapped_column(String(64))
    applied_version: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
