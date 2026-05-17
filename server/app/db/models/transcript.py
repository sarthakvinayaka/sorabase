from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import TranscriptStatus
from app.db.mixins import TimestampMixin
from app.db.postgresql_enums import pg_str_enum

if TYPE_CHECKING:
    from app.db.models.audio_upload import AudioUpload
    from app.db.models.candidate_record import CandidateRecord
    from app.db.models.field_evidence import FieldEvidence
    from app.db.models.transcript_segment import TranscriptSegment


class Transcript(Base, TimestampMixin):
    __tablename__ = "transcripts"
    __table_args__ = (UniqueConstraint("audio_upload_id", "version", name="uq_transcripts_audio_version"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    audio_upload_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("audio_uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider: Mapped[str | None] = mapped_column(String(128), nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    status: Mapped[TranscriptStatus] = mapped_column(
        pg_str_enum(TranscriptStatus, name="transcript_status"),
        nullable=False,
        server_default=TranscriptStatus.PENDING.value,
    )

    audio_upload: Mapped[AudioUpload] = relationship(back_populates="transcripts")
    segments: Mapped[list[TranscriptSegment]] = relationship(
        back_populates="transcript",
        order_by="TranscriptSegment.sequence_index",
    )
    candidate_records_primary: Mapped[list[CandidateRecord]] = relationship(back_populates="primary_transcript")
    field_evidences: Mapped[list[FieldEvidence]] = relationship(
        "FieldEvidence",
        back_populates="transcript",
    )
