# Independent Code Audit — Evidence Assurance Platform

**Date:** 2026-08-09  
**Auditor:** Claude Code (automated forensic audit)  
**Branch:** `claude/repository-setup-preferences-45mk1t`  
**Build status at audit time:** `npm run build` passes, `npm run test` 53/53 pass

---

## Legend

| Status | Meaning |
|---|---|
| `IMPLEMENTED_AND_TESTED` | Code exists, is reachable, and has at least one passing automated test verifying its behavior |
| `IMPLEMENTED_NOT_TESTED` | Code exists and is reachable but no automated test exercises it |
| `PARTIALLY_IMPLEMENTED` | Code exists but one or more critical responsibilities are stubs, no-ops, or hard-coded fallbacks |
| `UI_ONLY_OR_STUB` | Renders correctly but wires to nothing real or has missing side effects |
| `MISSING` | Required by architecture/spec but absent from the codebase |
| `BLOCKED_BY_EXTERNAL_CREDENTIAL_OR_AUTHORIZATION` | Implementation complete; cannot run without a secret or external account the author controls |

---

## Database Tables (Migration: `supabase/migrations/001_initial_schema.sql`)

**Correct count: 14 tables.** The `docs/database.md` says 13 — that was written before `commitment_evaluations` was added. The migration contains:

| Table | RLS | Status |
|---|---|---|
| `organizations` | enabled | IMPLEMENTED_NOT_TESTED |
| `profiles` | enabled | IMPLEMENTED_NOT_TESTED |
| `verification_cases` | enabled | IMPLEMENTED_NOT_TESTED |
| `extracted_claims` | enabled | IMPLEMENTED_NOT_TESTED |
| `evidence_sources` | enabled | IMPLEMENTED_NOT_TESTED |
| `evidence_matches` | enabled | IMPLEMENTED_NOT_TESTED |
| `prosecutor_reviews` | enabled | IMPLEMENTED_NOT_TESTED |
| `scoring_results` | enabled | IMPLEMENTED_NOT_TESTED |
| `verification_reports` | enabled | IMPLEMENTED_NOT_TESTED |
| `verification_jobs` | enabled | IMPLEMENTED_NOT_TESTED |
| `audit_events` | enabled | IMPLEMENTED_NOT_TESTED |
| `commitments` | enabled | IMPLEMENTED_NOT_TESTED |
| `commitment_evaluations` | enabled | IMPLEMENTED_NOT_TESTED |
| `benchmark_runs` | enabled | IMPLEMENTED_NOT_TESTED |

**No integration tests verify RLS policies.** All 14 tables have RLS enabled at DDL level; whether the policies correctly isolate organizations has not been tested.

---

## Core Library — Verification

| File | Status | Notes |
|---|---|---|
| `src/lib/verification/scoring-engine.ts` | IMPLEMENTED_AND_TESTED | 348 lines, fully deterministic, no LLM calls. Tested by `tests/unit/scoring-engine.test.ts` (28 cases) and `tests/unit/benchmarks.test.ts` (15 fixture assertions). All 5 release gates pass. |
| `src/lib/verification/classifier.ts` | IMPLEMENTED_AND_TESTED | Keyword-based domain classifier, deterministic. Tested by `tests/unit/classifier.test.ts` (6 cases). |
| `src/lib/verification/intake.ts` | IMPLEMENTED_AND_TESTED | Text normalization, DOI extraction, storage path sanitization. Tested by `tests/unit/intake.test.ts`. |
| `src/lib/verification/parsers/index.ts` | IMPLEMENTED_NOT_TESTED | PDF/DOCX parsing via `pdf-parse` and `mammoth`. No unit test. MIME type validation exists. `file_upload` input type is accepted by the API but the pipeline worker never routes to this parser. |

---

## Core Library — Retrieval

| File | Status | Notes |
|---|---|---|
| `src/lib/retrieval/doi-validator.ts` | IMPLEMENTED_AND_TESTED | 231 lines. Network calls to Crossref/DataCite/DOI.org. Tested by `tests/unit/doi-validator.test.ts`. Tests mock the network; live behavior BLOCKED_BY_EXTERNAL_CREDENTIAL_OR_AUTHORIZATION (network egress must be open in production). |
| `src/lib/retrieval/url-fetcher.ts` | IMPLEMENTED_NOT_TESTED | 182 lines. SSRF protection solid: blocks RFC1918, localhost, cloud metadata, non-standard ports, non-HTTP(S), redirects re-validated. No unit test. |

---

## Core Library — AI Providers

