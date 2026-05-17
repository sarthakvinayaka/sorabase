"""
Schema proposal route — General Mode only.

POST /api/conversations/{conversation_id}/schema-proposal

Fetches the conversation transcript and (if already extracted) the AI summary,
then calls the LLM to propose 5–15 extraction columns for user review.

This endpoint is stateless: it generates a fresh proposal on each call and
does not persist the result. Persistence and user edits are handled separately.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Candidate, ExtractionRun
from app.db.session import get_db
from app.domain.schema_proposal_schemas import SchemaProposalResponse
from app.repositories import conversation_repo
from app.services.schema_proposal_client import SchemaProposalError, propose_schema

router = APIRouter()


@router.post(
    "/conversations/{conversation_id}/schema-proposal",
    response_model=SchemaProposalResponse,
    status_code=200,
    summary="Propose extraction schema for a conversation (General Mode)",
    tags=["schema-proposals"],
)
def propose_conversation_schema(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> SchemaProposalResponse:
    """
    Generate an AI-suggested extraction schema for the given conversation.

    The LLM receives:
    - The conversation transcript (required — returns 409 if not ready)
    - The AI-generated summary from the linked extraction run, if present

    Returns a list of proposed columns (5–15) for the user to review and edit
    before running a custom extraction.
    """
    conversation = conversation_repo.get(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    transcript: str | None = conversation.raw_text
    if not transcript or not transcript.strip():
        raise HTTPException(
            status_code=409,
            detail="Conversation transcript is not ready. Wait for transcription to complete.",
        )

    # Pull summary from the linked extraction run when available.
    # This is optional — schema proposal works on transcript alone if extraction
    # hasn't run yet.
    summary: str | None = None
    if conversation.candidate_id is not None:
        candidate: Candidate | None = db.get(Candidate, conversation.candidate_id)
        if candidate is not None and candidate.latest_extraction_run_id is not None:
            run: ExtractionRun | None = db.get(ExtractionRun, candidate.latest_extraction_run_id)
            if run is not None:
                summary = run.candidate_summary

    try:
        result = propose_schema(transcript, summary)
    except SchemaProposalError as exc:
        raise HTTPException(status_code=503, detail=f"Schema proposal failed: {exc}")

    return SchemaProposalResponse(
        conversation_id=conversation_id,
        columns=result.columns,
        rationale=result.rationale,
        model_used=result.model_used,
        generated_at=datetime.now(timezone.utc),
    )
