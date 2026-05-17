# Staffing MVP — seed scenarios (reference)

These five **screening-call** records are what the seed script materializes. Enum mapping to the database:

| Plain-language | `candidate_records.approval_status` | `extraction_status` | `ats_sync_status` |
| --- | --- | --- | --- |
| Draft (pipeline mid-flight) | `not_started` | `running` | `none` |
| Needs review | `pending_review` | `complete` | `none` |
| Approved (not yet pushed) | `approved` | `complete` | `pending` |
| Approved + synced | `approved` | `complete` | `synced` |
| Mixed decisions / ATS failure | `partially_approved` | `complete` | `failed` |

## 1 — Priya Shah (SAP FI / OTC, contract-to-hire)

- **Recruiter:** Luis Ortega (SAP / finance contract desk).
- **Call:** 22-minute screen for a **Big 4 alumni** consultant; client needs SAP FI + SD cash application, **Chicago hybrid**.
- **Story:** Candidate is strong on FI-AR and bank rec, weak on VIM; still negotiating availability. Extraction job is **still running** — transcript and segments exist, **no `extracted_fields` rows yet** (realistic “recruiter can read while model catches up”).
- **Edge:** none at extraction layer yet; internal note references client code name **“Project Ledgerline”**.

## 2 — Marcus Lee (RN, infusion clinic, 13-week travel)

- **Recruiter:** Morgan Avery (clinical staffing).
- **Call:** Travel contract in **Phoenix**; compact, credential-heavy dialogue (state license, compact, ACLS).
- **State:** Needs recruiter review — visa/work auth **ambiguous** (mentions TN history *and* “AOS pending” without clarity); **notice period never stated** (field absent); skills and clinical stack look solid.
- **Audit:** System marks extraction complete; recruiter opens record (`audit`).

## 3 — Elena Vásquez (staff backend, Series B fintech)

- **Recruiter:** Jamie Patel (tech perm).
- **Call:** **Remote CONUS**, Go + Postgres, small team ownership; compensation band discussed cleanly.
- **State:** Recruiter **approved** profile; ATS push **queued/pending** (connection healthy but no successful sync row yet).
- **Audit:** Bulk-style approvals on key fields.

## 4 — Jordan Okonkwo (Senior DevOps, contract, SF Bay)

- **Recruiter:** Jamie Patel.
- **Call:** Kubernetes, Terraform, on-call rotation; **conflicting compensation signals** — candidate first says **$95/hr corp-to-corp**, later mentions **“low 160s base if it flips perm”** without resolving which is authoritative.
- **State:** Approved + **synced** to Bullhorn (mock `external_entity_ref`); **two `field_evidence` rows** on `compensation_expectations` pointing at different transcript spans.
- **Audit:** edit on target role + approval trail.

## 5 — Sam Rivera (Payroll / Workday implementation lead)

- **Recruiter:** Luis Ortega (cross practice).
- **Call:** **Hybrid Bay Area** but candidate says they are **“mostly remote for now”** and **“could do one week a month in-office if it’s the right team”** — location rule unclear for the client MSAs.
- **State:** **Partially approved** (some fields approved, one rejected as unusable for submittal); ATS sync **failed** (mapping / validation style summary in `ats_sync_logs`).
- **Edge:** **Notice period** explicitly **missing** (no row); visa is **US citizen** (clean) to contrast with Marcus.

---

**Org:** *Northline Talent Partners* (regional staffing + light consulting). **Three recruiters** map to three users (distinct emails).

## Load seed data

From `server/` (PostgreSQL must be running; run `alembic upgrade head` first):

```bash
source .venv/bin/activate
export DATABASE_URL=postgresql+psycopg://pilot:pilot@127.0.0.1:5432/pilot
python scripts/seed_staffing_mvp.py
```

This executes `TRUNCATE organizations CASCADE` then inserts the scenarios. Use `--dry-run` to print the planned scenario count only.
