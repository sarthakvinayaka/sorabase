"""
OpenAI client for General Mode dynamic extraction.

Builds a Pydantic model at runtime from user-approved columns, then calls the
Structured Outputs API with that model as response_format.
"""

from dataclasses import dataclass, field
from typing import Any

import openai
from pydantic import BaseModel, create_model

from app.config import settings
from app.domain.general_extraction_schemas import ApprovedColumn, FIELD_TYPE_MAP
from app.prompts.general_extraction import (
    GENERAL_EXTRACTION_SYSTEM_PROMPT,
    build_general_extraction_user_message,
)


class GeneralExtractionError(Exception):
    """Raised when the OpenAI call fails or the response cannot be validated."""


@dataclass
class GeneralExtractionResult:
    fields: dict[str, Any]  # { field_name: { value, confidence, status, evidence_snippet } }
    extracted_summary: str
    missing_fields: list[str]
    ambiguous_fields: list[str]
    prompt_tokens: int
    completion_tokens: int
    model_used: str


def _build_response_model(columns: list[ApprovedColumn]) -> type[BaseModel]:
    """Build a dynamic Pydantic model from the approved column list."""
    field_defs: dict[str, Any] = {}
    for col in columns:
        extraction_type = FIELD_TYPE_MAP.get(col.type, FIELD_TYPE_MAP["text"])
        field_defs[col.name] = (extraction_type, ...)
    field_defs["extracted_summary"] = (str, ...)
    field_defs["missing_fields"] = (list[str], ...)
    field_defs["ambiguous_fields"] = (list[str], ...)
    return create_model("GeneralExtractionLLMResponse", **field_defs)


_EMPTY_FIELD: dict[str, Any] = {
    "value": None,
    "confidence": 0.0,
    "status": "missing",
    "evidence_snippet": None,
}


def extract_general(
    transcript_text: str,
    columns: list[ApprovedColumn],
) -> GeneralExtractionResult:
    """
    Call OpenAI Structured Outputs with a dynamically-built schema.
    Raises GeneralExtractionError on any failure.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)
    response_model = _build_response_model(columns)

    try:
        completion = client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": GENERAL_EXTRACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_general_extraction_user_message(transcript_text, columns),
                },
            ],
            response_format=response_model,
            max_tokens=4096,
            timeout=60,
        )
    except openai.APITimeoutError as exc:
        raise GeneralExtractionError("OpenAI request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise GeneralExtractionError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise GeneralExtractionError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise GeneralExtractionError(f"OpenAI API error: {exc}") from exc

    message = completion.choices[0].message
    if message.refusal:
        raise GeneralExtractionError(f"Model refused to extract: {message.refusal}")
    if message.parsed is None:
        raise GeneralExtractionError("Model response could not be parsed into the expected schema.")

    parsed_dict = message.parsed.model_dump()
    usage = completion.usage

    return GeneralExtractionResult(
        fields={col.name: parsed_dict.get(col.name, _EMPTY_FIELD) for col in columns},
        extracted_summary=parsed_dict.get("extracted_summary", ""),
        missing_fields=parsed_dict.get("missing_fields", []),
        ambiguous_fields=parsed_dict.get("ambiguous_fields", []),
        prompt_tokens=usage.prompt_tokens if usage else 0,
        completion_tokens=usage.completion_tokens if usage else 0,
        model_used=completion.model,
    )
