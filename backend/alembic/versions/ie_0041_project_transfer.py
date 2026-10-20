"""Versioned transfers and explicitly selected evidence rights.

Revision ID: ie_0041
Revises: ie_0040
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ie_0041"
down_revision: str | None = "ie_0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ie_project_drafts",
        sa.Column(
            "ownership_generation", sa.Integer(), server_default="1", nullable=False
        ),
    )
    op.create_check_constraint(
        "ownership_generation_positive", "ie_project_drafts", "ownership_generation > 0"
    )
    op.add_column(
        "ie_achievement_evidence",
        sa.Column("uploaded_by_user_id", sa.Uuid(), sa.ForeignKey("users.id")),
    )
    op.add_column(
        "ie_achievement_evidence", sa.Column("uploaded_owner_generation", sa.Integer())
    )
    op.execute("""
        UPDATE ie_achievement_evidence e SET uploaded_by_user_id = p.owner_user_id,
        uploaded_owner_generation = p.ownership_generation
        FROM ie_achievement_drafts a JOIN ie_project_drafts p ON p.id = a.project_id
        WHERE a.id = e.achievement_id
    """)
    op.alter_column("ie_achievement_evidence", "uploaded_by_user_id", nullable=False)
    op.alter_column(
        "ie_achievement_evidence", "uploaded_owner_generation", nullable=False
    )
    op.execute("""
        CREATE FUNCTION ie_evidence_origin() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF TG_OP = 'INSERT' THEN
            IF NEW.uploaded_by_user_id IS NULL
              AND NEW.uploaded_owner_generation IS NULL THEN
              SELECT p.owner_user_id, p.ownership_generation
              INTO NEW.uploaded_by_user_id, NEW.uploaded_owner_generation
              FROM ie_project_drafts p
              JOIN ie_achievement_drafts a ON a.project_id = p.id
              WHERE a.id = NEW.achievement_id;
            END IF;
          ELSIF (NEW.uploaded_by_user_id, NEW.uploaded_owner_generation)
            IS DISTINCT FROM
              (OLD.uploaded_by_user_id, OLD.uploaded_owner_generation) THEN
            RAISE EXCEPTION 'evidence origin is immutable';
          END IF;
          RETURN NEW;
        END $$;
    """)
    op.execute(
        "CREATE TRIGGER ie_evidence_origin_guard BEFORE INSERT OR UPDATE ON "
        "ie_achievement_evidence FOR EACH ROW "
        "EXECUTE FUNCTION ie_evidence_origin()"
    )
    op.create_table(
        "ie_project_transfers",
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
        sa.Column("from_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "target_user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("from_generation", sa.Integer(), nullable=False),
        sa.Column("creation_request_id", sa.Uuid(), nullable=False),
        sa.Column("creation_fingerprint", sa.String(64), nullable=False),
        sa.Column("evidence_snapshot", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("initial_snapshot", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("allow_preview", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "from_user_id", "creation_request_id", name="uq_ie_transfer_creation"
        ),
        sa.CheckConstraint(
            "status IN ('PENDING','ACCEPTED','REJECTED',"
            "'CANCELED','EXPIRED','INVALIDATED')",
            name="status_valid",
        ),
        sa.CheckConstraint(
            "version > 0 AND from_generation > 0 AND expires_at > created_at "
            "AND from_user_id <> target_user_id",
            name="proposal_valid",
        ),
    )
    op.create_index(
        "ix_ie_transfer_target",
        "ie_project_transfers",
        ["target_user_id", "created_at", "id"],
    )
    op.create_index(
        "ix_ie_transfer_project",
        "ie_project_transfers",
        ["project_id", "created_at", "id"],
    )
    op.create_table(
        "ie_transfer_receipts",
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
            "transfer_id",
            sa.Uuid(),
            sa.ForeignKey("ie_project_transfers.id"),
            nullable=False,
        ),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "actor_user_id", "request_id", name="uq_ie_transfer_receipt"
        ),
    )
    op.create_table(
        "ie_transferred_evidence_grants",
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
        sa.Column("ownership_generation", sa.Integer(), nullable=False),
        sa.Column(
            "evidence_id",
            sa.Uuid(),
            sa.ForeignKey("ie_achievement_evidence.id"),
            nullable=False,
        ),
        sa.Column(
            "transfer_id",
            sa.Uuid(),
            sa.ForeignKey("ie_project_transfers.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "project_id",
            "ownership_generation",
            "evidence_id",
            name="uq_ie_transfer_evidence_scope",
        ),
        sa.CheckConstraint("ownership_generation > 1", name="generation_valid"),
    )
    for table in ("ie_transfer_receipts", "ie_transferred_evidence_grants"):
        op.execute(
            f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION ie_collaboration_immutable()"
        )
    op.execute("""
      CREATE FUNCTION ie_transfer_proposal_guard() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF (to_jsonb(NEW) - ARRAY['status','version','updated_at'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','version','updated_at']) THEN
          RAISE EXCEPTION 'transfer proposal is immutable';
        END IF;
        RETURN NEW;
      END $$;
    """)
    op.execute(
        "CREATE TRIGGER ie_transfer_proposal_immutable BEFORE UPDATE ON "
        "ie_project_transfers FOR EACH ROW "
        "EXECUTE FUNCTION ie_transfer_proposal_guard()"
    )


def downgrade() -> None:
    op.drop_table("ie_transferred_evidence_grants")
    op.drop_table("ie_transfer_receipts")
    op.drop_table("ie_project_transfers")
    op.execute("DROP FUNCTION ie_transfer_proposal_guard()")
    op.execute("DROP TRIGGER ie_evidence_origin_guard ON ie_achievement_evidence")
    op.execute("DROP FUNCTION ie_evidence_origin()")
    op.drop_column("ie_achievement_evidence", "uploaded_owner_generation")
    op.drop_column("ie_achievement_evidence", "uploaded_by_user_id")
    op.drop_constraint(
        op.f("ck_ie_project_drafts_ownership_generation_positive"),
        "ie_project_drafts",
        type_="check",
    )
    op.drop_column("ie_project_drafts", "ownership_generation")
