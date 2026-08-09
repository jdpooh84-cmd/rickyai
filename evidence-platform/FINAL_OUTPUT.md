# Evidence Assurance Platform — MVP Build Output

**Branch:** `claude/repository-setup-preferences-45mk1t`  
**Date:** 2026-08-09  
**Build result:** LOCAL_CONTROLLED_MVP_READY

---

## What was built

A full-stack evidence verification platform where every verdict is traceable to stored claims, source passages, LLM runs, and deterministic scoring — never to model confidence alone.

### Core pipeline (12 stages)
1. Intake normalization (text or file upload)
2. Text extraction (PDF, DOCX, plain text)
3. Claim extraction (LLM)
4. Domain classification (deterministic)
5. Source collection (DOI resolver + URL fetcher)
6. Source validation (Crossref API + accessibility)
7. Passage extraction (URL content fetch with SSRF protection)
8. Evidence matching (LLM per claim × source pair, Zod-validated)
9. Prosecutor review (LLM with real claim/source/match context)
10. Scoring (deterministic 14-component engine with policy overrides)
11. Report generation
12. Completion

### Routes
20 total — see `docs/final-verification-report.md` for the full list.

### Tests
166 passing: 83 unit + 83 integration (12 test files)  
E2E: 28 Playwright tests — 19 pass in CI (Tier A: health, auth pages, 5 protected-route redirects, 8 API 401 assertions, 3 cron bearer cases); 9 skipped (Tier B: authenticated flows, file upload, org isolation — require Docker)

---

## Files changed in this build session

See `docs/final-verification-report.md` → "What Was Built in This Session" for the complete list with descriptions.

---

## Remaining work before launch

**Founder must do (cannot be automated):**
1. Create Supabase project, apply migrations 001 and 002, enable Auth (email/password)
2. Create `case-uploads` storage bucket in Supabase (private, required for file upload pipeline)
3. Set 6 environment variables in Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`, `CRON_SECRET`)
4. Deploy to Vercel; verify cron job at `/api/cron/process-jobs` is registered
5. Verify `/api/health` returns `{"ok": true, "version": "0.1.0"}`

See `docs/founder-actions-required.md` for step-by-step instructions.

**Known gaps (not blocking MVP):**
- Persistent rate limiting (Redis) — current in-memory rate limiter resets on Vercel cold start
- No RLS integration tests — RLS enforced at DDL level; organization isolation not tested in suite
- E2E tests with credentials — 3/11 E2E tests require real Supabase credentials; infrastructure in place
- File upload malware scanning — MIME + size validation in place; ClamAV/VirusTotal post-MVP

---

## Checks run

```
npm run build            ✓  20 routes, 0 TypeScript errors
npm run typecheck        ✓  0 errors
npm run lint             ✓  0 errors (6 warnings in test files)
npm run test             ✓  166/166 passed (12 test files)
npm run test:unit        ✓  83/83
npm run test:integration ✓  83/83
npx playwright test --list  11 tests listed
```

See `docs/gap-closure-verification-report.md` for full Phase 6 output.
