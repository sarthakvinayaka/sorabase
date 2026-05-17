"""Opt-in dev route: create a minimal WAV upload + manual transcript (no real ASR)."""

from __future__ import annotations

import io
import uuid
import wave
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.audio_uploads import get_storage
from app.core.config import settings
from app.schemas.transcription import TranscribeResponse, build_transcribe_response
from app.services.audio_upload_service import AudioUploadService
from app.services.transcription.factory import get_transcription_provider
from app.services.transcription_service import TranscriptionService
from app.storage.local import LocalFileStorage

router = APIRouter(tags=["dev-demo"])


def _tiny_silence_wav_bytes() -> bytes:
    """Short mono PCM WAV; satisfies upload validation and gives storage a real object."""
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(8000)
        wf.writeframes(b"\x00\x00" * 800)
    return bio.getvalue()


class DemoFromTranscriptBody(BaseModel):
    full_text: str = Field(..., min_length=1, max_length=500_000)
    job_reference: str | None = None
    upload_notes: str | None = Field(None, max_length=8000)


@router.post("/recruiters/{recruiter_id}/demo-from-transcript", response_model=TranscribeResponse)
def demo_from_transcript(
    recruiter_id: uuid.UUID,
    body: DemoFromTranscriptBody,
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
) -> TranscribeResponse:
    if not settings.allow_transcript_only_demo:
        raise HTTPException(
            status_code=403,
            detail="Transcript-only demo is disabled. Set ALLOW_TRANSCRIPT_ONLY_DEMO=true in server environment.",
        )

    audio_svc = AudioUploadService(db, storage)
    ts_svc = TranscriptionService(db, storage, get_transcription_provider())
    tiny = _tiny_silence_wav_bytes()
    try:
        upload, _job = audio_svc.create_upload(
            recruiter_id=recruiter_id,
            file_bytes=tiny,
            original_filename="demo-silence.wav",
            content_type="audio/wav",
            job_reference=body.job_reference,
            upload_notes=body.upload_notes,
        )
        transcript = ts_svc.ingest_manual_transcript(
            upload_id=upload.id,
            organization_id=upload.organization_id,
            full_text=body.full_text,
        )
        u_final = audio_svc.get_upload(upload_id=upload.id, organization_id=upload.organization_id)
        if u_final is None:
            db.rollback()
            raise HTTPException(status_code=500, detail="Upload missing after demo insert")
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return build_transcribe_response(idempotent=False, transcript=transcript, upload=u_final)
