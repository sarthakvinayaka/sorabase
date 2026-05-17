"""Analysis node — add typed scoring columns to analysis_runs.

The analysis_runs table existed as a stub (id, org_id, extraction_run_id,
candidate_id, job_id, status, results, created_at). This migration adds all
typed output columns so the UI can render scoring breakdowns, requirement
checklists, and narrative fields without parsing the raw JSON blob.

Revision ID: 004
Revises: 003
Create Date: 2026-05-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analysis_runs", sa.Column("overall_score", sa.Integer, nullable=True))
    op.add_column("analysis_runs", sa.Column("overall_tier", sa.String(50), nullable=True))
    op.add_column("analysis_runs", sa.Column("score_breakdown", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("hard_requirements_met", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("hard_requirements_missed", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("preferred_requirements_met", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("preferred_requirements_missed", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("strengths", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("gaps", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("concerns", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("missing_info", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("rationale", sa.Text, nullable=True))
    op.add_column("analysis_runs", sa.Column("suggested_follow_up_questions", sa.JSON, nullable=True))
    op.add_column("analysis_runs", sa.Column("model_used", sa.String(100), nullable=True))
    op.add_column("analysis_runs", sa.Column("prompt_tokens", sa.Integer, nullable=True))
    op.add_column("analysis_runs", sa.Column("completion_tokens", sa.Integer, nullable=True))


def downgrade() -> None:
    for col in [
        "completion_tokens", "prompt_tokens", "model_used",
        "suggested_follow_up_questions", "rationale", "missing_info",
        "concerns", "gaps", "strengths",
        "preferred_requirements_missed", "preferred_requirements_met",
        "hard_requirements_missed", "hard_requirements_met",
        "score_breakdown", "overall_tier", "overall_score",
    ]:
        op.drop_column("analysis_runs", col)
