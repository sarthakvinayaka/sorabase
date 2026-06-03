"""
Desktop live-capture session API.

Flow:
  1. Desktop starts → POST /api/capture-sessions → {id, status:"active"}
  2. Deepgram utterance arrives → POST /api/capture-sessions/{id}/chunks
  3. Desktop stops → POST /api/capture-sessions/{id}/complete
       → assembles TranscriptChunks → creates Conversation (source_type="desktop_live_capture")
       → returns conversation_id for redirect
  4. Frontend/polling → GET /api/capture-sessions/{id}

The complete step is intentionally synchronous: transcript text is already
available (assembled from Deepgram chunks) so no async queue is needed.
Study-mode extraction is handled by the Next.js text-complete route which
calls POST /api/study/extract after this endpoint returns.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.models import CaptureSession, Conversation, TranscriptChunk
from app.db.session import get_db
from app.domain.api_schemas import (
    CaptureCompleteResponse,
    CaptureSessionCreate,
    CaptureSessionRead,
    TranscriptChunkAppend,
)

router = APIRouter()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_session(db: Session, session_id: uuid.UUID, org_id: uuid.UUID) -> CaptureSession:
    cs = (
        db.query(CaptureSession)
        .filter(CaptureSession.id == session_id, CaptureSession.org_id == org_id)
        .first()
    )
    if cs is None:
        raise HTTPException(status_code=404, detail="Capture session not found.")
    return cs


@router.post("/capture-sessions", response_model=CaptureSessionRead, status_code=201)
def create_capture_session(
    body: CaptureSessionCreate,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> CaptureSessionRead:
    now = _utcnow()
    cs = CaptureSession(
        org_id=org_id,
        mode=body.mode,
        label=body.label,
        source=body.source,
        status="active",
        chunk_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(cs)
    db.commit()
    db.refresh(cs)
    return CaptureSessionRead.model_validate(cs)


@router.get("/capture-sessions/{session_id}", response_model=CaptureSessionRead)
def get_capture_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> CaptureSessionRead:
    return CaptureSessionRead.model_validate(_get_session(db, session_id, org_id))


@router.post("/capture-sessions/{session_id}/chunks", status_code=201)
def append_chunk(
    session_id: uuid.UUID,
    body: TranscriptChunkAppend,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
):
    cs = _get_session(db, session_id, org_id)
    if cs.status != "active":
        raise HTTPException(
            status_code=409,
            detail=f"Session is '{cs.status}' — cannot append chunks.",
        )

    seq = cs.chunk_count
    db.add(
        TranscriptChunk(
            capture_session_id=session_id,
            seq=seq,
            text=body.text,
            speaker=body.speaker,
            confidence=body.confidence,
            created_at=_utcnow(),
        )
    )
    cs.chunk_count = seq + 1
    cs.updated_at = _utcnow()
    db.commit()
    return {"ok": True, "seq": seq}


@router.post("/capture-sessions/{session_id}/complete", response_model=CaptureCompleteResponse)
def complete_capture_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    org_id: uuid.UUID = Depends(get_current_org_id),
) -> CaptureCompleteResponse:
    cs = _get_session(db, session_id, org_id)
    if cs.status != "active":
        raise HTTPException(
            status_code=409,
            detail=f"Session is already '{cs.status}'.",
        )

    cs.status = "assembling"
    cs.updated_at = _utcnow()
    db.commit()

    chunks = (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.capture_session_id == session_id)
        .order_by(TranscriptChunk.seq)
        .all()
    )

    raw_text = "\n".join(c.text for c in chunks if c.text and c.text.strip())

    if not raw_text:
        cs.status = "failed"
        cs.error_message = "No transcript text was captured."
        cs.updated_at = _utcnow()
        db.commit()
        raise HTTPException(
            status_code=422,
            detail="No transcript text was captured. The session had no content.",
        )

    now = _utcnow()
    conv = Conversation(
        org_id=org_id,
        source_type="desktop_live_capture",
        raw_text=raw_text,
        char_count=len(raw_text),
        transcript_status="ready",
        status="raw",
        job_reference=cs.label,
        source_metadata={"mode": cs.mode, "capture_session_id": str(session_id)},
        created_at=now,
    )
    db.add(conv)
    db.flush()

    cs.conversation_id = conv.id
    cs.status = "ready"
    cs.updated_at = now
    db.commit()

    return CaptureCompleteResponse(
        capture_session_id=session_id,
        conversation_id=conv.id,
        status="ready",
    )
