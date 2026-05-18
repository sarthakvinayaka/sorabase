"""
Transcript adapter — the existing paste-text flow normalized to the adapter interface.

ingest():       Creates Conversation (transcript_status=ready) + SourceEvent in one transaction.
produce_transcript(): Returns raw_text already stored at ingest time; no extra work needed.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.adapters.base import IngestionResult, TranscriptPayload
from app.db.models import Conversation, SourceEvent


class TranscriptAdapter:
    source_type = "transcript"
    ingestion_mode = "sync"

    def ingest(
        self,
        payload: TranscriptPayload,
        db: Session,
        actor_id: str = "system",
        org_id: uuid.UUID | None = None,
    ) -> IngestionResult:
        conversation = Conversation(
            org_id=org_id,
            source_type="transcript",
            transcript_status="ready",
            status="raw",
            raw_text=payload.raw_text,
            char_count=len(payload.raw_text),
            recruiter_id=payload.recruiter_id,
            job_reference=payload.job_reference,
            job_id=payload.job_id,
        )
        db.add(conversation)
        db.flush()

        event = SourceEvent(
            org_id=org_id,
            source_type="transcript",
            # raw_payload stores metadata only — the text already lives in Conversation.raw_text.
            raw_payload={"char_count": len(payload.raw_text)},
            status="ready",
            conversation_id=conversation.id,
        )
        db.add(event)
        db.flush()
        db.commit()
        db.refresh(conversation)
        db.refresh(event)

        return IngestionResult(
            source_event_id=event.id,
            conversation_id=conversation.id,
            transcript_ready=True,
        )

    def produce_transcript(
        self,
        source_event_id: uuid.UUID,
        db: Session,
    ) -> str:
        event = db.get(SourceEvent, source_event_id)
        if event is None:
            raise ValueError(f"SourceEvent {source_event_id} not found.")
        conversation = db.get(Conversation, event.conversation_id)
        if conversation is None or conversation.raw_text is None:
            raise ValueError(f"Conversation for event {source_event_id} has no transcript text.")
        return conversation.raw_text
