"""candidate_processing_stage for intake pipeline

Revision ID: 20260516_000004
Revises: 20260515_000003
Create Date: 2026-05-16

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "20260516_000004"
down_revision = "20260515_000003"
branch_labels = None
depends_on = None

_stage = postgresql.ENUM(
    "uploaded",
    "transcribed",
    "extracted",
    "needs_review",
    "approved",
    "synced",
    name="candidate_processing_stage",
    create_type=True,
)


def _column_exists(bind, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspect(bind).get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    _stage.create(bind, checkfirst=True)

    # Folded into 20260514_000002 create_all for fresh installs; keep ALTER for older DBs.
    if not _column_exists(bind, "candidate_records", "processing_stage"):
        op.add_column(
            "candidate_records",
            sa.Column("processing_stage", _stage, nullable=False, server_default="uploaded"),
        )
    op.execute(
        sa.text(
            """
            UPDATE candidate_records
            SET processing_stage = 'transcribed'
            WHERE primary_transcript_id IS NOT NULL
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE candidate_records
            SET processing_stage = 'needs_review'
            WHERE extraction_status::text = 'complete'
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE candidate_records
            SET processing_stage = 'approved'
            WHERE approval_status::text IN ('approved', 'partially_approved')
            """,
        ),
    )
    op.execute(
        sa.text(
            """
            UPDATE candidate_records
            SET processing_stage = 'synced'
            WHERE ats_sync_status::text = 'synced'
            """,
        ),
    )


def downgrade() -> None:
    op.drop_column("candidate_records", "processing_stage")
    _stage.drop(op.get_bind(), checkfirst=True)
