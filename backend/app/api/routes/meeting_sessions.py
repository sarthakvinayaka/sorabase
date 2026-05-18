"""
GET /api/meeting-sessions — list recent auto-triggered Zoom workflow sessions.
GET /api/meeting-sessions/{session_id} — get a single session.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.domain.api_schemas import MeetingSessionRead
from app.repositories import meeting_session_repo

router = APIRouter()


@router.get("/meeting-sessions", response_model=list[MeetingSessionRead])
def list_meeting_sessions(
    status: str | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> list[MeetingSessionRead]:
    sessions = meeting_session_repo.list_recent(db, org_id=org_id, limit=min(limit, 100), status=status)
    return [MeetingSessionRead.model_validate(s) for s in sessions]


@router.get("/meeting-sessions/{session_id}", response_model=MeetingSessionRead)
def get_meeting_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> MeetingSessionRead:
    ms = meeting_session_repo.get(db, session_id, org_id=org_id)
    if ms is None:
        raise HTTPException(status_code=404, detail="Meeting session not found.")
    return MeetingSessionRead.model_validate(ms)
