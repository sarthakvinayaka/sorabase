"""Transcription provider abstraction (ASR vendors plug in behind this boundary)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.db.models.audio_upload import AudioUpload


@dataclass(frozen=True)
class TranscriptionSegmentResult:
    sequence_index: int
    start_ms: int
    end_ms: int
    speaker_label: str
    text: str


@dataclass(frozen=True)
class TranscriptionResult:
    """Structured ASR output — persisted separately from extraction / structured fields."""

    full_text: str
    language: str
    segments: tuple[TranscriptionSegmentResult, ...]
    provider_id: str


@runtime_checkable
class TranscriptionProvider(Protocol):
    """Pluggable ASR (Whisper, Deepgram, AWS Transcribe, etc.)."""

    @property
    def provider_id(self) -> str: ...

    def transcribe(
        self,
        *,
        upload: AudioUpload,
        audio_bytes: bytes | None = None,
    ) -> TranscriptionResult:
        """
        Produce transcript text + timed segments.

        `audio_bytes` is optional for mock/demo paths; real providers should read from storage
        or consume the bytes stream.
        """
        ...
