"""Independent lifecycle and governed immutable public introductions.

Revision ID: 0042
Revises: 0041
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0042"
down_revision: str | None = "0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ie_project_drafts",
        sa.Column("lifecycle", sa.String(16), nullable=False, server_default="ACTIVE"),
    )
    op.add_column(
        "ie_project_drafts",
        sa.Column(
            "introduction_moderation_state",
            sa.String(16),
            nullable=False,
            server_default="NORMAL",
        ),
    )
    op.add_column("ie_project_drafts", sa.Column("public_introduction_id", sa.Uuid()))
    op.create_check_constraint(
        "lifecycle_valid", "ie_project_drafts", "lifecycle IN ('ACTIVE','COMPLETED')"
    )
    op.create_check_constraint(
        "introduction_moderation_valid",
        "ie_project_drafts",
        "introduction_moderation_state IN ('NORMAL','TAKEN_DOWN')",
    )
    op.create_unique_constraint(
        "uq_ie_recruitment_project_identity",
        "ie_recruitment_drafts",
        ["id", "project_id"],
    )
    op.create_table(
        "ie_project_introductions",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("ie_project_drafts.id"),
            nullable=False,
        ),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("fields", JSONB(), nullable=False),
        sa.Column("achievement_id", sa.Uuid()),
        sa.Column("achievement_revision_id", sa.Uuid()),
        sa.Column("recruitment_id", sa.Uuid()),
        sa.Column("recruitment_revision_id", sa.Uuid()),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("id", "project_id", name="uq_ie_introduction_project"),
        sa.UniqueConstraint("project_id", "number", name="uq_ie_introduction_number"),
        sa.ForeignKeyConstraint(
            ["achievement_id", "project_id"],
            ["ie_achievement_drafts.id", "ie_achievement_drafts.project_id"],
            name="fk_ie_introduction_achievement",
        ),
        sa.ForeignKeyConstraint(
            ["achievement_revision_id", "achievement_id"],
            ["ie_achievement_revisions.id", "ie_achievement_revisions.achievement_id"],
            name="fk_ie_introduction_achievement_revision",
        ),
        sa.ForeignKeyConstraint(
            ["recruitment_id", "project_id"],
            ["ie_recruitment_drafts.id", "ie_recruitment_drafts.project_id"],
            name="fk_ie_introduction_recruitment",
        ),
        sa.ForeignKeyConstraint(
            ["recruitment_revision_id", "recruitment_id"],
            ["ie_recruitment_revisions.id", "ie_recruitment_revisions.recruitment_id"],
            name="fk_ie_introduction_recruitment_revision",
        ),
        sa.CheckConstraint("number > 0", name="number_positive"),
        sa.CheckConstraint(
            "(achievement_id IS NOT NULL AND achievement_revision_id IS NOT NULL "
            "AND recruitment_id IS NULL AND recruitment_revision_id IS NULL) OR "
            "(recruitment_id IS NOT NULL AND recruitment_revision_id IS NOT NULL "
            "AND achievement_id IS NULL AND achievement_revision_id IS NULL)",
            name="one_source",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(fields) = 'object' AND "
            "(fields - ARRAY['title','summary','direction','stage']) = '{}'::jsonb",
            name="fields_shape",
        ),
        *(
            sa.CheckConstraint(
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
        sa.CheckConstraint("btrim(fields->>'title') <> ''", name="title_nonempty"),
    )
    op.create_foreign_key(
        "fk_ie_project_introduction",
        "ie_project_drafts",
        "ie_project_introductions",
        ["public_introduction_id", "id"],
        ["id", "project_id"],
    )
    op.create_table(
        "ie_lifecycle_receipts",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("ie_project_drafts.id"),
            nullable=False,
        ),
        sa.Column(
            "actor_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("applied_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "actor_user_id", "request_id", name="uq_ie_lifecycle_receipt"
        ),
        sa.CheckConstraint(
            "action IN ('COMPLETE','RESUME','INTRODUCTION')", name="action_valid"
        ),
        sa.CheckConstraint(
            "applied_version > 0 AND char_length(fingerprint) = 64",
            name="receipt_valid",
        ),
    )
    for table in ("ie_project_introductions", "ie_lifecycle_receipts"):
        op.execute(
            f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE "
            f"ON {table} FOR EACH ROW "
            "EXECUTE FUNCTION ie_collaboration_immutable()"
        )


def downgrade() -> None:
    op.drop_table("ie_lifecycle_receipts")
    op.drop_constraint(
        "fk_ie_project_introduction", "ie_project_drafts", type_="foreignkey"
    )
    op.drop_table("ie_project_introductions")
    op.drop_constraint(
        "uq_ie_recruitment_project_identity", "ie_recruitment_drafts", type_="unique"
    )
    op.drop_constraint(
        op.f("ck_ie_project_drafts_lifecycle_valid"), "ie_project_drafts", type_="check"
    )
    op.drop_constraint(
        op.f("ck_ie_project_drafts_introduction_moderation_valid"),
        "ie_project_drafts",
        type_="check",
    )
    for column in (
        "public_introduction_id",
        "introduction_moderation_state",
        "lifecycle",
    ):
        op.drop_column("ie_project_drafts", column)
