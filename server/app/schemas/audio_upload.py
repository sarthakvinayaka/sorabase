from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models.audio_upload import AudioUpload
from app.schemas.extraction_pipeline import UploadPipelineDTO


class TranscriptJobDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    error_message: str | None = None
    meta: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class AudioUploadDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    recruiter_id: uuid.UUID | None
    storage_key: str
    original_filename: str | None
    content_type: str | None
    byte_size: int | None
    status: str
    job_reference: str | None
    upload_notes: str | None
    checksum_sha256: str | None
    created_at: datetime
    updated_at: datetime
    transcript_job: TranscriptJobDTO | None = None
    candidate_pipeline: UploadPipelineDTO | None = None


class AudioUploadCreateResponse(BaseModel):
    upload: AudioUploadDTO
    processing: TranscriptJobDTO


def _latest_job(upload: AudioUpload):
    jobs = sorted(upload.transcript_jobs or [], key=lambda j: j.created_at, reverse=True)
    return jobs[0] if jobs else None


def transcript_job_to_dto(job) -> TranscriptJobDTO:
    return TranscriptJobDTO(
        id=job.id,
        status=job.status.value,
        error_message=job.error_message,
        meta=dict(job.meta or {}),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def upload_to_dto(upload: AudioUpload, *, pipeline: UploadPipelineDTO | None = None) -> AudioUploadDTO:
    j = _latest_job(upload)
    return AudioUploadDTO(
        id=upload.id,
        organization_id=upload.organization_id,
        recruiter_id=upload.uploaded_by_recruiter_id,
        storage_key=upload.storage_key,
        original_filename=upload.original_filename,
        content_type=upload.content_type,
        byte_size=upload.byte_size,
        status=upload.status.value,
        job_reference=upload.job_reference,
        upload_notes=upload.upload_notes,
        checksum_sha256=upload.checksum_sha256,
        created_at=upload.created_at,
        updated_at=upload.updated_at,
        transcript_job=transcript_job_to_dto(j) if j else None,
        candidate_pipeline=pipeline,
    )
