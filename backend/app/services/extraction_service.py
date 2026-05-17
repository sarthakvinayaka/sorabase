"""
Orchestrates one extraction run end to end:
  conversation → OpenAI → normalize → persist → audit log

This is the only module that coordinates across repositories and services.
It does not own any DB models directly.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.domain.extraction_schemas import EXTRACTION_FIELD_NAMES, ExtractionLLMResponse
from app.services import audit_service
from app.services.normalization import normalize_field
from app.services.openai_client import extract_from_transcript
from app.db.models import Candidate, Conversation, ExtractionRun, ExtractedField
from app.repositories import candidate_repo, conversation_repo


class ConversationNotFoundError(Exception):
    pass


class ConversationTooLargeError(Exception):
    pass


class TranscriptNotReadyError(Exception):
    """Raised when extraction is attempted before transcript_status='ready'."""


# Keep old names as aliases so existing tests continue to work until renamed.
TranscriptNotFoundError = ConversationNotFoundError
TranscriptTooLargeError = ConversationTooLargeError


def run_extraction(
    db: Session,
    conversation_id: uuid.UUID,
    actor_id: str = "system",
) -> tuple[Candidate, ExtractionRun]:
    """
    Execute one extraction pipeline run against a conversation.

    Returns (Candidate, ExtractionRun) on success.
    Raises ConversationNotFoundError, ConversationTooLargeError, or ExtractionError.
    Sets conversation.status to "processing" before the LLM call and
    "extracted" / "failed" after.
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
            f"Conversation {conversation_id} transcript is not ready yet "
            f"(transcript_status={conversation.transcript_status!r}). "
            "Wait for transcription to complete before running extraction."
        )

    conversation_repo.set_status(db, conversation, "processing")

    try:
        result = extract_from_transcript(conversation.raw_text)
    except Exception:
        conversation_repo.set_status(db, conversation, "failed")
        db.commit()
        raise

    candidate = candidate_repo.get_or_create_for_conversation(db, conversation_id)

    # Link conversation → candidate now that we have the candidate id.
    conversation.candidate_id = candidate.id
    db.flush()

    extraction_run = _persist_extraction_run(db, conversation_id, candidate.id, result)

    _persist_fields(db, extraction_run.id, result.response)

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
        new_value={"model": result.model_used},
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
    result,
) -> ExtractionRun:
    llm: ExtractionLLMResponse = result.response
    overall_confidence = _compute_overall_confidence(llm)

    extraction_run = ExtractionRun(
        org_id=uuid.UUID(settings.default_org_id),
        conversation_id=conversation_id,
        candidate_id=candidate_id,
        missing_fields=llm.missing_fields,
        ambiguous_fields=llm.ambiguous_fields,
        suggested_follow_up_questions=llm.suggested_follow_up_questions,
        candidate_summary=llm.candidate_summary,
        overall_confidence=overall_confidence,
        model_used=result.model_used,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        status="completed",
        raw_response=llm.model_dump(),
    )
    db.add(extraction_run)
    db.flush()
    return extraction_run


def _persist_fields(
    db: Session,
    extraction_run_id: uuid.UUID,
    llm: ExtractionLLMResponse,
) -> None:
    llm_dict = llm.model_dump()
    for field_name in EXTRACTION_FIELD_NAMES:
        field_data: dict = llm_dict.get(field_name, {})

        raw_value = field_data.get("value")

        normalized = normalize_field(field_name, raw_value)

        extracted_field = ExtractedField(
            org_id=uuid.UUID(settings.default_org_id),
            extraction_run_id=extraction_run_id,
            field_name=field_name,
            raw_value=raw_value,
            normalized_value=normalized,
            reviewed_value=None,
            evidence_snippet=field_data.get("evidence_snippet"),
            confidence=field_data.get("confidence", 0.0),
            status=field_data.get("status", "missing"),
            edited=False,
        )
        db.add(extracted_field)
    db.flush()


def _compute_overall_confidence(llm: ExtractionLLMResponse) -> float:
    llm_dict = llm.model_dump()
    scores = [
        llm_dict[f]["confidence"]
        for f in EXTRACTION_FIELD_NAMES
        if llm_dict.get(f, {}).get("status") == "extracted"
    ]
    return round(sum(scores) / len(scores), 4) if scores else 0.0
