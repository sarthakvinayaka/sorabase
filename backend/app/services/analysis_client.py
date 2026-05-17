"""
OpenAI wrapper for candidate-JD fit analysis.
Mirrors the pattern in openai_client.py — no DB access.
"""

from dataclasses import dataclass

import openai

from app.config import settings
from app.domain.analysis_schemas import AnalysisLLMResponse
from app.prompts.analysis import ANALYSIS_SYSTEM_PROMPT, build_analysis_user_message


class AnalysisError(Exception):
    """Raised when the OpenAI call fails or the response cannot be validated."""


@dataclass
class AnalysisResult:
    response: AnalysisLLMResponse
    prompt_tokens: int
    completion_tokens: int
    model_used: str


def analyze_candidate_fit(
    candidate_profile: str,
    job_title: str,
    job_description: str,
    job_requirements: str,
    transcript: str,
) -> AnalysisResult:
    """
    Call OpenAI Structured Outputs and return a validated AnalysisLLMResponse.
    Raises AnalysisError on API failure, refusal, or schema mismatch.
    """
    client = openai.OpenAI(api_key=settings.openai_api_key)
    user_message = build_analysis_user_message(
        candidate_profile=candidate_profile,
        job_title=job_title,
        job_description=job_description or "",
        job_requirements=job_requirements or "",
        transcript=transcript,
    )

    try:
        completion = client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format=AnalysisLLMResponse,
            max_tokens=4096,
            timeout=90,
        )
    except openai.APITimeoutError as exc:
        raise AnalysisError("OpenAI analysis request timed out.") from exc
    except openai.AuthenticationError as exc:
        raise AnalysisError("Invalid OpenAI API key.") from exc
    except openai.RateLimitError as exc:
        raise AnalysisError("OpenAI rate limit exceeded.") from exc
    except openai.APIError as exc:
        raise AnalysisError(f"OpenAI API error: {exc}") from exc

    message = completion.choices[0].message

    if message.refusal:
        raise AnalysisError(f"Model refused to analyze: {message.refusal}")

    if message.parsed is None:
        raise AnalysisError("Model response could not be parsed into the expected schema.")

    usage = completion.usage
    return AnalysisResult(
        response=message.parsed,
        prompt_tokens=usage.prompt_tokens if usage else 0,
        completion_tokens=usage.completion_tokens if usage else 0,
        model_used=completion.model,
    )
