"""
Source adapter tests.

Covers:
- TranscriptAdapter.ingest() creates Conversation + SourceEvent with correct state
- TranscriptAdapter.produce_transcript() returns the stored text
- Audio adapter creates pending Conversation + MediaReference, transcript_ready=False
- Audio produce_transcript() raises ValueError when no MediaReference found for event_id
- Zoom/Meet/WhatsApp stubs create pending Conversation + return transcript_ready=False
- Zoom/Meet/WhatsApp stubs raise NotImplementedError on produce_transcript()
- Registry dispatches to the right adapter and raises on unknown source_type
- extraction_service raises TranscriptNotReadyError when transcript_status='pending'
- POST /conversations creates a SourceEvent alongside the Conversation
- POST /conversations with non-transcript source_type returns 400
- POST /conversations/{id}/extract returns 409 when transcript_status='pending'
"""

import uuid

import pytest

from app.adapters.audio_adapter import AudioAdapter
from app.adapters.base import (
    AudioPayload,
    GoogleMeetPayload,
    TranscriptPayload,
    WhatsAppPayload,
    ZoomWebhookPayload,
)
from app.adapters.meet_adapter import GoogleMeetAdapter
from app.adapters.registry import get_adapter
from app.adapters.transcript_adapter import TranscriptAdapter
from app.adapters.whatsapp_adapter import WhatsAppAdapter
from app.adapters.zoom_adapter import ZoomAdapter
from app.db.models import Conversation, MediaReference, SourceEvent
from app.services.extraction_service import TranscriptNotReadyError, run_extraction


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _transcript_payload(**overrides) -> TranscriptPayload:
    return TranscriptPayload(
        raw_text="Recruiter: Tell me about yourself. Candidate: " + "x" * 60,
        **overrides,
    )


# ---------------------------------------------------------------------------
# TranscriptAdapter
# ---------------------------------------------------------------------------

class TestTranscriptAdapter:
    def test_ingest_creates_conversation_and_source_event(self, db):
        adapter = TranscriptAdapter()
        result = adapter.ingest(_transcript_payload(), db)

        conv = db.get(Conversation, result.conversation_id)
        event = db.get(SourceEvent, result.source_event_id)

        assert conv is not None
        assert event is not None
        assert conv.transcript_status == "ready"
        assert conv.source_type == "transcript"
        assert event.source_type == "transcript"
        assert event.conversation_id == conv.id

    def test_ingest_transcript_ready_true(self, db):
        adapter = TranscriptAdapter()
        result = adapter.ingest(_transcript_payload(), db)
        assert result.transcript_ready is True

    def test_ingest_sets_raw_text(self, db):
        adapter = TranscriptAdapter()
        text = "Recruiter: Hi. Candidate: " + "y" * 80
        result = adapter.ingest(TranscriptPayload(raw_text=text), db)
        conv = db.get(Conversation, result.conversation_id)
        assert conv.raw_text == text
        assert conv.char_count == len(text)

    def test_ingest_source_event_status_ready(self, db):
        adapter = TranscriptAdapter()
        result = adapter.ingest(_transcript_payload(), db)
        event = db.get(SourceEvent, result.source_event_id)
        assert event.status == "ready"

    def test_produce_transcript_returns_raw_text(self, db):
        adapter = TranscriptAdapter()
        text = "Recruiter: Start. Candidate: " + "z" * 80
        result = adapter.ingest(TranscriptPayload(raw_text=text), db)
        returned = adapter.produce_transcript(result.source_event_id, db)
        assert returned == text

    def test_ingest_propagates_job_reference(self, db):
        adapter = TranscriptAdapter()
        result = adapter.ingest(_transcript_payload(job_reference="REQ-001"), db)
        conv = db.get(Conversation, result.conversation_id)
        assert conv.job_reference == "REQ-001"

    def test_no_media_reference_created(self, db):
        adapter = TranscriptAdapter()
        result = adapter.ingest(_transcript_payload(), db)
        from sqlalchemy import select
        refs = db.scalars(
            select(MediaReference).where(MediaReference.conversation_id == result.conversation_id)
        ).all()
        assert len(refs) == 0


# ---------------------------------------------------------------------------
# Audio adapter stub
# ---------------------------------------------------------------------------

