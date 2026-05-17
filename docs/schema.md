# Database schema — staffing screening MVP

This document describes the **initial** PostgreSQL schema owned by the FastAPI service (`/server`). It is focused on **trust, auditability, and repeatable extraction**, not on full ATS feature parity.

## Entity relationship overview

- **organizations** own tenant data: **users**, **recruiters**, **audio_uploads**, **candidate_records**, **export_jobs**, **ats_connections**, and **audit_logs**.
- **users** belong to an organization; **recruiters** are `(user, organization)` memberships (a user may have multiple recruiter profiles if they join multiple orgs later).
- **audio_uploads** store object-storage keys and metadata (`job_reference`, `upload_notes` capture intake context). **transcript_generation_jobs** track placeholder ASR pipeline state until a real worker exists.
- **transcripts** version ASR output per upload (`version` is monotonic per audio). **transcript_segments** time-align rows within a transcript.
- **candidate_records** anchor the recruiter workflow for one screening artifact (typically one **audio_upload**), with denormalized workflow fields (`approval_status`, `extraction_status`, `ats_sync_status`, `confidence_overall`).
- **extraction_runs** model **reruns**: each run is an immutable snapshot container; **extracted_fields** belong to exactly one run. Older runs (and their fields/evidence) remain queryable for audits and model comparisons.
- **field_evidence** ties an extracted field to **transcript** text (and optionally a **transcript_segment**) via offsets and/or a verbatim snippet.
- **export_jobs** track async export artifacts (`export_format` is `json` or `csv`; avoid SQL reserved word `format` at the column layer).
- **ats_connections** store provider configuration references (never raw secrets in this MVP schema—use `vault_secret_ref`). **ats_sync_logs** record outbound sync attempts with redacted summaries.
- **audit_logs** capture security-sensitive actions with JSON `metadata` (note: column name is `metadata` in SQL; ORM attribute is `metadata_`).

## Versioning model (extraction reruns)

1. A new **extraction_runs** row is created with `run_index = MAX(run_index)+1` for that candidate.
2. New **extracted_fields** + **field_evidence** rows are inserted for that run only.
3. The **candidate_records.extraction_status** / `confidence_overall` fields reflect the **latest** operational state for UI convenience; historical truth lives in **extraction_runs** + child tables.

## Bullhorn readiness

- **extracted_fields.bullhorn_field_key** reserves a stable mapping target (for example `candidate.customText1`) without enforcing Bullhorn semantics at the DB layer.
- **ats_connections.config** (JSONB) is the intended home for **field mapping templates** and provider-specific routing metadata in a later milestone.

## Enum values (seed / migration reference)

Values are stored as PostgreSQL native `ENUM` types (see `server/app/db/enums.py`).

### `audio_upload_status`

| Value | Meaning |
| --- | --- |
| `pending` | Accepted, not yet durably stored |
| `stored` | Object persisted and verified |
| `failed` | Upload or verification failed |

### `transcript_job_status` (placeholder transcript pipeline)

| Value | Meaning |
| --- | --- |
| `queued` | Job row created |
| `in_progress` | Reserved for a future worker |
| `awaiting_asr` | MVP terminal state: file stored, no ASR integration yet |
| `completed` | Reserved for real pipeline completion |
| `failed` | Worker / validation failure |

### `transcript_status`

| Value | Meaning |
| --- | --- |
| `pending` | Queued / not started |
| `processing` | ASR in flight |
| `complete` | Text available |
| `failed` | ASR failed |

### `candidate_approval_status`

| Value | Meaning |
| --- | --- |
| `not_started` | No reviewer workflow yet |
| `pending_review` | Awaiting recruiter review |
| `partially_approved` | Mixed approvals across fields |
| `approved` | Recruiter cleared for downstream use |
| `rejected` | Recruiter rejected this screening case |

### `candidate_extraction_status`

| Value | Meaning |
| --- | --- |
| `none` | No extraction scheduled |
| `queued` | Work queued |
| `running` | Extraction in flight |
| `complete` | Latest run finished successfully |
| `failed` | Latest run failed |
| `stale` | Underlying transcript/audio changed; rerun recommended |

### `candidate_ats_sync_status`

| Value | Meaning |
| --- | --- |
| `none` | No ATS push attempted |
| `pending` | Approved payload queued |
| `in_progress` | Push in flight |
| `synced` | Last successful push recorded |
| `failed` | Last push failed |
| `skipped` | Explicitly skipped (policy / dry-run) |

### `extraction_run_status`

| Value | Meaning |
| --- | --- |
| `queued` | Run created, not started |
| `running` | Model call in progress |
| `complete` | Run finished |
| `failed` | Run failed |
| `cancelled` | User/system cancelled |

### `extracted_field_status`

| Value | Meaning |
| --- | --- |
| `pending` | Fresh model output |
| `draft` | Edited but not finalized |
| `approved` | Recruiter approved this field for export/ATS |
| `rejected` | Recruiter rejected |
| `superseded` | Intentionally replaced (policy hook; optional use) |

### `extracted_field_source`

| Value | Meaning |
| --- | --- |
| `model` | Primary LLM / structured extractor |
| `heuristic` | Rules / parsers |
| `manual` | Recruiter-entered |
| `imported` | Pasted/imported from another system |

### `export_job_format` / `export_job_status`

Formats: `json`, `csv`.

Statuses: `queued`, `processing`, `complete`, `failed`.

### ATS enums

- **`ats_provider`**: `bullhorn`, `other`
- **`ats_connection_status`**: `disconnected`, `connected`, `error`, `revoked`
- **`ats_sync_log_status`**: `started`, `success`, `failed`, `partial`

### `audit_actor_type`

| Value | Meaning |
| --- | --- |
| `user` | Human-initiated |
| `system` | Background worker / pipeline |
| `api_key` | Programmatic actor |

## Timestamps

All business tables include **`created_at`** and **`updated_at`** (`TIMESTAMP WITH TIME ZONE`, server-side defaults on insert). A few log-style tables still carry `updated_at` for rare corrections, but treat **`created_at` as the primary event time** for **ats_sync_logs** and **audit_logs** when reasoning about timelines.

## Migrations

```bash
cd server
source .venv/bin/activate
export DATABASE_URL=postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot
alembic upgrade head
```

Revisions:

- `20260513_000001` — empty placeholder (scaffold)
- `20260514_000002` — creates all tables/types for this schema
- `20260515_000003` — `audio_uploads` intake columns + `transcript_generation_jobs`
