"""Orchestrate ASR: persist transcripts + segments; update job and candidate pointers (not extraction rows)."""

from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import CandidateExtractionStatus, TranscriptJobStatus, TranscriptStatus
from app.db.enums import (
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateProcessingStage,
)
from app.db.models.audio_upload import AudioUpload
from app.db.models.candidate_record import CandidateRecord
from app.db.models.transcript import Transcript
from app.db.models.transcript_generation_job import TranscriptGenerationJob
from app.db.models.transcript_segment import TranscriptSegment
from app.services.transcription.protocol import TranscriptionProvider
from app.storage.base import FileStoragePort


def _latest_transcript_job(upload: AudioUpload) -> TranscriptGenerationJob | None:
    jobs = sorted(upload.transcript_jobs or [], key=lambda j: j.created_at, reverse=True)
    return jobs[0] if jobs else None


def _find_complete_transcript_v1(upload: AudioUpload) -> Transcript | None:
    for t in upload.transcripts or []:
        if t.version == 1 and t.status == TranscriptStatus.COMPLETE and t.segments:
            return t
    return None


class TranscriptionService:
    def __init__(
        self,
        session: Session,
        storage: FileStoragePort,
        provider: TranscriptionProvider,
    ) -> None:
        self._session = session
        self._storage = storage
        self._provider = provider

    def load_upload_scoped(self, *, upload_id: uuid.UUID, organization_id: uuid.UUID) -> AudioUpload | None:
        stmt = (
            select(AudioUpload)
            .where(AudioUpload.id == upload_id, AudioUpload.organization_id == organization_id)
            .options(
                selectinload(AudioUpload.transcript_jobs),
                selectinload(AudioUpload.transcripts).selectinload(Transcript.segments),
            )
        )
        return self._session.scalars(stmt).first()

    def get_transcript_for_upload(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Transcript | None:
        stmt = (
            select(Transcript)
            .join(AudioUpload, AudioUpload.id == Transcript.audio_upload_id)
            .where(
                AudioUpload.id == upload_id,
                AudioUpload.organization_id == organization_id,
                Transcript.version == 1,
                Transcript.status == TranscriptStatus.COMPLETE,
            )
            .options(selectinload(Transcript.segments))
        )
        return self._session.scalars(stmt).first()

    def get_transcript_for_candidate(
        self,
        *,
        candidate_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Transcript | None:
        cand = self._session.get(CandidateRecord, candidate_id)
        if cand is None or cand.organization_id != organization_id:
            return None
        if cand.primary_transcript_id is not None:
            stmt = (
                select(Transcript)
                .join(AudioUpload, AudioUpload.id == Transcript.audio_upload_id)
                .where(
                    Transcript.id == cand.primary_transcript_id,
                    AudioUpload.organization_id == organization_id,
                    Transcript.status == TranscriptStatus.COMPLETE,
                )
                .options(selectinload(Transcript.segments))
            )
            return self._session.scalars(stmt).first()
        return self.get_transcript_for_upload(upload_id=cand.audio_upload_id, organization_id=organization_id)

    def fail_transcription_job(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
        error_message: str,
    ) -> None:
        upload = self.load_upload_scoped(upload_id=upload_id, organization_id=organization_id)
        if upload is None:
            return
        job = _latest_transcript_job(upload)
        if job is None:
            job = TranscriptGenerationJob(audio_upload_id=upload.id, status=TranscriptJobStatus.FAILED, meta={})
            self._session.add(job)
        job.status = TranscriptJobStatus.FAILED
        job.error_message = error_message[:4000]

    def run_transcribe(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> tuple[Transcript, bool]:
        """Return `(transcript, idempotent)` — idempotent when a complete v1 transcript already exists."""
        upload = self.load_upload_scoped(upload_id=upload_id, organization_id=organization_id)
        if upload is None:
            msg = "Upload not found"
            raise ValueError(msg)

        existing = _find_complete_transcript_v1(upload)
        if existing is not None:
            job = _latest_transcript_job(upload)
            if job is not None:
                job.status = TranscriptJobStatus.COMPLETED
                job.error_message = None
                self._session.flush()
            cand_stmt = select(CandidateRecord).where(
                CandidateRecord.audio_upload_id == upload.id,
                CandidateRecord.organization_id == organization_id,
            )
            existing_cands = list(self._session.scalars(cand_stmt).all())
            for cand in existing_cands:
                cand.primary_transcript_id = existing.id
                cand.processing_stage = CandidateProcessingStage.TRANSCRIBED
                if cand.extraction_status == CandidateExtractionStatus.NONE:
                    cand.extraction_status = CandidateExtractionStatus.QUEUED
            if not existing_cands:
                self._session.add(
                    CandidateRecord(
                        organization_id=organization_id,
                        audio_upload_id=upload.id,
                        created_by_recruiter_id=upload.uploaded_by_recruiter_id,
                        primary_transcript_id=existing.id,
                        approval_status=CandidateApprovalStatus.NOT_STARTED,
                        extraction_status=CandidateExtractionStatus.QUEUED,
                        ats_sync_status=CandidateAtsSyncStatus.NONE,
                        processing_stage=CandidateProcessingStage.TRANSCRIBED,
                    ),
                )
            self._session.flush()
            return existing, True

        job = _latest_transcript_job(upload)
        if job is None:
            job = TranscriptGenerationJob(
                audio_upload_id=upload.id,
                status=TranscriptJobStatus.QUEUED,
                meta={},
            )
            self._session.add(job)
            self._session.flush()

        job.status = TranscriptJobStatus.IN_PROGRESS
        job.error_message = None
        self._session.flush()

        try:
            audio_bytes = self._storage.read_bytes(upload.storage_key)
        except FileNotFoundError:
            audio_bytes = None

        result = self._provider.transcribe(upload=upload, audio_bytes=audio_bytes)

        self._session.execute(
            delete(Transcript).where(Transcript.audio_upload_id == upload.id, Transcript.version == 1),
        )

        transcript = Transcript(
            audio_upload_id=upload.id,
            version=1,
            language=result.language,
            provider=result.provider_id,
            full_text=result.full_text,
            status=TranscriptStatus.COMPLETE,
        )
        self._session.add(transcript)
        self._session.flush()

        for seg in result.segments:
            self._session.add(
                TranscriptSegment(
                    transcript_id=transcript.id,
                    sequence_index=seg.sequence_index,
                    start_ms=seg.start_ms,
                    end_ms=seg.end_ms,
                    speaker_label=seg.speaker_label,
                    text=seg.text,
                ),
            )

        job.status = TranscriptJobStatus.COMPLETED
        job.error_message = None
        meta = dict(job.meta or {})
        meta.update(
            {
                "provider": result.provider_id,
                "segment_count": len(result.segments),
                "language": result.language,
            },
        )
        job.meta = meta

        cand_stmt = select(CandidateRecord).where(
            CandidateRecord.audio_upload_id == upload.id,
            CandidateRecord.organization_id == organization_id,
        )
        existing = list(self._session.scalars(cand_stmt).all())
        for cand in existing:
            cand.primary_transcript_id = transcript.id
            cand.processing_stage = CandidateProcessingStage.TRANSCRIBED
            if cand.extraction_status == CandidateExtractionStatus.NONE:
                cand.extraction_status = CandidateExtractionStatus.QUEUED
        if not existing:
            self._session.add(
                CandidateRecord(
                    organization_id=organization_id,
                    audio_upload_id=upload.id,
                    created_by_recruiter_id=upload.uploaded_by_recruiter_id,
                    primary_transcript_id=transcript.id,
                    approval_status=CandidateApprovalStatus.NOT_STARTED,
                    extraction_status=CandidateExtractionStatus.QUEUED,
                    ats_sync_status=CandidateAtsSyncStatus.NONE,
                    processing_stage=CandidateProcessingStage.TRANSCRIBED,
                ),
            )

        self._session.refresh(transcript, attribute_names=["segments"])
        return transcript, False

    def ingest_manual_transcript(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
        full_text: str,
    ) -> Transcript:
        """Persist caller-supplied text as a completed v1 transcript (one segment). Updates job + candidate like ASR."""
        text = (full_text or "").strip()
        if not text:
            msg = "Transcript text is empty"
            raise ValueError(msg)

        upload = self.load_upload_scoped(upload_id=upload_id, organization_id=organization_id)
        if upload is None:
            msg = "Upload not found"
            raise ValueError(msg)

        job = _latest_transcript_job(upload)
        if job is None:
            job = TranscriptGenerationJob(
                audio_upload_id=upload.id,
                status=TranscriptJobStatus.QUEUED,
                meta={},
            )
            self._session.add(job)
            self._session.flush()

        job.status = TranscriptJobStatus.IN_PROGRESS
        job.error_message = None
        self._session.flush()

        self._session.execute(
            delete(Transcript).where(Transcript.audio_upload_id == upload.id, Transcript.version == 1),
        )

        transcript = Transcript(
            audio_upload_id=upload.id,
            version=1,
            language="en",
            provider="manual",
            full_text=text,
            status=TranscriptStatus.COMPLETE,
        )
        self._session.add(transcript)
        self._session.flush()

        est_ms = max(1000, min(3_600_000, len(text) * 50))
        self._session.add(
            TranscriptSegment(
                transcript_id=transcript.id,
                sequence_index=0,
                start_ms=0,
                end_ms=est_ms,
                speaker_label=None,
                text=text,
            ),
        )

        job.status = TranscriptJobStatus.COMPLETED
        job.error_message = None
        meta = dict(job.meta or {})
        meta.update({"source": "manual", "segment_count": 1})
        job.meta = meta

        cand_stmt = select(CandidateRecord).where(
            CandidateRecord.audio_upload_id == upload.id,
            CandidateRecord.organization_id == organization_id,
        )
        existing_cands = list(self._session.scalars(cand_stmt).all())
        for cand in existing_cands:
            cand.primary_transcript_id = transcript.id
            cand.processing_stage = CandidateProcessingStage.TRANSCRIBED
            if cand.extraction_status == CandidateExtractionStatus.NONE:
                cand.extraction_status = CandidateExtractionStatus.QUEUED
        if not existing_cands:
            self._session.add(
                CandidateRecord(
                    organization_id=organization_id,
                    audio_upload_id=upload.id,
                    created_by_recruiter_id=upload.uploaded_by_recruiter_id,
                    primary_transcript_id=transcript.id,
                    approval_status=CandidateApprovalStatus.NOT_STARTED,
                    extraction_status=CandidateExtractionStatus.QUEUED,
                    ats_sync_status=CandidateAtsSyncStatus.NONE,
                    processing_stage=CandidateProcessingStage.TRANSCRIBED,
                ),
            )

        self._session.refresh(transcript, attribute_names=["segments"])
        return transcript