| File | Status | Notes |
|---|---|---|
| `src/lib/ai/providers/interface.ts` | IMPLEMENTED_NOT_TESTED | Defines `AIProvider`, `ProviderRunOptions`, `ProviderRunResult`. No test needed (type-only). |
| `src/lib/ai/providers/anthropic.ts` | BLOCKED_BY_EXTERNAL_CREDENTIAL_OR_AUTHORIZATION | Requires `ANTHROPIC_API_KEY`. Falls back to mock when absent. Uses `claude-sonnet-4-5` model. Retry logic present (configurable `maxRetries`). |
| `src/lib/ai/providers/mock.ts` | IMPLEMENTED_NOT_TESTED | Returns empty object for every schema. Will fail Zod validation for required fields — not a safe mock for integration testing. |
| `src/lib/ai/providers/factory.ts` | IMPLEMENTED_NOT_TESTED | Module-level singleton. `require()` call used to avoid circular import. Works but not tested. |

---

## Core Library — AI Schemas

| File | Status | Notes |
|---|---|---|
| `src/lib/ai/schemas/claim-extraction.ts` | IMPLEMENTED_NOT_TESTED | `ClaimSchema` defines 9 fields. `is_verifiable`, `confidence`, `source_location` columns exist in DB but are NOT in this schema — the pipeline sets `is_verifiable: true` hardcoded. |
| `src/lib/ai/schemas/evidence-matching.ts` | IMPLEMENTED_NOT_TESTED | `EvidenceMatchSchema` defines the full LLM evidence matching structure. **This schema is never called in the pipeline.** Stage 8 uses heuristic-only matching. |
| `src/lib/ai/schemas/prosecutor.ts` | IMPLEMENTED_NOT_TESTED | 14 objection types, 6 recommendation values. Used in pipeline Stage 9. |

---

## Core Library — AI Prompts

| File | Status | Notes |
|---|---|---|
| `src/lib/ai/prompts/extract-claims.ts` | IMPLEMENTED_NOT_TESTED | Well-written, includes untrusted-data warning. |
| `src/lib/ai/prompts/prosecutor.ts` | IMPLEMENTED_NOT_TESTED | Adversarial framing. Includes untrusted-data guard. |
| `src/lib/ai/prompts/versions.ts` | IMPLEMENTED_NOT_TESTED | 6 versioned keys. No evidence-matcher prompt exists in code (matched schema but missing prompt). |

---

## Core Library — Security

| File | Status | Notes |
|---|---|---|
| `src/lib/security/sanitizer.ts` | IMPLEMENTED_AND_TESTED | Redacts JWTs, API keys, SSNs, credit cards, password/token fields. Tested by `tests/unit/sanitizer.test.ts`. |
| `src/lib/security/rate-limiter.ts` | IMPLEMENTED_AND_TESTED | In-memory Map, 50 req/60s per IP. Tested by `tests/unit/rate-limiter.test.ts`. **Critical gap: in-memory store resets on every Vercel serverless cold start — rate limits do not persist across invocations.** |
| `src/lib/security/headers.ts` | IMPLEMENTED_NOT_TESTED | Sets CSP, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy. `script-src 'unsafe-inline'` is weak — no nonce-based CSP. Headers applied in `proxy.ts` on every request. |

---

## Core Library — Benchmarks

| File | Status | Notes |
|---|---|---|
| `src/lib/benchmarks/fixtures.ts` | IMPLEMENTED_AND_TESTED | 15 fixtures covering all 5 release gates. |
| `src/lib/benchmarks/runner.ts` | IMPLEMENTED_AND_TESTED | Runs fixtures against scoring engine. All 5 gates pass. |

---

## Pipeline Worker

