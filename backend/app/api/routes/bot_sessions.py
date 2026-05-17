"""
REST endpoints for meeting-bot sessions.

POST   /api/bot-sessions              — start a bot (creates BotSession + calls provider)
GET    /api/bot-sessions              — list recent sessions
GET    /api/bot-sessions/{id}         — get single session (for polling)
DELETE /api/bot-sessions/{id}         — cancel bot + mark failed
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domain.api_schemas import BotSessionCreate, BotSessionRead
from app.repositories import bot_session_repo
from app.services.bot_provider import get_bot_provider

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/bot-sessions", response_model=BotSessionRead, status_code=201)
def create_bot_session(body: BotSessionCreate, db: Session = Depends(get_db)):
    """
    Send a meeting bot into the specified Zoom/Meet/Teams URL.
    Returns immediately with a BotSession in status='joining'.
    Subsequent status changes arrive via the /api/webhooks/recall endpoint.
    """
    provider = get_bot_provider()

    bot_name = "Pilot Recruiting Bot"

    try:
        provider_bot_id = provider.create_bot(
            meeting_url=body.meeting_url,
            bot_name=bot_name,
        )
    except Exception as exc:
        logger.exception("Failed to create bot for meeting_url=%s", body.meeting_url)
        raise HTTPException(status_code=502, detail=f"Bot provider error: {exc}") from exc

    session = bot_session_repo.create(
        db,
        provider_bot_id=provider_bot_id,
        meeting_url=body.meeting_url,
        meeting_label=body.meeting_label,
        job_reference=body.job_reference,
        auto_run=body.auto_run,
        mode=body.mode,
    )
    logger.info(
        "Bot session created: id=%s provider_bot_id=%s url=%s",
        session.id, provider_bot_id, body.meeting_url,
    )
    return session


@router.get("/bot-sessions", response_model=list[BotSessionRead])
def list_bot_sessions(
    limit: int = 20,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    return bot_session_repo.list_recent(db, limit=limit, status=status)


@router.get("/bot-sessions/{session_id}", response_model=BotSessionRead)
def get_bot_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = bot_session_repo.get(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Bot session not found")
    return session


@router.delete("/bot-sessions/{session_id}", status_code=204)
def cancel_bot_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Cancel the bot and mark the session as failed.
    Best-effort — if the bot is already done, this is a no-op.
    """
    session = bot_session_repo.get(db, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Bot session not found")

    if session.status in ("complete", "failed"):
        return JSONResponse(status_code=204, content=None)

    provider = get_bot_provider()
    try:
        provider.cancel_bot(session.provider_bot_id)
    except Exception as exc:
        logger.warning("Could not cancel bot %s: %s", session.provider_bot_id, exc)

    bot_session_repo.set_status(db, session, "failed", error_message="Cancelled by recruiter")
    db.commit()
