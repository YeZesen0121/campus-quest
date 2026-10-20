"""innovation_mentors

Revision ID: ie_0037
Revises: ie_0036
Create Date: 2026-10-15 06:18:50.015848

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "ie_0037"
down_revision: str | None = "ie_0036"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_users_role"), "users", type_="check")
    op.create_check_constraint(
        op.f("ck_users_role"), "users", "role IN ('STUDENT','TEACHER','ADMIN','MENTOR')"
    )
    op.create_table(
        "ie_mentor_profiles",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("fields", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("public_version", sa.Integer(), nullable=False),
        sa.Column("confirmation_state", sa.String(length=16), nullable=False),
        sa.Column("visibility", sa.String(length=16), nullable=False),
        sa.Column("moderation_state", sa.String(length=16), nullable=False),
        sa.Column("accepting_contact", sa.Boolean(), nullable=False),
        sa.Column(
            "authorized_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("public_revision_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "confirmation_state IN ('PENDING','CONFIRMED','REJECTED')",
            name=op.f("ck_ie_mentor_profiles_confirmation_valid"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(fields) = 'object' AND "
            "jsonb_typeof(authorized_fields) = 'array'",
            name=op.f("ck_ie_mentor_profiles_json_valid"),
        ),
        sa.CheckConstraint(
            "moderation_state IN ('NORMAL','TAKEN_DOWN')",
            name=op.f("ck_ie_mentor_profiles_moderation_valid"),
        ),
        sa.CheckConstraint(
            "visibility <> 'VISIBLE' OR "
            "(public_revision_id IS NOT NULL AND public_version > 0)",
            name=op.f("ck_ie_mentor_profiles_visible_consistent"),
        ),
        sa.CheckConstraint(
            "visibility IN ('HIDDEN','VISIBLE')",
            name=op.f("ck_ie_mentor_profiles_visibility_valid"),
        ),
        sa.CheckConstraint(
            "version > 0 AND public_version >= 0",
            name=op.f("ck_ie_mentor_profiles_versions_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_ie_mentor_profiles_users_user_id")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ie_mentor_profiles")),
        sa.UniqueConstraint("user_id", name="uq_ie_mentor_user"),
    )
    op.create_index(
        "ix_ie_mentor_public_revision",
        "ie_mentor_profiles",
        ["public_revision_id", "id"],
        unique=False,
    )
    op.create_index(
        "ix_ie_mentor_visible_updated",
        "ie_mentor_profiles",
        ["updated_at", "id"],
        unique=False,
        postgresql_where=sa.text(
            "visibility = 'VISIBLE' AND moderation_state = 'NORMAL'"
        ),
    )
    op.create_table(
        "ie_mentor_consents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("draft_version", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("scope", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "draft_version > 0", name=op.f("ck_ie_mentor_consents_version_positive")
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_ie_mentor_consents_users_actor_user_id"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["ie_mentor_profiles.id"],
            name=op.f("fk_ie_mentor_consents_ie_mentor_profiles_profile_id"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ie_mentor_consents")),
        sa.UniqueConstraint("id", "profile_id", name="uq_ie_mentor_consent_identity"),
    )
    op.create_table(
        "ie_mentor_receipts",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("actor_user_id", sa.Uuid(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("applied_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "char_length(fingerprint) = 64 AND applied_version > 0",
            name=op.f("ck_ie_mentor_receipts_receipt_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_ie_mentor_receipts_users_actor_user_id"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["ie_mentor_profiles.id"],
            name=op.f("fk_ie_mentor_receipts_ie_mentor_profiles_profile_id"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ie_mentor_receipts")),
        sa.UniqueConstraint("actor_user_id", "request_id", name="uq_ie_mentor_request"),
    )
    op.create_index(
        "ix_ie_mentor_receipt_profile",
        "ie_mentor_receipts",
        ["profile_id"],
        unique=False,
    )
    op.create_table(
        "ie_project_mentor_links",
        sa.Column(
            "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("mentor_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by", sa.Uuid(), nullable=False),
        sa.Column(
            "project_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('PENDING','ACCEPTED','REJECTED','REVOKED')",
            name=op.f("ck_ie_project_mentor_links_status_valid"),
        ),
        sa.CheckConstraint(
            "version > 0", name=op.f("ck_ie_project_mentor_links_version_positive")
        ),
        sa.ForeignKeyConstraint(
            ["mentor_id"],
            ["ie_mentor_profiles.id"],
            name=op.f("fk_ie_project_mentor_links_ie_mentor_profiles_mentor_id"),
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["ie_project_drafts.id"],
            name=op.f("fk_ie_project_mentor_links_ie_project_drafts_project_id"),
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["users.id"],
            name=op.f("fk_ie_project_mentor_links_users_requested_by"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ie_project_mentor_links")),
        sa.UniqueConstraint(
            "project_id", "mentor_id", name="uq_ie_project_mentor_pair"
        ),
    )
    op.create_index(
        "ix_ie_project_mentor_target",
        "ie_project_mentor_links",
        ["mentor_id", "status"],
        unique=False,
    )
    op.create_table(
        "ie_mentor_revisions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("consent_id", sa.Uuid(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("contacts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "jsonb_typeof(contacts) = 'array' AND jsonb_array_length(contacts) <= 4",
            name=op.f("ck_ie_mentor_revisions_contact_shape"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(content) = 'object' AND NOT content ? 'contacts'",
            name=op.f("ck_ie_mentor_revisions_content_private_free"),
        ),
        sa.CheckConstraint(
            "number > 0", name=op.f("ck_ie_mentor_revisions_number_positive")
        ),
        sa.ForeignKeyConstraint(
            ["consent_id", "profile_id"],
            ["ie_mentor_consents.id", "ie_mentor_consents.profile_id"],
            name="fk_ie_mentor_revision_consent",
        ),
        sa.ForeignKeyConstraint(
            ["profile_id"],
            ["ie_mentor_profiles.id"],
            name=op.f("fk_ie_mentor_revisions_ie_mentor_profiles_profile_id"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ie_mentor_revisions")),
        sa.UniqueConstraint("id", "profile_id", name="uq_ie_mentor_revision_identity"),
        sa.UniqueConstraint(
            "profile_id", "number", name="uq_ie_mentor_revision_number"
        ),
    )
    op.create_foreign_key(
        "fk_ie_mentor_public",
        "ie_mentor_profiles",
        "ie_mentor_revisions",
        ["public_revision_id", "id"],
        ["id", "profile_id"],
    )
    op.execute("""CREATE FUNCTION ie_mentor_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'mentor consent history is immutable'; END; $$""")
    for table in ("ie_mentor_consents", "ie_mentor_revisions", "ie_mentor_receipts"):
        op.execute(
            f"CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE ON {table} "
            "FOR EACH ROW EXECUTE FUNCTION ie_mentor_immutable()"
        )
    op.execute("""CREATE FUNCTION ie_mentor_identity_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'mentor identity cannot be rebound';
        END IF; RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER ie_mentor_identity_guard BEFORE UPDATE ON "
        "ie_mentor_profiles FOR EACH ROW "
        "EXECUTE FUNCTION ie_mentor_identity_guard()"
    )


