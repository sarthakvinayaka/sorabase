"""Audio upload — whisper_response column on media_references.

Revision ID: 007
Revises: 006
Create Date: 2026-05-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "media_references",
        sa.Column("whisper_response", postgresql.JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("media_references", "whisper_response")
