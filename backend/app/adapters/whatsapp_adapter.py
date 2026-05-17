"""
WhatsApp adapter — stub.

ingest():           Creates pending Conversation + SourceEvent.
                    external_id = WhatsApp thread_id.
                    No MediaReference — messages are text, not audio.
produce_transcript(): NOT YET IMPLEMENTED — will join messages into a transcript when built.
"""

import uuid

from sqlalchemy.orm import Session

from app.adapters.base import IngestionResult, WhatsAppPayload
from app.config import settings
from app.db.models import Conversation, SourceEvent


class WhatsAppAdapter:
    source_type = "whatsapp"
    ingestion_mode = "async"

    def ingest(
        self,
        payload: WhatsAppPayload,
        db: Session,
        actor_id: str = "system",
    ) -> IngestionResult:
        org = uuid.UUID(settings.default_org_id)

        conversation = Conversation(
            org_id=org,
            source_type="whatsapp",
            transcript_status="pending",
            status="raw",
            raw_text=None,
            char_count=None,
            job_id=payload.job_id,
            job_reference=payload.job_reference,
            source_metadata={"thread_id": payload.thread_id, "message_count": len(payload.messages)},
        )
        db.add(conversation)
        db.flush()

        event = SourceEvent(
            org_id=org,
            source_type="whatsapp",
            external_id=payload.thread_id,
            raw_payload={
                "thread_id": payload.thread_id,
                "message_count": len(payload.messages),
            },
            status="received",
            conversation_id=conversation.id,
        )
        db.add(event)
        db.flush()
        db.commit()
        db.refresh(event)
        db.refresh(conversation)

        return IngestionResult(
            source_event_id=event.id,
            conversation_id=conversation.id,
            transcript_ready=False,
        )

    def produce_transcript(self, source_event_id: uuid.UUID, db: Session) -> str:
        raise NotImplementedError(
            "WhatsApp message joining is not yet implemented. "
            "Implement WhatsAppAdapter.produce_transcript() to join messages into a single transcript."
        )
