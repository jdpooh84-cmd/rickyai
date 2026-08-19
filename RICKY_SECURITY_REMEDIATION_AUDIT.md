# RICKY SECURITY REMEDIATION AUDIT

**Scope:** Phase 0 — All BLOCKER and CRITICAL findings from RICKY_PHASE_0_AUDIT.md  
**Period:** 2026-08-19  
**Branch:** `claude/rickyai-byo-creatomate-api-c9c4ka`  
**Commit:** b77600c (plus prior commits for C-01/C-02/C-03)

---

## Summary

All 6 Phase 0 findings (2 BLOCKER, 4 CRITICAL) have been resolved in code. Two findings (B-01, B-02) require operator actions (secret generation + deployment) before the controls are active in production. The code is production-ready; the operator steps are documented in `RICKY_SECURITY_IMPLEMENTATION_PROGRESS.md`.

---

## B-01: BYO API Keys Were Stored as Plaintext

**Root cause:** The column `api_key_encrypted` was named as if encrypted but no encryption/decryption code existed anywhere. Browser clients wrote raw key material directly to the database with full RLS read access to their own rows.

**Attack surface before fix:**
- Supabase service-role data breach → all user API keys exposed
- Any XSS in the dashboard could exfiltrate keys via the Supabase anon client
- Log aggregation of Supabase REST query responses could leak column values

**Fix implemented:**
1. `supabase/functions/_shared/credential-service.ts` — AES-256-GCM encrypt/decrypt using Deno Web Crypto. Key derived from `USER_API_KEY_ENCRYPTION_SECRET` (64-hex = 32 bytes). 12-byte random IV per encryption. GCM authenticated tag prevents ciphertext tampering. Key not extractable.
2. `supabase/functions/save-api-key/index.ts` — only permitted write path for BYO keys. Requires valid user JWT. Encrypts on server. Returns `{ success, provider, masked }`. Never returns key material.
3. `supabase/migrations/20260819000001_api_key_encryption.sql` — adds `key_iv`, `key_version`, `api_key_masked` columns. Adds `REVOKE SELECT(api_key_encrypted, key_iv)` and `REVOKE INSERT/UPDATE(api_key_encrypted, key_iv, key_version)` from `authenticated` and `anon` roles.
4. `supabase/functions/generate-video-v2/index.ts` — updated to read `key_iv` and `key_version`; decrypts v1 keys via credential-service; falls through to plaintext for legacy v0 rows.
5. `supabase/functions/clip-video/index.ts` — same decryption pattern for Klap key.
6. `src/components/dashboard/steps/ExternalAppConnections.tsx` — browser write replaced with `fetch()` POST to `save-api-key`.
7. `src/components/dashboard/ConnectStep.tsx` — same.

**Residual risk:** Existing rows remain plaintext (tagged `v0-plaintext`). Edge functions handle both transparently. Re-enrollment or background re-encryption required to eliminate all plaintext at rest. Operator must set `USER_API_KEY_ENCRYPTION_SECRET` before any new keys are accepted.

---

## B-02: No Webhook Signature Verification

**Root cause:** `video-callback` and `clip-callback` had `verify_jwt = false` and no other authentication. Any HTTP client could POST forged "completed" payloads with arbitrary `video_url` values, injecting attacker-controlled URLs into user video libraries.

**Attack surface before fix:**
- Forge any user's video job as completed with malicious URL (phishing, tracking, NSFW)
- Replay legitimate callbacks to re-trigger downstream operations
- Enumerate job IDs (UUIDs — low risk but worth noting)

**Fix implemented:**
1. Both callbacks now check a URL query parameter `?secret=<token>` against the corresponding env var (`CREATOMATE_WEBHOOK_SECRET` / `KLAP_WEBHOOK_SECRET`) using constant-time string comparison. Mismatched or absent tokens return 401.
2. `generate-video-v2` appends `?secret=<CREATOMATE_WEBHOOK_SECRET>` to the webhook URL included in the Creatomate render payload, so only callbacks from Creatomate (which received the URL from us) can present the correct token.
3. `supabase/migrations/20260819000002_webhook_receipts.sql` creates `webhook_receipts` with `UNIQUE(provider, event_fingerprint)`. Duplicate inserts return `23505` and are treated as no-ops, preventing replay attacks from re-triggering downstream effects.

**Residual risk:** Fail-open if env vars not set (logs a warning). Operator must set both secrets and update provider webhook URL configuration.

---

## C-01: Race Condition in Usage Increment

**Root cause:** Non-atomic read-then-write: `SELECT render_jobs_used → compute → UPDATE`. Under concurrent requests, two callers could both read the same count, both compute `count + 1`, and both write the same final value — effectively missing one increment or allowing over-limit requests.

**Fix implemented:** `supabase/migrations/20260819000000_atomic_render_usage.sql` creates `check_and_increment_render_usage()` — a PLPGSQL function that:
1. `SELECT ... FOR UPDATE` — pessimistic row lock
2. Checks quota; returns `(false, current)` if exceeded
3. Atomic `INSERT ... ON CONFLICT DO UPDATE SET render_jobs_used = render_jobs_used + 1`

`webhook-proxy/index.ts` now calls this RPC and checks the `allowed` field before dispatching to Make.com.

---

## C-02: const Reassignment Bug in rewrite-script

**Root cause:** `const providerUsed = "anthropic"` declared in the try block, then `providerUsed = "template_fallback"` in the catch block. In Deno (strict mode), reassigning a `const` throws `TypeError`, making the catch path throw an unexpected error that masked the original AI failure.

**Fix implemented:** Changed `const providerUsed` → `let providerUsed` at declaration site.

---

## C-03: Stale Project Ref in config.toml

**Root cause:** `project_id = "symbyrtzimafpxbzurjh"` was a stale value. Any `supabase` CLI command without explicit `--project-ref` would target the wrong project.

**Fix implemented:** Updated to `project_id = "psmxeckstfeyxlqzzkgw"`.

---

## C-04: Admin Functions

**Root cause (partial):** Admin functions used deprecated `https://deno.land/std@0.190.0/http/server.ts` import (performance/compatibility concern). Admin activity log table existed but received no writes, so administrative actions were unaudited.

**Fix implemented:**
1. Both `admin-stats` and `admin-users` now use `Deno.serve()` (modern Supabase Edge Runtime pattern; eliminates std-lib dependency).
2. `admin-users` writes to `admin_activity_log` for: `grant_role`, `revoke_role`, `update_payout`, `create_advertiser`, `update_advertiser_status`.
3. `admin-stats` writes to `admin_activity_log` on every invocation.

**Verification:** Admin role check (C-04 CRITICAL concern) was already correct — `user_roles` table query via service_role client before any data access. No self-assignment path exists. Finding status changed from UNKNOWN to VERIFIED.
