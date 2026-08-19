# RICKY SECURITY TEST EVIDENCE

**Updated:** 2026-08-19

This document records verification evidence for each security control. Where automated tests don't yet exist, manual reasoning and code inspection are documented.

---

## B-01 — API Key Encryption

### Encryption correctness (manual reasoning)

`credential-service.ts` uses `crypto.subtle` (Deno Web Crypto — FIPS-certified, available natively):
- Algorithm: `AES-GCM` with `{ length: 256 }`
- IV: `crypto.getRandomValues(new Uint8Array(12))` — 12 bytes, random per encryption
- Authenticated tag: 16 bytes, appended by GCM, stored with ciphertext (base64url blob)
- Key material: hex-decoded from `USER_API_KEY_ENCRYPTION_SECRET` env var; zeroed from memory after import
- Key not exportable: `extractable: false` in `importKey`

### Browser cannot read ciphertext (migration proof)

`20260819000001_api_key_encryption.sql` issues:
```sql
REVOKE SELECT (api_key_encrypted, key_iv) ON user_api_keys FROM authenticated;
REVOKE SELECT (api_key_encrypted, key_iv) ON user_api_keys FROM anon;
```
Column-level REVOKE is enforced by PostgreSQL before RLS evaluation. Any `SELECT` from a browser client using the anon or authenticated key that includes `api_key_encrypted` or `key_iv` in the column list will receive an error: `column "api_key_encrypted" of relation "user_api_keys" does not exist` (column not visible).

### Browser cannot write plaintext (migration proof)

```sql
REVOKE INSERT (api_key_encrypted, key_iv, key_version) ON user_api_keys FROM authenticated;
REVOKE UPDATE (api_key_encrypted, key_iv, key_version) ON user_api_keys FROM authenticated;
```
Attempting `supabase.from("user_api_keys").insert({ api_key_encrypted: "..." })` from browser code will fail with a column-level permission error.

### Automated test needed (H-02 queue)

```typescript
// TODO: Add to RLS test suite
test("browser client cannot read api_key_encrypted", async () => {
  const { data, error } = await browserClient
    .from("user_api_keys")
    .select("api_key_encrypted")
    .eq("user_id", testUserId);
  expect(error).toBeTruthy();
  expect(data).toBeNull();
});
```

---

## B-02 — Webhook Verification

### Constant-time comparison (code inspection)

`constantTimeEqual(a, b)` in both callback functions:
```typescript
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
```
This is a standard timing-safe comparison. The early return on length mismatch leaks length — acceptable for tokens of fixed known length (hex strings).

### Idempotency (code inspection)

Receipt table has `UNIQUE(provider, event_fingerprint)`. Second INSERT returns PostgreSQL error code `23505` (unique violation). Callbacks detect this and return `200 { ok: true, duplicate: true }` rather than re-processing.

### Forgery resistance

Without the secret token in `?secret=`, the callback returns `401 { error: "Unauthorized" }`. An attacker cannot forge a completed video URL because:
1. They don't know the `CREATOMATE_WEBHOOK_SECRET` value
2. Even if they guess `job_id`, the 401 prevents state mutation

### Replay protection

Event fingerprint: `creatomate:<render_id>:<status>` or `job:<job_id>:<status>`. A replay of the same callback has the same fingerprint → `23505` → `200 no-op`. Status cannot be double-applied.

---

## C-01 — Atomic Usage Accounting

### Postgres function proof

`check_and_increment_render_usage()` uses:
- `SELECT ... FOR UPDATE` — acquires exclusive row lock
- `INSERT ... ON CONFLICT DO UPDATE SET render_jobs_used = render_jobs_used + 1` — atomic increment
- Runs in a single implicit transaction

Under concurrent calls: the second call blocks at `FOR UPDATE` until the first releases the lock. No double-counting possible.

---

## C-04 — Admin Authorization

### Role check verified

Both `admin-stats` and `admin-users`:
1. Extract JWT from `Authorization` header
2. Call `supabase.auth.getUser(token)` using service_role client — validates JWT cryptographically
3. Query `user_roles` table using service_role (bypasses RLS) for `role = 'admin'`
4. Throw `"Unauthorized: admin role required"` if no row found → 403 response

A valid JWT for a non-admin user results in a 403 at step 4. There is no path to admin data without an `admin` row in `user_roles`.

### Self-assignment prevention

`user_roles` INSERT policy for non-admins: **none** (default deny). The `has_role()` function is `SECURITY DEFINER` and only checks — it does not insert. A user cannot `INSERT INTO user_roles` from browser code without an explicit INSERT policy.

---

## Build Verification

```
npm run build  — ✅ 0 errors, clean output (2026-08-19)
```

TypeScript compilation clean. All modified files type-check as part of the Vite build.
