# SiliconSense by SpideyTech — Authentication & Security Architecture

## 1. Authentication Model (Supabase Auth + Server-Side JWT Verification)
- **Guest Access:** Public catalog browsing (`/v1/components/*`, `/v1/workloads`, `/v1/meta/dataset-version`) and temporary build analyses (`/v1/builds/analyze`, `/v1/builds/compare`) require no account.
- **Authenticated User Access:** Saving builds (`POST /v1/builds`) and viewing saved build history (`GET /v1/builds`) require a valid `Bearer <JWT>` signed with `SUPABASE_JWT_SECRET` (HS256).
- **Zero Trust on Browser Role Claims:** FastAPI verifies the JWT signature and `exp` timestamp server-side, extracts `sub`, and resolves the user's role strictly from the PostgreSQL `user_profile.role` column (`user`, `data_admin`, `system_worker`). Client-supplied role claims in the JWT payload are ignored.

## 2. Privileged Admin & Worker Endpoints
- All `/internal/ingestion/*` endpoints require `user_profile.role IN ('data_admin', 'system_worker')`.
- Every privileged mutation records an immutable row in `audit_event` with `actor_subject`, `action`, `entity_type`, `entity_id`, and `payload_json`.

## 3. Local Development Setup
1. Ensure `SUPABASE_JWT_SECRET` is set in `.env` (defaults to placeholder in `.env.example`).
2. Never expose `SUPABASE_JWT_SECRET` or any Supabase `service_role` key to `apps/web` (`NEXT_PUBLIC_*` variables must only contain the public URL and anon key).