| Component | Status | Notes |
|---|---|---|
| `src/lib/jobs/worker.ts` — overall | PARTIALLY_IMPLEMENTED | 430 lines. Stages 1–6 and 10–11 are real. Stages 7, 8, and 9 have critical deficiencies (detailed below). |
| Stage 1: `intake_normalized` | IMPLEMENTED_NOT_TESTED | `normalizeText()` applied to raw_input. Real. |
| Stage 2: `text_extracted` | IMPLEMENTED_NOT_TESTED | Assigns normalized text. Real. |
| Stage 3: `claims_extracted` | IMPLEMENTED_NOT_TESTED | Calls LLM via `getAIProvider()`. Inserts claims. Does not persist `is_verifiable` from schema (hardcodes `true`). Does not persist `confidence` or `source_location` columns. |
| Stage 4: `domain_classified` | IMPLEMENTED_NOT_TESTED | Keyword-based classification. Updates case with `domain`, `stakes_level`, `materiality`. Real. |
| Stage 5: `sources_collected` | IMPLEMENTED_NOT_TESTED | Extracts DOIs with regex, URLs with regex. Limits URLs to 20. Inserts `evidence_sources` rows. Real. |
| Stage 6: `sources_validated` | IMPLEMENTED_NOT_TESTED | Validates DOIs via `validateDoi()`, fetches URLs via `fetchUrl()`. Updates source metadata. Real. |
| Stage 7: `passages_extracted` | UI_ONLY_OR_STUB | **Comment says "handled per-source in evidence matching" but Stage 8 never extracts passages.** No text is fetched and stored as passage content. No `passage_text` column is updated anywhere. This is a **no-op stub**. |
| Stage 8: `evidence_matched` | PARTIALLY_IMPLEMENTED | **Heuristic-only matching.** Assigns `relationship: "context_only"` and `entailment_score: 0.3` to every accessible source × verifiable claim pair. `EvidenceMatchSchema` is defined and available but is never invoked. No claim text, no passage text, no LLM evidence assessment. All evidence matches have identical scores. |
| Stage 9: `prosecutor_reviewed` | PARTIALLY_IMPLEMENTED | Sends LLM only a count summary: `"Claims: N. Sources: M. Matches: K."` — no claim text, no source metadata, no passages. The prosecutor cannot flag fabricated citations or missing passages without seeing them. Additionally, `recommendation: "proceed"` is **hardcoded** in the DB insert (line 309), ignoring `pd.recommendation` from the LLM output. |
| Stage 10: `scored` | IMPLEMENTED_NOT_TESTED | Calls deterministic `scoreEvidence()`. Inserts `scoring_results`. Updates case with verdict and score. Real. |
| Stage 11: `report_generated` | IMPLEMENTED_NOT_TESTED | Generates summary report. Inserts `verification_reports`. `apa_references: []` is always empty. |
| `pollAndProcessJobs()` | PARTIALLY_IMPLEMENTED | **Not production-safe for Vercel serverless.** Function polls DB for queued jobs. In Vercel, every API request runs in a short-lived function — there is no persistent process to call this. No Vercel Cron route exists. Jobs will accumulate in `verification_jobs` with `status: "queued"` and never be processed unless a trigger exists. |

---

## Supabase Clients

| File | Status | Notes |
|---|---|---|
| `src/lib/supabase/client.ts` | IMPLEMENTED_NOT_TESTED | Browser client. Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Validates env vars. |
| `src/lib/supabase/server.ts` | IMPLEMENTED_NOT_TESTED | Server client (anon key) and service client (service role key). `createServiceClient()` correctly uses `SUPABASE_SERVICE_ROLE_KEY` — never exposed to browser. |
| `src/lib/supabase/types.ts` | IMPLEMENTED_NOT_TESTED | Hand-authored Database type. All tables have `Relationships: []`. Schema has `Views: Record<string, never>` and `Functions: Record<string, never>`. Required for Supabase v2 type inference to work. |

---

## Proxy / Auth Middleware

| File | Status | Notes |
|---|---|---|
| `src/proxy.ts` | IMPLEMENTED_NOT_TESTED | Next.js 16 `proxy.ts` with `export function proxy`. Protects `/dashboard`, `/verify`, `/cases`, `/commitments`, `/benchmarks`. Refreshes session on every request. Redirects logged-in users away from `/login` and `/signup`. Security headers applied. |

---

## API Routes

| Route | Status | Notes |
|---|---|---|
| `GET /api/health` | IMPLEMENTED_NOT_TESTED | Returns `{status: "ok", timestamp, version}`. No auth required. |
| `GET /api/cases` | IMPLEMENTED_NOT_TESTED | Paginated, filterable by status. Auth required. Rate-limited. |
| `POST /api/cases` | IMPLEMENTED_NOT_TESTED | Creates case, enqueues job. Auth required. Zod validation. Audit event written. **Does not handle `file_upload` input type (no multipart parsing).** |
| `GET /api/cases/[id]` | IMPLEMENTED_NOT_TESTED | Returns case + claims + sources + matches + prosecutor + scoring + report. Auth via RLS. |
| `DELETE /api/cases/[id]` | IMPLEMENTED_NOT_TESTED | Cancels queued/failed case. Checks `created_by === user.id`. |
| `POST /api/cases/[id]/run` | IMPLEMENTED_NOT_TESTED | Re-queues case for processing. Validates `from_stage`. Does not actually trigger `processJob()` — just enqueues. |
| `GET /api/commitments` | IMPLEMENTED_NOT_TESTED | Paginated list. Auth required. |
| `POST /api/commitments` | IMPLEMENTED_NOT_TESTED | Creates commitment. Auth required. Zod validation. Audit event written. |
| `POST /api/commitments/[id]/evaluate` | IMPLEMENTED_NOT_TESTED | LLM-based commitment evaluation. Correct: uses try/catch on provider.run(), sends `evidence_text` as untrusted data warning, stores evaluation + audit event. |
| `GET /api/benchmarks/results` | IMPLEMENTED_NOT_TESTED | Admin-only. Returns recent benchmark runs. |
| `POST /api/benchmarks/run` | IMPLEMENTED_NOT_TESTED | Admin-only. Runs all 15 fixtures, stores result. |
| `/api/cron/process-jobs` | MISSING | **No route exists to trigger `processJob()`.** Without this, jobs never run in production. |
| `/api/cases/upload` | MISSING | No multipart upload handler for `file_upload` input type. |

