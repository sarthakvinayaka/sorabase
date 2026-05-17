"""Extraction provider boundary: transcript → structured staffing profile (separate from DB persistence)."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.schemas.staffing_extraction import StaffingExtractionOutput


@runtime_checkable
class StaffingExtractionProvider(Protocol):
    """Pluggable extractor (mock, hosted LLM with JSON mode, self-hosted, etc.)."""

    @property
    def provider_id(self) -> str: ...

    def extract_staffing_profile(
        self,
        *,
        transcript_text: str,
        segments: list[tuple[int, int, int, str, str]] | None = None,
    ) -> StaffingExtractionOutput:
        """
        Return `StaffingExtractionOutput` grounded in the transcript.

        `segments` tuples: (sequence_index, start_ms, end_ms, speaker_label, text).
        Implementations should cite `TranscriptEvidence.quote` as a verbatim substring of `transcript_text` when asserting values.
        """
        ...

