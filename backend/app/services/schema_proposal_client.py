"""
OpenAI Structured Outputs client for schema proposal generation.

Responsibilities:
- Build the request (messages + response_format)
- Call the API with a timeout
- Validate the parsed response (column count, name format, uniqueness)
- Return a SchemaProposalResult dataclass
- Raise SchemaProposalError on any failure so callers don't need to import openai
"""

import re
from dataclasses import dataclass

import openai

from app.config import settings
from app.domain.schema_proposal_schemas import ProposedColumn, SchemaProposalLLMResponse
from app.prompts.schema_proposal import (
    SCHEMA_PROPOSAL_SYSTEM_PROMPT,
    build_schema_proposal_user_message,
)

MIN_COLUMNS = 5
MAX_COLUMNS = 15

_SNAKE_CASE_RE = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")


class SchemaProposalError(Exception):
    """Raised when proposal generation or post-parse validation fails."""


@dataclass
class SchemaProposalResult:
    columns:           list[ProposedColumn]
    rationale:         str
    model_used:        str
    prompt_tokens:     int
    completion_tokens: int


def propose_schema(
    transcript: str,
    summary: str | None = None,
) -> SchemaProposalResult:
    """
    Ask the LLM to propose extraction columns for this conversation.

    Validates:
    - Column count is in [MIN_COLUMNS, MAX_COLUMNS]
    - All column names are valid snake_case identifiers
    - No duplicate column names

    Returns a validated SchemaProposalResult.
    Raises SchemaProposalError on API failure, refusal, or validation failure.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)
    user_message = build_schema_proposal_user_message(transcript, summary)

    try:
        completion = client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SCHEMA_PROPOSAL_SYSTEM_PROMPT},
                {"role": "user",   "content": user_message},
            ],
            response_format=SchemaProposalLLMResponse,
            max_tokens=2048,
            timeout=60,
        )
    except openai.APITimeoutError as exc:
        raise SchemaProposalError("OpenAI request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise SchemaProposalError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise SchemaProposalError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise SchemaProposalError(f"OpenAI API error: {exc}") from exc

    message = completion.choices[0].message

    if message.refusal:
        raise SchemaProposalError(f"Model refused to generate schema: {message.refusal}")

    if message.parsed is None:
        raise SchemaProposalError("Model response could not be parsed into the expected schema.")

    parsed: SchemaProposalLLMResponse = message.parsed
    _validate(parsed)

    usage = completion.usage
    return SchemaProposalResult(
        columns=parsed.columns,
        rationale=parsed.rationale,
        model_used=completion.model,
        prompt_tokens=usage.prompt_tokens if usage else 0,
        completion_tokens=usage.completion_tokens if usage else 0,
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate(parsed: SchemaProposalLLMResponse) -> None:
    """
    Enforce post-parse constraints that JSON Schema / Pydantic cannot express
    in strict mode:
      1. Column count in [MIN_COLUMNS, MAX_COLUMNS]
      2. Each name is a valid snake_case identifier
      3. No duplicate names
    Raises SchemaProposalError with a descriptive message on any violation.
    """
    n = len(parsed.columns)
    if not (MIN_COLUMNS <= n <= MAX_COLUMNS):
        raise SchemaProposalError(
            f"Expected {MIN_COLUMNS}–{MAX_COLUMNS} columns, got {n}."
        )

    for col in parsed.columns:
        if not _SNAKE_CASE_RE.match(col.name):
            raise SchemaProposalError(
                f"Column name {col.name!r} is not a valid snake_case identifier "
                "(lowercase letters, digits, and underscores only; must start with a letter)."
            )

    names = [col.name for col in parsed.columns]
    seen: set[str] = set()
    duplicates: list[str] = []
    for name in names:
        if name in seen:
            duplicates.append(name)
        seen.add(name)
    if duplicates:
        raise SchemaProposalError(
            f"Duplicate column names returned by model: {duplicates}. "
            "Each column name must be unique."
        )
