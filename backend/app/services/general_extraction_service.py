"""
Orchestrates General Mode extraction end to end:
  conversation + approved columns → OpenAI → persist → audit log
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.constants import GENERAL_MODE_TAG
from app.domain.general_extraction_schemas import ApprovedColumn
from app.services import audit_service
from app.services.general_extraction_client import GeneralExtractionResult, extract_general
from app.db.models import Candidate, Conversation, ExtractionRun, ExtractedField
from app.repositories import candidate_repo, conversation_repo


class ConversationNotFoundError(Exception):
    pass


class ConversationTooLargeError(Exception):
    pass


class TranscriptNotReadyError(Exception):
    pass


def run_general_extraction(
    db: Session,
    conversation_id: uuid.UUID,
    columns: list[ApprovedColumn],
    org_id: uuid.UUID | None = None,
    actor_id: str = "system",
    template_id: str | None = None,
    template_version: int | None = None,
) -> tuple[Candidate, ExtractionRun]:
    """
    Execute one General Mode extraction pipeline run.

    Returns (Candidate, ExtractionRun) on success.
    Raises ConversationNotFoundError, ConversationTooLargeError,
    TranscriptNotReadyError, or GeneralExtractionError on failure.
    """
    conversation: Conversation | None = db.get(Conversation, conversation_id)
    if conversation is None:
        raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")

    char_count = conversation.char_count or 0
    if char_count > settings.max_transcript_chars:
        raise ConversationTooLargeError(
            f"Conversation is {char_count} characters. "
            f"Limit is {settings.max_transcript_chars}."
        )

    if getattr(conversation, "transcript_status", "ready") != "ready":
        raise TranscriptNotReadyError(
            f"Conversation {conversation_id} transcript is not ready yet."
        )

    conversation_repo.set_status(db, conversation, "processing")

    try:
        result = extract_general(conversation.raw_text, columns)
    except Exception:
        conversation_repo.set_status(db, conversation, "failed")
        db.commit()
        raise

    candidate = candidate_repo.get_or_create_for_conversation(db, conversation_id)
    conversation.candidate_id = candidate.id
    db.flush()

    extraction_run = _persist_extraction_run(
        db, conversation_id, candidate.id, result,
        org_id=org_id,
        template_id=template_id,
        template_version=template_version,
    )
    _persist_fields(db, extraction_run.id, result, columns, org_id=org_id)

    candidate.latest_extraction_run_id = extraction_run.id
    candidate.updated_at = datetime.now(timezone.utc)
    db.flush()

    conversation_repo.set_status(db, conversation, "extracted")

    audit_service.log(
        db,
        entity_type="extraction_run",
        entity_id=extraction_run.id,
        action="extracted",
        actor_id=actor_id,
        new_value={"model": result.model_used, "mode": "general", "columns": len(columns)},
        source="system",
    )

    db.commit()
    db.refresh(candidate)
    db.refresh(extraction_run)
    return candidate, extraction_run


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _persist_extraction_run(
    db: Session,
    conversation_id: uuid.UUID,
    candidate_id: uuid.UUID,
    result: GeneralExtractionResult,
    org_id: uuid.UUID | None = None,
    template_id: str | None = None,
    template_version: int | None = None,
) -> ExtractionRun:
    overall_confidence = _compute_overall_confidence(result.fields)

    extraction_run = ExtractionRun(
        org_id=org_id or uuid.UUID(settings.default_org_id),
        conversation_id=conversation_id,
        candidate_id=candidate_id,
        template_id=str(template_id) if template_id else GENERAL_MODE_TAG,
        missing_fields=result.missing_fields,
        ambiguous_fields=result.ambiguous_fields,
        suggested_follow_up_questions=[],
        candidate_summary=result.extracted_summary,
        overall_confidence=overall_confidence,
        model_used=result.model_used,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        status="completed",
        raw_response={
            "fields": result.fields,
            "summary": result.extracted_summary,
            "template_id": str(template_id) if template_id else None,
            "template_version": template_version,
        },
    )
    db.add(extraction_run)
    db.flush()
    return extraction_run


def _persist_fields(
    db: Session,
    extraction_run_id: uuid.UUID,
    result: GeneralExtractionResult,
    columns: list[ApprovedColumn],
    org_id: uuid.UUID | None = None,
) -> None:
    for col in columns:
        field_data: dict[str, Any] = result.fields.get(col.name, {})
        raw_value = field_data.get("value")

        extracted_field = ExtractedField(
            org_id=org_id or uuid.UUID(settings.default_org_id),
            extraction_run_id=extraction_run_id,
            field_name=col.name,
            raw_value=raw_value,
            normalized_value=raw_value,
            reviewed_value=None,
            evidence_snippet=field_data.get("evidence_snippet"),
            confidence=field_data.get("confidence", 0.0),
            status=field_data.get("status", "missing"),
            edited=False,
        )
        db.add(extracted_field)
    db.flush()


def _compute_overall_confidence(fields: dict[str, Any]) -> float:
    scores = [
        fd["confidence"]
        for fd in fields.values()
        if fd.get("status") == "extracted"
    ]
    return round(sum(scores) / len(scores), 4) if scores else 0.0
