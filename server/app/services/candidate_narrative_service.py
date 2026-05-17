"""Versioned recruiter summary + submittal drafts (separate from extracted_fields)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.candidate_narrative_generation import CandidateNarrativeGeneration
from app.db.models.user import User
from app.schemas.candidate_narrative import NarrativeGenerationDTO, NarrativeHistoryResponse, NarrativeLatestResponse
from app.services.candidate_export_service import build_approved_export_payload
from app.services.candidate_narratives.rules_narrative_generator import GENERATOR_PROVIDER_ID, generate_rules_narrative
from app.services.transcription.factory import get_transcription_provider
from app.services.transcription_service import TranscriptionService
from app.storage.factory import get_local_file_storage


def _row_to_dto(row: CandidateNarrativeGeneration) -> NarrativeGenerationDTO:
    return NarrativeGenerationDTO(
        id=row.id,
        version=row.version,
        recruiter_summary=row.recruiter_summary,
        submittal_draft=row.submittal_draft,
        generator_provider=row.generator_provider,
        context_meta=dict(row.context_meta or {}),
        created_at=row.created_at,
        created_by_user_id=row.created_by_user_id,
    )


class CandidateNarrativeService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _require_user(self, user_id: uuid.UUID) -> None:
        if self._session.get(User, user_id) is None:
            msg = "User not found"
            raise ValueError(msg)

    def _assert_exportable(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        """Reuses export eligibility (approved + latest complete run + org scope)."""
        build_approved_export_payload(
            self._session,
            candidate_id=candidate_id,
            organization_id=organization_id,
        )

    def get_latest(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> NarrativeLatestResponse:
        self._assert_exportable(candidate_id=candidate_id, organization_id=organization_id)
        stmt = (
            select(CandidateNarrativeGeneration)
            .where(
                CandidateNarrativeGeneration.candidate_record_id == candidate_id,
                CandidateNarrativeGeneration.organization_id == organization_id,
            )
            .order_by(CandidateNarrativeGeneration.version.desc())
            .limit(1)
        )
        row = self._session.scalars(stmt).first()
        return NarrativeLatestResponse(generation=_row_to_dto(row) if row else None)

    def get_history(self, *, candidate_id: uuid.UUID, organization_id: uuid.UUID) -> NarrativeHistoryResponse:
        self._assert_exportable(candidate_id=candidate_id, organization_id=organization_id)
        stmt = (
            select(CandidateNarrativeGeneration)
            .where(
                CandidateNarrativeGeneration.candidate_record_id == candidate_id,
                CandidateNarrativeGeneration.organization_id == organization_id,
            )
            .order_by(CandidateNarrativeGeneration.version.desc())
        )
        rows = self._session.scalars(stmt).all()
        return NarrativeHistoryResponse(versions=[_row_to_dto(r) for r in rows])

    def generate(
        self,
        *,
        candidate_id: uuid.UUID,
        organization_id: uuid.UUID,
        editor_user_id: uuid.UUID,
    ) -> NarrativeGenerationDTO:
        self._require_user(editor_user_id)
        payload = build_approved_export_payload(
            self._session,
            candidate_id=candidate_id,
            organization_id=organization_id,
        )

        ts = TranscriptionService(self._session, get_local_file_storage(), get_transcription_provider())
        transcript = ts.get_transcript_for_candidate(candidate_id=candidate_id, organization_id=organization_id)
        transcript_text = transcript.full_text if transcript else ""

        summary, submittal, gen_meta = generate_rules_narrative(payload=payload, transcript_full_text=transcript_text)

        next_v = self._session.scalar(
            select(func.coalesce(func.max(CandidateNarrativeGeneration.version), 0)).where(
                CandidateNarrativeGeneration.candidate_record_id == candidate_id,
            ),
        )
        version = int(next_v or 0) + 1

        context_meta: dict[str, Any] = {
            **gen_meta,
            "export_schema_version": payload.get("export_schema_version"),
            "extraction_run_id": payload.get("extraction_run", {}).get("id"),
            "candidate_id": str(candidate_id),
        }

        row = CandidateNarrativeGeneration(
            candidate_record_id=candidate_id,
            organization_id=organization_id,
            version=version,
            recruiter_summary=summary,
            submittal_draft=submittal,
            generator_provider=GENERATOR_PROVIDER_ID,
            created_by_user_id=editor_user_id,
            context_meta=context_meta,
        )
        self._session.add(row)
        self._session.flush()
        return _row_to_dto(row)
