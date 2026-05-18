"""
POST /api/audio — multipart audio upload endpoint.

Flow:
  1. Validate MIME type and file size.
  2. Persist bytes to local storage via LocalFileStorage.
  3. Call AudioAdapter.ingest() — creates pending Conversation + SourceEvent + MediaReference.
  4. Call AudioAdapter.produce_transcript() — calls Whisper, promotes Conversation to ready.
  5. Return AudioIngestResponse with conversation_id for the frontend to redirect.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.adapters.audio_adapter import AudioAdapter
from app.adapters.base import AudioPayload
from app.api.deps import get_current_org_id
from app.config import settings
from app.db.session import get_db
from app.domain.api_schemas import AudioIngestResponse
from app.repositories import conversation_repo
from app.services.storage_service import get_audio_storage

router = APIRouter()

_ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "audio/flac",
    "audio/x-flac",
}

_audio_adapter = AudioAdapter()


@router.post("/audio", response_model=AudioIngestResponse, status_code=201)
async def upload_audio(
    file: UploadFile,
    job_reference: str | None = None,
    job_id: str | None = None,
    recruiter_id: str | None = None,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> AudioIngestResponse:
    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported audio format: {content_type!r}. "
                f"Accepted: {', '.join(sorted(_ALLOWED_MIME_TYPES))}."
            ),
        )

    data = await file.read()
    if len(data) > settings.max_audio_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"File is {len(data):,} bytes. "
                f"Maximum allowed is {settings.max_audio_bytes:,} bytes (25 MB)."
            ),
        )

    storage = get_audio_storage()
    storage_key = storage.save(data, file.filename or "upload.audio")

    parsed_job_id = uuid.UUID(job_id) if job_id else None

    payload = AudioPayload(
        storage_key=storage_key,
        mime_type=content_type,
        size_bytes=len(data),
        job_reference=job_reference,
        job_id=parsed_job_id,
    )

    ingest_result = _audio_adapter.ingest(payload, db, org_id=org_id)

    try:
        _audio_adapter.produce_transcript(ingest_result.source_event_id, db)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Audio transcription failed: {exc}",
        )

    conv = conversation_repo.get(db, ingest_result.conversation_id)

    return AudioIngestResponse(
        conversation_id=ingest_result.conversation_id,
        source_event_id=ingest_result.source_event_id,
        transcript_status=conv.transcript_status,
        transcript_ready=conv.transcript_status == "ready",
    )
