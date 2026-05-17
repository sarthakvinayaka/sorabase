"""
Source adapter contracts.

SourceAdapter — structural Protocol every adapter must satisfy.
IngestionPayload — discriminated union of per-source inbound payloads.
IngestionResult — what every adapter.ingest() returns.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal, Protocol, Union, runtime_checkable

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# Per-source inbound payload types
# ---------------------------------------------------------------------------

class TranscriptPayload(BaseModel):
    source_type: Literal["transcript"] = "transcript"
    raw_text: str
    recruiter_id: str | None = None
    job_id: uuid.UUID | None = None
    job_reference: str | None = None


class AudioPayload(BaseModel):
    source_type: Literal["audio"] = "audio"
    storage_key: str          # S3/GCS object key
    mime_type: str            # audio/mp3, audio/wav, audio/m4a …
    size_bytes: int
    recruiter_id: str | None = None
    job_id: uuid.UUID | None = None
    job_reference: str | None = None


class ZoomWebhookPayload(BaseModel):
    source_type: Literal["zoom"] = "zoom"
    meeting_id: str
    recording_url: str       # direct download URL for the preferred audio file
    host_email: str
    participants: list[str] = Field(default_factory=list)
    duration_seconds: int | None = None
    started_at: datetime | None = None
    download_token: str | None = None   # short-lived token from webhook payload
    job_id: uuid.UUID | None = None
    job_reference: str | None = None


class GoogleMeetPayload(BaseModel):
    source_type: Literal["google_meet"] = "google_meet"
    meeting_id: str
    recording_url: str
    organizer_email: str
    participants: list[str] = Field(default_factory=list)
    duration_seconds: int | None = None
    job_id: uuid.UUID | None = None
    job_reference: str | None = None


class WhatsAppPayload(BaseModel):
    source_type: Literal["whatsapp"] = "whatsapp"
    thread_id: str
    # Each message: {"sender": str, "text": str, "timestamp": str}
    # Typed more strictly when the WhatsApp adapter is built.
    messages: list[dict] = Field(default_factory=list)
    job_id: uuid.UUID | None = None
    job_reference: str | None = None


IngestionPayload = Annotated[
    Union[
        TranscriptPayload,
        AudioPayload,
        ZoomWebhookPayload,
        GoogleMeetPayload,
        WhatsAppPayload,
    ],
    Field(discriminator="source_type"),
]


# ---------------------------------------------------------------------------
# Ingest result
# ---------------------------------------------------------------------------

@dataclass
class IngestionResult:
    source_event_id: uuid.UUID
    conversation_id: uuid.UUID
    # True when raw_text is already populated and extraction can proceed.
    # False for async sources (audio, Zoom, Meet) where transcription is pending.
    transcript_ready: bool


# ---------------------------------------------------------------------------
# Adapter protocol
# ---------------------------------------------------------------------------

@runtime_checkable
class SourceAdapter(Protocol):
    source_type: str
    # sync  — produce_transcript() blocks until transcript is available.
    # async — produce_transcript() raises NotImplementedError; a background
    #         worker will update transcript_status when done.
    ingestion_mode: Literal["sync", "async"]

    def ingest(
        self,
        payload: IngestionPayload,
        db: Session,
        actor_id: str = "system",
    ) -> IngestionResult:
        """
        Create a SourceEvent + linked Conversation.
        Must be idempotent on external_id when provided.
        """
        ...

    def produce_transcript(
        self,
        source_event_id: uuid.UUID,
        db: Session,
    ) -> str:
        """
        Ensure Conversation.raw_text is populated and transcript_status='ready'.
        Returns the transcript text.
        Sync adapters block. Async adapters raise NotImplementedError until
        the integration is implemented.
        """
        ...
