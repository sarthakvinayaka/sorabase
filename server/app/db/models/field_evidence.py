from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.db.models.extracted_field import ExtractedField
    from app.db.models.transcript import Transcript
    from app.db.models.transcript_segment import TranscriptSegment


class FieldEvidence(Base, TimestampMixin):
    __tablename__ = "field_evidence"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    extracted_field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("extracted_fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transcript_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transcript_segment_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("transcript_segments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    span_start_char: Mapped[int | None] = mapped_column(Integer, nullable=True)
    span_end_char: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_text: Mapped[str] = mapped_column(Text, nullable=False)
    model_confidence: Mapped[float | None] = mapped_column(Numeric(6, 5), nullable=True)
    provider_span_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)

    extracted_field: Mapped[ExtractedField] = relationship(back_populates="evidences")
    transcript: Mapped[Transcript] = relationship(back_populates="field_evidences")
    transcript_segment: Mapped[TranscriptSegment | None] = relationship(back_populates="field_evidences")
