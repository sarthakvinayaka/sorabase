"""
Zoom webhook integration tests.

Covers:
- HMAC-SHA256 signature verification (valid, wrong secret, tampered body, missing headers)
- endpoint.url_validation handshake returns correct encryptedToken
- recording.completed: ingest creates pending Conversation + SourceEvent + MediaReference
- recording.completed: background produce_transcript promotes Conversation to ready
- recording.completed: no audio file → 200 skipped (not 400)
- Unknown event type: 200 ignored
- Missing ZOOM_WEBHOOK_SECRET_TOKEN: 500
- pick_recording_url prefers M4A over MP4
- ZoomAdapter.produce_transcript: download + Whisper + state machine
- ZoomAdapter.produce_transcript: download failure marks failed
"""

import hashlib
import hmac
import json
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.adapters.zoom_adapter import ZoomAdapter
from app.adapters.base import ZoomWebhookPayload
from app.api.routes.webhooks import _verify_zoom_signature, _build_zoom_payload
from app.db.models import Conversation, MediaReference, SourceEvent
from app.services.whisper_client import WhisperResult
from app.services.zoom_client import pick_recording_url


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SECRET = "test-webhook-secret"


def _sign(body: bytes | str, secret: str = _SECRET, timestamp: str = "1700000000") -> dict:
    if isinstance(body, str):
        body = body.encode()
    msg = f"v0:{timestamp}:{body.decode('utf-8', errors='replace')}"
    sig = "v0=" + hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return {
        "x-zm-request-timestamp": timestamp,
        "x-zm-signature": sig,
    }


def _recording_body(
    meeting_id: str = "meet-001",
    file_type: str = "M4A",
    host_email: str = "host@co.com",
) -> dict:
    return {
        "event": "recording.completed",
        "download_token": "jwt-download-token",
        "payload": {
            "object": {
                "uuid": meeting_id,
                "id": meeting_id,
                "host_email": host_email,
                "duration": 30,
                "start_time": "2026-05-15T10:00:00Z",
                "recording_files": [
                    {
                        "file_type": file_type,
                        "status": "completed",
                        "download_url": f"https://zoom.us/rec/download/{meeting_id}.{file_type.lower()}",
                    }
                ],
            }
        },
    }


def _validation_body(plain_token: str = "abc123plain") -> dict:
    return {
        "event": "endpoint.url_validation",
        "payload": {"plainToken": plain_token},
    }


def _fake_whisper(text: str = "Recruiter: Hello. Candidate: Hi there.") -> WhisperResult:
    return WhisperResult(
        text=text,
        duration_seconds=30,
        language="en",
        segments=[],
        raw_response={"text": text, "duration": 30.0, "language": "en", "segments": []},
    )


# ---------------------------------------------------------------------------
# Unit: signature verification
# ---------------------------------------------------------------------------

class TestSignatureVerification:
    def test_valid_signature(self):
        body = b'{"event":"recording.completed"}'
        ts = "1700000000"
        headers = _sign(body, timestamp=ts)
        assert _verify_zoom_signature(body, ts, headers["x-zm-signature"], _SECRET) is True

    def test_wrong_secret_fails(self):
        body = b'{"event":"recording.completed"}'
        ts = "1700000000"
        headers = _sign(body, secret="wrong-secret", timestamp=ts)
        assert _verify_zoom_signature(body, ts, headers["x-zm-signature"], _SECRET) is False

    def test_tampered_body_fails(self):
        body = b'{"event":"recording.completed"}'
        ts = "1700000000"
        headers = _sign(body, timestamp=ts)
        tampered = b'{"event":"recording.completed","extra":1}'
        assert _verify_zoom_signature(tampered, ts, headers["x-zm-signature"], _SECRET) is False

    def test_wrong_timestamp_fails(self):
        body = b'{"event":"recording.completed"}'
        headers = _sign(body, timestamp="1700000000")
        assert _verify_zoom_signature(body, "9999999999", headers["x-zm-signature"], _SECRET) is False

    def test_empty_signature_fails(self):
        body = b'{"event":"test"}'
        assert _verify_zoom_signature(body, "1700000000", "", _SECRET) is False


# ---------------------------------------------------------------------------
# Unit: pick_recording_url
# ---------------------------------------------------------------------------

