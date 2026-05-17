# General Mode — Developer Guide

General Mode lets users extract *any* structured data from a conversation by defining a custom schema at review time, rather than using the fixed 35-field schema used by Recruiting Mode.

---

## Architecture overview

```
User submits conversation
        │
        ▼
  Conversation row created (transcript_status = "pending" | "ready")
        │
        ▼
  schema/[conversationId]   ←── AI proposes columns (POST /schema-proposal)
  SchemaReviewWorkspace          User edits & approves schema
        │ localStorage: pilot-schema-{conversationId}
        ▼
  processing/[conversationId]
  ProcessingWorkspace        ←── reads localStorage, calls POST /extract-general
        │
        ▼
  results/[candidateId]
  GeneralResultsWorkspace    ←── field review, approval, export
```

### Key difference from Recruiting Mode

| Aspect | Recruiting Mode | General Mode |
|--------|-----------------|--------------|
| Schema | Fixed 35 fields | User-defined at runtime |
| Extraction trigger | POST /extract | POST /extract-general |
| Schema storage | N/A | localStorage (ephemeral per session) |
| Template reuse | N/A | SchemaTemplate table + version tracking |
| Mode marker | ExtractionRun.template_id = NULL | ExtractionRun.template_id = "general" |
| Bot session | mode = "recruiting" → extraction | mode = "general" → stops at ready |
| Dashboard | /dashboard | /general/dashboard |
| Export | /review/{id} candidate export | /general/results/{id} + GeneralExportMenu |

---

## Backend pipeline

### 1. Schema proposal  (`POST /api/conversations/{id}/schema-proposal`)

`schema_proposal_client.propose_schema(transcript, summary?)`

- Calls OpenAI Structured Outputs with `SchemaProposalLLMResponse` as `response_format`
- Post-parse validation (see `_validate()`):
  - Column count: 5–15
  - All names: valid `snake_case` (`^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`)
  - No duplicate names
- Returns `SchemaProposalResult` (columns + rationale)

### 2. General extraction (`POST /api/conversations/{id}/extract-general`)

`general_extraction_service.run_general_extraction(db, conversation_id, columns, ...)`

1. Validates conversation exists, transcript is ready, char count ≤ limit
2. Calls `general_extraction_client.extract_general(transcript, columns)`
   - Builds a dynamic Pydantic model at runtime from `ApprovedColumn` list
   - Uses per-field extraction types (`TextFieldExtraction`, `NumberFieldExtraction`, …) so OpenAI returns tight JSON types
3. Persists `ExtractionRun` with `template_id = GENERAL_MODE_TAG` (or a template UUID if one was used)
4. Persists one `ExtractedField` row per column — even for missing/ambiguous fields
5. Updates `Candidate.latest_extraction_run_id`
6. Logs audit event

**`ExtractionRun.raw_response` structure:**
```json
{
  "fields": { "<col_name>": { "value": ..., "confidence": ..., "status": ..., "evidence_snippet": ... } },
  "summary": "...",
  "template_id": "<uuid or null>",
  "template_version": <int or null>
}
```
Column order in `raw_response["fields"]` is the canonical order for exports.

### 3. Overall confidence

`_compute_overall_confidence(fields)` — average confidence of *extracted* fields only (`status == "extracted"`). Fields with `status = "missing"` (confidence = 0) are excluded so they don't distort the session score.

### 4. Schema templates (`/api/schema-templates`)

Templates are saved `ProposedColumn[]` lists with a name and visibility scope.

- **Version bump**: `template_repo.update_template()` increments `version` whenever `columns` changes. Metadata-only updates (name, description, visibility) do not bump.
- **Extraction snapshot**: at extraction time, `template_id` and `template_version` are written to `ExtractionRun.raw_response` so the exact schema used is frozen even if the template is later updated.

### 5. Export (`/api/candidates/{id}/general-export/...`)

`general_export_service.build_general_export(db, candidate_id, include_transcript=False)`

**Effective value precedence** (same as Recruiting Mode):
```
reviewed_value  (human edit, field.edited=True)
  └── normalized_value  (AI post-processed)
       └── raw_value    (AI raw output)
```

**Column order** — preserved from `raw_response["fields"].keys()`, not DB sort order.

**CSV format** — single header row + single data row. Lists are flattened to semicolons; booleans to `Yes`/`No`; `None` to empty string.

**Webhook delivery** (`webhook_delivery_service.deliver()`) — 3 attempts, 1 s → 2 s → 4 s backoff on 5xx. 4xx = permanent failure (no retry). Sends `X-Pilot-Event` and `X-Pilot-Delivery` headers.

---

## Frontend pipeline

### localStorage schema contract

Key: `pilot-schema-{conversationId}`

New format (from Task 9):
```ts
interface StoredSchema {
  columns:          ProposedColumn[];
  templateId?:      string;
  templateVersion?: number;
}
```

Backward-compatible: `ProcessingWorkspace` and `GeneralResultsWorkspace` both handle the old `ProposedColumn[]` array format.

### Meeting ingestion (bot path)

When source = "meeting", `general/page.tsx` creates a `BotSession` with `mode: "general"` and `auto_run: false`. The backend `_process_bot_session` webhook handler:
1. Fetches transcript from Recall.ai
2. Creates `Conversation` + sets `BotSession.status = "ready"` with `conversation_id`
3. `run_post_transcript()` sees `mode="general"` and returns `ready_for_schema_review` — no extraction runs
4. Frontend polls and redirects to `/general/schema/{conversationId}?source=meeting` on `status=ready`

---

## Mode sentinel constant

```python
# backend/app/constants.py
GENERAL_MODE_TAG  = "general"   # stored in ExtractionRun.template_id
MODE_GENERAL      = "general"   # stored in BotSession/MeetingSession.mode
MODE_RECRUITING   = "recruiting"
```

The `general_dashboard_repo` uses `GENERAL_MODE_TAG` to filter runs belonging to General Mode. Do not use the raw string `"general"` outside `constants.py`.

---

## Tests

| File | What it covers |
|------|----------------|
| `test_general_extraction_service.py` | Full pipeline: error paths, field persistence, low-confidence behaviour, confidence computation |
| `test_general_export_service.py` | `build_general_export` effective-value precedence, column order, transcript flag; `render_csv` formatting |
| `test_webhook_delivery_service.py` | Successful delivery, 4xx permanent failure, 5xx retry + backoff, network errors |
| `test_template_repo.py` | CRUD, version-bump on column change, no bump on metadata change |
| `test_schema_proposal.py` | Validation (count, snake_case, duplicates), LLM mock, route 409/503 |
| `test_meeting_orchestrator.py` | Mode branching: general→ready_for_schema_review, recruiting→extraction, auto_run=False→skip |

---

## Adding a new column type

1. Add a new `XxxFieldExtraction(BaseModel)` in `domain/general_extraction_schemas.py`
2. Add `"xxx": XxxFieldExtraction` to `FIELD_TYPE_MAP`
3. Add `"xxx"` to the `Literal` in `ApprovedColumn.type`
4. Update `ColumnType` in `frontend/lib/types.ts`
5. Handle the new type in `general_export_service.render_csv()` if it needs special CSV serialisation
6. Add a test case in `test_general_extraction_service.py`
