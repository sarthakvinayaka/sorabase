"""
Tests for schema proposal service and route.

The OpenAI client is mocked — these tests verify validation logic and
route integration, not LLM quality.
"""

from unittest.mock import patch

import pytest

from app.db.models import Conversation
from app.domain.schema_proposal_schemas import ColumnType, ProposedColumn, SchemaProposalLLMResponse
from app.services.schema_proposal_client import (
    MIN_COLUMNS,
    MAX_COLUMNS,
    SchemaProposalError,
    SchemaProposalResult,
    _validate,
    propose_schema,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_column(name: str = "topic", type: ColumnType = ColumnType.TEXT) -> ProposedColumn:
    return ProposedColumn(name=name, description="A useful column.", type=type, required=True)


def _make_valid_llm_response(n: int = 7) -> SchemaProposalLLMResponse:
    columns = [_make_column(f"column_{i}") for i in range(n)]
    return SchemaProposalLLMResponse(columns=columns, rationale="These columns cover the key topics.")


def _make_proposal_result(response: SchemaProposalLLMResponse) -> SchemaProposalResult:
    return SchemaProposalResult(
        columns=response.columns,
        rationale=response.rationale,
        model_used="gpt-4o-2024-08-06",
        prompt_tokens=500,
        completion_tokens=200,
    )


# ---------------------------------------------------------------------------
# Validation unit tests (no DB, no network)
# ---------------------------------------------------------------------------

class TestValidate:
    def test_valid_response_passes(self):
        _validate(_make_valid_llm_response(7))  # should not raise

    def test_too_few_columns_raises(self):
        response = _make_valid_llm_response(MIN_COLUMNS - 1)
        with pytest.raises(SchemaProposalError, match="got 4"):
            _validate(response)

    def test_too_many_columns_raises(self):
        response = _make_valid_llm_response(MAX_COLUMNS + 1)
        with pytest.raises(SchemaProposalError, match="got 16"):
            _validate(response)

    def test_min_columns_passes(self):
        _validate(_make_valid_llm_response(MIN_COLUMNS))

    def test_max_columns_passes(self):
        _validate(_make_valid_llm_response(MAX_COLUMNS))

    def test_invalid_name_with_space_raises(self):
        response = _make_valid_llm_response(5)
        response.columns[0] = _make_column("bad name")
        with pytest.raises(SchemaProposalError, match="not a valid snake_case"):
            _validate(response)

    def test_invalid_name_with_hyphen_raises(self):
        response = _make_valid_llm_response(5)
        response.columns[0] = _make_column("bad-name")
        with pytest.raises(SchemaProposalError, match="not a valid snake_case"):
            _validate(response)

    def test_invalid_name_starts_with_digit_raises(self):
        response = _make_valid_llm_response(5)
        response.columns[0] = _make_column("1_invalid")
        with pytest.raises(SchemaProposalError, match="not a valid snake_case"):
            _validate(response)

    def test_valid_snake_case_names_pass(self):
        response = _make_valid_llm_response(5)
        response.columns[0] = _make_column("meeting_purpose")
        response.columns[1] = _make_column("action_items2")
        _validate(response)  # should not raise

    def test_duplicate_names_raises(self):
        response = _make_valid_llm_response(5)
        response.columns[1] = _make_column(response.columns[0].name)
        with pytest.raises(SchemaProposalError, match="Duplicate"):
            _validate(response)


# ---------------------------------------------------------------------------
# propose_schema unit tests (mock OpenAI)
# ---------------------------------------------------------------------------

class TestProposeSchema:
    @patch("app.services.schema_proposal_client.openai.OpenAI")
    def test_returns_result_on_valid_response(self, mock_openai_cls):
        llm_response = _make_valid_llm_response(8)
        mock_client = mock_openai_cls.return_value
        mock_client.beta.chat.completions.parse.return_value = _make_completion(llm_response)

        result = propose_schema("Some transcript text here.", summary=None)

        assert len(result.columns) == 8
        assert result.rationale == "These columns cover the key topics."
        assert result.model_used == "gpt-4o-2024-08-06"

    @patch("app.services.schema_proposal_client.openai.OpenAI")
    def test_passes_summary_when_provided(self, mock_openai_cls):
        llm_response = _make_valid_llm_response(6)
        mock_client = mock_openai_cls.return_value
        mock_client.beta.chat.completions.parse.return_value = _make_completion(llm_response)

        result = propose_schema("Transcript text.", summary="This meeting was about Q2 planning.")

        assert len(result.columns) == 6
        # Verify the API was actually called
        mock_client.beta.chat.completions.parse.assert_called_once()

    @patch("app.services.schema_proposal_client.openai.OpenAI")
    def test_raises_on_too_few_columns(self, mock_openai_cls):
        llm_response = _make_valid_llm_response(2)
        mock_client = mock_openai_cls.return_value
        mock_client.beta.chat.completions.parse.return_value = _make_completion(llm_response)

        with pytest.raises(SchemaProposalError, match="got 2"):
            propose_schema("Transcript text.")

    @patch("app.services.schema_proposal_client.openai.OpenAI")
    def test_raises_on_refusal(self, mock_openai_cls):
        mock_client = mock_openai_cls.return_value
        mock_client.beta.chat.completions.parse.return_value = _make_refusal_completion()

        with pytest.raises(SchemaProposalError, match="refused"):
            propose_schema("Transcript text.")

    @patch("app.services.schema_proposal_client.openai.OpenAI")
    def test_raises_on_api_timeout(self, mock_openai_cls):
        import openai as _openai
        mock_client = mock_openai_cls.return_value
        mock_client.beta.chat.completions.parse.side_effect = _openai.APITimeoutError(
            request=None  # type: ignore[arg-type]
        )

        with pytest.raises(SchemaProposalError, match="timed out"):
            propose_schema("Transcript text.")


# ---------------------------------------------------------------------------
# Route integration tests (real DB, mock OpenAI)
# ---------------------------------------------------------------------------

class TestSchemaProposalRoute:
    @pytest.fixture()
    def conversation(self, db) -> Conversation:
        c = Conversation(
            source_type="transcript",
            status="extracted",
            raw_text="Attendee A: Let's discuss the Q2 budget.\nAttendee B: Agreed, I think we need 50k.",
            char_count=80,
            transcript_status="ready",
        )
        db.add(c)
        db.flush()
        return c

    @patch("app.api.routes.schema_proposals.propose_schema")
    def test_returns_200_with_valid_proposal(self, mock_propose, client, conversation):
        llm_response = _make_valid_llm_response(6)
        mock_propose.return_value = _make_proposal_result(llm_response)

        resp = client.post(f"/api/conversations/{conversation.id}/schema-proposal")

        assert resp.status_code == 200
        data = resp.json()
        assert data["conversation_id"] == str(conversation.id)
        assert len(data["columns"]) == 6
        assert "rationale" in data
        assert "model_used" in data
        assert "generated_at" in data

    @patch("app.api.routes.schema_proposals.propose_schema")
    def test_column_fields_present(self, mock_propose, client, conversation):
        llm_response = _make_valid_llm_response(5)
        llm_response.columns[0] = ProposedColumn(
            name="budget_amount",
            description="The budget figure discussed.",
            type=ColumnType.NUMBER,
            required=True,
        )
        mock_propose.return_value = _make_proposal_result(llm_response)

        resp = client.post(f"/api/conversations/{conversation.id}/schema-proposal")
        data = resp.json()

        first = data["columns"][0]
        assert first["name"] == "budget_amount"
        assert first["type"] == "number"
        assert first["required"] is True
        assert "description" in first

    def test_returns_404_for_unknown_conversation(self, client):
        import uuid
        resp = client.post(f"/api/conversations/{uuid.uuid4()}/schema-proposal")
        assert resp.status_code == 404

    def test_returns_409_when_transcript_not_ready(self, client, db):
        c = Conversation(
            source_type="audio",
            status="raw",
            raw_text=None,
            char_count=None,
            transcript_status="pending",
        )
        db.add(c)
        db.flush()

        resp = client.post(f"/api/conversations/{c.id}/schema-proposal")
        assert resp.status_code == 409

    @patch("app.api.routes.schema_proposals.propose_schema")
    def test_returns_503_on_llm_failure(self, mock_propose, client, conversation):
        mock_propose.side_effect = SchemaProposalError("OpenAI rate limit exceeded.")

        resp = client.post(f"/api/conversations/{conversation.id}/schema-proposal")
        assert resp.status_code == 503
        assert "Schema proposal failed" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Mock completion builders
# ---------------------------------------------------------------------------

class _FakeUsage:
    prompt_tokens = 500
    completion_tokens = 200


class _FakeMessage:
    def __init__(self, parsed, refusal=None):
        self.parsed = parsed
        self.refusal = refusal


class _FakeChoice:
    def __init__(self, parsed, refusal=None):
        self.message = _FakeMessage(parsed, refusal)


class _FakeCompletion:
    model = "gpt-4o-2024-08-06"
    usage = _FakeUsage()

    def __init__(self, choices):
        self.choices = choices


def _make_completion(parsed: SchemaProposalLLMResponse) -> _FakeCompletion:
    return _FakeCompletion(choices=[_FakeChoice(parsed=parsed)])


def _make_refusal_completion() -> _FakeCompletion:
    return _FakeCompletion(choices=[_FakeChoice(parsed=None, refusal="I cannot do this.")])
