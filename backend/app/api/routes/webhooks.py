"""
Webhook receivers:

POST /api/webhooks/zoom   — Zoom cloud-recording webhook (recording.completed)
POST /api/webhooks/recall — Recall.ai meeting-bot lifecycle events

Zoom flow:
  1. Verify HMAC-SHA256 signature.
  2. endpoint.url_validation → respond with challenge.
  3. recording.completed → ingest + background transcription + extraction.

Recall flow:
  1. Verify HMAC-SHA256 signature.
  2. Map event type → BotSession.status.
  3. On bot.done → fetch transcript → create Conversation → run extraction.
  All events are appended to BotSession.webhook_events for auditability.
"""

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse

from app.adapters.zoom_adapter import ZoomAdapter
from app.adapters.base import ZoomWebhookPayload
from app.config import settings
from app.db.models import Conversation, SourceEvent
from app.db.session import SessionLocal
from app.constants import MODE_GENERAL
from app.repositories import bot_session_repo, meeting_session_repo
from app.services.bot_provider import get_bot_provider
from app.services.meeting_orchestrator import run_post_transcript
from app.services.zoom_client import pick_recording_url

logger = logging.getLogger(__name__)
router = APIRouter()

_zoom_adapter = ZoomAdapter()

# ---------------------------------------------------------------------------
# Recall.ai — event type → BotSession status mapping
# ---------------------------------------------------------------------------

_RECALL_STATUS_MAP: dict[str, str] = {
    "bot.joining_call":          "joining",
    "bot.in_waiting_room":       "waiting_for_admission",
    "bot.in_call_not_recording": "in_meeting",
    "bot.in_call_recording":     "recording",
    "bot.call_ended":            "transcribing",
    "bot.fatal":                 "failed",
}

# Terminal statuses — do not overwrite with a later non-terminal event
_TERMINAL = {"complete", "failed"}


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def _verify_zoom_signature(
    raw_body: bytes,
    timestamp: str,
    signature: str,
    secret: str,
) -> bool:
    message = f"v0:{timestamp}:{raw_body.decode('utf-8', errors='replace')}"
    expected_hash = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    expected = f"v0={expected_hash}"
    return hmac.compare_digest(expected, signature)


# ---------------------------------------------------------------------------
# Background processing: transcribe → extract → update session
# ---------------------------------------------------------------------------

