from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.audio_uploads import get_storage
from app.schemas.transcription import TranscribeResponse, TranscriptDetailDTO, build_transcribe_response, transcript_to_dto
from app.services.audio_upload_service import AudioUploadService
from app.services.transcription.factory import get_transcription_provider
from app.services.transcription.protocol import TranscriptionProvider
from app.services.transcription_service import TranscriptionService
from app.storage.local import LocalFileStorage

router = APIRouter(tags=["transcription"])


def transcription_provider_dep() -> TranscriptionProvider:
    try:
        return get_transcription_provider()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/audio/uploads/{upload_id}/transcribe", response_model=TranscribeResponse)
def trigger_transcription(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    provider: Annotated[TranscriptionProvider, Depends(transcription_provider_dep)],
    upload_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> TranscribeResponse:
    svc = TranscriptionService(db, storage, provider)
    audio_svc = AudioUploadService(db, storage)
    try:
        transcript, idempotent = svc.run_transcribe(upload_id=upload_id, organization_id=organization_id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        TranscriptionService(db, storage, provider).fail_transcription_job(
            upload_id=upload_id,
            organization_id=organization_id,
            error_message=str(exc),
        )
        db.commit()
        raise HTTPException(status_code=500, detail="Transcription failed") from exc

    upload = audio_svc.get_upload(upload_id=upload_id, organization_id=organization_id)
    if upload is None:
        db.rollback()
        raise HTTPException(status_code=404, detail="Upload not found")

    resp = build_transcribe_response(idempotent=idempotent, transcript=transcript, upload=upload)
    db.commit()
    return resp


@router.get("/audio/uploads/{upload_id}/transcript", response_model=TranscriptDetailDTO)
def get_transcript_by_upload(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    upload_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> TranscriptDetailDTO:
    svc = TranscriptionService(db, storage, get_transcription_provider())
    t = svc.get_transcript_for_upload(upload_id=upload_id, organization_id=organization_id)
    if t is None or not t.segments:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript_to_dto(t)


@router.get("/candidates/{candidate_id}/transcript", response_model=TranscriptDetailDTO)
def get_transcript_by_candidate(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    candidate_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> TranscriptDetailDTO:
    svc = TranscriptionService(db, storage, get_transcription_provider())
    t = svc.get_transcript_for_candidate(candidate_id=candidate_id, organization_id=organization_id)
    if t is None or not t.segments:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript_to_dto(t)