class TestPickRecordingUrl:
    def test_prefers_m4a_over_mp4(self):
        files = [
            {"file_type": "MP4", "status": "completed", "download_url": "https://zoom.us/mp4"},
            {"file_type": "M4A", "status": "completed", "download_url": "https://zoom.us/m4a"},
        ]
        assert pick_recording_url(files) == "https://zoom.us/m4a"

    def test_falls_back_to_mp4(self):
        files = [
            {"file_type": "MP4", "status": "completed", "download_url": "https://zoom.us/mp4"},
            {"file_type": "CHAT", "status": "completed", "download_url": "https://zoom.us/chat"},
        ]
        assert pick_recording_url(files) == "https://zoom.us/mp4"

    def test_skips_non_completed(self):
        files = [
            {"file_type": "M4A", "status": "processing", "download_url": "https://zoom.us/m4a"},
            {"file_type": "MP4", "status": "completed", "download_url": "https://zoom.us/mp4"},
        ]
        assert pick_recording_url(files) == "https://zoom.us/mp4"

    def test_returns_none_if_no_audio(self):
        files = [
            {"file_type": "CHAT", "status": "completed", "download_url": "https://zoom.us/chat"},
        ]
        assert pick_recording_url(files) is None

    def test_empty_list(self):
        assert pick_recording_url([]) is None


# ---------------------------------------------------------------------------
# Unit: _build_zoom_payload
# ---------------------------------------------------------------------------

class TestBuildZoomPayload:
    def test_builds_payload_from_m4a(self):
        body = _recording_body(meeting_id="zm-xyz", file_type="M4A")
        payload = _build_zoom_payload(body)
        assert payload is not None
        assert payload.meeting_id == "zm-xyz"
        assert payload.host_email == "host@co.com"
        assert payload.download_token == "jwt-download-token"
        assert "m4a" in payload.recording_url

    def test_returns_none_for_chat_only(self):
        body = {
            "event": "recording.completed",
            "download_token": "tok",
            "payload": {
                "object": {
                    "uuid": "zm-chat",
                    "id": "zm-chat",
                    "host_email": "h@co.com",
                    "recording_files": [
                        {"file_type": "CHAT", "status": "completed", "download_url": "https://zoom.us/chat"}
                    ],
                }
            },
        }
        assert _build_zoom_payload(body) is None


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

class TestZoomWebhookEndpoint:
    def _post(self, client, body: dict, secret: str = _SECRET, timestamp: str = "1700000000"):
        raw = json.dumps(body).encode()
        headers = _sign(raw, secret=secret, timestamp=timestamp)
        return client.post(
            "/api/webhooks/zoom",
            content=raw,
            headers={"Content-Type": "application/json", **headers},
        )

    def test_url_validation_returns_encrypted_token(self, client):
        plain = "my-plain-token-abc"
        body = _validation_body(plain)
        resp = self._post(client, body)
        assert resp.status_code == 200
        data = resp.json()
        assert data["plainToken"] == plain
        # Verify the encryptedToken is the correct HMAC
        expected = hmac.new(
            _SECRET.encode(), plain.encode(), hashlib.sha256
        ).hexdigest()
        assert data["encryptedToken"] == expected

    def test_bad_signature_returns_401(self, client):
        body = _recording_body()
        raw = json.dumps(body).encode()
        headers = _sign(raw, secret="wrong")
        resp = client.post(
            "/api/webhooks/zoom",
            content=raw,
            headers={"Content-Type": "application/json", **headers},
        )
        assert resp.status_code == 401

    def test_unknown_event_returns_200_ignored(self, client):
        body = {"event": "meeting.started", "payload": {}}
        resp = self._post(client, body)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored"

    def test_recording_no_audio_returns_200_skipped(self, client):
        body = {
            "event": "recording.completed",
            "download_token": "tok",
            "payload": {
                "object": {
                    "uuid": "zm-no-audio",
                    "id": "zm-no-audio",
                    "host_email": "h@co.com",
                    "recording_files": [
                        {"file_type": "CHAT", "status": "completed", "download_url": "https://zoom.us/chat"}
                    ],
                }
            },
        }
        resp = self._post(client, body)
        assert resp.status_code == 200
        assert resp.json()["status"] == "skipped"

    @patch("app.api.routes.webhooks._zoom_adapter")
    def test_recording_completed_creates_conversation(self, mock_adapter, client, db):
        conv_id = uuid.uuid4()
        event_id = uuid.uuid4()

        from app.adapters.base import IngestionResult
        mock_adapter.ingest.return_value = IngestionResult(
            source_event_id=event_id,
            conversation_id=conv_id,
            transcript_ready=False,
        )
        mock_adapter.produce_transcript.return_value = "transcribed"

        body = _recording_body(meeting_id="zm-good")
        resp = self._post(client, body)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "accepted"
        assert data["conversation_id"] == str(conv_id)
        mock_adapter.ingest.assert_called_once()

    def test_missing_secret_returns_500(self, client):
        import app.api.routes.webhooks as wh_module
        original = wh_module.settings.zoom_webhook_secret_token
        wh_module.settings.zoom_webhook_secret_token = ""
        try:
            body = _recording_body()
            raw = json.dumps(body).encode()
            resp = client.post(
                "/api/webhooks/zoom",
                content=raw,
                headers={"Content-Type": "application/json"},
            )
            assert resp.status_code == 500
        finally:
            wh_module.settings.zoom_webhook_secret_token = original


# ---------------------------------------------------------------------------
# ZoomAdapter.produce_transcript
# ---------------------------------------------------------------------------

