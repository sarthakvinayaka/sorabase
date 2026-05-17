# Candidate record exports

Exports provide a **deterministic** snapshot of a staffing candidate after review. They are intended for downstream systems, spreadsheets, and archival use.

## Rules

| Rule | Behavior |
|------|----------|
| **Approval gate** | The candidate’s `approval_status` must be `approved` or `partially_approved`. Otherwise the API returns **400** with a clear error. |
| **Extraction version** | Only the **latest completed** extraction run (`ExtractionRun.status = complete`, highest `run_index`) is considered. Older runs are never merged in. |
| **Field values** | Only `ExtractedField` rows with `status = approved` on that run are exported. Draft, pending, rejected, or superseded values are **excluded**. |
| **Schema keys** | Structured columns are limited to `STAFFING_EXTRACTION_FIELD_KEYS` (see `server/app/schemas/staffing_extraction.py`). Any other approved field names on the run are ignored for the structured block (deterministic contract). |
| **Determinism** | JSON is serialized with **sorted keys** at every object level and compact separators (`","`, `":"`). CSV uses a **fixed header order**: metadata columns first, then staffing fields in schema tuple order. |
| **Recruiter metadata** | When `created_by_recruiter_id` is set, exports include linked recruiter `user_id`, `email`, `full_name`, and recruiter `display_title`. |

## HTTP API (`/v1`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/candidates/{candidate_id}/export/preview?organization_id=` | Same JSON body as download; **no** `Content-Disposition`; **does not** write an `export_jobs` row (read-only preview). |
| `GET` | `/candidates/{candidate_id}/export.json?organization_id=&requested_by_user_id=` | `Content-Disposition: attachment` JSON download; inserts **`export_jobs`** (`status=complete`, `export_format=json`). |
| `GET` | `/candidates/{candidate_id}/export.csv?organization_id=&requested_by_user_id=` | UTF-8 CSV with BOM for Excel; same job logging with `export_format=csv`. |

`requested_by_user_id` is optional; when present it must exist in `users` (400 otherwise). It is stored on `export_jobs.requested_by_user_id` for audit.

## `export_jobs` row (successful download)

Each successful **JSON** or **CSV** download creates one row:

- `status`: `complete`
- `completed_at`: server time when the response was prepared
- `meta` (JSONB): includes `bytes`, `export_schema_version`, `field_count`, `structured_field_keys` (sorted), `inline_download: true`

Preview requests intentionally **omit** this row so recruiters can inspect payloads without polluting the job table.

## UI (review console)

On `/review/[candidateId]`, the **Export** panel appears when the record is approved (or partially approved). It provides:

- **Preview JSON** — fetches `/export/preview` and shows a formatted `<pre>` block.
- **Download JSON** / **Download CSV** — triggers a browser download and shows success or error text.

---

## Sample JSON (`export.json`)

The following example is **illustrative** (pretty-printed). On the wire, compact `sort_keys` serialization is used.

```json
{
  "candidate": {
    "approval_status": "approved",
    "audio_upload_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "confidence_overall": 0.87333,
    "created_at": "2026-05-12T18:22:11+00:00",
    "extraction_status": "complete",
    "id": "11111111-2222-3333-4444-555555555555",
    "internal_title": "Staffing — screening",
    "notes": null,
    "organization_id": "66666666-7777-8888-9999-aaaaaaaaaaaa",
    "processing_stage": "approved",
    "updated_at": "2026-05-13T09:05:00+00:00"
  },
  "extraction_run": {
    "completed_at": "2026-05-12T18:25:40+00:00",
    "id": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    "provider_model": "mock-staffing-v1",
    "run_index": 1
  },
  "exported_at": "2026-05-13T10:01:02.123456+00:00",
  "export_schema_version": 1,
  "recruiter": {
    "display_title": "Senior Recruiter",
    "email": "jamie@example.com",
    "full_name": "Jamie Rivera",
    "recruiter_id": "cccccccc-dddd-eeee-ffff-000000000001",
    "user_id": "dddddddd-eeee-ffff-0000-111111111111"
  },
  "structured_fields": {
    "availability_date": "2026-06-01",
    "certifications": ["AWS Solutions Architect", "CKA"],
    "current_title": "Senior DevOps Engineer",
    "email": "candidate@example.com",
    "full_name": "Alex Kim",
    "phone": "+1-415-555-0199",
    "primary_skills": ["Kubernetes", "Terraform", "Python"],
    "target_roles": ["Contract DevOps lead"]
  }
}
```

List-like values are JSON-decoded from stored `field_value` text when valid JSON; otherwise the raw string is used.

---

## Sample CSV (`export.csv`)

- First line: **header** (fixed order).
- Second line: **one data row** (wide table: metadata + every staffing field column; empty cells when that field was not exported).
- File begins with a **UTF-8 BOM** (`U+FEFF`) for Microsoft Excel compatibility.

Abbreviated example (columns truncated with `…` for documentation only):

```csv
exported_at,export_schema_version,candidate_id,organization_id,approval_status,...,full_name,email,phone,...,concerns_or_red_flags
2026-05-13T10:01:02.123456+00:00,1,11111111-...,66666666-...,approved,...,Alex Kim,candidate@example.com,+1-415-555-0199,...,,
```

Full header order in code: `exported_at`, `export_schema_version`, `candidate_id`, … `recruiter_display_title`, then every key in `STAFFING_EXTRACTION_FIELD_KEYS` in declaration order.

---

## Common errors

| HTTP | Meaning |
|------|---------|
| **404** | Candidate id not found for the given `organization_id`. |
| **400** | Record not in an exportable approval state, no completed extraction run, or invalid `requested_by_user_id`. |
