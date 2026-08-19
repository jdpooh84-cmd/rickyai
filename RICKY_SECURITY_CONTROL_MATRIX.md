# RICKY SECURITY CONTROL MATRIX

**Updated:** 2026-08-19

---

## Credential Storage

| Control | Implementation | Status |
|---|---|---|
| Keys encrypted at rest | AES-256-GCM, 12-byte IV, 256-bit key from `USER_API_KEY_ENCRYPTION_SECRET` | ✅ Implemented |
| Encryption runs server-side | `supabase/functions/_shared/credential-service.ts` in `save-api-key` edge fn | ✅ Implemented |
| Browser cannot write plaintext | Column-level REVOKE on `api_key_encrypted`, `key_iv` from `authenticated`/`anon` | ✅ Implemented |
| Browser cannot read ciphertext | Column-level REVOKE on `api_key_encrypted`, `key_iv` from `authenticated`/`anon` | ✅ Implemented |
| Decryption only in edge functions | `service_role` bypasses RLS; no decrypt function exposed to browser | ✅ Implemented |
| Legacy plaintext rows tagged | `key_version = 'v0-plaintext'` for pre-migration rows | ✅ Implemented |
| Keys never returned in responses | `save-api-key` returns `{ success, provider, masked }` only | ✅ Implemented |
| KMS / Vault | Not yet — single shared secret; upgrade to Supabase Vault when available | ⚠️ Future |

---

## Webhook Authentication

| Control | Implementation | Status |
|---|---|---|
| Creatomate callback authenticated | `CREATOMATE_WEBHOOK_SECRET` URL token; constant-time compare | ✅ Implemented |
| Klap callback authenticated | `KLAP_WEBHOOK_SECRET` URL token; constant-time compare | ✅ Implemented |
| Token appended by edge function | `generate-video-v2` appends `?secret=<token>` to webhook URL at dispatch time | ✅ Implemented |
| Replay / duplicate protection | `webhook_receipts` table; `(provider, event_fingerprint)` unique constraint | ✅ Implemented |
| Fail-open during secret rollout | Secret check skipped with warning log if env var not yet set | ⚠️ Operator must set secrets |
| HMAC-based verification | Not implemented — Creatomate/Klap do not support HMAC signatures per API docs | N/A |

---

## Authorization

| Control | Implementation | Status |
|---|---|---|
| Admin role check in admin-stats | `user_roles` table via `service_role`; maybeSingle check | ✅ Implemented |
| Admin role check in admin-users | Same | ✅ Implemented |
| No self-assign admin | INSERT policy missing on `user_roles` for non-admins = default deny | ✅ Verified |
| Admin action audit log | `admin_activity_log` written for role grants/revokes, payout updates, advertiser actions | ✅ Implemented |
| Tenant isolation (RLS) | RLS policies on all tenant tables added 2026-06-09 migration | ✅ Implemented |
| Cross-user RLS test suite | Not yet written | 🔴 Missing |

---

## Usage Accounting

| Control | Implementation | Status |
|---|---|---|
| Atomic quota check | `check_and_increment_render_usage()` with `FOR UPDATE` row lock | ✅ Implemented |
| Quota enforced before dispatch | Webhook proxy checks quota atomically before calling Make.com | ✅ Implemented |
| Double-spend prevention | Row-level lock prevents concurrent over-increment | ✅ Implemented |

---

## Frontend Security

| Control | Implementation | Status |
|---|---|---|
| No plaintext keys in browser state | Browser only sees `provider`, `is_valid`, `api_key_masked` | ✅ Implemented |
| Key write path | POST to `save-api-key` edge fn with JWT; response has no key data | ✅ Implemented |
| VITE_SUPABASE_URL required in env | Frontend uses `import.meta.env.VITE_SUPABASE_URL` for function URL | ✅ Implementation correct |

---

## Gaps Remaining

| Gap | Risk | Priority |
|---|---|---|
| No cross-user RLS tests | H-02 — cannot verify isolation without tests | HIGH |
| No CI pipeline | H-03 — regressions undetected | HIGH |
| Misleading social "Connect" UI | H-01 — user trust/expectation mismatch | HIGH |
| Dead functions in production | H-04 — attack surface | HIGH |
| No error tracking | H-05 — blind to production failures | HIGH |
| Single shared encryption key | B-01 partial — Supabase Vault or KMS would be stronger | MODERATE |
| No MFA for admin actions | P1 item — admin role change without step-up auth | MODERATE |
