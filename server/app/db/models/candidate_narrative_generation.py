from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.db.models.candidate_record import CandidateRecord


class CandidateNarrativeGeneration(Base, TimestampMixin):
    """Versioned AI/rules-generated recruiter summary + client submittal (not structured extraction)."""

    __tablename__ = "candidate_narrative_generations"
    __table_args__ = (
        UniqueConstraint("candidate_record_id", "version", name="uq_narrative_generations_candidate_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_record_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("candidate_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    recruiter_summary: Mapped[str] = mapped_column(Text, nullable=False)
    submittal_draft: Mapped[str] = mapped_column(Text, nullable=False)
    generator_provider: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    context_meta: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    candidate_record: Mapped["CandidateRecord"] = relationship(back_populates="narrative_generations")

