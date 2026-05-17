"""candidate_narrative_generations — versioned recruiter summary + submittal drafts

Revision ID: 20260518_000006
Revises: 20260517_000005
Create Date: 2026-05-18

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "20260518_000006"
down_revision = "20260517_000005"
branch_labels = None
depends_on = None


def _index_exists(bind, table: str, index_name: str) -> bool:
    return any(idx["name"] == index_name for idx in inspect(bind).get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not inspect(bind).has_table("candidate_narrative_generations"):
        op.create_table(
            "candidate_narrative_generations",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("candidate_record_id", sa.Uuid(), sa.ForeignKey("candidate_records.id", ondelete="CASCADE"), nullable=False),
            sa.Column("organization_id", sa.Uuid(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("recruiter_summary", sa.Text(), nullable=False),
            sa.Column("submittal_draft", sa.Text(), nullable=False),
            sa.Column("generator_provider", sa.String(255), nullable=False),
            sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("context_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("candidate_record_id", "version", name="uq_narrative_generations_candidate_version"),
        )
    if not _index_exists(bind, "candidate_narrative_generations", "ix_narrative_generations_candidate_created"):
        op.create_index(
            "ix_narrative_generations_candidate_created",
            "candidate_narrative_generations",
            ["candidate_record_id", "version"],
            unique=False,
        )
    if not _index_exists(bind, "candidate_narrative_generations", "ix_narrative_generations_org"):
        op.create_index("ix_narrative_generations_org", "candidate_narrative_generations", ["organization_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_narrative_generations_org", table_name="candidate_narrative_generations")
    op.drop_index("ix_narrative_generations_candidate_created", table_name="candidate_narrative_generations")
    op.drop_table("candidate_narrative_generations")
