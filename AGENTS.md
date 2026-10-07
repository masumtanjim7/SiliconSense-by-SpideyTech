# SiliconSense by SpideyTech (PC Strength & Balance Analyzer) — Instructions

## Source of truth
Before modifying architecture, scoring, data ingestion or UI, read:
- docs/PC_Strength_Balance_Analyzer_Product_Blueprint.pdf
- docs/PC_Strength_Balance_Analyzer_AI_Prompt_Playbook.docx
- docs/database-design.png

## Product contract
We analyze PC builds by workload. Performance and balance are separate. Never invent benchmark data.

## Stack
- apps/web: Next.js App Router + TypeScript + Tailwind + Recharts + Motion
- apps/api: FastAPI + Pydantic + SQLAlchemy/Alembic
- PostgreSQL
- Python Pandas/NumPy pipelines
- Redis/Celery only when needed; cron/scheduled scripts are acceptable for MVP
- Supabase Auth for MVP
- S3-compatible object storage for raw archives when useful

## Data provenance
Every benchmark/imported metric must preserve source, source version, source date/test version where available, imported_at, raw value/unit and canonical component identity.
Raw data is immutable. Cleaned/normalized data is derived and versioned.

## Data-source policy
- Blender Open Data: allowed benchmark source; ingest only documented public exports/query results and record provenance.
- Geekbench Browser: do not scrape/bulk-copy. Reference/validation only unless explicit license/permission is documented in the repo.
- Phoronix Test Suite: preferred for our own reproducible benchmark runs. Verify test/profile licensing before production use.
- Manufacturer/spec catalogs: curated/authorized sources only. Do not silently scrape retail/manufacturer sites.

## Scoring
- Store metric-level normalized scores.
- Workload weights are versioned data, not hard-coded magic scattered through UI/API.
- Analysis must expose scoring_version, normalization_version and dataset_version.
- Confidence decreases with stale, sparse or incomparable data.
- Never present a missing metric as zero unless a documented rule says so.

## Frontend
- Premium dark glassmorphism, restrained and readable.
- Use design tokens; no random hard-coded gradients per component.
- Mobile-first, 320px minimum width, accessible focus states, reduced-motion support.
- Forms/tables are solid enough for readability.
- Never compute authoritative scores in the browser; backend is source of truth.

## Backend
- Keep routers thin. Domain/services own scoring, ingestion, normalization and recommendation logic.
- Validate inputs with Pydantic.
- Use migrations.
- Idempotent ingestion jobs.
- Structured logs, correlation/request IDs where practical.

## Quality gate before completing any task
1. Run relevant tests/lint/typecheck.
