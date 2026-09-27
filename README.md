# SiliconSense by SpideyTech

> **Your hardware's sixth sense.** Detect hidden PC bottlenecks before you build or upgrade. Understand how strong your PC really is, where it is unbalanced, and what to upgrade first via explainable, workload-aware benchmark scoring in a dark glassmorphic lab UI.

## Architecture & Tech Stack
- **Frontend (`apps/web`):** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui (Base UI), Motion for React, Recharts
- **Backend (`apps/api`):** Python FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic
- **Data & Scoring:** Deterministic percentile normalization & workload-weighted scoring (Pandas, NumPy)
- **Database & Infra (`infra/docker`):** PostgreSQL 16, Redis 7, Supabase Auth

## Repository Layout
```text
.
├── AGENTS.md                 # Persistent rules & data provenance contract
├── .env.example              # Environment variable template
├── apps/
│   ├── web/                  # Next.js frontend application
│   └── api/                  # FastAPI backend & scoring engine
├── packages/
│   ├── contracts/            # Shared API schemas & TypeScript definitions
│   └── design-tokens/        # Hardware-lab glassmorphism design tokens
├── data/
│   ├── fixtures/             # Small deterministic test fixtures
│   └── manifests/            # Benchmark source & license manifests
├── scripts/                  # CLI ingestion & maintenance utilities
├── docs/                     # Product Blueprint, AI Playbook, ADRs & schema docs
└── infra/
    ├── docker/               # Local PostgreSQL & Redis Docker Compose setup
    └── deployment/           # Production deployment