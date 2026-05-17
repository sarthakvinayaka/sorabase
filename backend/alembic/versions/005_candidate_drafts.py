"""Candidate drafts — recruiter-editable prose output.

Adds the candidate_drafts table for AI-generated and recruiter-edited
candidate summaries and job-specific submittal drafts.

Revision ID: 005
Revises: 004
Create Date: 2026-05-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidate_drafts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "candidate_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("candidates.id"),
            nullable=False,
        ),
        sa.Column(
            "analysis_run_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("analysis_runs.id"),
            nullable=True,
        ),
        sa.Column("draft_type", sa.String(50), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("edited", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_candidate_drafts_candidate_id",
        "candidate_drafts",
        ["candidate_id"],
    )
    op.create_index(
        "ix_candidate_drafts_analysis_run_id",
        "candidate_drafts",
        ["analysis_run_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_candidate_drafts_analysis_run_id", table_name="candidate_drafts")
    op.drop_index("ix_candidate_drafts_candidate_id", table_name="candidate_drafts")
    op.drop_table("candidate_drafts")