class TestAudioAdapterStub:
    def test_ingest_creates_pending_conversation(self, db):
        adapter = AudioAdapter()
        payload = AudioPayload(storage_key="uploads/test.mp3", mime_type="audio/mp3", size_bytes=1024)
        result = adapter.ingest(payload, db)

        conv = db.get(Conversation, result.conversation_id)
        assert conv.transcript_status == "pending"
        assert conv.source_type == "audio"
        assert conv.raw_text is None

    def test_ingest_creates_media_reference(self, db):
        adapter = AudioAdapter()
        payload = AudioPayload(storage_key="uploads/call.m4a", mime_type="audio/m4a", size_bytes=2048)
        result = adapter.ingest(payload, db)

        from sqlalchemy import select
        refs = db.scalars(
            select(MediaReference).where(MediaReference.conversation_id == result.conversation_id)
        ).all()
        assert len(refs) == 1
        assert refs[0].ref_type == "audio_upload"
        assert refs[0].transcription_status == "pending"
        assert refs[0].storage_key == "uploads/call.m4a"

    def test_ingest_transcript_ready_false(self, db):
        adapter = AudioAdapter()
        payload = AudioPayload(storage_key="k", mime_type="audio/wav", size_bytes=100)
        result = adapter.ingest(payload, db)
        assert result.transcript_ready is False

    def test_produce_transcript_raises_without_media(self, db):
        adapter = AudioAdapter()
        with pytest.raises(ValueError, match="No MediaReference found"):
            adapter.produce_transcript(uuid.uuid4(), db)


# ---------------------------------------------------------------------------
# Zoom adapter stub
# ---------------------------------------------------------------------------

class TestZoomAdapterStub:
    def test_ingest_creates_pending_conversation(self, db):
        adapter = ZoomAdapter()
        payload = ZoomWebhookPayload(
            meeting_id="zoom-abc-123",
            recording_url="https://zoom.us/rec/abc",
            host_email="recruiter@co.com",
        )
        result = adapter.ingest(payload, db)

        conv = db.get(Conversation, result.conversation_id)
        assert conv.transcript_status == "pending"
        assert conv.source_type == "zoom"

    def test_ingest_sets_external_id(self, db):
        adapter = ZoomAdapter()
        payload = ZoomWebhookPayload(
            meeting_id="zoom-xyz-999",
            recording_url="https://zoom.us/rec/xyz",
            host_email="host@co.com",
        )
        result = adapter.ingest(payload, db)
        event = db.get(SourceEvent, result.source_event_id)
        assert event.external_id == "zoom-xyz-999"

    def test_ingest_creates_media_reference(self, db):
        adapter = ZoomAdapter()
        payload = ZoomWebhookPayload(
            meeting_id="zm-1",
            recording_url="https://zoom.us/rec/1",
            host_email="h@co.com",
        )
        result = adapter.ingest(payload, db)

        from sqlalchemy import select
        refs = db.scalars(
            select(MediaReference).where(MediaReference.conversation_id == result.conversation_id)
        ).all()
        assert len(refs) == 1
        assert refs[0].ref_type == "recording"

    def test_produce_transcript_raises_without_event(self, db):
        adapter = ZoomAdapter()
        with pytest.raises(ValueError, match="SourceEvent"):
            adapter.produce_transcript(uuid.uuid4(), db)


# ---------------------------------------------------------------------------
# Google Meet adapter stub
# ---------------------------------------------------------------------------

class TestGoogleMeetAdapterStub:
    def test_ingest_creates_pending_conversation(self, db):
        adapter = GoogleMeetAdapter()
        payload = GoogleMeetPayload(
            meeting_id="meet-abc",
            recording_url="https://drive.google.com/rec/abc",
            organizer_email="org@co.com",
        )
        result = adapter.ingest(payload, db)
        conv = db.get(Conversation, result.conversation_id)
        assert conv.source_type == "google_meet"
        assert conv.transcript_status == "pending"

    def test_produce_transcript_raises(self, db):
        adapter = GoogleMeetAdapter()
        with pytest.raises(NotImplementedError):
            adapter.produce_transcript(uuid.uuid4(), db)


# ---------------------------------------------------------------------------
# WhatsApp adapter stub
# ---------------------------------------------------------------------------

