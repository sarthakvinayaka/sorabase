from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models.transcript import Transcript
from app.db.models.transcript_segment import TranscriptSegment
from app.schemas.audio_upload import AudioUploadDTO, upload_to_dto


class TranscriptSegmentDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sequence_index: int
    start_ms: int
    end_ms: int
    speaker_label: str | None = None
    text: str


class TranscriptDetailDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    audio_upload_id: uuid.UUID
    version: int
    language: str | None = None
    provider: str | None = None
    status: str
    full_text: str
    segments: list[TranscriptSegmentDTO] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TranscribeResponse(BaseModel):
    idempotent: bool
    transcript: TranscriptDetailDTO
    upload: AudioUploadDTO


def segment_to_dto(seg: TranscriptSegment) -> TranscriptSegmentDTO:
    return TranscriptSegmentDTO(
        id=seg.id,
        sequence_index=seg.sequence_index,
        start_ms=seg.start_ms,
        end_ms=seg.end_ms,
        speaker_label=seg.speaker_label,
        text=seg.text,
    )


def transcript_to_dto(transcript: Transcript) -> TranscriptDetailDTO:
    segs = sorted(transcript.segments or [], key=lambda s: s.sequence_index)
    return TranscriptDetailDTO(
        id=transcript.id,
        audio_upload_id=transcript.audio_upload_id,
        version=transcript.version,
        language=transcript.language,
        provider=transcript.provider,
        status=transcript.status.value,
        full_text=transcript.full_text,
        segments=[segment_to_dto(s) for s in segs],
        created_at=transcript.created_at,
        updated_at=transcript.updated_at,
    )


def build_transcribe_response(*, idempotent: bool, transcript: Transcript, upload) -> TranscribeResponse:
    return TranscribeResponse(
        idempotent=idempotent,
        transcript=transcript_to_dto(transcript),
        upload=upload_to_dto(upload, pipeline=None),
    )
