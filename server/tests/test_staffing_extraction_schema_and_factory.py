"""Schema validation and factory wiring for extraction."""

import pytest
from pydantic import ValidationError

from app.core import config
from app.schemas.staffing_extraction import StaffingExtractionOutput
from app.services.extraction.errors import ExtractionConfigurationError
from app.services.extraction.factory import get_staffing_extraction_provider
from app.services.extraction.mock_staffing_provider import MockStaffingExtractionProvider


def test_staffing_output_rejects_missing_fields_mismatch() -> None:
    base = MockStaffingExtractionProvider().extract_staffing_profile(
        transcript_text="no structured content here",
        segments=None,
    )
    data = base.model_dump(mode="python")
    data["missing_fields"] = list(set(data["missing_fields"]) | {"email"})
    data["fields"]["email"] = {
        "value": "conflict@example.com",
        "confidence": 0.9,
        "evidence": {"quote": "conflict@example.com", "segment_index": None, "start_ms": None, "end_ms": None},
        "ambiguity_note": None,
    }
    with pytest.raises(ValidationError):
        StaffingExtractionOutput.model_validate(data)


def test_factory_openai_without_key_raises() -> None:
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(config.settings, "extraction_provider", "openai", raising=False)
        mp.setattr(config.settings, "openai_api_key", "", raising=False)
        with pytest.raises(ExtractionConfigurationError, match="OPENAI_API_KEY"):
            get_staffing_extraction_provider()


def test_factory_unknown_provider_raises() -> None:
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(config.settings, "extraction_provider", "unknown-vendor", raising=False)
        with pytest.raises(ExtractionConfigurationError, match="Unknown extraction provider"):
            get_staffing_extraction_provider()