class TestWhatsAppAdapterStub:
    def test_ingest_creates_pending_conversation(self, db):
        adapter = WhatsAppAdapter()
        payload = WhatsAppPayload(
            thread_id="wa-thread-001",
            messages=[{"sender": "recruiter", "text": "Hello", "timestamp": "2026-01-01T10:00:00Z"}],
        )
        result = adapter.ingest(payload, db)
        conv = db.get(Conversation, result.conversation_id)
        assert conv.source_type == "whatsapp"
        assert conv.transcript_status == "pending"

    def test_ingest_sets_external_id(self, db):
        adapter = WhatsAppAdapter()
        payload = WhatsAppPayload(thread_id="wa-999", messages=[])
        result = adapter.ingest(payload, db)
        event = db.get(SourceEvent, result.source_event_id)
        assert event.external_id == "wa-999"

    def test_no_media_reference_for_whatsapp(self, db):
        adapter = WhatsAppAdapter()
        payload = WhatsAppPayload(thread_id="wa-no-media", messages=[])
        result = adapter.ingest(payload, db)
        from sqlalchemy import select
        refs = db.scalars(
            select(MediaReference).where(MediaReference.conversation_id == result.conversation_id)
        ).all()
        assert len(refs) == 0

    def test_produce_transcript_raises(self, db):
        adapter = WhatsAppAdapter()
        with pytest.raises(NotImplementedError):
            adapter.produce_transcript(uuid.uuid4(), db)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_source_types_registered(self):
        for stype in ("transcript", "audio", "zoom", "google_meet", "whatsapp"):
            adapter = get_adapter(stype)
            assert adapter.source_type == stype

    def test_unknown_source_type_raises(self):
        with pytest.raises(ValueError, match="No adapter registered"):
            get_adapter("fax_machine")

    def test_returns_same_instance(self):
        a1 = get_adapter("transcript")
        a2 = get_adapter("transcript")
        assert a1 is a2


# ---------------------------------------------------------------------------
# Extraction service guard
# ---------------------------------------------------------------------------

class TestTranscriptNotReadyGuard:
    def test_raises_when_transcript_pending(self, db):
        conv = Conversation(
            source_type="audio",
            transcript_status="pending",
            status="raw",
            raw_text=None,
            char_count=None,
        )
        db.add(conv)
        db.flush()

        with pytest.raises(TranscriptNotReadyError):
            run_extraction(db, conv.id)

    def test_does_not_raise_when_transcript_ready(self, db):
        # A conversation with transcript_status='ready' but no valid text will fail
        # at the OpenAI call — but it should NOT raise TranscriptNotReadyError.
        conv = Conversation(
            source_type="transcript",
            transcript_status="ready",
            status="raw",
            raw_text="short",  # will fail char limit, but that's a different error
            char_count=5,
        )
        db.add(conv)
        db.flush()

        # Should raise ConversationTooLargeError or ExtractionError, NOT TranscriptNotReadyError.
        from app.services.extraction_service import ConversationTooLargeError
        from app.services.openai_client import ExtractionError
        try:
            run_extraction(db, conv.id)
        except TranscriptNotReadyError:
            pytest.fail("TranscriptNotReadyError should not be raised when transcript_status='ready'")
        except (ConversationTooLargeError, ExtractionError, Exception):
            pass  # expected — different error, not our concern here


# ---------------------------------------------------------------------------
# API integration
# ---------------------------------------------------------------------------

class TestConversationsAPI:
    def test_create_conversation_creates_source_event(self, client, db):
        resp = client.post(
            "/api/conversations",
            json={"raw_text": "Recruiter: Hi. Candidate: " + "x" * 60},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["transcript_status"] == "ready"

        from sqlalchemy import select
        events = db.scalars(
            select(SourceEvent).where(
                SourceEvent.conversation_id == uuid.UUID(data["id"])
            )
        ).all()
        assert len(events) == 1
        assert events[0].source_type == "transcript"
        assert events[0].status == "ready"

    def test_create_conversation_rejects_non_transcript_source(self, client):
        resp = client.post(
            "/api/conversations",
            json={"raw_text": "x" * 100, "source_type": "zoom"},
        )
        assert resp.status_code == 400
        assert "not supported" in resp.json()["detail"]

    def test_extract_returns_409_when_transcript_pending(self, client, db):
        conv = Conversation(
            source_type="audio",
            transcript_status="pending",
            status="raw",
            raw_text=None,
            char_count=None,
        )
        db.add(conv)
        db.flush()

        resp = client.post(f"/api/conversations/{conv.id}/extract")
        assert resp.status_code == 409
        assert "not ready" in resp.json()["detail"]
