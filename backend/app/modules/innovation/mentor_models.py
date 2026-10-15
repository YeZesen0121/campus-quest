"""Mentor aggregate, immutable consent/revisions and scoped project display links."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
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


class MentorProfile(Base):
    __tablename__ = "ie_mentor_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_ie_mentor_user"),
        ForeignKeyConstraint(
            ["public_revision_id", "id"],
            ["ie_mentor_revisions.id", "ie_mentor_revisions.profile_id"],
            name="fk_ie_mentor_public",
            use_alter=True,
        ),
        CheckConstraint("version > 0 AND public_version >= 0", name="versions_valid"),
        CheckConstraint(
            "confirmation_state IN ('PENDING','CONFIRMED','REJECTED')",
            name="confirmation_valid",
        ),
        CheckConstraint("visibility IN ('HIDDEN','VISIBLE')", name="visibility_valid"),
        CheckConstraint(
            "moderation_state IN ('NORMAL','TAKEN_DOWN')", name="moderation_valid"
        ),
        CheckConstraint(
            "visibility <> 'VISIBLE' OR "
            "(public_revision_id IS NOT NULL AND public_version > 0)",
            name="visible_consistent",
        ),
        CheckConstraint(
            "jsonb_typeof(fields) = 'object' AND "
            "jsonb_typeof(authorized_fields) = 'array'",
            name="json_valid",
        ),
        Index("ix_ie_mentor_public_revision", "public_revision_id", "id"),
        Index(
            "ix_ie_mentor_visible_updated",
            "updated_at",
            "id",
            postgresql_where=text(
                "visibility = 'VISIBLE' AND moderation_state = 'NORMAL'"
            ),
        ),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    fields: Mapped[dict[str, Any]] = mapped_column(JSONB)
    version: Mapped[int] = mapped_column(Integer)
    public_version: Mapped[int] = mapped_column(Integer)
    confirmation_state: Mapped[str] = mapped_column(String(16))
    visibility: Mapped[str] = mapped_column(String(16))
    moderation_state: Mapped[str] = mapped_column(String(16))
    accepting_contact: Mapped[bool] = mapped_column(Boolean)
    authorized_fields: Mapped[list[str]] = mapped_column(JSONB)
    public_revision_id: Mapped[UUID | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MentorConsent(Base):
    __tablename__ = "ie_mentor_consents"
    __table_args__ = (
        UniqueConstraint("id", "profile_id", name="uq_ie_mentor_consent_identity"),
        CheckConstraint("draft_version > 0", name="version_positive"),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(ForeignKey("ie_mentor_profiles.id"))
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    draft_version: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(40))
    scope: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MentorRevision(Base):
    __tablename__ = "ie_mentor_revisions"
    __table_args__ = (
        UniqueConstraint("id", "profile_id", name="uq_ie_mentor_revision_identity"),
        UniqueConstraint("profile_id", "number", name="uq_ie_mentor_revision_number"),
        ForeignKeyConstraint(
            ["consent_id", "profile_id"],
            ["ie_mentor_consents.id", "ie_mentor_consents.profile_id"],
            name="fk_ie_mentor_revision_consent",
        ),
        CheckConstraint("number > 0", name="number_positive"),
        CheckConstraint(
            "jsonb_typeof(content) = 'object' AND NOT content ? 'contacts'",
            name="content_private_free",
        ),
        CheckConstraint(
            "jsonb_typeof(contacts) = 'array' AND jsonb_array_length(contacts) <= 4",
            name="contact_shape",
        ),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    profile_id: Mapped[UUID] = mapped_column(ForeignKey("ie_mentor_profiles.id"))
    consent_id: Mapped[UUID]
    number: Mapped[int] = mapped_column(Integer)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB)
    contacts: Mapped[list[dict[str, str]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MentorReceipt(Base):
    __tablename__ = "ie_mentor_receipts"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "request_id", name="uq_ie_mentor_request"),
        CheckConstraint(
            "char_length(fingerprint) = 64 AND applied_version > 0",
            name="receipt_valid",
        ),
        Index("ix_ie_mentor_receipt_profile", "profile_id"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    request_id: Mapped[UUID]
    profile_id: Mapped[UUID] = mapped_column(ForeignKey("ie_mentor_profiles.id"))
    resource_id: Mapped[UUID]
    action: Mapped[str] = mapped_column(String(40))
    fingerprint: Mapped[str] = mapped_column(String(64))
    applied_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ProjectMentorLink(Base):
    __tablename__ = "ie_project_mentor_links"
    __table_args__ = (
        UniqueConstraint("project_id", "mentor_id", name="uq_ie_project_mentor_pair"),
        CheckConstraint(
            "status IN ('PENDING','ACCEPTED','REJECTED','REVOKED')", name="status_valid"
        ),
        CheckConstraint("version > 0", name="version_positive"),
        Index("ix_ie_project_mentor_target", "mentor_id", "status"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    mentor_id: Mapped[UUID] = mapped_column(ForeignKey("ie_mentor_profiles.id"))
    requested_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    project_snapshot: Mapped[dict[str, str]] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(16))
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
