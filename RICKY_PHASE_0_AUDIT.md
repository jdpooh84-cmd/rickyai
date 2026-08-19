# RICKY_PHASE_0_AUDIT.md

**Created:** 2026-08-19  
**Branch:** `claude/rickyai-byo-creatomate-api-c9c4ka`  
**Policy:** Do not enable risky growth automation while BLOCKER or CRITICAL issues remain unresolved.

Findings are ranked: `BLOCKER` → `CRITICAL` → `HIGH` → `MODERATE` → `LOW`

---

## BLOCKER

### B-01 — BYO API keys stored as plaintext despite encrypted column name

**File:** `supabase/migrations/` (column definition), all reads/writes to `user_api_keys`  
**Impact:** Any Supabase service-role data breach exposes every user's Creatomate, Klap, Gemini, HeyGen, ElevenLabs, and Make.com keys in full. Column is named `api_key_encrypted` but no encryption/decryption call was found anywhere in source.  
**Do not build personalized GTM or multi-step automation that depends on key storage until this is resolved.**

**Required fix:**
1. Stop naming the column `encrypted` until it is actually encrypted.
2. Implement server-side envelope encryption using a KMS-backed secret (e.g., Supabase Vault or an external KMS). Store ciphertext + key version metadata, not plaintext.
3. Keys must never be returned to browser code. All decryption must happen in Edge Functions with service-role access only.
4. Plan a migration path for existing plaintext records (re-enrollment prompt or background re-encryption with audit trail).
5. Update RLS so browser clients cannot read the column; only trusted server paths can decrypt and use the key material.
6. Add integration tests verifying that a browser-scoped Supabase client cannot read `api_key_encrypted`.

---

### B-02 — No webhook signature verification on public endpoints

**Files:** `supabase/functions/video-callback/`, `supabase/functions/clip-callback/`  
**Config:** Both have `verify_jwt = false` in `supabase/config.toml`  
**Impact:** Any party on the internet can POST to these endpoints and forge a "completed" video or clip job — injecting arbitrary `video_url` or `clip_urls` values into the database. This is a trust boundary violation with direct user-facing consequences.  
**Do not expose new unauthenticated webhook endpoints until this pattern is corrected.**

**Required fix:**
1. `video-callback` (Creatomate): Verify the `X-Creatomate-Signature` HMAC header using the Creatomate signing secret. Reject missing or invalid signatures with 401. Verify timestamp to reject stale replays.
2. `clip-callback` (Klap): Implement equivalent signature verification using Klap's documented webhook signing scheme. If Klap does not support HMAC signatures, use a pre-shared token secret embedded in the callback URL (registered as a per-user webhook URL containing a signed opaque token) rather than an unauthenticated POST body.
3. For both: persist event receipts with idempotency keys; duplicate callbacks must be safe no-ops.
4. Reject payloads with unexpected schema, missing required fields, or job IDs that don't match the authenticated user's records.
5. Add webhook replay, duplicate, malformed, stale, and forgery test cases.

---

## CRITICAL

### C-01 — Race condition in webhook-proxy usage increment

**File:** `supabase/functions/webhook-proxy/index.ts`  
**Pattern:** `SELECT render_jobs_used → compute new value → UPDATE render_jobs_used`  
**Impact:** Under concurrent callbacks, the same usage slot can be double-counted or under-counted. Quota limits become unreliable and billable usage counters are inaccurate.

**Required fix:**
```sql
UPDATE subscriptions
SET render_jobs_used = render_jobs_used + 1
WHERE id = $1
RETURNING render_jobs_used;
```
Or use a dedicated usage ledger table with immutable append-only events and a materialized balance. Enforce the quota check transactionally *before* dispatching to the provider.

---

### C-02 — `const` reassignment bug in rewrite-script

**File:** `supabase/functions/rewrite-script/index.ts`  
**Pattern:** `const providerUsed = ...` declared in try block, reassigned in catch block  
**Impact:** Runtime TypeError in strict mode (Deno is strict). The catch path is unreachable or throws an unexpected error, masking the original failure and returning an incorrect error response to the user.

**Required fix:**
1. Change `const providerUsed` to `let providerUsed`.
2. Add a test that exercises the failure path to confirm error handling behavior.
3. Verify the fallback/error response shape matches what the frontend expects.