class TestZoomAdapterProduceTranscript:
    def _ingest(self, db, meeting_id: str = "zm-test") -> tuple:
        adapter = ZoomAdapter()
        payload = ZoomWebhookPayload(
            meeting_id=meeting_id,
            recording_url=f"https://zoom.us/rec/{meeting_id}.m4a",
            host_email="host@co.com",
            download_token="tok-123",
        )
        result = adapter.ingest(payload, db)
        return adapter, result

    @patch("app.adapters.zoom_adapter.whisper_client")
    @patch("app.adapters.zoom_adapter.zoom_client")
    @patch("app.adapters.zoom_adapter.storage_service")
    def test_produce_transcript_promotes_conversation(
        self, mock_storage, mock_zoom, mock_whisper, db
    ):
        text = "Recruiter: Tell me. Candidate: " + "x" * 60
        mock_zoom.download_recording.return_value = b"audio bytes"
        mock_storage.get_audio_storage.return_value.save.return_value = "key.m4a"
        mock_storage.get_audio_storage.return_value.delete.return_value = None
        mock_whisper.transcribe.return_value = _fake_whisper(text)

        adapter, result = self._ingest(db)
        returned_text = adapter.produce_transcript(result.source_event_id, db)

        assert returned_text == text
        conv = db.get(Conversation, result.conversation_id)
        assert conv.transcript_status == "ready"
        assert conv.raw_text == text
        assert conv.char_count == len(text)

    @patch("app.adapters.zoom_adapter.whisper_client")
    @patch("app.adapters.zoom_adapter.zoom_client")
    @patch("app.adapters.zoom_adapter.storage_service")
    def test_media_reference_completed(self, mock_storage, mock_zoom, mock_whisper, db):
        mock_zoom.download_recording.return_value = b"audio bytes"
        mock_storage.get_audio_storage.return_value.save.return_value = "key.m4a"
        mock_storage.get_audio_storage.return_value.delete.return_value = None
        mock_whisper.transcribe.return_value = _fake_whisper()

        adapter, result = self._ingest(db)
        adapter.produce_transcript(result.source_event_id, db)

        from sqlalchemy import select
        media = db.scalars(
            select(MediaReference).where(
                MediaReference.conversation_id == result.conversation_id
            )
        ).first()
        assert media.transcription_status == "completed"
        assert media.duration_seconds == 30
        assert media.whisper_response is not None

    @patch("app.adapters.zoom_adapter.whisper_client")
    @patch("app.adapters.zoom_adapter.zoom_client")
    @patch("app.adapters.zoom_adapter.storage_service")
    def test_source_event_promoted_to_ready(self, mock_storage, mock_zoom, mock_whisper, db):
        mock_zoom.download_recording.return_value = b"audio bytes"
        mock_storage.get_audio_storage.return_value.save.return_value = "key.m4a"
        mock_storage.get_audio_storage.return_value.delete.return_value = None
        mock_whisper.transcribe.return_value = _fake_whisper()

        adapter, result = self._ingest(db)
        adapter.produce_transcript(result.source_event_id, db)

        event = db.get(SourceEvent, result.source_event_id)
        assert event.status == "ready"

    @patch("app.adapters.zoom_adapter.zoom_client")
    @patch("app.adapters.zoom_adapter.storage_service")
    def test_download_failure_marks_failed(self, mock_storage, mock_zoom, db):
        mock_zoom.download_recording.side_effect = RuntimeError("Network error")
        mock_storage.get_audio_storage.return_value.save.return_value = "key.m4a"

        adapter, result = self._ingest(db)
        with pytest.raises(RuntimeError, match="Network error"):
            adapter.produce_transcript(result.source_event_id, db)

        from sqlalchemy import select
        media = db.scalars(
            select(MediaReference).where(
                MediaReference.conversation_id == result.conversation_id
            )
        ).first()
        assert media.transcription_status == "failed"

    @patch("app.adapters.zoom_adapter.whisper_client")
    @patch("app.adapters.zoom_adapter.zoom_client")
    @patch("app.adapters.zoom_adapter.storage_service")
    def test_audio_file_deleted_after_transcription(
        self, mock_storage, mock_zoom, mock_whisper, db
    ):
        mock_zoom.download_recording.return_value = b"audio bytes"
        mock_store = MagicMock()
        mock_store.save.return_value = "temp.m4a"
        mock_storage.get_audio_storage.return_value = mock_store
        mock_whisper.transcribe.return_value = _fake_whisper()

        adapter, result = self._ingest(db)
        adapter.produce_transcript(result.source_event_id, db)

        mock_store.delete.assert_called_once_with("temp.m4a")

    def test_missing_source_event_raises(self, db):
        adapter = ZoomAdapter()
        with pytest.raises(ValueError, match="SourceEvent"):
            adapter.produce_transcript(uuid.uuid4(), db)
