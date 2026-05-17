"""
Mode-aware post-transcript orchestration.

After a transcript is ready, decides what happens next based on the session mode:
  - "recruiting": runs full extraction pipeline → Candidate
  - "general":    stops at ready — frontend polls and redirects to schema review

Called by both the Zoom cloud-recording path (_process_meeting) and the
Recall.ai bot path (_process_bot_session) in webhooks.py.
"""

import logging
import uuid
from dataclasses import dataclass, field
from typing import Literal

from sqlalchemy.orm import Session

from app.constants import MODE_GENERAL
from app.services import extraction_service

logger = logging.getLogger(__name__)


@dataclass
class OrchestrationResult:
    mode: str
    action: Literal["extraction_complete", "ready_for_schema_review", "skipped", "failed"]
    candidate_id: uuid.UUID | None = None
    error: str | None = None


def run_post_transcript(
    db: Session,
    conversation_id: uuid.UUID,
    mode: str,
    auto_run: bool = True,
) -> OrchestrationResult:
    """
    Dispatch post-transcript work based on mode.

    Does NOT update any session status — callers own that responsibility
    so they can use their own DB session and error handling.

    Returns an OrchestrationResult the caller uses to decide next status.
    """
    if mode == MODE_GENERAL:
        logger.info(
            "General mode: conversation %s ready for schema review — no extraction",
            conversation_id,
        )
        return OrchestrationResult(mode=mode, action="ready_for_schema_review")

    # Recruiting mode
    if not auto_run:
        logger.info(
            "Recruiting mode: auto_run=False for conversation %s — skipping extraction",
            conversation_id,
        )
        return OrchestrationResult(mode=mode, action="skipped")

    try:
        candidate, _ = extraction_service.run_extraction(db, conversation_id)
        logger.info(
            "Extraction complete: conversation=%s candidate=%s",
            conversation_id,
            candidate.id,
        )
        return OrchestrationResult(
            mode=mode,
            action="extraction_complete",
            candidate_id=candidate.id,
        )
    except Exception as exc:
        logger.exception("Extraction failed for conversation %s", conversation_id)
        return OrchestrationResult(mode=mode, action="failed", error=str(exc))
