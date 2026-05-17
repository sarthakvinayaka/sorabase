"""Typed analytics-friendly extraction fields.

No structural changes to the DB schema are required — extracted_fields uses a
schemaless field_name/raw_value pattern (field_name: String, raw_value: JSON),
so column definitions are unchanged.

What changed at the application level (field names stored in field_name column):

  Removed (4):
    years_experience        → split into years_experience_years + years_experience_text
    target_rate_or_salary   → split into target_salary_min + target_salary_max +
                              compensation_period + compensation_text
    notice_period           → renamed to notice_period_days + notice_period_text
    visa_status             → folded into work_authorization_text

  Added (11):
    work_authorization_status   enum: authorized_now | requires_future_sponsorship |
                                      requires_current_sponsorship | unknown
    work_authorization_text     verbatim candidate quote about work auth / visa
    remote_preference_text      verbatim candidate quote about remote preference
    years_experience_years      float (canonical numeric years)
    years_experience_text       verbatim candidate quote about experience
    target_salary_min           int (whole dollars lower bound)
    target_salary_max           int (whole dollars upper bound, null for single point)
    compensation_period         "annual" | "hourly"
    compensation_text           verbatim candidate quote about compensation
    notice_period_days          int (calendar days, 0 = immediate)
    notice_period_text          verbatim candidate quote about notice period

  Enum value changes:
    RemotePreference values changed from Title Case ("Remote", "On-site") to
    lowercase canonical ("remote", "onsite") and gained an "unknown" fallback.

For production data migration (run against extracted_fields rows before deploying):

  -- Rename notice_period → notice_period_days
  UPDATE extracted_fields SET field_name = 'notice_period_days'
  WHERE field_name = 'notice_period';

  -- Rename years_experience → years_experience_years
  UPDATE extracted_fields SET field_name = 'years_experience_years'
  WHERE field_name = 'years_experience';

  -- Split target_rate_or_salary into three rows per extraction run
  INSERT INTO extracted_fields (id, org_id, extraction_run_id, field_name,
    raw_value, normalized_value, evidence_snippet, confidence, status, edited, created_at, updated_at)
  SELECT gen_random_uuid(), org_id, extraction_run_id,
    'target_salary_min',
    raw_value->'lo', normalized_value->'lo',
    evidence_snippet, confidence, status, false, now(), now()
  FROM extracted_fields WHERE field_name = 'target_rate_or_salary'
    AND raw_value->'lo' IS NOT NULL AND raw_value->>'lo' != 'null';

  INSERT INTO extracted_fields (id, org_id, extraction_run_id, field_name,
    raw_value, normalized_value, evidence_snippet, confidence, status, edited, created_at, updated_at)
  SELECT gen_random_uuid(), org_id, extraction_run_id,
    'target_salary_max',
    raw_value->'hi', normalized_value->'hi',
    evidence_snippet, confidence, status, false, now(), now()
  FROM extracted_fields WHERE field_name = 'target_rate_or_salary'
    AND raw_value->'hi' IS NOT NULL AND raw_value->>'hi' != 'null';

  INSERT INTO extracted_fields (id, org_id, extraction_run_id, field_name,
    raw_value, normalized_value, evidence_snippet, confidence, status, edited, created_at, updated_at)
  SELECT gen_random_uuid(), org_id, extraction_run_id,
    'compensation_period',
    raw_value->'period', normalized_value->'period',
    evidence_snippet, confidence, status, false, now(), now()
  FROM extracted_fields WHERE field_name = 'target_rate_or_salary'
    AND raw_value->'period' IS NOT NULL AND raw_value->>'period' != 'null';

  DELETE FROM extracted_fields WHERE field_name = 'target_rate_or_salary';

  -- Remove visa_status (data is re-extracted into work_authorization_text)
  DELETE FROM extracted_fields WHERE field_name = 'visa_status';

Revision ID: 003
Revises: 002
Create Date: 2026-05-15
"""

from alembic import op


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No column changes — field_name is a plain String, raw_value is JSON.
    # The data migration SQL above must be run manually against existing data
    # before deploying the updated application code.
    pass


def downgrade() -> None:
    pass
