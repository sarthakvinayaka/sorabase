"""
Audio upload pipeline tests.

Covers:
- LocalFileStorage: save/open/delete round-trip
- AudioAdapter.produce_transcript(): Whisper mocked, full state machine
- POST /api/audio: validates MIME, size, calls Whisper, returns AudioIngestResponse
- Conversation transcript_status promoted to 'ready' after transcription
- MediaReference whisper_response + duration persisted
- SourceEvent status promoted to 'ready' after transcription
"""

import io
import os
import tempfile
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.adapters.audio_adapter import AudioAdapter
from app.adapters.base import AudioPayload
from app.db.models import Conversation, MediaReference, SourceEvent
from app.services.storage_service import LocalFileStorage
from app.services.whisper_client import WhisperResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_whisper_result(text: str = "Recruiter: Hi. Candidate: Hello there.") -> WhisperResult:
    return WhisperResult(
        text=text,
        duration_seconds=42,
        language="en",
        segments=[{"id": 0, "start": 0.0, "end": 2.5, "text": text}],
        raw_response={"text": text, "duration": 42.0, "language": "en", "segments": []},
    )


def _audio_payload(storage_key: str = "test.mp3") -> AudioPayload:
    return AudioPayload(
        storage_key=storage_key,
        mime_type="audio/mpeg",
        size_bytes=1024,
    )


# ---------------------------------------------------------------------------
# LocalFileStorage
# ---------------------------------------------------------------------------

class TestLocalFileStorage:
    def test_save_returns_key(self, tmp_path):
        store = LocalFileStorage(str(tmp_path))
        key = store.save(b"hello audio", "test.mp3")
        assert key.endswith(".mp3")
        assert (tmp_path / key).exists()

    def test_open_returns_bytes(self, tmp_path):
        store = LocalFileStorage(str(tmp_path))
        data = b"audio data here"
        key = store.save(data, "clip.wav")
        assert store.open(key) == data

    def test_delete_removes_file(self, tmp_path):
        store = LocalFileStorage(str(tmp_path))
        key = store.save(b"bye", "gone.mp3")
        store.delete(key)
        assert not (tmp_path / key).exists()

    def test_delete_missing_key_is_noop(self, tmp_path):
        store = LocalFileStorage(str(tmp_path))
        store.delete("nonexistent.mp3")  # should not raise

    def test_open_missing_key_raises(self, tmp_path):
        store = LocalFileStorage(str(tmp_path))
        with pytest.raises(FileNotFoundError):
            store.open("ghost.mp3")

    def test_creates_base_dir(self, tmp_path):
        new_dir = str(tmp_path / "nested" / "uploads")
        store = LocalFileStorage(new_dir)
        key = store.save(b"x", "file.mp3")
        assert store.open(key) == b"x"


# ---------------------------------------------------------------------------
# AudioAdapter.produce_transcript()
# ---------------------------------------------------------------------------

class TestAudioAdapterProduceTranscript:
    def _ingest_with_storage(self, db, storage_key: str = "clip.mp3") -> tuple:
        adapter = AudioAdapter()
        payload = _audio_payload(storage_key)
        result = adapter.ingest(payload, db)
        return adapter, result

    @patch("app.adapters.audio_adapter.whisper_client")
    @patch("app.adapters.audio_adapter.storage_service")
    def test_produce_transcript_returns_text(self, mock_storage_svc, mock_whisper, db):
        whisper_text = "Recruiter: Tell me. Candidate: Sure, " + "x" * 60
        mock_storage_svc.get_audio_storage.return_value.open.return_value = b"audio"
        mock_whisper.transcribe.return_value = _fake_whisper_result(whisper_text)

        adapter, result = self._ingest_with_storage(db)
        text = adapter.produce_transcript(result.source_event_id, db)
        assert text == whisper_text

    @patch("app.adapters.audio_adapter.whisper_client")
    @patch("app.adapters.audio_adapter.storage_service")
    def test_conversation_promoted_to_ready(self, mock_storage_svc, mock_whisper, db):
        whisper_text = "Recruiter: Hi. Candidate: " + "y" * 80
        mock_storage_svc.get_audio_storage.return_value.open.return_value = b"audio"
        mock_whisper.transcribe.return_value = _fake_whisper_result(whisper_text)

        adapter, result = self._ingest_with_storage(db)
        adapter.produce_transcript(result.source_event_id, db)

        conv = db.get(Conversation, result.conversation_id)
        assert conv.transcript_status == "ready"
        assert conv.raw_text == whisper_text
        assert conv.char_count == len(whisper_text)

    @patch("app.adapters.audio_adapter.whisper_client")
    @patch("app.adapters.audio_adapter.storage_service")
    def test_media_reference_completed(self, mock_storage_svc, mock_whisper, db):
        mock_storage_svc.get_audio_storage.return_value.open.return_value = b"audio"
        mock_whisper.transcribe.return_value = _fake_whisper_result()

        adapter, result = self._ingest_with_storage(db)
        adapter.produce_transcript(result.source_event_id, db)

        from sqlalchemy import select
        media = db.scalars(
            select(MediaReference).where(
                MediaReference.conversation_id == result.conversation_id
            )
        ).first()
        assert media.transcription_status == "completed"
        assert media.duration_seconds == 42
        assert media.whisper_response is not None

    @patch("app.adapters.audio_adapter.whisper_client")
    @patch("app.adapters.audio_adapter.storage_service")
    def test_source_event_promoted_to_ready(self, mock_storage_svc, mock_whisper, db):
        mock_storage_svc.get_audio_storage.return_value.open.return_value = b"audio"
        mock_whisper.transcribe.return_value = _fake_whisper_result()

        adapter, result = self._ingest_with_storage(db)
        adapter.produce_transcript(result.source_event_id, db)

        event = db.get(SourceEvent, result.source_event_id)
        assert event.status == "ready"

    @patch("app.adapters.audio_adapter.whisper_client")
    @patch("app.adapters.audio_adapter.storage_service")
    def test_whisper_failure_marks_failed(self, mock_storage_svc, mock_whisper, db):
        mock_storage_svc.get_audio_storage.return_value.open.return_value = b"audio"
        mock_whisper.transcribe.side_effect = RuntimeError("Whisper API error")

        adapter, result = self._ingest_with_storage(db)

        with pytest.raises(RuntimeError, match="Whisper API error"):
            adapter.produce_transcript(result.source_event_id, db)

        from sqlalchemy import select
        media = db.scalars(
            select(MediaReference).where(
                MediaReference.conversation_id == result.conversation_id
            )
        ).first()
        assert media.transcription_status == "failed"

    def test_missing_media_ref_raises(self, db):
        adapter = AudioAdapter()
        with pytest.raises(ValueError, match="No MediaReference found"):
            adapter.produce_transcript(uuid.uuid4(), db)


