"""Select extraction implementation from settings (swap point for real LLM workers)."""

from __future__ import annotations

from app.core.config import settings
from app.services.extraction.errors import ExtractionConfigurationError
from app.services.extraction.mock_staffing_provider import MockStaffingExtractionProvider
from app.services.extraction.openai_staffing_extraction_provider import OpenAIStaffingExtractionProvider
from app.services.extraction.protocol import StaffingExtractionProvider


def get_staffing_extraction_provider() -> StaffingExtractionProvider:
    """
    Select implementation from ``settings.extraction_provider``:

    - ``mock`` / ``local`` / ``dev`` — heuristic ``MockStaffingExtractionProvider``
    - ``openai`` — ``OpenAIStaffingExtractionProvider`` (requires ``OPENAI_API_KEY``)
    """
    key = (settings.extraction_provider or "mock").strip().lower()
    if key in ("mock", "local", "dev"):
        return MockStaffingExtractionProvider()
    if key == "openai":
        if not (settings.openai_api_key or "").strip():
            msg = "OPENAI_API_KEY is required when EXTRACTION_PROVIDER=openai"
            raise ExtractionConfigurationError(msg)
        return OpenAIStaffingExtractionProvider()
    msg = f"Unknown extraction provider: {key!r}"
    raise ExtractionConfigurationError(msg)