def downgrade() -> None:
    op.drop_constraint("fk_ie_mentor_public", "ie_mentor_profiles", type_="foreignkey")
    op.drop_table("ie_mentor_revisions")
    op.drop_index("ix_ie_project_mentor_target", table_name="ie_project_mentor_links")
    op.drop_table("ie_project_mentor_links")
    op.drop_index("ix_ie_mentor_receipt_profile", table_name="ie_mentor_receipts")
    op.drop_table("ie_mentor_receipts")
    op.drop_table("ie_mentor_consents")
    op.drop_index(
        "ix_ie_mentor_visible_updated",
        table_name="ie_mentor_profiles",
        postgresql_where=sa.text(
            "visibility = 'VISIBLE' AND moderation_state = 'NORMAL'"
        ),
    )
    op.drop_index("ix_ie_mentor_public_revision", table_name="ie_mentor_profiles")
    op.drop_table("ie_mentor_profiles")
    op.execute("DROP FUNCTION ie_mentor_immutable()")
    op.execute("DROP FUNCTION ie_mentor_identity_guard()")
    # Deliberately fails if live MENTOR accounts still exist; never silently
    # relabel a mentor as a student or grant task-teacher capabilities.
    op.drop_constraint(op.f("ck_users_role"), "users", type_="check")
    op.create_check_constraint(
        op.f("ck_users_role"), "users", "role IN ('STUDENT','TEACHER','ADMIN')"
    )
