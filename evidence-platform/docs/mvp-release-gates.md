# MVP Release Gates

Gates that must pass before this platform is released to users. Each gate has a verification method and current status.

---

## Gate 1: Build passes with zero TypeScript errors

| Check | Command | Status |
|---|---|---|
| Production build | `npm run build` | PASS — 16 routes, 0 errors |
| Type-strict compilation | `npm run typecheck` | PASS — 0 errors |

---

## Gate 2: All automated tests pass

| Suite | Command | Status |
|---|---|---|
| Full suite | `npm run test` | PASS — 166/166 (12 test files) |
| Unit tests | `npm run test:unit` | PASS — 83/83 (8 files) |
| Integration tests | `npm run test:integration` | PASS — 83/83 (4 files) |
| E2E structure | `npx playwright test --list` | 11 tests listed |

---

## Gate 3: Pipeline stages 1–12 all implemented

| Stage | State name | Implemented |
|---|---|---|
| 1 | intake_normalized | YES |
| 2 | text_extracted | YES — includes file_upload path via Supabase Storage |
| 3 | claims_extracted | YES — LLM with Zod-validated schema |
| 4 | domain_classified | YES — deterministic |
| 5 | sources_collected | YES — DOI regex + URL extraction |
| 6 | sources_validated | YES — Crossref + accessibility check + metadata stored |
| 7 | passages_extracted | YES — URL content fetch + DOI metadata summary |
| 8 | evidence_matched | YES — LLM per claim×source pair |
| 9 | prosecutor_reviewed | YES — LLM with real context |
| 10 | scored | YES — deterministic 14-component engine |
| 11 | report_generated | YES — includes APA 7 renderer output |
| 12 | completed | YES |

---

## Gate 4: Non-negotiable product rules enforced

| Rule | Enforcement | Status |
|---|---|---|
| Evidence before fluency | Verdicts from `scoreEvidence()` only | PASS |
| No claim verified by LLM alone | LLM output is input to scoring, not output | PASS |
| No DOI/source invented | DOI validation rejects non-existent identifiers | PASS |
| No verdict without passage linked | Stage 8 stores passage_text per match | PASS |
| APA 7 is output formatting only | `renderApa7References()` eligibility guards | PASS |
| Retrieved content is untrusted | System prompts mark UNTRUSTED DATA | PASS |
| High-stakes uncertainty → REQUIRES_QUALIFIED_REVIEW | Policy override in scoring engine | PASS |
| Every verdict traceable | Audit events, claim IDs, source IDs, match IDs stored | PASS |

---

## Gate 5: Security baseline

| Item | Status |
|---|---|
| SSRF protection | PASS — 29 tests, 2 bugs fixed this session |
| Cron route fails closed when CRON_SECRET absent | PASS — fixed in Phase 4 |
| Cron secret comparison is constant-time | PASS — `crypto.timingSafeEqual` |
| All LLM outputs Zod-validated | PASS |
| No raw SQL | PASS |
| No `dangerouslySetInnerHTML` | PASS |
| RLS on all 14 tables | PASS — verified via migration SQL |
| No secrets in NEXT_PUBLIC_ vars | PASS |

---

## Gate 6: File upload pipeline

| Item | Status |
|---|---|
| Upload endpoint (`/api/cases/upload`) | PASS — implemented Phase 2 |
| MIME type validation (PDF, DOCX, TXT, MD) | PASS |
| File size validation (15 MB default) | PASS |
| Content stored in Supabase Storage | PASS — path: `orgs/{orgId}/cases/{caseId}/{filename}` |
| Worker Stage 2 downloads and parses file | PASS — implemented Phase 2 |
| Scanned PDF (no extractable text) → fails cleanly | PASS — returns clear error |

---

## Gate 7: Job retry and idempotency

| Item | Status |
|---|---|
| Attempt count incremented per claim | PASS — Phase 4 |
| Exponential backoff on failure | PASS — 30s, 60s, 120s, capped at 300s |
| Terminal failure after max_attempts | PASS — default 3, configurable per job |
| Job claim is atomic (optimistic lock) | PASS — `.eq("status", "queued")` condition |
| Re-queued job does not block terminal states | PASS — case stays in "queued" until attempts exhausted |

---

## Gate 8: APA 7 renderer

| Item | Status |
|---|---|
| Renderer implemented | PASS — `src/lib/reports/apa7-renderer.ts` |
| Verified-only sources rendered | PASS — `identity_status === "verified"` or `"metadata_only"` |
| Retracted sources blocked | PASS — `retraction_status === "retracted"` excludes source |
| Metadata-mismatch blocked | PASS — `doi_status === "metadata_mismatch"` excludes source |
| Unlinked sources blocked | PASS — source must appear in `evidence_matches` |
| Upload-type sources blocked | PASS — no public identifier |
| No fields invented | PASS — omits with limitation record |
| renderer_version stored | PASS |
| APA references populated in report | PASS — `apa_references` field in `verification_reports` |

---

## Remaining Work (Not Blocking MVP)

| Item | Severity | Notes |
|---|---|---|
| Playwright E2E tests require real Supabase credentials | Medium | Test infrastructure in place; tests skip gracefully without credentials |
| APA 7 author format (last-word-is-family heuristic) | Low | Works for Western names; documented limitation for compound family names |
| Malware scanning for uploads | Low | MIME + size validation in place |
| Persistent rate limiter (Redis) | Medium | In-memory; resets on cold start |
| DOI full-text resolution | Low | Metadata-only for DOIs; passages from URL sources only |

---

## External Actions Required Before Launch (Founder)

1. Create Supabase project, apply migrations `001` and `002`, enable Auth with email/password
2. Set environment variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`, `CRON_SECRET`
3. Create `case-uploads` storage bucket in Supabase (required for file upload pipeline)
4. Deploy to Vercel; verify cron job registered at `/api/cron/process-jobs`
5. Verify `/api/health` returns `{"ok": true, "version": "0.1.0"}`
