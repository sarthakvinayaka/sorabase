"""OpenAI Chat Completions structured extraction (Pydantic parse) → ``StaffingExtractionOutput``."""

from __future__ import annotations

import json
from pathlib import Path

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from app.core.config import settings
from app.schemas.staffing_extraction import StaffingExtractionOutput
from app.services.extraction.errors import ExtractionProviderRuntimeError

_MAX_TRANSCRIPT_CHARS = 120_000


def _staffing_prompt_dir() -> Path:
    # server/app/services/extraction/<this_file> → repo root is parents[4]
    return Path(__file__).resolve().parents[4] / "prompts" / "staffing"


def _load_extraction_prompt_pair() -> tuple[str, str]:
    path = _staffing_prompt_dir() / "extraction.md"
    if not path.is_file():
        msg = f"Extraction prompt not found: {path}"
        raise FileNotFoundError(msg)
    raw = path.read_text(encoding="utf-8")
    if "## System" not in raw or "## User" not in raw:
        msg = "extraction.md must contain ## System and ## User sections"
        raise ValueError(msg)
    tail = raw.split("## System", 1)[1]
    system_body, user_body = tail.split("## User", 1)
    return system_body.strip(), user_body.strip()


class OpenAIStaffingExtractionProvider:
    """Calls OpenAI with ``response_format=StaffingExtractionOutput`` (structured outputs / parse)."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        key = (api_key or settings.openai_api_key or "").strip()
        if not key:
            msg = "OPENAI_API_KEY is required for OpenAI extraction"
            raise ValueError(msg)
        bu = (base_url or settings.openai_base_url or "").strip() or None
        self._client = OpenAI(api_key=key, base_url=bu)
        self._model = (model or settings.openai_extraction_model).strip()
        self._system_prompt, self._user_template = _load_extraction_prompt_pair()

    @property
    def provider_id(self) -> str:
        return f"openai:{self._model}"

    def extract_staffing_profile(
        self,
        *,
        transcript_text: str,
        segments: list[tuple[int, int, int, str, str]] | None = None,
    ) -> StaffingExtractionOutput:
        text = transcript_text or ""
        if len(text) > _MAX_TRANSCRIPT_CHARS:
            text = text[:_MAX_TRANSCRIPT_CHARS] + "\n\n[Transcript truncated for extraction request length.]"

        seg_payload: list[dict[str, object]] = []
        if segments:
            for seq, sm, em, sp, st in segments:
                seg_payload.append(
                    {
                        "sequence_index": seq,
                        "start_ms": sm,
                        "end_ms": em,
                        "speaker_label": sp,
                        "text": st,
                    },
                )
        segments_json = json.dumps(seg_payload, ensure_ascii=False)
        user = self._user_template.replace("{{TRANSCRIPT_TEXT}}", text).replace(
            "{{TRANSCRIPT_SEGMENTS_JSON}}",
            segments_json,
        )

        try:
            completion = self._client.beta.chat.completions.parse(
                model=self._model,
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": user},
                ],
                response_format=StaffingExtractionOutput,
                temperature=0,
                max_completion_tokens=16_384,
            )
        except (APIConnectionError, APITimeoutError, RateLimitError) as exc:
            raise ExtractionProviderRuntimeError(f"OpenAI network error: {exc}") from exc
        except APIStatusError as exc:
            raise ExtractionProviderRuntimeError(f"OpenAI API error: {exc}") from exc
        except Exception as exc:
            raise ExtractionProviderRuntimeError(f"OpenAI extraction failed: {exc}") from exc

        choice = completion.choices[0]
        message = choice.message
        refusal = getattr(message, "refusal", None)
        if refusal:
            raise ExtractionProviderRuntimeError(f"Model refused: {refusal}")
        parsed = message.parsed
        if parsed is None:
            raise ExtractionProviderRuntimeError("OpenAI returned no parsed structured output")
        return parsed
