"""
Orchestrates draft generation:
  reviewed fields + transcript → LLM → persist → audit log

Two draft types:
  candidate_summary — job-agnostic, generated from reviewed profile + transcript
  submittal         — job-specific, generated from profile + JD analysis + transcript
"""

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import AnalysisRun, Candidate, CandidateDraft, Conversation, ExtractionRun, ExtractedField, Job
from app.repositories import analysis_repo, draft_repo
from app.services import audit_service
from app.services.analysis_service import build_candidate_profile
from app.services.drafts_client import DraftGenerationError, generate_submittal_text, generate_summary_text


class CandidateNotReadyError(Exception):
    """Candidate not found or has no completed extraction run."""


class AnalysisRunNotReadyError(Exception):
    """Analysis run not found, not completed, or doesn't belong to this candidate."""


class DraftNotFoundError(Exception):
    """Draft not found or doesn't belong to this candidate."""


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def generate_summary_draft(
    db: Session,
    candidate_id: uuid.UUID,
    actor_id: str = "recruiter",
) -> CandidateDraft:
    """
    Generate a candidate profile summary grounded in the reviewed extracted fields.
    Creates a new CandidateDraft row each time (generation history is kept).
    Raises CandidateNotReadyError if the candidate has no completed extraction.
    Propagates DraftGenerationError on LLM failure.
    """
    candidate, extraction_run, fields, transcript = _load_candidate_data(db, candidate_id)

    profile = build_candidate_profile(fields)
    content = generate_summary_text(profile, transcript)

    draft = draft_repo.create(
        db,
        org_id=uuid.UUID(settings.default_org_id),
        candidate_id=candidate_id,
        analysis_run_id=None,
        draft_type="candidate_summary",
        content=content,
        edited=False,
    )

    audit_service.log(
        db,
        entity_type="candidate_draft",
        entity_id=draft.id,
        action="generated",
        actor_id=actor_id,
        new_value={"draft_type": "candidate_summary", "words": len(content.split())},
        source="system",
    )

    db.commit()
    db.refresh(draft)
    return draft


def generate_submittal_draft(
    db: Session,
    candidate_id: uuid.UUID,
    analysis_run_id: uuid.UUID,
    actor_id: str = "recruiter",
) -> CandidateDraft:
    """
    Generate a job-specific submittal grounded in the reviewed profile and JD analysis.
    Raises CandidateNotReadyError, AnalysisRunNotReadyError, or DraftGenerationError.
    """
    candidate, extraction_run, fields, transcript = _load_candidate_data(db, candidate_id)

    run: AnalysisRun | None = analysis_repo.get(db, analysis_run_id)
    if run is None or run.candidate_id != candidate_id:
        raise AnalysisRunNotReadyError(f"Analysis run {analysis_run_id} not found for this candidate.")
    if run.status != "completed":
        raise AnalysisRunNotReadyError("Analysis run is not completed.")

    job: Job | None = db.get(Job, run.job_id)

    profile = build_candidate_profile(fields)
    analysis_ctx = _build_analysis_context(run)

    content = generate_submittal_text(
        candidate_profile=profile,
        job_title=job.title if job else "Unknown Role",
        job_requirements=job.requirements or "" if job else "",
        analysis_context=analysis_ctx,
        transcript=transcript,
    )

    draft = draft_repo.create(
        db,
        org_id=uuid.UUID(settings.default_org_id),
        candidate_id=candidate_id,
        analysis_run_id=analysis_run_id,
        draft_type="submittal",
        content=content,
        edited=False,
    )

    audit_service.log(
        db,
        entity_type="candidate_draft",
        entity_id=draft.id,
        action="generated",
        actor_id=actor_id,
        new_value={
            "draft_type": "submittal",
            "analysis_run_id": str(analysis_run_id),
            "words": len(content.split()),
        },
        source="system",
    )

    db.commit()
    db.refresh(draft)
    return draft


