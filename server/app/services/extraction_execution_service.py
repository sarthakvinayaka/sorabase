"""Run staffing extraction against a stored transcript and persist versioned rows."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import (
    AuditActorType,
    CandidateApprovalStatus,
    CandidateAtsSyncStatus,
    CandidateExtractionStatus,
    CandidateProcessingStage,
    ExtractionRunStatus,
    ExtractedFieldSource,
    ExtractedFieldStatus,
    TranscriptStatus,
)
from app.db.models.audit_log import AuditLog
from app.db.models.audio_upload import AudioUpload
from app.db.models.candidate_record import CandidateRecord
from app.db.models.extraction_run import ExtractionRun
from app.db.models.extracted_field import ExtractedField
from app.db.models.field_evidence import FieldEvidence
from app.db.models.transcript import Transcript
from app.schemas.extraction_pipeline import ExtractionTriggerResponse, LatestExtractionRunDTO, UploadPipelineDTO
from app.schemas.staffing_extraction import STAFFING_EXTRACTION_FIELD_KEYS, StaffingExtractionOutput
from app.services.extraction.errors import ExtractionExecutionError, ExtractionProviderRuntimeError
from app.services.extraction.factory import get_staffing_extraction_provider
from app.services.extraction.staffing_extraction_post import apply_staffing_extraction_post_processing
from app.services.extraction.protocol import StaffingExtractionProvider


def _serialize_field_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _mean_confidence(output: StaffingExtractionOutput) -> float:
    vals: list[float] = []
    for key in STAFFING_EXTRACTION_FIELD_KEYS:
        block = getattr(output.fields, key)
        vals.append(float(block.confidence))
    if not vals:
        return 0.0
    return round(sum(vals) / len(vals), 5)


def _segment_id_for_index(transcript: Transcript, sequence_index: int | None) -> uuid.UUID | None:
    if sequence_index is None:
        return None
    for seg in transcript.segments or []:
        if seg.sequence_index == sequence_index:
            return seg.id
    return None


def _char_span(full_text: str, quote: str | None) -> tuple[int | None, int | None]:
    if not quote or not full_text:
        return None, None
    i = full_text.find(quote)
    if i < 0:
        return None, None
    return i, i + len(quote)


def _segments_tuples(transcript: Transcript) -> list[tuple[int, int, int, str, str]]:
    rows: list[tuple[int, int, int, str, str]] = []
    for seg in sorted(transcript.segments or [], key=lambda s: s.sequence_index):
        rows.append(
            (
                seg.sequence_index,
                seg.start_ms,
                seg.end_ms,
                seg.speaker_label or "",
                seg.text,
            ),
        )
    return rows


def _write_audit(
    session: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    actor_type: AuditActorType,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    metadata: dict[str, Any],
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_=metadata,
        ),
    )


class ExtractionExecutionService:
    def __init__(self, session: Session, provider: StaffingExtractionProvider | None = None) -> None:
        self._session = session
        self._provider = provider

    def _resolve_provider(self) -> StaffingExtractionProvider:
        """Use injected provider when present; otherwise resolve lazily (avoids API key on read-only paths)."""
        if self._provider is not None:
            return self._provider
        return get_staffing_extraction_provider()

    def get_primary_candidate_for_upload(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> CandidateRecord | None:
        stmt = (
            select(CandidateRecord)
            .where(
                CandidateRecord.audio_upload_id == upload_id,
                CandidateRecord.organization_id == organization_id,
            )
            .options(selectinload(CandidateRecord.extraction_runs))
            .order_by(CandidateRecord.created_at.asc())
            .limit(1)
        )
        return self._session.scalars(stmt).first()

    def get_pipeline_for_upload(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> UploadPipelineDTO | None:
        cand = self.get_primary_candidate_for_upload(upload_id=upload_id, organization_id=organization_id)
        if cand is None:
            return None
        runs = sorted(cand.extraction_runs or [], key=lambda r: r.run_index, reverse=True)
        latest = runs[0] if runs else None
        latest_dto: LatestExtractionRunDTO | None = None
        if latest is not None:
            meta = dict(latest.meta or {})
            latest_dto = LatestExtractionRunDTO(
                id=latest.id,
                run_index=latest.run_index,
                status=latest.status.value,
                provider_model=latest.provider_model,
                error_message=latest.error_message,
                missing_fields=list(meta.get("missing_fields") or []),
                ambiguous_fields=list(meta.get("ambiguous_fields") or []),
                created_at=latest.created_at,
                completed_at=latest.completed_at,
            )
        return UploadPipelineDTO(
            candidate_id=cand.id,
            processing_stage=cand.processing_stage.value,
            extraction_status=cand.extraction_status.value,
            approval_status=cand.approval_status.value,
            ats_sync_status=cand.ats_sync_status.value,
            confidence_overall=float(cand.confidence_overall) if cand.confidence_overall is not None else None,
            latest_extraction_run=latest_dto,
        )

    def _next_run_index(self, candidate_id: uuid.UUID) -> int:
        m = self._session.scalar(
            select(func.coalesce(func.max(ExtractionRun.run_index), 0)).where(
                ExtractionRun.candidate_record_id == candidate_id,
            ),
        )
        return int(m or 0) + 1

    def _supersede_prior_model_drafts(self, *, candidate_id: uuid.UUID, new_run_index: int) -> None:
        stmt = (
            select(ExtractedField)
            .join(ExtractionRun, ExtractionRun.id == ExtractedField.extraction_run_id)
            .where(
                ExtractionRun.candidate_record_id == candidate_id,
                ExtractionRun.run_index < new_run_index,
                ExtractedField.source == ExtractedFieldSource.MODEL,
                ExtractedField.status.in_(
                    (ExtractedFieldStatus.PENDING, ExtractedFieldStatus.DRAFT),
                ),
            )
        )
        for row in self._session.scalars(stmt):
            row.status = ExtractedFieldStatus.SUPERSEDED

    def run_extraction_for_upload(
        self,
        *,
        upload_id: uuid.UUID,
        organization_id: uuid.UUID,
        actor_user_id: uuid.UUID | None = None,
        actor_type: AuditActorType = AuditActorType.SYSTEM,
    ) -> ExtractionTriggerResponse:
        upload = self._session.scalar(
            select(AudioUpload).where(
                AudioUpload.id == upload_id,
                AudioUpload.organization_id == organization_id,
            ),
        )
        if upload is None:
            msg = "Upload not found"
            raise ValueError(msg)

        transcript = self._session.scalar(
            select(Transcript)
            .where(
                Transcript.audio_upload_id == upload_id,
                Transcript.status == TranscriptStatus.COMPLETE,
            )
            .options(selectinload(Transcript.segments))
            .order_by(Transcript.version.desc())
            .limit(1),
        )
        if transcript is None or not (transcript.segments or []):
            raise ExtractionExecutionError("A complete transcript with segments is required before extraction.")

        cand = self.get_primary_candidate_for_upload(upload_id=upload_id, organization_id=organization_id)
        if cand is None:
            cand = CandidateRecord(
                organization_id=organization_id,
                audio_upload_id=upload.id,
                created_by_recruiter_id=upload.uploaded_by_recruiter_id,
                primary_transcript_id=transcript.id,
                approval_status=CandidateApprovalStatus.NOT_STARTED,
                extraction_status=CandidateExtractionStatus.NONE,
                ats_sync_status=CandidateAtsSyncStatus.NONE,
                processing_stage=CandidateProcessingStage.TRANSCRIBED,
            )
            self._session.add(cand)
            self._session.flush()
        else:
            cand.primary_transcript_id = transcript.id
            if cand.processing_stage == CandidateProcessingStage.UPLOADED:
                cand.processing_stage = CandidateProcessingStage.TRANSCRIBED

        full_text = (transcript.full_text or "").strip()
        if not full_text and transcript.segments:
            full_text = "\n".join(s.text for s in sorted(transcript.segments, key=lambda s: s.sequence_index))

        run_index = self._next_run_index(cand.id)
        prov = self._resolve_provider()
        run = ExtractionRun(
            candidate_record_id=cand.id,
            run_index=run_index,
            status=ExtractionRunStatus.RUNNING,
            provider_model=prov.provider_id,
            provider_job_ref=None,
            error_message=None,
            completed_at=None,
            meta={"transcript_id": str(transcript.id)},
        )
        self._session.add(run)
        self._session.flush()

        cand.extraction_status = CandidateExtractionStatus.RUNNING

        try:
            tuples = _segments_tuples(transcript)
            output = prov.extract_staffing_profile(
                transcript_text=full_text,
                segments=tuples,
            )
            output = apply_staffing_extraction_post_processing(output, transcript_text=full_text)
        except Exception as exc:
            run.status = ExtractionRunStatus.FAILED
            run.error_message = str(exc)[:4000]
            cand.extraction_status = CandidateExtractionStatus.FAILED
            _write_audit(
                self._session,
                organization_id=organization_id,
                actor_user_id=actor_user_id,
                actor_type=actor_type,
                action="extraction.run_failed",
                entity_type="extraction_run",
                entity_id=run.id,
                metadata={"upload_id": str(upload_id), "error": str(exc)[:2000]},
            )
            self._session.flush()
            raise ExtractionProviderRuntimeError(str(exc)) from exc

        self._supersede_prior_model_drafts(candidate_id=cand.id, new_run_index=run_index)

        overall = _mean_confidence(output)
        meta = dict(run.meta or {})
        meta.update(
            {
                "missing_fields": list(output.missing_fields),
                "ambiguous_fields": list(output.ambiguous_fields),
                "suggested_follow_up_questions": list(output.suggested_follow_up_questions),
                "schema_version": output.schema_version,
                "transcript_id": str(transcript.id),
            },
        )

        for key in STAFFING_EXTRACTION_FIELD_KEYS:
            block = getattr(output.fields, key)
            serialized = _serialize_field_value(block.value)
            ef = ExtractedField(
                extraction_run_id=run.id,
                field_name=key,
                field_value=serialized,
                ai_extracted_value=serialized,
                confidence=round(float(block.confidence), 5),
                status=ExtractedFieldStatus.DRAFT,
                source=ExtractedFieldSource.MODEL,
                notes=block.ambiguity_note,
            )
            self._session.add(ef)
            self._session.flush()

            quote = block.evidence.quote if block.evidence and block.evidence.quote else ""
            seg_id = None
            if block.evidence:
                seg_id = _segment_id_for_index(transcript, block.evidence.segment_index)
            start_c, end_c = _char_span(full_text, block.evidence.quote if block.evidence else None)

            self._session.add(
                FieldEvidence(
                    extracted_field_id=ef.id,
                    transcript_id=transcript.id,
                    transcript_segment_id=seg_id,
                    span_start_char=start_c,
                    span_end_char=end_c,
                    evidence_text=quote or "(no quote — value null or withheld)",
                    model_confidence=float(block.confidence),
                    provider_span_ref=None,
                ),
            )

        run.status = ExtractionRunStatus.COMPLETE
        run.error_message = None
        run.completed_at = datetime.now(timezone.utc)
        run.meta = meta
        run.provider_model = prov.provider_id

        cand.extraction_status = CandidateExtractionStatus.COMPLETE
        cand.confidence_overall = overall
        cand.processing_stage = CandidateProcessingStage.NEEDS_REVIEW
        cand.approval_status = CandidateApprovalStatus.PENDING_REVIEW

        _write_audit(
            self._session,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            action="extraction.run_completed",
            entity_type="extraction_run",
            entity_id=run.id,
            metadata={
                "upload_id": str(upload_id),
                "candidate_id": str(cand.id),
                "run_index": run_index,
                "provider": prov.provider_id,
            },
        )

        self._session.flush()

        return ExtractionTriggerResponse(
            extraction_run_id=run.id,
            status=run.status.value,
            candidate_id=cand.id,
            processing_stage=cand.processing_stage.value,
            extraction_status=cand.extraction_status.value,
            approval_status=cand.approval_status.value,
            confidence_overall=overall,
            missing_fields=list(output.missing_fields),
            ambiguous_fields=list(output.ambiguous_fields),
        )
