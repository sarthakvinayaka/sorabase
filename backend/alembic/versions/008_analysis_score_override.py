"""Analysis score override — recruiter_override_score, recruiter_override_reason, score_status.

Revision ID: 008
Revises: 007
Create Date: 2026-05-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "analysis_runs",
        sa.Column("recruiter_override_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "analysis_runs",
        sa.Column("recruiter_override_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "analysis_runs",
        sa.Column(
            "score_status",
            sa.String(length=50),
            nullable=False,
            server_default="ai_scored",
        ),
    )


def downgrade() -> None:
    op.drop_column("analysis_runs", "score_status")
    op.drop_column("analysis_runs", "recruiter_override_reason")
    op.drop_column("analysis_runs", "recruiter_override_score")
