from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import AudioUploadStatus, TranscriptJobStatus
from app.db.models.audio_upload import AudioUpload
from app.db.models.recruiter import Recruiter
from app.db.models.transcript_generation_job import TranscriptGenerationJob
from app.services.audio_upload_policy import normalize_content_type, validate_audio_upload
from app.storage.base import FileStoragePort

_CONTENT_EXT = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/m4a": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/webm": ".webm",
}


def _safe_filename(name: str | None) -> str:
    if not name:
        return "recording"
    base = Path(name).name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._") or "recording"
    return cleaned[:200]


def _extension_for_type(content_type: str | None) -> str:
    ct = normalize_content_type(content_type)
    return _CONTENT_EXT.get(ct or "", ".bin")


class AudioUploadService:
    def __init__(self, session: Session, storage: FileStoragePort) -> None:
        self._session = session
        self._storage = storage

    def _get_recruiter(self, recruiter_id: uuid.UUID) -> Recruiter:
        rec = self._session.get(Recruiter, recruiter_id)
        if rec is None:
            msg = "Recruiter not found"
            raise ValueError(msg)
        return rec

    def create_upload(
        self,
        *,
        recruiter_id: uuid.UUID,
        file_bytes: bytes,
        original_filename: str | None,
        content_type: str | None,
        job_reference: str | None,
        upload_notes: str | None,
    ) -> tuple[AudioUpload, TranscriptGenerationJob]:
        validate_audio_upload(content_type=content_type, byte_size=len(file_bytes))
        rec = self._get_recruiter(recruiter_id)
        ct = normalize_content_type(content_type)
        upload_id = uuid.uuid4()
        ext = _extension_for_type(ct)
        storage_rel = f"{rec.organization_id}/{upload_id}{ext}"
        checksum = hashlib.sha256(file_bytes).hexdigest()
        safe_name = _safe_filename(original_filename)
        display_name = safe_name + ext

        upload = AudioUpload(
            id=upload_id,
            organization_id=rec.organization_id,
            uploaded_by_recruiter_id=rec.id,
            storage_key=storage_rel,
            original_filename=display_name,
            content_type=ct,
            byte_size=len(file_bytes),
            duration_seconds=None,
            checksum_sha256=checksum,
            job_reference=job_reference.strip()[:512] if job_reference else None,
            upload_notes=upload_notes.strip() if upload_notes else None,
            status=AudioUploadStatus.PENDING,
        )
        job = TranscriptGenerationJob(
            audio_upload_id=upload_id,
            status=TranscriptJobStatus.QUEUED,
            error_message=None,
            meta={},
        )
        self._session.add_all([upload, job])
        self._session.flush()
        try:
            written = self._storage.write_bytes(storage_rel, file_bytes)
        except Exception as exc:
            self._session.rollback()
            msg = f"Storage failed: {exc}"
            raise ValueError(msg) from exc

        upload.storage_key = written
        upload.status = AudioUploadStatus.STORED
        job.status = TranscriptJobStatus.AWAITING_ASR
        job.meta = {
            "pipeline": "mvp_stub",
            "original_filename": original_filename,
            "message": "Transcription worker not configured; job is a placeholder.",
        }
        self._session.refresh(upload, attribute_names=["transcript_jobs"])
        return upload, job

    def get_upload(self, *, upload_id: uuid.UUID, organization_id: uuid.UUID) -> AudioUpload | None:
        stmt: Select[tuple[AudioUpload]] = (
            select(AudioUpload)
            .where(AudioUpload.id == upload_id, AudioUpload.organization_id == organization_id)
            .options(selectinload(AudioUpload.transcript_jobs))
        )
        return self._session.scalars(stmt).first()

    def list_recent(self, *, organization_id: uuid.UUID, limit: int = 20) -> list[AudioUpload]:
        stmt = (
            select(AudioUpload)
            .where(AudioUpload.organization_id == organization_id)
            .options(selectinload(AudioUpload.transcript_jobs))
            .order_by(desc(AudioUpload.created_at))
            .limit(min(max(limit, 1), 100))
        )
        return list(self._session.scalars(stmt).all())
