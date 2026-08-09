# Launch Checklist

Items checked by automated build are marked with their verification method.  
Items requiring human action link to `founder-actions-required.md`.

---

## Code Quality

- [x] `npm run build` — passes with zero TypeScript errors (15 routes)
- [x] `npm run test` — 111 tests pass (7 unit files, 3 integration files)
- [x] `npm run typecheck` — no type errors
- [x] All pipeline stages 1–12 implemented (see `docs/independent-code-audit.md`)
- [x] No hardcoded secrets in source
- [x] No `any` types in core paths
- [x] No TODO placeholders in shipped code paths

## Security

- [x] SSRF protection blocks all private IP ranges, protocols, and non-standard ports
- [x] LLM outputs Zod-validated before any DB write or UI render
- [x] Prompt injection defense in all LLM system prompts
- [x] No raw SQL in any source file
- [x] No `dangerouslySetInnerHTML` in any component
- [x] CSP headers applied
- [x] Rate limiting in place (see caveat in `security-verification-report.md` §8)
- [ ] **FOUNDER:** Verify RLS enabled on all 14 tables in Supabase dashboard

## Database

- [ ] **FOUNDER:** Run migration `001_initial_schema.sql`
- [ ] **FOUNDER:** Run migration `002_extend_evidence_relationship.sql`
- [ ] **FOUNDER:** Confirm all 14 tables visible in Supabase Table Editor
- [ ] **FOUNDER:** Enable Supabase Auth with Email/Password provider

## Environment Variables

- [ ] **FOUNDER:** Set all 6 required env vars in Vercel (see `founder-actions-required.md` §1)
- [ ] **FOUNDER:** Create `.env.local` for local development

## Deployment

- [ ] **FOUNDER:** Deploy to Vercel (`npx vercel --prod` from `evidence-platform/`)
- [ ] **FOUNDER:** Verify Vercel cron appears at `/api/cron/process-jobs` (every minute)
- [ ] **FOUNDER:** Test `/api/health` returns `{"ok": true, "version": "0.1.0"}`
- [ ] **FOUNDER:** Test login flow at `/login`
- [ ] **FOUNDER:** Test case submission at `/cases/new`
- [ ] **FOUNDER:** Test commitment creation at `/commitments/new`
- [ ] **FOUNDER:** Test commitment evaluation at `/commitments/{id}` (paste evidence text, verify verdict renders)

## Known Limitations (Acceptable for MVP)

- Rate limiter state resets on cold start (in-memory)
- No malware scanning for file uploads
- APA 7 references array is always empty (formatting not yet implemented)
- Playwright E2E tests not yet written (test infrastructure is in place)
- `file_upload` input type accepted by API but not handled in pipeline worker

## Post-MVP Backlog

- Upgrade rate limiter to Redis/Upstash
- Implement APA 7 reference renderer
- Add file upload malware scanning
- Add Playwright E2E tests
- Add DOI → full-text resolution (open access only)
