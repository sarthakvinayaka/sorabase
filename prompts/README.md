# LLM prompts

Versioned prompt templates for staffing workflows. The **OpenAI extraction provider** loads `staffing/extraction.md` at runtime (UTF-8). See `docs/extraction_llm_integration.md`.

## Layout

| Path | Purpose |
|------|---------|
| `staffing/extraction.md` | **Canonical** transcript → `StaffingExtractionOutput` (strict grounding) |
| `staffing/transcript_to_candidate_fields.md` | Doc pointer — same contract as `extraction.md` |
| `staffing/transcript_to_candidate_summary.md` | Naming alias → future step; see `candidate_summary.md` |
| `staffing/transcript_to_submittal_draft.md` | Naming alias → future step; see `submittal_draft.md` |
| `staffing/transcript_to_follow_up_questions.md` | Naming alias; main extraction emits `suggested_follow_up_questions` |
| `staffing/candidate_summary.md` | Template for a **future** standalone summary step (not called by extract endpoint today) |
| `staffing/submittal_draft.md` | Template for a **future** standalone submittal step |
| `staffing/follow_up_questions.md` | Optional standalone follow-up refinement (not wired to extract) |
| `schemas/staffing_extraction.output.schema.json` | JSON Schema mirror — regenerate: `cd server && PYTHONPATH=. python scripts/dump_staffing_extraction_schema.py` |

Placeholders use `{{UPPER_SNAKE}}` markers — substituted in `OpenAIStaffingExtractionProvider` before the API call.
