# Pilot — staffing / recruiting MVP (monorepo)

Monorepo layout:

- **`web/`** — Next.js 15 (App Router, TypeScript, Tailwind). Browser calls the API via **`NEXT_PUBLIC_API_URL`**. Server components / RSC health check use **`SERVER_API_URL`**.
- **`server/`** — FastAPI (SQLAlchemy + Alembic, PostgreSQL). Mock transcription and extraction providers for local demos; audit logs on review actions and extraction completion.
- **`docs/`** — Schema notes, seed scenarios, export shape.
- **`scripts/`** — Local setup helper (`setup_local.sh`).

## What works in this MVP

- **Audio intake** — multipart upload, storage, transcript job row, list uploads by organization.
- **Intake pipeline** — transcribe and extract per upload (extraction defaults to **`mock`** heuristics; set **`openai`** for structured LLM extraction — see below); candidate **`processing_stage`** / **`approval_status`** stay consistent through extraction.
- **Review console** — load transcript + latest completed extraction fields, edit/save with audit trail, approve/reject, re-run extraction, exports when approved.
- **Analytics** — `GET /v1/analytics/recruiting` with tenant filters; dashboard at **`/analytics`**.
- **Mock auth** — `GET /v1/auth/whoami` for a fixed principal (see server routes).

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- Docker (optional, for PostgreSQL via `docker-compose.yml`)

## Quick start

### 1. Environment files

```bash
cp .env.example .env
cp .env.example web/.env.local
cp .env.example server/.env
```

Important keys:

| Key | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Next.js (browser) | API base URL, default `http://127.0.0.1:8000` |
| `SERVER_API_URL` | Next.js (server) | RSC `fetch` to API, e.g. homepage `/health` |
| `NEXT_PUBLIC_DEV_ORG_ID` | Web demo forms | Default tenant UUID after seed |
| `NEXT_PUBLIC_DEV_RECRUITER_ID` | Upload page | Default recruiter UUID for intake |
| `NEXT_PUBLIC_DEV_EDITOR_USER_ID` | Review PATCH/POST | Must exist in `users` table (seed provides Morgan) |
| `DATABASE_URL` | Server / Alembic | PostgreSQL connection string |
| `CORS_ORIGINS` | Server | Browser origins allowed for API |
| `EXTRACTION_PROVIDER` | Server | `mock` (default) or `openai` |
| `OPENAI_API_KEY` | Server | Required when `EXTRACTION_PROVIDER=openai` |
| `OPENAI_EXTRACTION_MODEL` | Server | Optional; default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | Server | Optional custom API base URL |

**LLM extraction (OpenAI)**

1. In **`server/.env`**: `EXTRACTION_PROVIDER=openai`, `OPENAI_API_KEY=sk-...` (see `.env.example`).
2. Restart **uvicorn**. Read-only routes (e.g. upload detail) **do not** call OpenAI; only **`POST /v1/audio/uploads/{id}/extract`** does (after a complete transcript exists).
3. The provider loads **`prompts/staffing/extraction.md`**, calls **`beta.chat.completions.parse`** with `response_format=StaffingExtractionOutput`, then **post-processing** drops non-null values whose `evidence.quote` is not a verbatim substring of the transcript. Full detail: **`docs/extraction_llm_integration.md`**.
4. **Tests:** `cd server && source .venv/bin/activate && pip install -r requirements.txt && PYTHONPATH=. pytest tests/ -q`

Misconfiguration (OpenAI selected without a key) → **503** on extract; provider/runtime failure → **502** (failed extraction run is persisted when applicable).

### 2. Optional: start PostgreSQL

```bash
docker compose up -d postgres
```

### 3. Backend (FastAPI)

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Smoke test:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/v1/auth/whoami
```

### 4. Database migrations (Alembic)

With Postgres running and `DATABASE_URL` set in `server/.env`:

```bash
cd server
source .venv/bin/activate
alembic upgrade head
```

### 5. Frontend (Next.js)

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`. Use **Upload audio** → open an upload → **Run transcription (mock)** → **Run extraction (mock)** → **Review console**. **`/analytics`** needs `organization_id` in the query string or `NEXT_PUBLIC_DEV_ORG_ID` in `web/.env.local`.

### One-shot helper

```bash
chmod +x scripts/setup_local.sh
./scripts/setup_local.sh
```

## Demo database seed (optional)

After migrations:

```bash
cd server
source .venv/bin/activate
export DATABASE_URL=postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot
python scripts/seed_staffing_mvp.py
# python scripts/seed_staffing_mvp.py --dry-run
```

Scenario narrative: **`docs/seed_scenarios.md`** (content is assembled by `seed_staffing_mvp.py` from `server/scripts/seed_staffing_scenarios.py`).

## Architecture notes

- **PostgreSQL** is the system of record; **SQLAlchemy + Alembic** live under `server/`. The web app talks to the API over HTTP only.
- **File storage** — local directory (`FILE_STORAGE_ROOT`); see `server/app/storage`.
- **Review / reject** — Rejected records keep **`approval_status=rejected`** and **`processing_stage`** aligned with available artifacts (`extracted` if extraction completed, else `transcribed` / `uploaded`), so operational filters are not polluted by `needs_review` + `rejected`.

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/setup_local.sh` | Docker Postgres, Python venv + pip, optional Alembic, `npm install` in `web/` |
| `server/scripts/seed_staffing_mvp.py` | **Destructive** demo seed: one org, recruiters, screening scenarios (uses `seed_staffing_scenarios` module) |
| `server/scripts/dump_staffing_extraction_schema.py` | Dev helper for extraction schema introspection |

## License

Private / TBD.
