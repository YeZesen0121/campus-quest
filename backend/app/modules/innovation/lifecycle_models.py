"""Independent lifecycle, immutable public introductions and command receipts."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectIntroduction(Base):
    __tablename__ = "ie_project_introductions"
    __table_args__ = (
        UniqueConstraint("id", "project_id", name="uq_ie_introduction_project"),
        UniqueConstraint("project_id", "number", name="uq_ie_introduction_number"),
        ForeignKeyConstraint(
            ["achievement_id", "project_id"],
            ["ie_achievement_drafts.id", "ie_achievement_drafts.project_id"],
            name="fk_ie_introduction_achievement",
        ),
        ForeignKeyConstraint(
            ["achievement_revision_id", "achievement_id"],
            ["ie_achievement_revisions.id", "ie_achievement_revisions.achievement_id"],
            name="fk_ie_introduction_achievement_revision",
        ),
        ForeignKeyConstraint(
            ["recruitment_id", "project_id"],
            ["ie_recruitment_drafts.id", "ie_recruitment_drafts.project_id"],
            name="fk_ie_introduction_recruitment",
        ),
        ForeignKeyConstraint(
            ["recruitment_revision_id", "recruitment_id"],
            ["ie_recruitment_revisions.id", "ie_recruitment_revisions.recruitment_id"],
            name="fk_ie_introduction_recruitment_revision",
        ),
        CheckConstraint("number > 0", name="number_positive"),
        CheckConstraint(
            "(achievement_id IS NOT NULL AND achievement_revision_id IS NOT NULL "
            "AND recruitment_id IS NULL AND recruitment_revision_id IS NULL) OR "
            "(recruitment_id IS NOT NULL AND recruitment_revision_id IS NOT NULL "
            "AND achievement_id IS NULL AND achievement_revision_id IS NULL)",
            name="one_source",
        ),
        CheckConstraint(
            "jsonb_typeof(fields) = 'object' AND "
            "(fields - ARRAY['title','summary','direction','stage']) = '{}'::jsonb",
            name="fields_shape",
        ),
        *(
            CheckConstraint(
                f"jsonb_typeof(fields->'{field}') = 'string' AND fields ? '{field}' "
                f"AND char_length(fields->>'{field}') <= {limit}",
                name=f"{field}_length",
            )
            for field, limit in (
                ("title", 120),
                ("summary", 2000),
                ("direction", 120),
                ("stage", 80),
            )
        ),
        CheckConstraint("btrim(fields->>'title') <> ''", name="title_nonempty"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    number: Mapped[int] = mapped_column(Integer)
    fields: Mapped[dict[str, str]] = mapped_column(JSONB)
    achievement_id: Mapped[UUID | None]
    achievement_revision_id: Mapped[UUID | None]
    recruitment_id: Mapped[UUID | None]
    recruitment_revision_id: Mapped[UUID | None]
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LifecycleReceipt(Base):
    __tablename__ = "ie_lifecycle_receipts"
    __table_args__ = (
        UniqueConstraint("actor_user_id", "request_id", name="uq_ie_lifecycle_receipt"),
        CheckConstraint(
            "action IN ('COMPLETE','RESUME','INTRODUCTION')", name="action_valid"
        ),
        CheckConstraint(
            "applied_version > 0 AND char_length(fingerprint) = 64",
            name="receipt_valid",
        ),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    project_id: Mapped[UUID] = mapped_column(ForeignKey("ie_project_drafts.id"))
    actor_user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    request_id: Mapped[UUID]
    action: Mapped[str] = mapped_column(String(16))
    fingerprint: Mapped[str] = mapped_column(String(64))
    applied_version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