---

### C-03 — `supabase/config.toml` references stale project ref

**File:** `supabase/config.toml` line 1: `project_id = "symbyrtzimafpxbzurjh"`  
**Live project:** `psmxeckstfeyxlqzzkgw`  
**Impact:** Any developer running `supabase` CLI commands without `--project-ref` override will target the wrong project. Migrations, function deploys, and secrets management could silently succeed against the wrong project.

**Required fix:** Update `config.toml` to `project_id = "psmxeckstfeyxlqzzkgw"`. Confirm no live data exists under the old ref before making any changes there.

---

### C-04 — Admin functions have no observed role/permission check

**Files:** `supabase/functions/admin-stats/`, `supabase/functions/admin-users/`  
**Status:** UNKNOWN — these functions were identified in the repo but their authorization logic was not inspected.  
**Risk:** If admin functions check only that a JWT is present (not that the caller is a platform admin), any authenticated user could access aggregate platform data or user management endpoints.

**Required action:** Inspect both functions immediately. Verify they check an explicit admin role/claim (not just a valid JWT). Add a test that confirms a regular subscriber cannot call them.

---

## HIGH

### H-01 — Social platform "Connect" is entirely misleading UI

**Files:** `src/components/dashboard/steps/ConnectStep.tsx` (or equivalent), `src/components/dashboard/steps/ExternalAppConnections.tsx`  
**Impact:** Users see 11 platform icons (TikTok, Instagram, YouTube, etc.) with "Connect" affordance. There is no OAuth flow, no token storage, no posting pipeline. This creates an expectation that RickyAI will post on their behalf when it cannot.  
**Risk:** User trust erosion, support burden, potential chargeback risk if users believe the feature was sold.

**Required action:** Audit all social platform UI. Either:
- Clearly label as "Open [Platform]" with an external link icon and no "Connect" language, or
- Implement at minimum one real OAuth posting integration behind a feature flag

---

### H-02 — No RLS or authorization test suite

**Scope:** All 13+ tenant-bound tables, all storage paths, all edge functions  
**Impact:** RLS policies were added in a single migration (20260609). Without explicit cross-user and cross-tenant tests, policy gaps are undetectable until exploitation.

**Required action:** Write and run explicit RLS tests:
- User A cannot read User B's `businesses`, `user_api_keys`, `video_generation_jobs`, `clip_generation_jobs`
- User A cannot update User B's subscription or profile
- Service-role access paths in edge functions are not exposed to browser clients
- Storage bucket policies prevent cross-user object access

---

### H-03 — No CI pipeline observed

**Impact:** No automated build, test, lint, or typecheck runs on push/PR. Regressions are caught only locally or in production.

**Required action:** Add a GitHub Actions workflow that runs `npm run build`, `npm run lint`, and `npm run test` on every push to the feature branch and on PRs to main.

---

### H-04 — Dead edge functions deployed to production

**Functions:** `generate-video`, `create-template`, `debug-template`  
**Risk:** `generate-video` uses `esm.sh` imports (EarlyDrop on cold start) and references Manus AI. If called by any path (URL guess, old bookmark, webhook replay), it will fail unpredictably. `create-template` and `debug-template` have hardcoded identifiers that should not be production-callable.

**Required action:** Confirm these are not referenced by any webhook or external system, then undeploy from the live project. Keep source in repo under `legacy/` with a clear DO-NOT-DEPLOY comment.

---

### H-05 — No error tracking or structured observability

**Impact:** Production failures in edge functions and the React frontend are invisible unless users report them. No correlation between user actions and backend errors.

**Required action:** Add error tracking (e.g., Sentry or equivalent) to both the Vite frontend and edge functions. Add structured log format with correlation IDs to edge functions.

---

## MODERATE

### M-01 — ElevenLabs voice hardcoded, no language/voice selection

**File:** `supabase/functions/generate-video-v2/index.ts`  
**Voice:** `voice_id=21m00Tcm4TlvDq8ikWAM` (Rachel, English US)  
**Impact:** Non-English business owners or those who need a different voice have no option. Changing voice requires a code deploy.

**Required action:** Add voice selection to the VideoStudio UI. Expose voice_id as a user-configurable setting, potentially scoped to their ElevenLabs BYO key.

---

