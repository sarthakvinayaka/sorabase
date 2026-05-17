"""
Isolated wrapper around the OpenAI Structured Outputs API.

Responsibilities:
- Build the request (messages + response_format)
- Call the API with a timeout
- Return the parsed Pydantic model and token usage
- Raise ExtractionError on any failure so callers don't need to import openai

Nothing in this module reads from or writes to the database.
"""

from dataclasses import dataclass

import openai

from app.config import settings
from app.domain.extraction_schemas import ExtractionLLMResponse
from app.prompts.extraction import (
    EXTRACTION_SYSTEM_PROMPT,
    build_extraction_user_message,
)


class ExtractionError(Exception):
    """Raised when the OpenAI call fails or the response cannot be validated."""


@dataclass
class ExtractionResult:
    response: ExtractionLLMResponse
    prompt_tokens: int
    completion_tokens: int
    model_used: str


def extract_from_transcript(transcript_text: str) -> ExtractionResult:
    """
    Call OpenAI Structured Outputs and return a validated ExtractionLLMResponse.
    Raises ExtractionError on API failure, refusal, or schema mismatch.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)

    try:
        completion = client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": build_extraction_user_message(transcript_text)},
            ],
            response_format=ExtractionLLMResponse,
            max_tokens=4096,
            timeout=60,
        )
    except openai.APITimeoutError as exc:
        raise ExtractionError("OpenAI request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise ExtractionError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise ExtractionError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise ExtractionError(f"OpenAI API error: {exc}") from exc

    message = completion.choices[0].message

    if message.refusal:
        raise ExtractionError(f"Model refused to extract: {message.refusal}")

    if message.parsed is None:
        raise ExtractionError("Model response could not be parsed into the expected schema.")

    usage = completion.usage
    return ExtractionResult(
        response=message.parsed,
        prompt_tokens=usage.prompt_tokens if usage else 0,
        completion_tokens=usage.completion_tokens if usage else 0,
        model_used=completion.model,
    )
