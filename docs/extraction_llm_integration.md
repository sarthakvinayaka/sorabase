# Transcript → structured extraction (LLM integration)

This document describes the **implemented** extraction stack: mock heuristics or **OpenAI structured outputs**, then deterministic post-processing, then persistence into `extraction_runs` / `extracted_fields` / `field_evidence`.

## Code paths

| Piece | Role |
|-------|------|
| `server/app/schemas/staffing_extraction.py` | **Contract**: `StaffingExtractionOutput` (Pydantic) — per-field `value`, `confidence`, `evidence` (quote + optional segment/time), `missing_fields`, `ambiguous_fields`, `suggested_follow_up_questions`, `extraction_notes`. |
| `prompts/schemas/staffing_extraction.output.schema.json` | **JSON Schema** mirror (regenerate: `cd server && PYTHONPATH=. python scripts/dump_staffing_extraction_schema.py`). |
| `prompts/staffing/extraction.md` | **Prompt** loaded by `OpenAIStaffingExtractionProvider` — `## System` / `## User` sections; placeholders `{{TRANSCRIPT_TEXT}}`, `{{TRANSCRIPT_SEGMENTS_JSON}}`. |
| `prompts/staffing/transcript_to_candidate_fields.md` | **Alias doc** — points to `extraction.md` as the canonical transcript→fields prompt. |
| `server/app/services/extraction/protocol.py` | **`StaffingExtractionProvider`** — `extract_staffing_profile(...) -> StaffingExtractionOutput`. |
| `server/app/services/extraction/mock_staffing_provider.py` | **Mock** — regex/heuristics (no network). |
| `server/app/services/extraction/openai_staffing_extraction_provider.py` | **OpenAI** — `beta.chat.completions.parse(..., response_format=StaffingExtractionOutput, temperature=0)`. |
| `server/app/services/extraction/staffing_extraction_post.py` | **Post-processing** — clears non-null values whose `evidence.quote` is not a verbatim substring of the transcript; blends/caps model-reported confidence. |
| `server/app/services/extraction/factory.py` | **`get_staffing_extraction_provider()`** — `mock` / `local` / `dev` → mock; `openai` → OpenAI (requires `OPENAI_API_KEY`). |
| `server/app/services/extraction_execution_service.py` | **Orchestration** — resolves provider **lazily** only when running extraction (so read-only routes do not require an API key). Calls post-processing before persisting. |
| `server/app/api/routes/extraction_execution.py` | **`POST /v1/audio/uploads/{upload_id}/extract`** — `503` if provider configuration is invalid (e.g. OpenAI without key); `502` on provider/runtime failure after failed run is stored. |

## Environment variables (server)

| Variable | Purpose |
|----------|---------|
| `EXTRACTION_PROVIDER` | `mock` (default) or `openai`. |
| `OPENAI_API_KEY` | Required when `EXTRACTION_PROVIDER=openai`. |
| `OPENAI_EXTRACTION_MODEL` | Optional; default `gpt-4o-mini` (must support structured outputs / `parse`). |
| `OPENAI_BASE_URL` | Optional; custom API base (proxies, Azure mapping, etc.). |

Pydantic settings read these from `server/.env` (see `app/core/config.py`).

## OpenAI pipeline (implemented)

1. Load `prompts/staffing/extraction.md`, split `## System` / `## User`, substitute transcript + segments JSON.
2. Call `client.beta.chat.completions.parse` with `response_format=StaffingExtractionOutput` (schema-constrained).
3. Run `apply_staffing_extraction_post_processing` (quote substring checks + confidence caps).
4. Persist via existing `ExtractionExecutionService` logic (unchanged review/export gates).

## Failure handling

- **Missing key / unknown provider** — `ExtractionConfigurationError` → HTTP **503** on extract.
- **Network / rate limits / 5xx** — `ExtractionProviderRuntimeError` → HTTP **502** (run row left `FAILED` where applicable).
- **Model refusal** — `refusal` set → `ExtractionProviderRuntimeError`.
- **Truncation** — transcripts over **120k** characters are truncated before the API call (suffix note appended).

## Separation from transcription

Transcription stays in `transcripts` / `transcript_segments`. Extraction reads `full_text` (or falls back to joined segment text) and writes structured rows — re-running extraction does not require re-transcribing.

## Tests

```bash
cd server
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. pytest tests/ -q
```
