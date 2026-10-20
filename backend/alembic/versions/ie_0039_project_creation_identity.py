"""Separate immutable creation identity from transferable project ownership.

Revision ID: ie_0039
Revises: ie_0038
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ie_0039"
down_revision: str | None = "ie_0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ie_project_drafts", sa.Column("creator_user_id", sa.Uuid()))
    op.execute("UPDATE ie_project_drafts SET creator_user_id = owner_user_id")
    op.alter_column("ie_project_drafts", "creator_user_id", nullable=False)
    op.create_foreign_key(
        op.f("fk_ie_project_drafts_users_creator_user_id"),
        "ie_project_drafts",
        "users",
        ["creator_user_id"],
        ["id"],
    )
    op.drop_constraint(
        "uq_ie_project_drafts_owner_request", "ie_project_drafts", type_="unique"
    )
    op.create_unique_constraint(
        "uq_ie_project_drafts_creator_request",
        "ie_project_drafts",
        ["creator_user_id", "creation_request_id"],
    )
    op.execute("""CREATE FUNCTION ie_project_creation_guard() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.creator_user_id IS NULL THEN
                NEW.creator_user_id := NEW.owner_user_id;
            END IF;
            IF NEW.creator_user_id IS DISTINCT FROM NEW.owner_user_id THEN
                RAISE EXCEPTION 'initial owner must be the creator';
            END IF;
        ELSIF ROW(NEW.creator_user_id, NEW.creation_request_id,
                  NEW.creation_payload_fingerprint, NEW.created_at)
              IS DISTINCT FROM
              ROW(OLD.creator_user_id, OLD.creation_request_id,
                  OLD.creation_payload_fingerprint, OLD.created_at) THEN
            RAISE EXCEPTION 'project creation identity is immutable';
        END IF;
        RETURN NEW; END; $$""")
    op.execute(
        "CREATE TRIGGER ie_project_creation_guard BEFORE INSERT OR UPDATE ON "
        "ie_project_drafts FOR EACH ROW EXECUTE FUNCTION ie_project_creation_guard()"
    )
    # Existing owners and accepted mentors already participated before R6.
    op.execute("""INSERT INTO ie_project_participation
        (project_id, user_id, kind, created_at)
        SELECT id, owner_user_id, 'OWNER', created_at FROM ie_project_drafts
        ON CONFLICT ON CONSTRAINT uq_ie_participation_fact DO NOTHING""")
    op.execute("""INSERT INTO ie_project_participation
        (project_id, user_id, kind, created_at)
        SELECT l.project_id, m.user_id, 'MENTOR', l.updated_at
        FROM ie_project_mentor_links l JOIN ie_mentor_profiles m ON m.id = l.mentor_id
        WHERE l.status = 'ACCEPTED' OR EXISTS (
            SELECT 1 FROM audit_logs a
            WHERE a.target_id = l.id::text AND a.target_type = 'ie_project_mentor'
              AND a.action = 'ie.mentor.link.accept'
        )
        ON CONFLICT ON CONSTRAINT uq_ie_participation_fact DO NOTHING""")


def downgrade() -> None:
    # A transferred project can collide with another project created under the
    # successor's key. Let the old UNIQUE creation fail rather than lose data.
    op.drop_constraint(
        "uq_ie_project_drafts_creator_request", "ie_project_drafts", type_="unique"
    )
    op.create_unique_constraint(
        "uq_ie_project_drafts_owner_request",
        "ie_project_drafts",
        ["owner_user_id", "creation_request_id"],
    )
    op.execute("DROP TRIGGER ie_project_creation_guard ON ie_project_drafts")
    op.execute("DROP FUNCTION ie_project_creation_guard()")
    op.drop_constraint(
        op.f("fk_ie_project_drafts_users_creator_user_id"),
        "ie_project_drafts",
        type_="foreignkey",
    )
    op.drop_column("ie_project_drafts", "creator_user_id")
