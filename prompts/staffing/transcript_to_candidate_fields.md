# Transcript → candidate fields (canonical prompt name)

The FastAPI app loads **`prompts/staffing/extraction.md`** when `EXTRACTION_PROVIDER=openai`.

This file exists so product/docs can refer to a stable **`transcript_to_candidate_fields`** name without duplicating prompt text. Keep `extraction.md` as the single source of truth; update both paths in docs if you rename files.

## Placeholders (in `extraction.md`)

- `{{TRANSCRIPT_TEXT}}`
- `{{TRANSCRIPT_SEGMENTS_JSON}}`