def edit_draft(
    db: Session,
    draft_id: uuid.UUID,
    candidate_id: uuid.UUID,
    content: str,
    actor_id: str = "recruiter",
) -> CandidateDraft:
    """
    Save recruiter edits to a draft. Overwrites content and sets edited=True.
    Raises DraftNotFoundError if the draft doesn't exist or belong to this candidate.
    """
    draft = draft_repo.get(db, draft_id)
    if draft is None or draft.candidate_id != candidate_id:
        raise DraftNotFoundError(f"Draft {draft_id} not found.")

    old_snippet = draft.content[:120]
    updated = draft_repo.update_content(db, draft, content)

    audit_service.log(
        db,
        entity_type="candidate_draft",
        entity_id=draft_id,
        action="edited",
        actor_id=actor_id,
        old_value={"snippet": old_snippet},
        new_value={"words": len(content.split())},
        source="human",
    )

    db.commit()
    db.refresh(updated)
    return updated


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _load_candidate_data(
    db: Session,
    candidate_id: uuid.UUID,
) -> tuple[Candidate, ExtractionRun, list[ExtractedField], str]:
    candidate: Candidate | None = db.get(Candidate, candidate_id)
    if candidate is None or candidate.latest_extraction_run_id is None:
        raise CandidateNotReadyError(f"Candidate {candidate_id} not found or has no extraction run.")

    extraction_run: ExtractionRun | None = db.get(ExtractionRun, candidate.latest_extraction_run_id)
    if extraction_run is None or extraction_run.status != "completed":
        raise CandidateNotReadyError("Candidate extraction run is not completed.")

    fields = (
        db.query(ExtractedField)
        .filter(ExtractedField.extraction_run_id == extraction_run.id)
        .all()
    )

    conversation: Conversation | None = db.get(Conversation, extraction_run.conversation_id)
    transcript = (conversation.raw_text or "") if conversation else ""

    return candidate, extraction_run, fields, transcript


def _build_analysis_context(run: AnalysisRun) -> str:
    """Format an AnalysisRun into a readable text block for the submittal prompt."""
    lines: list[str] = [
        f"Overall Score: {run.overall_score}/100 ({_format_tier(run.overall_tier)})",
        "",
    ]

    if run.score_breakdown:
        dim_labels = {
            "skills": "Skills (35%)",
            "experience": "Experience (20%)",
            "domain": "Domain (15%)",
            "logistics": "Logistics (30%)",
        }
        lines.append("Score Breakdown:")
        for dim, ds in run.score_breakdown.items():
            label = dim_labels.get(dim, dim)
            lines.append(f"  {label}: {ds['score']} — {ds['rationale']}")
        lines.append("")

    if run.hard_requirements_met:
        lines.append("Hard Requirements Met:")
        for r in run.hard_requirements_met:
            evidence = f" — \"{r['candidate_evidence']}\"" if r.get("candidate_evidence") else ""
            lines.append(f"  ✓ {r['requirement']}{evidence}")
        lines.append("")

    if run.hard_requirements_missed:
        lines.append("Hard Requirements Missed:")
        for r in run.hard_requirements_missed:
            lines.append(f"  ✗ {r['requirement']}")
        lines.append("")

    if run.preferred_requirements_met:
        lines.append("Preferred Requirements Met:")
        for r in run.preferred_requirements_met:
            lines.append(f"  ✓ {r['requirement']}")
        lines.append("")

    if run.strengths:
        lines.append("Key Strengths:")
        for s in run.strengths:
            lines.append(f"  • {s}")
        lines.append("")

    if run.gaps:
        lines.append("Gaps:")
        for g in run.gaps:
            lines.append(f"  • {g}")
        lines.append("")

    if run.concerns:
        lines.append("Concerns:")
        for c in run.concerns:
            lines.append(f"  • {c}")
        lines.append("")

    if run.rationale:
        lines.append(f"Recruiter Analysis:\n{run.rationale}")

    return "\n".join(lines)


def _format_tier(tier: str | None) -> str:
    return {
        "strong_fit": "Strong Fit",
        "good_fit": "Good Fit",
        "partial_fit": "Partial Fit",
        "weak_fit": "Weak Fit",
        "no_fit": "No Fit",
    }.get(tier or "", "Unknown")
