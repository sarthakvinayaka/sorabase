"""
Orchestrates one analysis run end to end:
  candidate fields + job description → OpenAI → persist → audit log

Does not own DB models — coordinates repositories and the analysis client.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AnalysisRun, Candidate, ExtractionRun, ExtractedField, Job, Conversation
from app.domain.extraction_schemas import EXTRACTION_FIELD_NAMES
from app.repositories import analysis_repo
from app.services import audit_service
from app.services.analysis_client import AnalysisError, AnalysisResult, analyze_candidate_fit


class CandidateNotFoundError(Exception):
    pass


class JobNotFoundError(Exception):
    pass


class ExtractionNotReadyError(Exception):
    pass


def build_candidate_profile(fields: list[ExtractedField]) -> str:
    """Format a candidate's extracted fields into a human-readable text block."""
    field_map = {f.field_name: f for f in fields}
    lines: list[str] = []

    for field_name in EXTRACTION_FIELD_NAMES:
        f = field_map.get(field_name)
        if f is None:
            continue
        label = field_name.replace("_", " ").title()
        effective = _effective_value(f)
        if effective is None:
            lines.append(f"{label}: [NOT MENTIONED — {f.status.upper()}]")
        elif isinstance(effective, list):
            lines.append(f"{label}: {', '.join(str(v) for v in effective)}")
        elif isinstance(effective, bool):
            lines.append(f"{label}: {'Yes' if effective else 'No'}")
        else:
            lines.append(f"{label}: {effective}")

    return "\n".join(lines)


def run_analysis(
    db: Session,
    candidate_id: uuid.UUID,
    job_id: uuid.UUID,
    actor_id: str = "recruiter",
) -> AnalysisRun:
    """
    Execute one analysis pipeline run.

    Returns the persisted AnalysisRun on success (status="completed").
    Raises CandidateNotFoundError, JobNotFoundError, or ExtractionNotReadyError.
    An AnalysisError from the LLM is caught and stored (status="failed").
    """
    candidate: Candidate | None = db.get(Candidate, candidate_id)
    if candidate is None:
        raise CandidateNotFoundError(f"Candidate {candidate_id} not found.")

    job: Job | None = db.get(Job, job_id)
    if job is None:
        raise JobNotFoundError(f"Job {job_id} not found.")

    if candidate.latest_extraction_run_id is None:
        raise ExtractionNotReadyError("Candidate has no completed extraction run.")

    extraction_run: ExtractionRun | None = db.get(ExtractionRun, candidate.latest_extraction_run_id)
    if extraction_run is None or extraction_run.status != "completed":
        raise ExtractionNotReadyError("Candidate extraction run is not completed.")

    fields = (
        db.query(ExtractedField)
        .filter(ExtractedField.extraction_run_id == extraction_run.id)
        .all()
    )

    conversation: Conversation | None = db.get(Conversation, extraction_run.conversation_id)
    transcript = (conversation.raw_text or "") if conversation else ""

    candidate_profile = build_candidate_profile(fields)

    analysis_run = analysis_repo.create(
        db,
        org_id=uuid.UUID(settings.default_org_id),
        extraction_run_id=extraction_run.id,
        candidate_id=candidate_id,
        job_id=job_id,
        status="pending",
    )

    try:
        result: AnalysisResult = analyze_candidate_fit(
            candidate_profile=candidate_profile,
            job_title=job.title,
            job_description=job.description or "",
            job_requirements=job.requirements or "",
            transcript=transcript,
        )
    except AnalysisError:
        analysis_run.status = "failed"
        db.commit()
        db.refresh(analysis_run)
        raise

    _apply_result(analysis_run, result)
    analysis_run.status = "completed"

    audit_service.log(
        db,
        entity_type="analysis_run",
        entity_id=analysis_run.id,
        action="analyzed",
        actor_id=actor_id,
        new_value={"model": result.model_used, "overall_score": result.response.overall_score},
        source="system",
    )

    db.commit()
    db.refresh(analysis_run)
    return analysis_run


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _effective_value(f: ExtractedField) -> Any:
    if f.edited and f.reviewed_value is not None:
        return f.reviewed_value
    if f.normalized_value is not None:
        return f.normalized_value
    return f.raw_value


def _apply_result(run: AnalysisRun, result: AnalysisResult) -> None:
    llm = result.response
    run.overall_score = llm.overall_score
    run.overall_tier = llm.overall_tier
    run.score_breakdown = {
        "skills": llm.skills_score.model_dump(),
        "experience": llm.experience_score.model_dump(),
        "domain": llm.domain_score.model_dump(),
        "logistics": llm.logistics_score.model_dump(),
    }

    met = [r for r in llm.hard_requirements if r.met]
    missed = [r for r in llm.hard_requirements if not r.met]
    run.hard_requirements_met = [r.model_dump() for r in met]
    run.hard_requirements_missed = [r.model_dump() for r in missed]

    pmet = [r for r in llm.preferred_requirements if r.met]
    pmissed = [r for r in llm.preferred_requirements if not r.met]
    run.preferred_requirements_met = [r.model_dump() for r in pmet]
    run.preferred_requirements_missed = [r.model_dump() for r in pmissed]

    run.strengths = llm.strengths
    run.gaps = llm.gaps
    run.concerns = llm.concerns
    run.missing_info = llm.missing_info
    run.rationale = llm.rationale
    run.suggested_follow_up_questions = llm.suggested_follow_up_questions
    run.model_used = result.model_used
    run.prompt_tokens = result.prompt_tokens
    run.completion_tokens = result.completion_tokens
    run.results = llm.model_dump()
