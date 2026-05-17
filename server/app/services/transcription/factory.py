"""Resolve ASR implementation from settings (swap point for Whisper / Deepgram / AWS)."""

from __future__ import annotations

from app.core.config import settings
from app.services.transcription.mock_provider import MockTranscriptionProvider
from app.services.transcription.protocol import TranscriptionProvider


def get_transcription_provider() -> TranscriptionProvider:
    key = (settings.transcription_provider or "mock").strip().lower()
    if key in ("mock", "local", "dev"):
        return MockTranscriptionProvider()
    msg = f"Unknown transcription provider: {key!r}"
    raise ValueError(msg)
