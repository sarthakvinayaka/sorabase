"""OpenAI provider wiring (mocked HTTP client)."""

from unittest.mock import MagicMock, patch

from app.schemas.staffing_extraction import StaffingExtractionOutput
from app.services.extraction.mock_staffing_provider import MockStaffingExtractionProvider
from app.services.extraction.openai_staffing_extraction_provider import OpenAIStaffingExtractionProvider


def test_openai_provider_calls_parse_and_returns_output() -> None:
    fake = MockStaffingExtractionProvider().extract_staffing_profile(
        transcript_text="US citizen in Chicago",
        segments=[(0, 0, 10, "C", "US citizen in Chicago")],
    )
    mock_client = MagicMock()
    mock_client.beta.chat.completions.parse.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(parsed=fake, refusal=None))],
    )
    with patch("app.services.extraction.openai_staffing_extraction_provider.OpenAI", return_value=mock_client):
        prov = OpenAIStaffingExtractionProvider(api_key="sk-test-key", model="gpt-4o-mini")
        out = prov.extract_staffing_profile(transcript_text="US citizen in Chicago", segments=None)

    assert out.schema_version == "staffing_extraction.v1"
    mock_client.beta.chat.completions.parse.assert_called_once()
    call_kw = mock_client.beta.chat.completions.parse.call_args.kwargs
    assert call_kw["response_format"] is StaffingExtractionOutput