def _process_meeting(source_event_id: uuid.UUID, session_id: uuid.UUID) -> None:
    """
    Full pipeline for one Zoom meeting: STT → extraction → session complete.
    Runs in a FastAPI BackgroundTask with its own DB session.
    """
    db = SessionLocal()
    try:
        ms = meeting_session_repo.get(db, session_id)

        # ── Step 1: transcribe ──────────────────────────────────────────────
        try:
            _zoom_adapter.produce_transcript(source_event_id, db)
            logger.info("Zoom transcription complete for source_event=%s", source_event_id)
        except Exception as exc:
            logger.exception("Zoom transcription failed for source_event=%s", source_event_id)
            if ms:
                meeting_session_repo.set_status(db, ms, "failed", error_message=str(exc))
                db.commit()
            return

        # ── Step 2: post-transcript dispatch ────────────────────────────────
        if ms is None:
            logger.warning("MeetingSession %s not found — skipping post-transcript dispatch", session_id)
            return

        from app.db.models import SourceEvent
        event = db.get(SourceEvent, source_event_id)
        if event is None or event.conversation_id is None:
            meeting_session_repo.set_status(db, ms, "failed", error_message="conversation_id missing after transcription")
            db.commit()
            return

        mode = ms.mode if hasattr(ms, "mode") else "recruiting"

        if mode == MODE_GENERAL:
            meeting_session_repo.set_status(db, ms, "ready")
            db.commit()
            logger.info("General mode: meeting_session=%s ready for schema review", session_id)
            return

        meeting_session_repo.set_status(db, ms, "extracting")
        db.commit()

        result = run_post_transcript(db, event.conversation_id, mode=mode, auto_run=True)

        if result.action == "extraction_complete" and result.candidate_id:
            meeting_session_repo.set_status(db, ms, "complete", candidate_id=result.candidate_id)
            db.commit()
            logger.info(
                "Auto-workflow complete: meeting=%s candidate=%s",
                ms.meeting_id, result.candidate_id,
            )
        elif result.error:
            logger.exception("Extraction failed for meeting_session=%s: %s", session_id, result.error)
            meeting_session_repo.set_status(db, ms, "failed", error_message=result.error)
            db.commit()

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@router.post("/webhooks/zoom")
async def zoom_webhook(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    raw_body = await request.body()

    secret = settings.zoom_webhook_secret_token
    if not secret:
        logger.error("ZOOM_WEBHOOK_SECRET_TOKEN is not configured — rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook secret not configured.")

    timestamp = request.headers.get("x-zm-request-timestamp", "")
    signature = request.headers.get("x-zm-signature", "")

    if not _verify_zoom_signature(raw_body, timestamp, signature, secret):
        raise HTTPException(status_code=401, detail="Invalid Zoom webhook signature.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_type: str = body.get("event", "")

    # URL validation handshake
    if event_type == "endpoint.url_validation":
        plain_token: str = body.get("payload", {}).get("plainToken", "")
        encrypted = hmac.new(
            secret.encode("utf-8"),
            plain_token.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return JSONResponse({"plainToken": plain_token, "encryptedToken": encrypted})

    if event_type == "recording.completed":
        try:
            payload = _build_zoom_payload(body)
        except (KeyError, ValueError) as exc:
            logger.warning("Zoom webhook payload parse error: %s", exc)
            return JSONResponse({"status": "skipped", "reason": str(exc)})

        if payload is None:
            return JSONResponse({"status": "skipped", "reason": "no_audio_recording"})

        db = SessionLocal()
        try:
            result = _zoom_adapter.ingest(payload, db)

            ms = meeting_session_repo.create(
                db,
                source_event_id=result.source_event_id,
                conversation_id=result.conversation_id,
                meeting_id=payload.meeting_id,
                host_email=payload.host_email,
            )
            session_id = ms.id
        finally:
            db.close()

        background_tasks.add_task(_process_meeting, result.source_event_id, session_id)

        logger.info(
            "Zoom recording.completed ingested: meeting=%s conversation=%s session=%s",
            payload.meeting_id, result.conversation_id, session_id,
        )
        return JSONResponse({
            "status": "accepted",
            "conversation_id": str(result.conversation_id),
            "source_event_id": str(result.source_event_id),
            "meeting_session_id": str(session_id),
        })

    return JSONResponse({"status": "ignored", "event": event_type})


# ---------------------------------------------------------------------------
# Recall.ai webhook endpoint
# ---------------------------------------------------------------------------

def _verify_recall_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """
    Recall sends:  X-Recall-Signature: sha256=<hex_digest>
    We recompute HMAC-SHA256 over the raw body.
    """
    if not signature_header.startswith("sha256="):
        return False
    expected_hex = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    received_hex = signature_header[len("sha256="):]
    return hmac.compare_digest(expected_hex, received_hex)


@router.post("/webhooks/recall")
async def recall_webhook(request: Request, background_tasks: BackgroundTasks) -> JSONResponse:
    """
    Receives lifecycle events from Recall.ai for all managed bots.

    Recall retries on non-2xx. We always return 200 quickly and do heavy
    work (transcript fetch, extraction) in a BackgroundTask.
    """
    raw_body = await request.body()

    secret = settings.recall_webhook_secret
    if secret:
        sig = request.headers.get("x-recall-signature", "")
        if not _verify_recall_signature(raw_body, sig, secret):
            raise HTTPException(status_code=401, detail="Invalid Recall webhook signature.")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_type: str = body.get("event", "")
    data: dict = body.get("data", {})
    bot_data: dict = data.get("bot", {})
    provider_bot_id: str = str(bot_data.get("id", ""))

    if not provider_bot_id:
        logger.warning("Recall webhook missing bot id: event=%s", event_type)
        return JSONResponse({"status": "ignored", "reason": "no_bot_id"})

    db = SessionLocal()
    try:
        session = bot_session_repo.get_by_provider_bot_id(db, provider_bot_id)
        if session is None:
            # Bot created outside our system or very early race — log and ack
            logger.info("Recall event for unknown bot %s (event=%s) — ignored", provider_bot_id, event_type)
            return JSONResponse({"status": "ignored", "reason": "unknown_bot"})

        # Audit every event regardless of outcome
        bot_session_repo.append_webhook_event(db, session, {
            "event": event_type,
            "ts": datetime.now(timezone.utc).isoformat(),
            "data": data,
        })
        db.commit()

        # Skip if already terminal
        if session.status in _TERMINAL:
            logger.info("Recall event %s for terminal session %s — ignored", event_type, session.id)
            return JSONResponse({"status": "ignored", "reason": "terminal_state"})

        # Simple status transitions
        if event_type in _RECALL_STATUS_MAP:
            new_status = _RECALL_STATUS_MAP[event_type]
            bot_session_repo.set_status(db, session, new_status)
            db.commit()
            logger.info("BotSession %s → %s (event=%s)", session.id, new_status, event_type)

        # bot.done: transcript is ready — trigger full pipeline
        elif event_type == "bot.done":
            if session.workflow_triggered:
                logger.info("BotSession %s workflow already triggered — skipping", session.id)
                return JSONResponse({"status": "acked", "reason": "already_triggered"})

            # Lock against duplicate events before the background task runs
            bot_session_repo.set_status(db, session, "transcribing")
            bot_session_repo.mark_workflow_triggered(db, session)
            db.commit()

            session_id = session.id
            background_tasks.add_task(
                _process_bot_session,
                provider_bot_id,
                session_id,
            )
            logger.info("BotSession %s bot.done received — pipeline queued", session_id)

    finally:
        db.close()

    return JSONResponse({"status": "acked", "event": event_type})


# ---------------------------------------------------------------------------
# Background pipeline: fetch transcript → create conversation → extract
# ---------------------------------------------------------------------------

def _process_bot_session(provider_bot_id: str, session_id: uuid.UUID) -> None:
    """
    Full post-call pipeline for a meeting-bot session:
      1. Fetch transcript from Recall.ai
      2. Create Conversation + SourceEvent
      3. Run extraction → Candidate
      4. Update BotSession to complete | failed

    Runs in a FastAPI BackgroundTask with its own DB session.
    """
    db = SessionLocal()
    try:
        session = bot_session_repo.get(db, session_id)
        if session is None:
            logger.error("_process_bot_session: BotSession %s not found", session_id)
            return

        # ── Step 1: fetch transcript ────────────────────────────────────────
        provider = get_bot_provider()
        try:
            transcript = provider.get_transcript(provider_bot_id)
        except Exception as exc:
            logger.exception("Transcript fetch failed for bot %s", provider_bot_id)
            bot_session_repo.set_status(db, session, "failed", error_message=f"transcript_fetch: {exc}")
            db.commit()
            return

        if not transcript:
            bot_session_repo.set_status(db, session, "failed", error_message="transcript_empty")
            db.commit()
            logger.warning("BotSession %s: empty transcript from provider", session_id)
            return

        # ── Step 2: create Conversation + SourceEvent ───────────────────────
        try:
            org_id = session.org_id
            conversation = Conversation(
                org_id=org_id,
                source_type="zoom_bot",
                transcript_status="ready",
                status="raw",
                raw_text=transcript,
                char_count=len(transcript),
                job_reference=session.job_reference,
                source_metadata={
                    "provider": session.provider,
                    "provider_bot_id": provider_bot_id,
                    "meeting_url": session.meeting_url,
                    "meeting_label": session.meeting_label,
                    "bot_session_id": str(session_id),
                },
            )
            db.add(conversation)
            db.flush()

            source_event = SourceEvent(
                org_id=org_id,
                source_type="zoom_bot",
                external_id=provider_bot_id,
                raw_payload={
                    "provider": session.provider,
                    "provider_bot_id": provider_bot_id,
                    "meeting_url": session.meeting_url,
                    "bot_session_id": str(session_id),
                },
                status="ready",
                conversation_id=conversation.id,
            )
            db.add(source_event)
            db.flush()

            bot_session_repo.set_status(
                db, session, "ready",
                conversation_id=conversation.id,
                transcript_chars=len(transcript),
            )
            db.commit()
            logger.info("BotSession %s: conversation %s created", session_id, conversation.id)
        except Exception as exc:
            logger.exception("Conversation creation failed for BotSession %s", session_id)
            bot_session_repo.set_status(db, session, "failed", error_message=f"conversation_create: {exc}")
            db.commit()
            return

        # ── Step 3: post-transcript dispatch ────────────────────────────────
        mode = session.mode if hasattr(session, "mode") else "recruiting"
        result = run_post_transcript(db, conversation.id, mode=mode, auto_run=session.auto_run)

        if result.action == "ready_for_schema_review":
            # Status already set to "ready" in Step 2; nothing more to do.
            logger.info("BotSession %s: general mode — ready for schema review", session_id)

        elif result.action == "skipped":
            logger.info("BotSession %s: auto_run=False — staying at ready", session_id)

        elif result.action == "extraction_complete" and result.candidate_id:
            bot_session_repo.set_status(db, session, "extracting")
            db.commit()
            bot_session_repo.set_status(
                db, session, "complete",
                candidate_id=result.candidate_id,
            )
            db.commit()
            logger.info("BotSession %s complete: candidate=%s", session_id, result.candidate_id)

        elif result.action == "failed":
            logger.exception("Extraction failed for BotSession %s: %s", session_id, result.error)
            bot_session_repo.set_status(db, session, "failed", error_message=f"extraction: {result.error}")
            db.commit()

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Payload builder
# ---------------------------------------------------------------------------

def _build_zoom_payload(body: dict) -> ZoomWebhookPayload | None:
    obj = body.get("payload", {}).get("object", {})
    recording_files: list[dict] = obj.get("recording_files", [])
    download_token: str | None = body.get("download_token")

    recording_url = pick_recording_url(recording_files)
    if not recording_url:
        return None

    participants: list[str] = [
        p.get("user_email", p.get("user_name", ""))
        for p in obj.get("participants", [])
        if p.get("user_email") or p.get("user_name")
    ]

    from datetime import datetime, timezone
    started_raw = obj.get("start_time")
    started_at = None
    if started_raw:
        try:
            started_at = datetime.fromisoformat(started_raw.replace("Z", "+00:00"))
        except ValueError:
            pass

    return ZoomWebhookPayload(
        meeting_id=str(obj.get("uuid") or obj.get("id", "")),
        recording_url=recording_url,
        host_email=obj.get("host_email", ""),
        participants=participants,
        duration_seconds=obj.get("duration"),
        started_at=started_at,
        download_token=download_token,
    )
