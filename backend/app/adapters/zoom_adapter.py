"""
Zoom webhook adapter.

ingest():            Creates pending Conversation + SourceEvent + MediaReference.
                     Stores download_token in SourceEvent.raw_payload for later use.
produce_transcript(): Downloads recording → LocalFileStorage → Whisper → cleanup.
                     Called from a FastAPI BackgroundTask, not inline in the webhook handler.
"""

import uuid

from sqlalchemy.orm import Session

from app.adapters.base import IngestionResult, ZoomWebhookPayload
from app.config import settings
from app.db.models import Conversation, MediaReference, SourceEvent
from app.repositories import media_ref_repo
from app.services import storage_service, whisper_client
from app.services import zoom_client


class ZoomAdapter:
    source_type = "zoom"
    ingestion_mode = "async"

    def ingest(
        self,
        payload: ZoomWebhookPayload,
        db: Session,
        actor_id: str = "system",
    ) -> IngestionResult:
        org = uuid.UUID(settings.default_org_id)

        conversation = Conversation(
            org_id=org,
            source_type="zoom",
            transcript_status="pending",
            status="raw",
            raw_text=None,
            char_count=None,
            job_id=payload.job_id,
            job_reference=payload.job_reference,
            source_metadata={
                "meeting_id": payload.meeting_id,
                "host_email": payload.host_email,
                "participants": payload.participants,
                "duration_seconds": payload.duration_seconds,
            },
        )
        db.add(conversation)
        db.flush()

        event = SourceEvent(
            org_id=org,
            source_type="zoom",
            external_id=payload.meeting_id,
            raw_payload={
                "meeting_id": payload.meeting_id,
                "host_email": payload.host_email,
                "participants": payload.participants,
                "duration_seconds": payload.duration_seconds,
                "started_at": payload.started_at.isoformat() if payload.started_at else None,
                "download_token": payload.download_token,
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
            ref_type="recording",
            storage_url=payload.recording_url,
            duration_seconds=payload.duration_seconds,
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
        Download the Zoom recording, transcribe via Whisper, update Conversation.

        Reads the download_token and recording URL from the persisted SourceEvent
        and MediaReference so it can be called from a background task with its own
        DB session, independently of the original webhook request.
        """
        event = db.get(SourceEvent, source_event_id)
        if event is None:
            raise ValueError(f"SourceEvent {source_event_id} not found")

        media = media_ref_repo.get_for_source_event(db, source_event_id)
        if media is None:
            raise ValueError(f"No MediaReference for source_event_id={source_event_id}")

        conversation = db.get(Conversation, event.conversation_id)

        raw = event.raw_payload or {}
        download_token: str | None = raw.get("download_token")
        recording_url: str | None = media.storage_url

        if not recording_url:
            raise ValueError(f"No recording URL stored for source_event_id={source_event_id}")

        media_ref_repo.mark_processing(db, media)
        event.status = "processing"
        db.flush()

        storage_key: str | None = None
        try:
            file_bytes = zoom_client.download_recording(recording_url, download_token)

            store = storage_service.get_audio_storage()
            storage_key = store.save(file_bytes, "zoom_recording.m4a")

            result = whisper_client.transcribe(
                file_bytes=file_bytes,
                filename="zoom_recording.m4a",
                mime_type="audio/m4a",
            )
        except Exception:
            media_ref_repo.mark_failed(db, media, "transcription_failed")
            event.status = "failed"
            db.commit()
            raise
        finally:
            # Always clean up the local audio file regardless of success/failure.
            if storage_key is not None:
                try:
                    store = storage_service.get_audio_storage()
                    store.delete(storage_key)
                except Exception:
                    pass

        media_ref_repo.mark_completed(
            db,
            media,
            transcript_text=result.text,
            duration_seconds=result.duration_seconds,
            whisper_response=result.raw_response,
        )

        conversation.raw_text = result.text
        conversation.char_count = len(result.text)
        conversation.transcript_status = "ready"
        event.status = "ready"
        db.flush()
        db.commit()

        db.refresh(conversation)
        return result.text
