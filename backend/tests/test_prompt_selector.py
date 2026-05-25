"""
Unit tests for the prompt selector and prompt injection in extraction clients.

No database or OpenAI calls are made here — everything is tested via mocks.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.prompts.extraction import EXTRACTION_SYSTEM_PROMPT
from app.prompts.general_extraction import GENERAL_EXTRACTION_SYSTEM_PROMPT
from app.prompts.selector import get_extraction_system_prompt


# ── selector ──────────────────────────────────────────────────────────────────

class TestGetExtractionSystemPrompt:
    def test_recruiter_returns_recruiter_prompt(self):
        result = get_extraction_system_prompt("recruiter")
        assert result is EXTRACTION_SYSTEM_PROMPT

    def test_general_returns_general_prompt(self):
        result = get_extraction_system_prompt("general")
        assert result is GENERAL_EXTRACTION_SYSTEM_PROMPT

    def test_prompts_are_distinct(self):
        assert get_extraction_system_prompt("recruiter") != get_extraction_system_prompt("general")

    def test_recruiter_prompt_contains_mode_marker(self):
        assert "recruiter-mode" in get_extraction_system_prompt("recruiter")

    def test_general_prompt_contains_mode_marker(self):
        assert "general-mode" in get_extraction_system_prompt("general")


# ── openai_client uses recruiter prompt by default ────────────────────────────

class TestExtractFromTranscriptPrompt:
    """Verify that extract_from_transcript passes the recruiter prompt to OpenAI."""

    def _make_mock_completion(self, parsed_obj):
        usage = MagicMock(prompt_tokens=10, completion_tokens=20)
        message = MagicMock(refusal=None, parsed=parsed_obj)
        choice = MagicMock(message=message)
        completion = MagicMock(choices=[choice], usage=usage, model="gpt-4o")
        return completion

    @patch("app.services.openai_client.openai.OpenAI")
    def test_default_uses_recruiter_prompt(self, mock_openai_cls):
        from app.domain.extraction_schemas import ExtractionLLMResponse
        mock_parsed = MagicMock(spec=ExtractionLLMResponse)
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.beta.chat.completions.parse.return_value = self._make_mock_completion(mock_parsed)

        from app.services.openai_client import extract_from_transcript
        extract_from_transcript("some transcript")

        call_kwargs = mock_client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        system_content = messages[0]["content"]
        assert system_content == EXTRACTION_SYSTEM_PROMPT

    @patch("app.services.openai_client.openai.OpenAI")
    def test_custom_prompt_override(self, mock_openai_cls):
        from app.domain.extraction_schemas import ExtractionLLMResponse
        mock_parsed = MagicMock(spec=ExtractionLLMResponse)
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.beta.chat.completions.parse.return_value = self._make_mock_completion(mock_parsed)

        custom = "CUSTOM SYSTEM PROMPT"
        from app.services.openai_client import extract_from_transcript
        extract_from_transcript("some transcript", system_prompt=custom)

        call_kwargs = mock_client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["content"] == custom


# ── general_extraction_client uses general prompt by default ──────────────────

class TestExtractGeneralPrompt:
    """Verify that extract_general passes the general prompt to OpenAI."""

    def _make_mock_completion(self, columns):
        from pydantic import BaseModel, create_model
        from app.domain.general_extraction_schemas import FIELD_TYPE_MAP
        field_defs = {col.name: (FIELD_TYPE_MAP.get(col.type, FIELD_TYPE_MAP["text"]), ...) for col in columns}
        field_defs["extracted_summary"] = (str, ...)
        field_defs["missing_fields"] = (list[str], ...)
        field_defs["ambiguous_fields"] = (list[str], ...)
        DynModel = create_model("DynModel", **field_defs)

        # Build a valid instance so model_dump() works
        instance_data = {col.name: {"value": None, "confidence": 0.0, "status": "missing", "evidence_snippet": None} for col in columns}
        instance_data["extracted_summary"] = ""
        instance_data["missing_fields"] = []
        instance_data["ambiguous_fields"] = []
        parsed_obj = DynModel(**instance_data)

        usage = MagicMock(prompt_tokens=10, completion_tokens=20)
        message = MagicMock(refusal=None, parsed=parsed_obj)
        choice = MagicMock(message=message)
        return MagicMock(choices=[choice], usage=usage, model="gpt-4o")

    @patch("app.services.general_extraction_client.openai.OpenAI")
    def test_default_uses_general_prompt(self, mock_openai_cls):
        from app.domain.general_extraction_schemas import ApprovedColumn
        columns = [ApprovedColumn(name="role", type="text", description="Job title", required=True)]

        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.beta.chat.completions.parse.return_value = self._make_mock_completion(columns)

        from app.services.general_extraction_client import extract_general
        extract_general("some transcript", columns)

        call_kwargs = mock_client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["content"] == GENERAL_EXTRACTION_SYSTEM_PROMPT

    @patch("app.services.general_extraction_client.openai.OpenAI")
    def test_custom_prompt_override(self, mock_openai_cls):
        from app.domain.general_extraction_schemas import ApprovedColumn
        columns = [ApprovedColumn(name="role", type="text", description="Job title", required=True)]

        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client
        mock_client.beta.chat.completions.parse.return_value = self._make_mock_completion(columns)

        custom = "MY CUSTOM GENERAL PROMPT"
        from app.services.general_extraction_client import extract_general
        extract_general("some transcript", columns, system_prompt=custom)

        call_kwargs = mock_client.beta.chat.completions.parse.call_args
        messages = call_kwargs.kwargs["messages"]
        assert messages[0]["content"] == custom
