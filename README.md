# Recruiter Intake — Phase 1

B2B workflow product for staffing teams. Turns a recruiter screening call transcript into a structured, reviewable, exportable candidate profile using OpenAI Structured Outputs.

---

## Architecture

```
pilot-4-staffing/
├── backend/        FastAPI service — extraction, persistence, audit trail
│   ├── app/
│   │   ├── api/routes/     HTTP endpoints (transcripts, extractions, candidates, exports)
│   │   ├── db/             SQLAlchemy ORM models + session factory
│   │   ├── domain/         Pydantic schemas (API contracts + LLM output schema)
│   │   ├── prompts/        Versioned prompt templates
│   │   ├── repositories/   DB access layer — no business logic
│   │   └── services/       Extraction pipeline, normalization, OpenAI client, audit log
│   ├── alembic/            Database migrations
│   └── tests/              Unit + integration tests
└── frontend/       Next.js 14 App Router — transcript input and review UI
    ├── app/
    │   ├── page.tsx                  Transcript paste + submit
    │   └── review/[candidateId]/    Candidate review, editing, export
    ├── components/review/           FieldRow, EvidencePanel, MissingFieldsBanner, ExportButton
    └── lib/                         Typed API client + TypeScript types
```

### Data flow

```
Recruiter pastes transcript
  → POST /api/transcripts       (persist raw text)
  → POST /api/extractions       (call OpenAI → normalize → persist fields + audit log)
  → Redirect to /review/{id}
  → Recruiter reviews fields, evidence snippets, confidence scores
  → PATCH /api/candidates/{id}/fields/{field_id}  (per-field edits with audit log)
  → GET  /api/candidates/{id}/export              (reviewed values → JSON download)
```

### Database tables

| Table | Purpose |
|---|---|
| `transcripts` | Raw transcript text — immutable after creation |
| `candidate_records` | One per transcript, tracks approval status and latest extraction |
| `extractions` | One per AI run — immutable snapshot including raw LLM response |
| `extracted_fields` | Per-field values: raw (LLM) · normalized (deterministic rules) · reviewed (human) |
| `audit_logs` | Append-only event stream — every extraction, edit, and export |

---

## Running locally

### Requirements

- Python 3.12+
- Node 20+
- PostgreSQL 15 (or Docker)

### 1. Start PostgreSQL

```bash
docker run --rm -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=staffing \
  postgres:15-alpine
```

Or `docker compose up db` from the repo root.

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — set OPENAI_API_KEY and DATABASE_URL

alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

App: http://localhost:3000

### 4. Full stack with Docker Compose

```bash
OPENAI_API_KEY=sk-... docker compose up
```

---

## Required environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o-2024-08-06` | Must support Structured Outputs |
| `MAX_TRANSCRIPT_CHARS` | No | `50000` | Hard limit before rejecting transcript |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `BACKEND_URL` | No | `http://localhost:8000` | FastAPI service URL for Next.js rewrites |

---

## Where the OpenAI integration lives

- **`backend/app/services/openai_client.py`** — isolated call to `client.beta.chat.completions.parse()` using Structured Outputs. Returns a validated `ExtractionLLMResponse` Pydantic model or raises `ExtractionError`.
- **`backend/app/domain/schemas.py`** — `ExtractionLLMResponse` + `FieldExtraction` define the strict JSON schema sent to OpenAI. All 28 candidate fields are required; unknown values must be `null`.
- **`backend/app/prompts/extraction.py`** — system prompt and user message builder, versioned as constants.
- **`backend/app/services/extraction_service.py`** — orchestrator: loads transcript → calls OpenAI → applies normalization → persists extraction and fields → writes audit log.

---

## Transcript extraction and review flow

1. **Transcript input** — recruiter pastes a raw transcript on the home page. Frontend calls `POST /api/transcripts` (persists text), then `POST /api/extractions` (runs OpenAI pipeline). Rejected if over 50k characters.

2. **Extraction pipeline** — `extraction_service.run_extraction()` calls the OpenAI client, receives a schema-validated `ExtractionLLMResponse`, applies deterministic normalization per field (email format, phone format, salary normalization, work auth canonicalization, skills list splitting), then persists one `Extraction` record and 28 `ExtractedField` rows.

3. **Review page** — displays all 28 fields in a table. Each row shows: current value, evidence snippet (verbatim quote from transcript), confidence bar, and source badge (AI vs. Edited). Recruiter can click Edit on any row to override a value inline.

4. **Edits** — `PATCH /api/candidates/{id}/fields/{field_id}` sets `reviewed_value`, marks `edited=true`, updates `status` to `"edited"`, and appends an audit log row with `old_value`, `new_value`, `actor_id`, and timestamp.

5. **Export** — `GET /api/candidates/{id}/export` returns a clean JSON snapshot. Each field's `value` is `reviewed_value` if edited, else `normalized_value`, else `raw_value`. The `source` field distinguishes `"ai_extracted"` from `"human_edited"`.

---

## Running tests

```bash
cd backend

# Set test database (PostgreSQL required)
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/staffing_test

# Run all tests
pytest

# Normalization and schema tests only (no DB required)
pytest tests/test_normalization.py tests/test_schemas.py -v
```

---

## Phase 2 work (not in scope here)

- Individual field confirmation (status: `confirmed`)
- Rerun extraction from the review page
- Approval / rejection workflow on the candidate record
- Auth and multi-recruiter support
- Audio upload + transcription pipeline
- ATS export adapters
