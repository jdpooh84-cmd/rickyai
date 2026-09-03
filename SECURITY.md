# Security — Ricky AI

## Non-Negotiable Rules

1. **Service-role key never in the browser.** Only anon key in `VITE_SUPABASE_ANON_KEY`. Service role is server-side only.
2. **RLS always enabled.** Never bypass Row-Level Security. Every tenant table must have a policy tracing back to `auth.uid()`.
3. **No secrets in source code.** All secrets in Supabase Function Secrets or Vercel environment variables.
4. **No secrets in logs.** Redact API keys, tokens, card numbers, and authorization headers from all log output.
5. **Idempotent webhooks.** Every webhook handler checks `webhook_receipts` before processing.
6. **Constant-time secret comparison.** Webhook secret validation uses `constantTimeEqual()` — never `===`.
7. **Input validation at every boundary.** Browser requests, webhook payloads, and tool parameters are validated server-side. TypeScript types are compile-time only.
8. **No client-side authorization.** Hidden buttons are not security. Entitlement checks happen in edge functions.

---

## Secrets Inventory

| Secret | Location | Used by |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secrets | All edge functions (auto-injected) |
| `SUPABASE_ANON_KEY` | Supabase Secrets + Vercel | Frontend (public), edge functions |
| `STRIPE_SECRET_KEY` | Supabase Secrets | `create-checkout`, `customer-portal`, `check-subscription` |
| `STRIPE_WEBHOOK_SECRET` | Supabase Secrets | Stripe webhook handler |
| `OPENAI_API_KEY` | Supabase Secrets | AI generation functions |
| `ANTHROPIC_API_KEY` | Supabase Secrets | `ai-strategy` fallback |
| `CREATOMATE_API_KEY` | Supabase Secrets | `generate-video-v2`, `reconcile-renders` (platform default) |
| `CREATOMATE_WEBHOOK_SECRET` | Supabase Secrets | `video-callback` |
| `RECONCILE_SECRET` | Supabase Secrets | `reconcile-renders` (pg_cron auth) |
| `TWILIO_ACCOUNT_SID` | Supabase Secrets | `handle-call`, `send-message` |
| `TWILIO_AUTH_TOKEN` | Supabase Secrets | `handle-call` (signature validation) |
| `TWILIO_PHONE_NUMBER` | Supabase Secrets | `send-message` |
| `USER_API_KEY_ENCRYPTION_SECRET` | Supabase Secrets | `credential-service.ts` (BYO key encryption) |
| `PEXELS_API_KEY` | Supabase Secrets | `generate-video-v2` (stock imagery) |

**Never rotate** a secret without also deploying all edge functions that use it.

---

## BYO API Key Security

User-supplied API keys (Creatomate, etc.) are encrypted with AES-256-GCM before storage in `user_api_keys.api_key_encrypted`. The encryption key is `USER_API_KEY_ENCRYPTION_SECRET` stored as a Supabase secret — it never reaches the browser or appears in `user_api_keys` rows.

**Decryption** only happens server-side in `credential-service.ts` which is imported by edge functions only.

Raw credentials are never returned in API responses, error objects, logs, or browser state.

---

## Webhook Security

Each public webhook endpoint uses a pre-shared secret:

```ts
// Timing-safe comparison — prevents timing-oracle attacks
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  if (aBuf.length !== bBuf.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBuf.length; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}
```

Twilio webhook validation uses HMAC-SHA1 signature verification against the request URL + sorted parameters.

---

## Row-Level Security

All tenant-owned tables have RLS enabled. The standard policy pattern:

```sql
-- Owner can do anything with their own business's data
create policy "owner_{table}" on {table} for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
```

Tables that inherit indirectly (e.g., `customer_memory` → `contacts` → `businesses`):
```sql
create policy "owner_customer_memory" on customer_memory for all using (
  contact_id in (
    select id from contacts where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  )
);
```

---

## Multi-Tenant Isolation

Business A must never access Business B data. Enforcement is:
1. RLS at database level (primary)
2. Server-side ownership check in edge functions (defense-in-depth)

Edge functions verify ownership via service-role client before any sensitive write:
```ts
const { data: biz } = await supabase
  .from("businesses")
  .select("id")
  .eq("id", businessId)
  .eq("user_id", user.id)
  .maybeSingle();
if (!biz) return 403;
```

---

## Input Validation

All edge function inputs are validated using `_shared/validate.ts` helpers. TypeScript types are compile-time only and do not protect against malicious payloads.

Required: UUID format for all ID parameters. Allowed values enforced for enum parameters. String length limits on all text inputs.

---

## Audit Trail

`audit_logs` records important actions including:
- Role changes
- Integration connections/disconnections
- Automation changes
- Offer approvals
- Campaign launches
- Large sends
- Experiment launches
- Growth Genome participation changes

Audit logs are append-only — no UPDATE or DELETE permitted at the application level.

---

## Security Incident Response

See `DISASTER_RECOVERY.md` for credential rotation procedures.

For suspected data breach: immediately contact Supabase support and rotate all service credentials.

---

*Last updated: 2026-09-03*
