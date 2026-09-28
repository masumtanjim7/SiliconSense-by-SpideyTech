# SiliconSense by SpideyTech — Operational Runbooks

## 1. Automated Dataset Refresh Failure
- **Symptom:** Scheduled cron or CLI execution of `scripts/refresh_datasets.py` fails with validation or constraint errors.
- **Remediation:**
  1. Inspect the raw JSON artifact schema against `data/manifests/`.
  2. Verify that unapproved benchmark versions or missing device names are correctly quarantined.
  3. Re-run manually with verbose output: `python scripts/refresh_datasets.py --dataset-version ds-2026-09-r1`.

## 2. High Quarantine Rate Alert
- **Symptom:** `/v1/meta/data-quality` reports `quarantine_rate_pct > 25.0`.
- **Remediation:**
  1. Check `benchmark_observation.environment_json -> 'quarantine_reason'` in PostgreSQL.
  2. Common causes include unapproved test version prefixes or unmatched component vendor strings. Update the test manifest if new PTS profile versions were introduced.

## 3. Database Migration Rollback
- **Symptom:** Alembic upgrade failure during deployment.
- **Remediation:**
  1. Check current revision: `python -m alembic current`.
  2. Downgrade one revision: `python -m alembic downgrade -1`.