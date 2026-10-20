"""Stable text-save commands with immutable reconciliation receipts.

Revision ID: ie_0040
Revises: ie_0039
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ie_0040"
down_revision: str | None = "ie_0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_ie_achievement_project_identity",
        "ie_achievement_drafts",
        ["id", "project_id"],
    )
    op.create_table(
        "ie_workspace_command_receipts",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "actor_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("ie_project_drafts.id"),
            nullable=False,
        ),
        sa.Column("achievement_id", sa.Uuid()),
        sa.Column("action", sa.String(24), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("applied_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "actor_user_id", "request_id", name="uq_ie_workspace_command"
        ),
        sa.ForeignKeyConstraint(
            ["achievement_id", "project_id"],
            ["ie_achievement_drafts.id", "ie_achievement_drafts.project_id"],
            name="fk_ie_workspace_receipt_achievement",
        ),
        sa.CheckConstraint(
            "char_length(fingerprint) = 64 AND applied_version > 0",
            name=op.f("ck_ie_workspace_command_receipts_receipt_valid"),
        ),
        sa.CheckConstraint(
            "(action = 'PROJECT_SAVE' AND achievement_id IS NULL) OR "
            "(action = 'ACHIEVEMENT_SAVE' AND achievement_id IS NOT NULL)",
            name=op.f("ck_ie_workspace_command_receipts_action_scope"),
        ),
    )
    op.create_index(
        "ix_ie_workspace_receipt_project",
        "ie_workspace_command_receipts",
        ["project_id"],
    )
    op.execute(
        "CREATE TRIGGER ie_workspace_receipt_immutable BEFORE UPDATE OR DELETE ON "
        "ie_workspace_command_receipts FOR EACH ROW "
        "EXECUTE FUNCTION ie_collaboration_immutable()"
    )


def downgrade() -> None:
    op.drop_table("ie_workspace_command_receipts")
    op.drop_constraint(
        "uq_ie_achievement_project_identity", "ie_achievement_drafts", type_="unique"
    )
