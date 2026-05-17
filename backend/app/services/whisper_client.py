"""
Whisper transcription wrapper.

Calls openai.audio.transcriptions.create with response_format="verbose_json"
so we get the full segment-level output (timestamps, confidence proxies).
"""

import io
from dataclasses import dataclass
from typing import Any

import openai

from app.config import settings


@dataclass
class WhisperResult:
    text: str
    duration_seconds: int | None
    language: str | None
    segments: list[dict]          # raw Whisper segment objects
    raw_response: dict[str, Any]  # full verbose_json response


def transcribe(file_bytes: bytes, filename: str, mime_type: str) -> WhisperResult:
    """
    Transcribe audio bytes via the Whisper API.

    Returns WhisperResult with full verbose_json for segment-level storage.
    Raises openai.APIError (or subclasses) on failure.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)

    audio_file = io.BytesIO(file_bytes)
    audio_file.name = filename

    response = client.audio.transcriptions.create(
        model=settings.whisper_model,
        file=audio_file,
        response_format="verbose_json",
    )

    raw = response.model_dump() if hasattr(response, "model_dump") else dict(response)

    duration_raw = raw.get("duration")
    duration = int(duration_raw) if duration_raw is not None else None

    return WhisperResult(
        text=raw.get("text", ""),
        duration_seconds=duration,
        language=raw.get("language"),
        segments=raw.get("segments", []),
        raw_response=raw,
    )
