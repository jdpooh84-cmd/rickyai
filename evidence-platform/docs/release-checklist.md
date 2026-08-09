# Release Checklist

## Pre-Release

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run format:check` passes
- [ ] `npm run test` all unit and integration tests pass
- [ ] `npm run build` succeeds with no type errors
- [ ] All 5 benchmark release gates pass at 100%
- [ ] RLS isolation tests pass (SQL tests in `supabase/tests/`)
- [ ] Migration history is clean from a fresh database (`supabase db reset`)
- [ ] `.env.example` is up to date with all required variables
- [ ] No hardcoded secrets, tokens, or API keys in source
- [ ] No `console.log` of sensitive data in production paths
- [ ] All edge cases in `docs/assumptions.md` are documented
- [ ] `docs/final-verification-report.md` is complete and truthful

## Security Checks

- [ ] Service role key is not accessible in any client component
- [ ] All API routes have Zod input validation
- [ ] All LLM outputs are Zod-validated before use
- [ ] URL fetcher SSRF tests pass
- [ ] Upload MIME validation tested with disguised file types
- [ ] Rate limiter tested with burst requests
- [ ] CSP headers verified in browser devtools
- [ ] Audit events created for case creation, access, and model runs

## Database

- [ ] All RLS policies exist and are tested
- [ ] `updated_at` triggers fire correctly
- [ ] Indexes exist on high-cardinality foreign keys and status columns
- [ ] No raw SQL string concatenation in application code

## Product Rules Verification

- [ ] APA references are only generated for verified metadata sources
- [ ] No claim marked VERIFIED_ENOUGH_TO_ACT solely on LLM agreement
- [ ] High-stakes claims route to REQUIRES_QUALIFIED_REVIEW when unresolved
- [ ] Prosecutor review is logged separately from final report
- [ ] Numeric score is internal — only verdict and explanation shown to user
- [ ] Commitment accountability does not infer motive, intent, or legal liability

## Deployment

- [ ] Supabase migrations pushed to production project
- [ ] Vercel environment variables set (URL, anon key, service key, AI key)
- [ ] Private storage bucket created
- [ ] Health endpoint returns 200 in production
- [ ] E2E smoke test runs against production URL

## Known Deferred Scope (not blockers)

- Finance, health, law, government, media provenance, identity/scam domain packs
- Redis-backed rate limiting (currently in-memory)
- PDF export for reports
- Multi-provider adversarial review (currently single-provider, labeled as such)
- Global admin role (currently organization-scoped admin only)
