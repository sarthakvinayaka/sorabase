# API (scaffold)

```bash
cd server
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- `GET /health`
- `GET /v1/auth/whoami` (mock principal)

Database migrations (after Postgres is up):

```bash
cd server
source .venv/bin/activate
export DATABASE_URL=postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot
alembic upgrade head
```

Schema documentation lives in `docs/schema.md`.

## Audio uploads (API)

- `POST /v1/audio/uploads` — multipart: `recruiter_id`, `file`, optional `job_reference`, `upload_notes`
- `GET /v1/audio/uploads?organization_id=…&limit=…`
- `GET /v1/audio/uploads/{upload_id}?organization_id=…`

Run `alembic upgrade head` after pulling (adds `transcript_generation_jobs` + upload metadata columns).

## Demo seed (destructive)

Requires migrations applied. This runs `TRUNCATE organizations CASCADE` then inserts five staffing scenarios.

```bash
cd server
source .venv/bin/activate
export DATABASE_URL=postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot
python scripts/seed_staffing_mvp.py
```

Scenario copy: `docs/seed_scenarios.md`.
