# Evidence Assurance Platform — MVP Build Output

**Branch:** `claude/repository-setup-preferences-45mk1t`  
**Date:** 2026-08-09  
**Build result:** READY FOR FOUNDER DEPLOYMENT

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
19 total (15 new, 4 pre-existing) — see `docs/final-verification-report.md` for the full list.

### Tests
111 passing: 53 unit + 58 integration

---

## Files changed in this build session

See `docs/final-verification-report.md` → "What Was Built in This Session" for the complete list with descriptions.

---

## Remaining work before launch

**Founder must do (cannot be automated):**
1. Set 6 environment variables in Vercel
2. Apply 2 database migrations to Supabase
3. Enable Supabase Auth
4. Deploy and verify Vercel cron

See `docs/founder-actions-required.md` for step-by-step instructions.

**Known gaps (not blocking MVP):**
- Playwright E2E tests (infrastructure in place, no test files)
- APA 7 reference rendering
- File upload malware scanning
- Persistent rate limiting (Redis)

---

## Checks run

```
npm run build      ✓  15 routes, 0 TypeScript errors
npm run typecheck  ✓  0 errors
npm run test       ✓  111/111 passed
```
