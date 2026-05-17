"""
Meeting-bot provider abstraction.

BotProvider  — Protocol every bot implementation must satisfy.
              Swap RecallBotProvider for a native Zoom bot by implementing
              this interface and updating get_bot_provider().

RecallBotProvider — Production implementation via Recall.ai REST API.
                    Docs: https://docs.recall.ai/reference/
"""

import logging
from typing import Protocol, runtime_checkable

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_RECALL_BASE = "https://us-east-1.recall.ai/api/v1"


# ---------------------------------------------------------------------------
# Provider protocol (swap surface)
# ---------------------------------------------------------------------------

@runtime_checkable
class BotProvider(Protocol):
    def create_bot(self, *, meeting_url: str, bot_name: str) -> str:
        """Start a bot session. Returns the provider's bot ID."""
        ...

    def get_bot(self, bot_id: str) -> dict:
        """Fetch current bot state. Returns provider-native dict."""
        ...

    def get_transcript(self, bot_id: str) -> str | None:
        """Fetch the final transcript text, or None if not yet available."""
        ...

    def cancel_bot(self, bot_id: str) -> None:
        """Remove the bot from the meeting (best-effort)."""
        ...


# ---------------------------------------------------------------------------
# Recall.ai implementation
# ---------------------------------------------------------------------------

class RecallBotProvider:
    """
    Recall.ai meeting bot.

    Auth:   Authorization: Token {recall_api_key}
    Region: us-east-1 (configurable via _RECALL_BASE constant above)

    Recall sends webhook events to a URL configured in the Recall dashboard.
    Set the webhook destination to:  {APP_BASE_URL}/api/webhooks/recall
    """

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {settings.recall_api_key}",
            "Content-Type": "application/json",
        }

    def create_bot(self, *, meeting_url: str, bot_name: str) -> str:
        payload = {
            "meeting_url": meeting_url,
            "bot_name": bot_name,
            "transcription_options": {
                "provider": "assembly_ai",  # speaker diarization, good quality
            },
        }
        with httpx.Client(timeout=30.0) as client:
            r = client.post(f"{_RECALL_BASE}/bot", headers=self._headers, json=payload)
            r.raise_for_status()
        bot_id = str(r.json()["id"])
        logger.info("Recall bot created: bot_id=%s meeting=%s", bot_id, meeting_url)
        return bot_id

    def get_bot(self, bot_id: str) -> dict:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(f"{_RECALL_BASE}/bot/{bot_id}", headers=self._headers)
            r.raise_for_status()
        return r.json()

    def get_transcript(self, bot_id: str) -> str | None:
        """
        Fetch speaker-segmented transcript from Recall and format it as
        plain text suitable for extraction.
        Returns None if transcript is not available yet.
        """
        with httpx.Client(timeout=60.0) as client:
            r = client.get(f"{_RECALL_BASE}/bot/{bot_id}/transcript", headers=self._headers)
            if r.status_code == 404:
                return None
            r.raise_for_status()
        return _format_recall_transcript(r.json())

    def cancel_bot(self, bot_id: str) -> None:
        with httpx.Client(timeout=15.0) as client:
            r = client.delete(f"{_RECALL_BASE}/bot/{bot_id}", headers=self._headers)
            if r.status_code in (404, 410):
                return  # already removed
            r.raise_for_status()
        logger.info("Recall bot cancelled: bot_id=%s", bot_id)


# ---------------------------------------------------------------------------
# Transcript formatting
# ---------------------------------------------------------------------------

def _format_recall_transcript(data: list | dict) -> str | None:
    """
    Convert Recall's transcript JSON to a plain-text readable transcript.

    Recall returns a list of speaker turns:
      [{"speaker": "Speaker 0", "words": [{"text": "Hello", ...}]}, ...]

    We emit:
      Speaker 0: Hello this is my experience...
      Speaker 1: Great, tell me more...
    """
    entries: list = data if isinstance(data, list) else data.get("results", [])
    if not entries:
        return None

    lines: list[str] = []
    for entry in entries:
        speaker: str = entry.get("speaker") or "Unknown"
        words: list[dict] = entry.get("words") or []
        text = " ".join(w.get("text", "") for w in words).strip()
        if text:
            lines.append(f"{speaker}: {text}")

    return "\n".join(lines) if lines else None


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_bot_provider() -> BotProvider:
    """Return the active provider. Replace RecallBotProvider here to swap providers."""
    return RecallBotProvider()