### M-02 — Ricky chat 25-question lifetime limit is not disclosed upfront

**File:** `supabase/functions/ricky-chat/index.ts`  
**Impact:** Users discover the limit only when they hit it, which feels punitive and opaque.

**Required action:** Display remaining question count in the chat UI. Show a clear notice before the first question and when approaching the limit.

---

### M-03 — Gemini BYO key saved but never used in pipeline

**File:** `src/components/dashboard/steps/ExternalAppConnections.tsx`  
**Impact:** Users are prompted to connect Gemini and save their key, but no active edge function reads it. This creates false expectations.

**Required action:** Either integrate Gemini into at least one AI research path (Step 4 Scout, Step 5 Audit, Step 12 GrantSearch are candidates), or remove Gemini from the "Connect Your Tools" UI until it has a real integration.

---

### M-04 — Client-side video composer exists but call path is unclear

**File:** `src/lib/videoComposer.ts`  
**Impact:** Canvas + MediaRecorder based composer (Ken Burns zoom, crossfade, captions, voiceover) exists but its invocation from the active UI could not be confirmed. This is either unused dead code or an undocumented offline rendering path.

**Required action:** Confirm whether `videoComposer.ts` is called from `VideoStudioStep` or any other component. If unused, mark as dead code. If used, document the call path.

---

### M-05 — PWA manifest/service worker installed but not documented

**File:** `package.json` → `vite-plugin-pwa`  
**Impact:** PWA capability exists but no PWA-specific UX (install prompt, offline mode, push notifications) was observed. The service worker may cache stale versions.

**Required action:** Document whether PWA is intentional. If yes, audit cache strategy and offline behavior. If no, consider removing to reduce complexity.

---

## LOW

### L-01 — `supabase/config.toml` missing JWT settings for most functions

**Impact:** Functions not listed in `config.toml` default to `verify_jwt = true`, which is correct behavior. But adding new public webhook endpoints without explicitly listing them is easy to forget.

**Required action:** Add a comment block to `config.toml` documenting the policy and listing which functions intentionally have `verify_jwt = false` with a justification for each.

---

### L-02 — No `.env.example` observed

**Impact:** New contributors/environments have no reference for required environment variables (`ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, Supabase keys, Stripe keys, Creatomate platform key, etc.).

**Required action:** Add `.env.example` (no values, just key names with descriptions) to the repository.

---

### L-03 — Test file at `src/test/example.test.ts` may be a scaffold

**Impact:** If the only test file is the vitest scaffold, the test suite gives false confidence.

**Required action:** Audit `src/test/` and verify real business logic test coverage. Run `npm run test` and review output.

---

## RESOLUTION TRACKING

| ID | Status | Owner | Target |
|---|---|---|---|
| B-01 | 🔴 Open | — | Before GTM phase |
| B-02 | 🔴 Open | — | Before any new webhook |
| C-01 | ✅ Resolved | Claude | 2026-08-19: migration 20260819000000_atomic_render_usage.sql + webhook-proxy wired to check_and_increment_render_usage RPC |
| C-02 | ✅ Resolved | Claude | 2026-08-19: `const providerUsed` → `let providerUsed` in rewrite-script/index.ts |
| C-03 | ✅ Resolved | Claude | 2026-08-19: supabase/config.toml project_id updated to psmxeckstfeyxlqzzkgw |
| C-04 | 🔴 Open | — | Inspect immediately |
| H-01 | 🔴 Open | — | Sprint 2 |
| H-02 | 🔴 Open | — | Sprint 1 |
| H-03 | 🔴 Open | — | Sprint 1 |
| H-04 | 🔴 Open | — | Sprint 1 |
| H-05 | 🔴 Open | — | Sprint 2 |
| M-01 | 🟡 Open | — | Sprint 3 |
| M-02 | 🟡 Open | — | Sprint 2 |
| M-03 | 🟡 Open | — | Sprint 2 |
| M-04 | 🟡 Open | — | Sprint 1 (verify) |
| M-05 | 🟡 Open | — | Sprint 2 |
| L-01 | 🟢 Open | — | As discovered |
| L-02 | 🟢 Open | — | As discovered |
| L-03 | 🟢 Open | — | Sprint 1 |

_Update status as issues are resolved. Mark 🟡 In Progress, ✅ Resolved._
