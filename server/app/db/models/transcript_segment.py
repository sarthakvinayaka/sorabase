from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.db.models.field_evidence import FieldEvidence
    from app.db.models.transcript import Transcript


class TranscriptSegment(Base, TimestampMixin):
    __tablename__ = "transcript_segments"
    __table_args__ = (UniqueConstraint("transcript_id", "sequence_index", name="uq_transcript_segments_order"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transcript_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    text: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    speaker_label: Mapped[str | None] = mapped_column(String(64), nullable=True)

    transcript: Mapped[Transcript] = relationship(back_populates="segments")
    field_evidences: Mapped[list[FieldEvidence]] = relationship(
        "FieldEvidence",
        back_populates="transcript_segment",
    )
