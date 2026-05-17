"""extracted_fields.ai_extracted_value + human_edit source enum value

Revision ID: 20260517_000005
Revises: 20260516_000004
Create Date: 2026-05-17

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "20260517_000005"
down_revision = "20260516_000004"
branch_labels = None
depends_on = None


def _column_exists(bind, table: str, column: str) -> bool:
    return any(c["name"] == column for c in inspect(bind).get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(
        sa.text(
            """
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON e.enumtypid = t.oid
                    WHERE t.typname = 'extracted_field_source' AND e.enumlabel = 'human_edit'
                ) THEN
                    ALTER TYPE extracted_field_source ADD VALUE 'human_edit';
                END IF;
            END $$;
            """,
        ),
    )
    if not _column_exists(bind, "extracted_fields", "ai_extracted_value"):
        op.add_column("extracted_fields", sa.Column("ai_extracted_value", sa.Text(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE extracted_fields
            SET ai_extracted_value = field_value
            WHERE ai_extracted_value IS NULL
              AND field_value IS NOT NULL
              AND source::text IN ('model', 'heuristic', 'imported')
            """,
        ),
    )


def downgrade() -> None:
    op.drop_column("extracted_fields", "ai_extracted_value")
    # PostgreSQL cannot drop enum value safely; leave human_edit in type.
