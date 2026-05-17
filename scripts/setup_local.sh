#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Starting Postgres (docker compose)"
(cd "$ROOT" && docker compose up -d postgres)

echo "==> Python venv + deps (server)"
cd "$ROOT/server"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -r requirements.txt

if [[ -f "$ROOT/.env" ]]; then
  echo "==> Applying Alembic migrations"
  set -a
  # shellcheck disable=SC1090
  source "$ROOT/.env"
  set +a
  alembic upgrade head
else
  echo "==> Skipping Alembic (no $ROOT/.env). Copy .env.example to .env first."
fi

echo "==> Node deps (web)"
cd "$ROOT/web"
npm install

echo "Done. Next: run API and web in separate terminals (see root README)."
