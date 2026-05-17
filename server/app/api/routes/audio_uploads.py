from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.audio_upload import (
    AudioUploadCreateResponse,
    AudioUploadDTO,
    transcript_job_to_dto,
    upload_to_dto,
)
from app.services.audio_upload_service import AudioUploadService
from app.services.extraction_execution_service import ExtractionExecutionService
from app.storage.factory import get_local_file_storage
from app.storage.local import LocalFileStorage

router = APIRouter(prefix="/audio", tags=["audio"])


def get_storage() -> LocalFileStorage:
    return get_local_file_storage()


@router.post("/uploads", response_model=AudioUploadCreateResponse)
async def create_audio_upload(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    recruiter_id: Annotated[uuid.UUID, Form(description="Recruiter performing the upload (must exist).")],
    file: Annotated[UploadFile, File(description="Screening call audio")],
    job_reference: Annotated[str | None, Form()] = None,
    upload_notes: Annotated[str | None, Form()] = None,
) -> AudioUploadCreateResponse:
    data = await file.read()
    service = AudioUploadService(db, storage)
    try:
        upload, job = service.create_upload(
            recruiter_id=recruiter_id,
            file_bytes=data,
            original_filename=file.filename,
            content_type=file.content_type,
            job_reference=job_reference,
            upload_notes=upload_notes,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AudioUploadCreateResponse(
        upload=upload_to_dto(upload, pipeline=None),
        processing=transcript_job_to_dto(job),
    )


@router.get("/uploads", response_model=list[AudioUploadDTO])
def list_audio_uploads(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    organization_id: Annotated[uuid.UUID, Query()],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[AudioUploadDTO]:
    service = AudioUploadService(db, storage)
    rows = service.list_recent(organization_id=organization_id, limit=limit)
    return [upload_to_dto(r, pipeline=None) for r in rows]


@router.get("/uploads/{upload_id}", response_model=AudioUploadDTO)
def get_audio_upload(
    db: Annotated[Session, Depends(get_db)],
    storage: Annotated[LocalFileStorage, Depends(get_storage)],
    upload_id: uuid.UUID,
    organization_id: Annotated[uuid.UUID, Query(description="Tenant scope for authorization.")],
) -> AudioUploadDTO:
    service = AudioUploadService(db, storage)
    upload = service.get_upload(upload_id=upload_id, organization_id=organization_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    pipeline = ExtractionExecutionService(db).get_pipeline_for_upload(
        upload_id=upload_id,
        organization_id=organization_id,
    )
    return upload_to_dto(upload, pipeline=pipeline)
