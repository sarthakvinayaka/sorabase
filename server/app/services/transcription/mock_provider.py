"""Deterministic canned transcripts for local/dev (no network)."""

from __future__ import annotations

from app.db.models.audio_upload import AudioUpload
from app.services.transcription.protocol import (
    TranscriptionProvider,
    TranscriptionResult,
    TranscriptionSegmentResult,
)


def _dialogue_to_result(
    *,
    provider_id: str,
    language: str,
    turns: list[tuple[str, str]],
    target_total_ms: int,
) -> TranscriptionResult:
    char_total = sum(len(t[1]) for t in turns) + 1
    ms_budget = max(target_total_ms, 90_000)
    ms_per_char = max(28, ms_budget // char_total)

    segments: list[TranscriptionSegmentResult] = []
    lines: list[str] = []
    cursor = 0
    for idx, (speaker, text) in enumerate(turns):
        t = text.strip()
        duration = max(3_200, min(48_000, len(t) * ms_per_char))
        start = int(cursor)
        end = int(cursor + duration)
        cursor = end + 350
        segments.append(
            TranscriptionSegmentResult(
                sequence_index=idx,
                start_ms=start,
                end_ms=end,
                speaker_label=speaker,
                text=t,
            ),
        )
        lines.append(f"[{speaker}]: {t}")
    full = "\n\n".join(lines)
    return TranscriptionResult(
        full_text=full,
        language=language,
        segments=tuple(segments),
        provider_id=provider_id,
    )


_SAMPLES: tuple[tuple[str, list[tuple[str, str]], int], ...] = (
    (
        "en",
        [
            ("Recruiter", "Thanks for making time — this is a mock transcript tied to your upload id for dev."),
            (
                "Candidate",
                "Happy to help. I’m summarizing my last role: owned intake SLAs for a 40-person recruiting pod.",
            ),
            (
                "Recruiter",
                "Great. Compensation band and notice period if we move forward with a client submittal this week?",
            ),
            (
                "Candidate",
                "I’m at 165 base today; I’d need 175+ for a switch. Two weeks notice is standard; I can flex documentation overlap.",
            ),
        ],
        14 * 60 * 1000,
    ),
    (
        "en",
        [
            ("Recruiter", "Mock screen two — confirm work authorization and location constraints for the client packet."),
            ("Candidate", "US citizen, hybrid in Chicago two days, otherwise remote within Illinois."),
            ("Recruiter", "Skills snapshot in two sentences?"),
            (
                "Candidate",
                "SAP FI cash application plus light treasury; I avoid pure SD config unless there’s a functional partner.",
            ),
        ],
        11 * 60 * 1000,
    ),
    (
        "en",
        [
            ("Recruiter", "Travel contract check: confirm compact licenses and any facility discipline flags."),
            ("Candidate", "Compact RN, no flags, last assignment was infusion outpatient."),
            ("Recruiter", "Availability for a 13-week Phoenix start?"),
            ("Candidate", "Two weeks wind-down with current agency; start third Monday out."),
        ],
        12 * 60 * 1000,
    ),
)


class MockTranscriptionProvider:
    """Returns canned dialogue; chooses sample from `upload.id` (stable per upload)."""

    @property
    def provider_id(self) -> str:
        return "mock-transcription"

    def transcribe(
        self,
        *,
        upload: AudioUpload,
        audio_bytes: bytes | None = None,
    ) -> TranscriptionResult:
        _ = audio_bytes  # Real providers consume audio; mock ignores bytes.
        idx = upload.id.int % len(_SAMPLES)
        language, turns, target_ms = _SAMPLES[idx]
        return _dialogue_to_result(provider_id=self.provider_id, language=language, turns=list(turns), target_total_ms=target_ms)
