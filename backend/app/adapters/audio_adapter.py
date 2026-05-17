"""
Audio upload adapter.

ingest():            Creates pending Conversation + SourceEvent + MediaReference.
produce_transcript(): Loads audio bytes → Whisper → updates MediaReference + Conversation.
"""

import uuid

from sqlalchemy.orm import Session

from app.adapters.base import AudioPayload, IngestionResult
from app.config import settings
from app.db.models import Conversation, MediaReference, SourceEvent
from app.repositories import media_ref_repo
from app.services import storage_service, whisper_client


class AudioAdapter:
    source_type = "audio"
    ingestion_mode = "sync"

    def ingest(
        self,
        payload: AudioPayload,
        db: Session,
        actor_id: str = "system",
    ) -> IngestionResult:
        org = uuid.UUID(settings.default_org_id)

        conversation = Conversation(
            org_id=org,
            source_type="audio",
            transcript_status="pending",
            status="raw",
            raw_text=None,
            char_count=None,
            job_id=payload.job_id,
            job_reference=payload.job_reference,
        )
        db.add(conversation)
        db.flush()

        event = SourceEvent(
            org_id=org,
            source_type="audio",
            raw_payload={
                "storage_key": payload.storage_key,
                "mime_type": payload.mime_type,
                "size_bytes": payload.size_bytes,
            },
            status="received",
            conversation_id=conversation.id,
        )
        db.add(event)
        db.flush()

        media = MediaReference(
            org_id=org,
            conversation_id=conversation.id,
            source_event_id=event.id,
            ref_type="audio_upload",
            storage_key=payload.storage_key,
            mime_type=payload.mime_type,
            size_bytes=payload.size_bytes,
            transcription_status="pending",
        )
        db.add(media)
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
        """
        Load audio from storage, call Whisper, persist result, update Conversation.

        Returns the transcript text. Raises on storage or API failure.
        """
        media = media_ref_repo.get_for_source_event(db, source_event_id)
        if media is None:
            raise ValueError(f"No MediaReference found for source_event_id={source_event_id}")

        event = db.get(SourceEvent, source_event_id)
        conversation = db.get(Conversation, event.conversation_id)

        # Mark in-flight
        media_ref_repo.mark_processing(db, media)
        event.status = "processing"
        db.flush()

        try:
            storage = storage_service.get_audio_storage()
            file_bytes = storage.open(media.storage_key)

            result = whisper_client.transcribe(
                file_bytes=file_bytes,
                filename=media.storage_key,
                mime_type=media.mime_type or "audio/mpeg",
            )
        except Exception:
            media_ref_repo.mark_failed(db, media, "transcription_failed")
            event.status = "failed"
            db.commit()
            raise

        media_ref_repo.mark_completed(
            db,
            media,
            transcript_text=result.text,
            duration_seconds=result.duration_seconds,
            whisper_response=result.raw_response,
        )

        # Promote conversation to ready
        conversation.raw_text = result.text
        conversation.char_count = len(result.text)
        conversation.transcript_status = "ready"
        event.status = "ready"
        db.flush()
        db.commit()

        db.refresh(conversation)
        return result.text
