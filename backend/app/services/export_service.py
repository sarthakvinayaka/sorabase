"""
Export service: builds the CandidateExport payload from a candidate's latest
extraction run. Business logic belongs here, not in the repository layer.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.domain.api_schemas import AnalysisRunRead, CandidateExport, ExportField
from app.repositories import analysis_repo, candidate_repo, draft_repo


def build_export(db: Session, candidate_id: uuid.UUID) -> CandidateExport | None:
    """
    Build the full export payload for a candidate. Returns None if the candidate
    does not exist or has no completed extraction run.
    """
    detail = candidate_repo.get_detail(db, candidate_id)
    if detail is None:
        return None

    export_fields: dict[str, ExportField] = {}
    for f in detail.fields:
        # Effective value precedence: reviewed → normalized → raw
        if f.edited and f.reviewed_value is not None:
            effective_value = f.reviewed_value
        elif f.normalized_value is not None:
            effective_value = f.normalized_value
        else:
            effective_value = f.raw_value

        export_fields[f.field_name] = ExportField(
            value=effective_value,
            source="human_edited" if f.edited else "ai_extracted",
            confidence=f.confidence,
            evidence_snippet=f.evidence_snippet,
            status=f.status,
        )

    latest_run = analysis_repo.get_latest_for_candidate(db, candidate_id)
    latest_analysis = AnalysisRunRead.model_validate(latest_run) if latest_run else None

    summary_draft_row = draft_repo.get_latest_by_type(db, candidate_id, "candidate_summary")
    submittal_draft_row = draft_repo.get_latest_by_type(db, candidate_id, "submittal")

    return CandidateExport(
        exported_at=datetime.now(timezone.utc),
        candidate_id=detail.candidate.id,
        conversation_id=detail.conversation.id,
        candidate_summary=detail.extraction.candidate_summary,
        missing_fields=detail.extraction.missing_fields,
        ambiguous_fields=detail.extraction.ambiguous_fields,
        suggested_follow_up_questions=detail.extraction.suggested_follow_up_questions,
        fields=export_fields,
        latest_analysis=latest_analysis,
        summary_draft=summary_draft_row.content if summary_draft_row else None,
        submittal_draft=submittal_draft_row.content if submittal_draft_row else None,
        submittal_draft_job_id=submittal_draft_row.analysis_run_id if submittal_draft_row else None,
    )
