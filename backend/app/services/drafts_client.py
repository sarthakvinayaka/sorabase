"""
Plain-text OpenAI wrapper for draft generation.
Uses chat.completions.create() — not structured outputs — since the output is prose.
"""

import openai

from app.config import settings
from app.prompts.drafts import (
    SUBMITTAL_SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    build_submittal_user_message,
    build_summary_user_message,
)


class DraftGenerationError(Exception):
    """Raised when the OpenAI call fails or returns an empty response."""


def generate_summary_text(
    candidate_profile: str,
    transcript: str,
) -> str:
    """
    Generate a 140-180 word candidate profile summary grounded in reviewed fields.
    Returns the prose string. Raises DraftGenerationError on failure.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)
    user_message = build_summary_user_message(candidate_profile, transcript)

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=400,
            timeout=45,
        )
    except openai.APITimeoutError as exc:
        raise DraftGenerationError("OpenAI request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise DraftGenerationError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise DraftGenerationError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise DraftGenerationError(f"OpenAI API error: {exc}") from exc

    content = completion.choices[0].message.content
    if not content or not content.strip():
        raise DraftGenerationError("Model returned an empty response.")

    return content.strip()


def generate_submittal_text(
    candidate_profile: str,
    job_title: str,
    job_requirements: str,
    analysis_context: str,
    transcript: str,
) -> str:
    """
    Generate a 280-340 word submittal grounded in the candidate profile and JD analysis.
    Returns the prose string. Raises DraftGenerationError on failure.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)
    user_message = build_submittal_user_message(
        candidate_profile=candidate_profile,
        job_title=job_title,
        job_requirements=job_requirements,
        analysis_context=analysis_context,
        transcript=transcript,
    )

    try:
        completion = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SUBMITTAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=700,
            timeout=60,
        )
    except openai.APITimeoutError as exc:
        raise DraftGenerationError("OpenAI request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise DraftGenerationError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise DraftGenerationError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise DraftGenerationError(f"OpenAI API error: {exc}") from exc

    content = completion.choices[0].message.content
    if not content or not content.strip():
        raise DraftGenerationError("Model returned an empty response.")

    return content.strip()