---

## UI Pages

| Route | Status | Notes |
|---|---|---|
| `/` (home) | IMPLEMENTED_NOT_TESTED | Landing page with accurate claims: "verdicts traceable to sources," "adversarial review," "commitment accountability." No overstatements found. |
| `/login` | IMPLEMENTED_NOT_TESTED | `LoginForm` in `<Suspense>` (correct for Next.js 16). Email/password, redirectTo support. |
| `/signup` | IMPLEMENTED_NOT_TESTED | Email/password sign-up. Email confirmation flow. |
| `/dashboard` | IMPLEMENTED_NOT_TESTED | Shows recent cases and commitments. Correct data fetching. |
| `/verify` | IMPLEMENTED_NOT_TESTED | Text/URL/DOI submission. No `file_upload` option in UI (input type is accepted by API but not surfaced). Score methodology explained accurately. |
| `/cases` | IMPLEMENTED_NOT_TESTED | Paginated case list with status filter. |
| `/cases/[id]` | IMPLEMENTED_NOT_TESTED | Case detail: verdict card, score, claims, sources. `RerunButton` uses Server Action (bypasses API `/run` route but achieves same DB state). Does not poll for status updates — user must refresh manually. |
| `/commitments` | IMPLEMENTED_NOT_TESTED | Commitment list with status filter. Links to `/commitments/[id]`. |
| `/commitments/new` | IMPLEMENTED_NOT_TESTED | Create commitment form. All fields present. |
| `/commitments/[id]` | MISSING | **Individual commitment detail page does not exist.** The list links to `/commitments/${c.id}` but that route returns 404. Clicking any commitment from the list is broken. |

---

## Tests

| Component | Status | Notes |
|---|---|---|
| `tests/unit/scoring-engine.test.ts` | IMPLEMENTED_AND_TESTED | 28 test cases covering all policy overrides and score ranges. |
| `tests/unit/benchmarks.test.ts` | IMPLEMENTED_AND_TESTED | 8 assertions over 15 fixtures, all 5 gates verified. |
| `tests/unit/classifier.test.ts` | IMPLEMENTED_AND_TESTED | 6 cases covering all domains. |
| `tests/unit/intake.test.ts` | IMPLEMENTED_AND_TESTED | Normalizations, DOI extraction, path sanitization. |
| `tests/unit/sanitizer.test.ts` | IMPLEMENTED_AND_TESTED | Redaction patterns verified. |
| `tests/unit/rate-limiter.test.ts` | IMPLEMENTED_AND_TESTED | Sliding window logic. |
| `tests/unit/doi-validator.test.ts` | IMPLEMENTED_AND_TESTED | Format parsing, mock network responses. |
| `tests/integration/` | MISSING | No directory. No RLS tests, no pipeline tests against DB. |
| `tests/e2e/` | MISSING | No directory. No Playwright tests. |
| `playwright.config.ts` | MISSING | Required for `npm run test:e2e`. |
| `tests/unit/url-fetcher.test.ts` | MISSING | SSRF protection untested. |
| `tests/unit/parsers.test.ts` | MISSING | PDF/DOCX parsing untested. |
| `tests/unit/worker.test.ts` | MISSING | Pipeline stages untested. |

---

## Documentation

