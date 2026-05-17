import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import MediaReference


def get(db: Session, media_id: uuid.UUID) -> MediaReference | None:
    return db.get(MediaReference, media_id)


def get_for_source_event(db: Session, source_event_id: uuid.UUID) -> MediaReference | None:
    return db.scalars(
        select(MediaReference)
        .where(MediaReference.source_event_id == source_event_id)
        .limit(1)
    ).first()


def list_for_conversation(db: Session, conversation_id: uuid.UUID) -> list[MediaReference]:
    return list(
        db.scalars(
            select(MediaReference)
            .where(MediaReference.conversation_id == conversation_id)
            .order_by(MediaReference.created_at.asc())
        ).all()
    )


def mark_processing(db: Session, media: MediaReference) -> None:
    media.transcription_status = "processing"
    db.flush()


def mark_completed(
    db: Session,
    media: MediaReference,
    transcript_text: str,
    duration_seconds: int | None,
    whisper_response: dict[str, Any] | None,
) -> None:
    media.transcription_status = "completed"
    media.transcript_text = transcript_text
    media.duration_seconds = duration_seconds
    media.whisper_response = whisper_response
    db.flush()


def mark_failed(db: Session, media: MediaReference, error_message: str) -> None:
    media.transcription_status = "failed"
    db.flush()
