"""Recruiter review: load bundle, save edits, approve / reject (transcript vs extraction stays isolated)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.enums import (
    AuditActorType,
    CandidateApprovalStatus,
    CandidateExtractionStatus,
    CandidateProcessingStage,
    ExtractionRunStatus,
    ExtractedFieldSource,
    ExtractedFieldStatus,
)
from app.db.models.audit_log import AuditLog
from app.db.models.candidate_record import CandidateRecord
from app.db.models.extraction_run import ExtractionRun
from app.db.models.extracted_field import ExtractedField
from app.db.models.user import User
from app.domain.staffing_field_groups import group_for_field
from app.schemas.candidate_review import (
    AuditTimelineEntryDTO,
    AuditTimelineResponse,
    ReviewActionResponse,
    ReviewBundleResponse,
    ReviewCandidateDTO,
    ReviewEvidenceDTO,
    ReviewFieldDTO,
    ReviewFieldUpdateItem,
    ReviewLatestRunDTO,
)
from app.schemas.transcription import transcript_to_dto
from app.services.transcription.factory import get_transcription_provider
from app.services.transcription_service import TranscriptionService
from app.storage.factory import get_local_file_storage


def _audit(
    session: Session,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    metadata: dict[str, Any],
) -> None:
    session.add(
        AuditLog(
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            actor_type=AuditActorType.USER if actor_user_id else AuditActorType.SYSTEM,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_=metadata,
        ),
    )


class CandidateReviewService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _require_candidate(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> CandidateRecord:
        cand = self._session.get(CandidateRecord, candidate_id)
        if cand is None or cand.organization_id != organization_id:
            msg = "Candidate not found"
            raise ValueError(msg)
        return cand

    def _require_user(self, editor_user_id: uuid.UUID) -> None:
        if self._session.get(User, editor_user_id) is None:
            msg = "Editor user not found"
            raise ValueError(msg)

    def _latest_complete_run(self, candidate_id: uuid.UUID) -> ExtractionRun | None:
        stmt = (
            select(ExtractionRun)
            .where(
                ExtractionRun.candidate_record_id == candidate_id,
                ExtractionRun.status == ExtractionRunStatus.COMPLETE,
            )
            .options(selectinload(ExtractionRun.extracted_fields).selectinload(ExtractedField.evidences))
            .order_by(ExtractionRun.run_index.desc())
            .limit(1)
        )
        return self._session.scalars(stmt).first()

    def get_bundle(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> ReviewBundleResponse:
        cand = self._require_candidate(candidate_id=candidate_id, organization_id=organization_id)
        ts = TranscriptionService(self._session, get_local_file_storage(), get_transcription_provider())
        transcript = ts.get_transcript_for_candidate(candidate_id=candidate_id, organization_id=organization_id)

        run = self._latest_complete_run(candidate_id)
        fields_out: list[ReviewFieldDTO] = []
        run_dto: ReviewLatestRunDTO | None = None
        if run is not None:
            meta = dict(run.meta or {})
            missing = set(meta.get("missing_fields") or [])
            ambiguous = set(meta.get("ambiguous_fields") or [])
            run_dto = ReviewLatestRunDTO(
                id=run.id,
                run_index=run.run_index,
                status=run.status.value,
                missing_fields=sorted(missing),
                ambiguous_fields=sorted(ambiguous),
                provider_model=run.provider_model,
            )
            for ef in sorted(run.extracted_fields or [], key=lambda x: x.field_name):
                if ef.status == ExtractedFieldStatus.SUPERSEDED:
                    continue
                conf = float(ef.confidence) if ef.confidence is not None else None
                needs = (
                    ef.field_name in missing
                    or ef.field_name in ambiguous
                    or (conf is not None and conf < 0.75)
                    or ef.status in (ExtractedFieldStatus.DRAFT, ExtractedFieldStatus.PENDING)
                )
                evs = [
                    ReviewEvidenceDTO(
                        id=e.id,
                        evidence_text=e.evidence_text,
                        model_confidence=float(e.model_confidence) if e.model_confidence is not None else None,
                    )
                    for e in (ef.evidences or [])
                ]
                fields_out.append(
                    ReviewFieldDTO(
                        id=ef.id,
                        field_name=ef.field_name,
                        group=group_for_field(ef.field_name),
                        field_value=ef.field_value,
                        ai_extracted_value=ef.ai_extracted_value,
                        confidence=conf,
                        status=ef.status.value,
                        source=ef.source.value,
                        edited_at=ef.edited_at,
                        edited_by_user_id=ef.edited_by_user_id,
                        evidence_snippets=evs,
                        is_missing_from_model=ef.field_name in missing,
                        is_ambiguous_from_model=ef.field_name in ambiguous,
                        needs_attention=needs,
                    ),
                )

        cand_dto = ReviewCandidateDTO(
            id=cand.id,
            organization_id=cand.organization_id,
            audio_upload_id=cand.audio_upload_id,
            processing_stage=cand.processing_stage.value,
            approval_status=cand.approval_status.value,
            extraction_status=cand.extraction_status.value,
        )
        return ReviewBundleResponse(
            candidate=cand_dto,
            transcript=transcript_to_dto(transcript) if transcript else None,
            latest_extraction_run=run_dto,
            fields=fields_out,
            audio_upload_id=cand.audio_upload_id,
        )

    def get_audit_timeline(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> AuditTimelineResponse:
        self._require_candidate(candidate_id=candidate_id, organization_id=organization_id)
        cid = str(candidate_id)
        stmt = (
            select(AuditLog)
            .where(AuditLog.organization_id == organization_id)
            .where(
                or_(
                    and_(AuditLog.entity_type == "candidate_record", AuditLog.entity_id == candidate_id),
                    and_(
                        AuditLog.action == "extraction.run_completed",
                        AuditLog.metadata_.contains({"candidate_id": cid}),
                    ),
                ),
            )
            .order_by(AuditLog.created_at.asc())
        )
        rows = self._session.scalars(stmt).all()
        entries = [
            AuditTimelineEntryDTO(
                id=log.id,
                created_at=log.created_at,
                action=log.action,
                actor_type=log.actor_type.value,
                actor_user_id=log.actor_user_id,
                metadata=dict(log.metadata_ or {}),
            )
            for log in rows
        ]
        return AuditTimelineResponse(entries=entries)

    def save_field_updates(
        self,
        *,
        candidate_id: uuid.UUID,
        organization_id: uuid.UUID,
        editor_user_id: uuid.UUID,
        updates: list[ReviewFieldUpdateItem],
    ) -> int:
        cand = self._require_candidate(candidate_id=candidate_id, organization_id=organization_id)
        self._require_user(editor_user_id)
        run = self._latest_complete_run(candidate_id)
        if run is None:
            msg = "No completed extraction run to edit"
            raise ValueError(msg)

        allowed_ids = {f.id for f in run.extracted_fields if f.status != ExtractedFieldStatus.SUPERSEDED}
        now = datetime.now(timezone.utc)
        changed = 0
        for u in updates:
            if u.extracted_field_id not in allowed_ids:
                msg = "Extracted field does not belong to the latest extraction run"
                raise ValueError(msg)
            ef = self._session.get(ExtractedField, u.extracted_field_id)
            if ef is None:
                continue
            new_val = u.field_value
            if (ef.field_value or "") == (new_val or ""):
                continue
            old_val = ef.field_value
            if ef.ai_extracted_value is None:
                ef.ai_extracted_value = old_val
            ef.field_value = new_val
            ef.source = ExtractedFieldSource.HUMAN_EDIT
            ef.status = ExtractedFieldStatus.DRAFT
            ef.edited_by_user_id = editor_user_id
            ef.edited_at = now
            changed += 1
            _audit(
                self._session,
                organization_id=organization_id,
                actor_user_id=editor_user_id,
                action="review.field_edited",
                entity_type="candidate_record",
                entity_id=cand.id,
                metadata={
                    "field_name": ef.field_name,
                    "extracted_field_id": str(ef.id),
                    "old_value": old_val,
                    "new_value": new_val,
                    "source": "human_edit",
                    "extraction_run_id": str(run.id),
                },
            )
        return changed

    def approve(
        self,
        *,
        candidate_id: uuid.UUID,
        organization_id: uuid.UUID,
        editor_user_id: uuid.UUID,
    ) -> ReviewActionResponse:
        cand = self._require_candidate(candidate_id=candidate_id, organization_id=organization_id)
        self._require_user(editor_user_id)
        if cand.approval_status == CandidateApprovalStatus.APPROVED:
            self._session.refresh(cand)
            return ReviewActionResponse(
                approval_status=cand.approval_status.value,
                processing_stage=cand.processing_stage.value,
            )
        run = self._latest_complete_run(candidate_id)
        if run is None:
            msg = "No completed extraction run to approve against"
            raise ValueError(msg)

        prev_approval = cand.approval_status.value
        prev_stage = cand.processing_stage.value
        cand.approval_status = CandidateApprovalStatus.APPROVED
        cand.processing_stage = CandidateProcessingStage.APPROVED
        for ef in run.extracted_fields or []:
            if ef.status in (ExtractedFieldStatus.DRAFT, ExtractedFieldStatus.PENDING):
                ef.status = ExtractedFieldStatus.APPROVED

        _audit(
            self._session,
            organization_id=organization_id,
            actor_user_id=editor_user_id,
            action="review.approved",
            entity_type="candidate_record",
            entity_id=cand.id,
            metadata={
                "extraction_run_id": str(run.id),
                "previous_approval_status": prev_approval,
                "new_approval_status": cand.approval_status.value,
                "previous_processing_stage": prev_stage,
                "new_processing_stage": cand.processing_stage.value,
            },
        )
        self._session.refresh(cand)
        return ReviewActionResponse(
            approval_status=cand.approval_status.value,
            processing_stage=cand.processing_stage.value,
        )

    def reject(
        self,
        *,
        candidate_id: uuid.UUID,
        organization_id: uuid.UUID,
        editor_user_id: uuid.UUID,
        reason: str | None,
    ) -> ReviewActionResponse:
        cand = self._require_candidate(candidate_id=candidate_id, organization_id=organization_id)
        self._require_user(editor_user_id)
        if cand.approval_status == CandidateApprovalStatus.REJECTED:
            self._session.refresh(cand)
            return ReviewActionResponse(
                approval_status=cand.approval_status.value,
                processing_stage=cand.processing_stage.value,
            )
        prev_approval = cand.approval_status.value
        prev_stage = cand.processing_stage.value
        cand.approval_status = CandidateApprovalStatus.REJECTED
        # Rejected is a terminal approval decision; keep intake stage aligned with artifacts
        # (avoid `needs_review` + `rejected`, which breaks operational filters and queue semantics).
        if cand.extraction_status == CandidateExtractionStatus.COMPLETE:
            cand.processing_stage = CandidateProcessingStage.EXTRACTED
        elif cand.primary_transcript_id is not None:
            cand.processing_stage = CandidateProcessingStage.TRANSCRIBED
        else:
            cand.processing_stage = CandidateProcessingStage.UPLOADED

        _audit(
            self._session,
            organization_id=organization_id,
            actor_user_id=editor_user_id,
            action="review.rejected",
            entity_type="candidate_record",
            entity_id=cand.id,
            metadata={
                "reason": (reason or "")[:2000],
                "previous_approval_status": prev_approval,
                "new_approval_status": cand.approval_status.value,
                "previous_processing_stage": prev_stage,
                "new_processing_stage": cand.processing_stage.value,
            },
        )
        self._session.refresh(cand)
        return ReviewActionResponse(
            approval_status=cand.approval_status.value,
            processing_stage=cand.processing_stage.value,
        )