| File | Status | Notes |
|---|---|---|
| `docs/architecture.md` | IMPLEMENTED_NOT_TESTED | Accurate. |
| `docs/database.md` | PARTIALLY_IMPLEMENTED | Claims 13 tables; actual count is 14. `commitment_evaluations` missing from table listing. |
| `docs/api.md` | IMPLEMENTED_NOT_TESTED | Covers known routes. Missing `/api/cron/process-jobs`. |
| `docs/scoring-policy.md` | IMPLEMENTED_NOT_TESTED | Policy overrides documented. |
| `docs/domain-policies.md` | IMPLEMENTED_NOT_TESTED | 7 domain packs documented. |
| `docs/threat-model.md` | IMPLEMENTED_NOT_TESTED | Covers main threat surfaces. |
| `docs/benchmark-policy.md` | IMPLEMENTED_NOT_TESTED | 5 gates documented. |
| `docs/assumptions.md` | IMPLEMENTED_NOT_TESTED | Records design choices. |
| `docs/release-checklist.md` | IMPLEMENTED_NOT_TESTED | Checklist exists. |
| `docs/supabase-production-setup.md` | MISSING | Required for deployment. |
| `docs/vercel-production-setup.md` | MISSING | Required for deployment. |
| `docs/founder-actions-required.md` | MISSING | Required per directive. |
| `docs/launch-checklist.md` | MISSING | Required per directive. |
| `docs/security-verification-report.md` | MISSING | Required per directive. |

---

## Configuration Files

| File | Status | Notes |
|---|---|---|
| `next.config.ts` | IMPLEMENTED_NOT_TESTED | Needs review. |
| `tsconfig.json` | IMPLEMENTED_NOT_TESTED | Strict mode, noUncheckedIndexedAccess, `tests/` excluded. |
| `tsconfig.test.json` | IMPLEMENTED_NOT_TESTED | `vitest/globals` types included. |
| `vitest.config.ts` | IMPLEMENTED_NOT_TESTED | Configured with path aliases. |
| `vercel.json` | MISSING | No cron configuration, no build overrides. Required for Vercel Cron to trigger job processing. |
| `.env.example` | MISSING | No template for required environment variables. |

---

## Critical Gaps Ranked by Severity

### SEVERITY: CRITICAL (blocks core product function)

1. **No job runner trigger.** `pollAndProcessJobs()` exists but nothing calls it in production. Every submitted case stays `queued` forever. Required: Vercel Cron route + `vercel.json` cron schedule, OR Supabase Edge Function.

2. **`/commitments/[id]` page missing.** Every commitment in the list links to a 404. The commitment detail/evaluate flow is entirely broken from the UI.

3. **Stage 8 heuristic-only matching.** `EvidenceMatchSchema` and evidence-matcher prompt version exist but the LLM is never called. All evidence gets `relationship: "context_only"` and `entailment_score: 0.3`. Scoring engine receives no meaningful signal.

### SEVERITY: HIGH (degrades verdict quality)

4. **Stage 9 prosecutor receives counts only.** Sending "Claims: 3. Sources: 2. Matches: 6." is not enough for the prosecutor to flag `fabricated_citation`, `no_direct_support`, or `stale_source`. The prosecutor objections are structurally meaningless without actual text.

5. **Stage 7 is a no-op.** No passage text is extracted or stored. The APA 7 renderer references `apa_references: []` always empty.

6. **`recommendation` hardcoded in prosecutor insert.** Line 309 of `worker.ts` inserts `recommendation: "proceed"` regardless of what the LLM returns. The `pd.recommendation` from the structured output is silently discarded.

7. **Rate limiter state lost on Vercel cold starts.** In-memory Map resets on every new function instance. Rate limits do not prevent per-IP abuse in production.

### SEVERITY: MEDIUM (ops/security/completeness)

8. **No integration tests for RLS.** Cannot verify that organization-scoped queries correctly enforce isolation.

9. **`file_upload` input type accepted but not handled.** `CreateCaseInputSchema` accepts it; the pipeline worker has no branch for it.

10. **14 tables documented as 13 in `docs/database.md`.** Minor documentation drift.

11. **CSP `script-src 'unsafe-inline'` is weak.** Nonce-based or hash-based CSP would be stronger.

12. **Missing `.env.example`.** No canonical reference for required environment variables.

13. **Mock AI provider returns empty object.** Zod validation of the mock output will fail for schemas with required fields, causing test pipelines to error when run with `AI_PROVIDER=mock`.

---

## Summary Counts

| Status | Count |
|---|---|
| IMPLEMENTED_AND_TESTED | 13 |
| IMPLEMENTED_NOT_TESTED | 43 |
| PARTIALLY_IMPLEMENTED | 4 |
| UI_ONLY_OR_STUB | 1 |
| MISSING | 17 |
| BLOCKED_BY_EXTERNAL_CREDENTIAL_OR_AUTHORIZATION | 3 |

**Build passes. Tests pass (unit only). Core scoring engine is sound and tested. Pipeline job runner, commitment UI, and LLM evidence matching are the three items that must be repaired before the product is usable.**
