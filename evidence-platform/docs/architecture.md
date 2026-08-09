# Architecture

## Overview

The Evidence Assurance and Accountability Platform is a Next.js App Router application backed by Supabase. It implements a resumable, stateful verification pipeline that processes submitted content through twelve deterministic stages.

## System Layers

```
Browser (React Server Components + Client Components)
  ↓
Next.js App Router (Route Handlers = API, Server Components = SSR)
  ↓
Verification Pipeline (lib/verification/)
  ↓
AI Provider Adapter (lib/ai/providers/) → Anthropic or Mock
DOI/Citation Adapters (lib/retrieval/) → Crossref, DataCite
URL Fetcher (lib/retrieval/url-fetcher.ts) → Public URLs
File Parser (lib/verification/parsers/) → PDF, DOCX, TXT, MD
  ↓
Supabase (Postgres + RLS + Storage)
```

## Pipeline Stages

| Stage | Module | Persisted State |
|---|---|---|
| intake_normalized | verification/intake.ts | verification_cases, case_artifacts |
| text_extracted | verification/parsers/ | case_artifacts.extracted_text |
| claims_extracted | ai/prompts/extract-claims.ts | claims |
| domain_classified | verification/classifier.ts | claims (domain, stakes_level) |
| sources_collected | retrieval/doi-validator.ts, url-fetcher.ts | sources |
| sources_validated | retrieval/source-validator.ts | sources |
| passages_extracted | verification/passage-extractor.ts | source_passages |
| evidence_matched | ai/prompts/evidence-matcher.ts | claim_evidence |
| prosecutor_reviewed | ai/prompts/prosecutor.ts | verification_runs |
| scored | verification/scoring-engine.ts | claim_scores |
| report_generated | reports/report-generator.ts | verification_cases.final_verdict |
| completed | — | verification_cases.status |

## Key Modules

### AI Provider Layer (`lib/ai/`)

- `providers/interface.ts` — provider interface contract
- `providers/anthropic.ts` — Anthropic SDK adapter (server-only)
- `providers/mock.ts` — deterministic mock for tests and local dev
- `providers/factory.ts` — selects provider from environment
- `prompts/` — versioned prompt strings with version constants
- `schemas/` — Zod schemas for all LLM structured outputs

### Retrieval (`lib/retrieval/`)

- `doi-validator.ts` — DOI normalization, syntax check, resolver, Crossref+DataCite queries
- `url-fetcher.ts` — SSRF-safe URL fetch with content extraction
- `source-validator.ts` — source tier classification, retraction check

### Verification (`lib/verification/`)

- `intake.ts` — input normalization, hashing, case creation
- `parsers/` — PDF, DOCX, TXT, MD text extraction
- `passage-extractor.ts` — exact passage extraction with locators
- `scoring-engine.ts` — pure TypeScript deterministic scoring (no LLM)
- `policy-engine.ts` — policy overrides that outrank numeric score

### Security (`lib/security/`)

- `rate-limiter.ts` — sliding-window in-memory rate limiter
- `sanitizer.ts` — log redaction for secrets, tokens, health IDs
- `headers.ts` — Content-Security-Policy and secure response headers

### Jobs (`lib/jobs/`)

- `worker.ts` — polling-based job processor, max 5 attempts
- `queue.ts` — job enqueueing with `verification_jobs` table

### Supabase (`lib/supabase/`)

- `client.ts` — browser client (anon key only)
- `server.ts` — server client (service role, server-only)
- `middleware.ts` — session refresh in middleware

## Data Flow: New Verification Case

1. User submits via `/verify` form (paste, URL, DOI, file)
2. POST `/api/cases` — server validates with Zod, creates case row, enqueues job
3. Job worker picks up `verification_jobs` row
4. Each pipeline stage runs, persists results, advances case status
5. Client polls `/api/cases/:id` — receives status updates
6. On `completed`, case report is available at `/cases/:id`

## Security Boundaries

- Service role key: server Route Handlers only, never browser
- AI provider keys: server only, never NEXT_PUBLIC_
- Storage: private bucket, signed URLs with 60-minute expiry
- RLS: all tables enforce organization isolation at the database layer
- Uploads: MIME and size validated server-side before storage
- Fetched content: treated as untrusted data in isolated context
- Prompt injection: web content passed as quoted data, not system instructions