# ---------------------------------------------------------------------------
# POST /api/audio endpoint
# ---------------------------------------------------------------------------

_FAKE_AUDIO = b"RIFF" + b"\x00" * 100  # minimal fake WAV header


class TestAudioUploadEndpoint:
    @patch("app.api.routes.audio._audio_adapter")
    @patch("app.api.routes.audio.get_audio_storage")
    def test_upload_returns_201(self, mock_get_storage, mock_adapter, client, db):
        conv_id = uuid.uuid4()
        event_id = uuid.uuid4()

        mock_get_storage.return_value.save.return_value = "saved_key.mp3"

        from app.adapters.base import IngestionResult
        mock_adapter.ingest.return_value = IngestionResult(
            source_event_id=event_id,
            conversation_id=conv_id,
            transcript_ready=False,
        )

        conv = Conversation(
            id=conv_id, source_type="audio", transcript_status="ready",
            status="raw", raw_text="transcribed text", char_count=16,
        )
        db.add(conv)
        db.flush()

        mock_adapter.produce_transcript.return_value = "transcribed text"

        resp = client.post(
            "/api/audio",
            files={"file": ("test.mp3", io.BytesIO(_FAKE_AUDIO), "audio/mpeg")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["transcript_ready"] is True
        assert data["transcript_status"] == "ready"

    def test_unsupported_mime_returns_415(self, client):
        resp = client.post(
            "/api/audio",
            files={"file": ("test.pdf", io.BytesIO(b"pdf content"), "application/pdf")},
        )
        assert resp.status_code == 415
        assert "Unsupported audio format" in resp.json()["detail"]

    @patch("app.api.routes.audio.get_audio_storage")
    def test_oversized_file_returns_413(self, mock_get_storage, client):
        import app.api.routes.audio as audio_route
        original = audio_route.settings.max_audio_bytes
        audio_route.settings.max_audio_bytes = 10  # force small limit
        try:
            resp = client.post(
                "/api/audio",
                files={"file": ("big.mp3", io.BytesIO(b"x" * 20), "audio/mpeg")},
            )
            assert resp.status_code == 413
        finally:
            audio_route.settings.max_audio_bytes = original

    @patch("app.api.routes.audio._audio_adapter")
    @patch("app.api.routes.audio.get_audio_storage")
    def test_whisper_failure_returns_503(self, mock_get_storage, mock_adapter, client, db):
        conv_id = uuid.uuid4()
        event_id = uuid.uuid4()

        mock_get_storage.return_value.save.return_value = "key.mp3"

        from app.adapters.base import IngestionResult
        mock_adapter.ingest.return_value = IngestionResult(
            source_event_id=event_id,
            conversation_id=conv_id,
            transcript_ready=False,
        )
        mock_adapter.produce_transcript.side_effect = RuntimeError("Whisper down")

        resp = client.post(
            "/api/audio",
            files={"file": ("clip.mp3", io.BytesIO(_FAKE_AUDIO), "audio/mpeg")},
        )
        assert resp.status_code == 503
        assert "transcription failed" in resp.json()["detail"].lower()
