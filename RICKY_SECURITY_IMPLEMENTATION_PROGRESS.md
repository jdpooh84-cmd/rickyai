# RICKY SECURITY IMPLEMENTATION PROGRESS

**Last updated:** 2026-08-19  
**Branch:** `claude/rickyai-byo-creatomate-api-c9c4ka`

---

## Phase 0 — Blockers and Criticals

| ID | Title | Status | Commit | Notes |
|---|---|---|---|---|
| B-01 | BYO API key encryption at rest | ✅ Done | b77600c | AES-256-GCM; save-api-key edge fn; column-level REVOKE |
| B-02 | Webhook signature verification | ✅ Done | b77600c | URL token; constant-time compare; idempotency table |
| C-01 | Race condition in usage accounting | ✅ Done | prior | Atomic Postgres RPC with FOR UPDATE lock |
| C-02 | const reassignment bug in rewrite-script | ✅ Done | prior | const → let |
| C-03 | Stale project ref in config.toml | ✅ Done | prior | Updated to psmxeckstfeyxlqzzkgw |
| C-04 | Admin function hardening | ✅ Done | b77600c | Deno.serve(); audit log writes added |

**All Phase 0 items resolved. GTM and webhook blockers lifted.**

---

## Operator Actions Required Before Production

These items cannot be completed by code commits alone:

### 1. Set `USER_API_KEY_ENCRYPTION_SECRET` (required for B-01)

Generate a 32-byte random secret and set it as a Supabase Function secret:

```bash
# Generate (run once, save the output securely)
openssl rand -hex 32

# Set in Supabase
supabase secrets set USER_API_KEY_ENCRYPTION_SECRET=<64-char-hex> --project-ref psmxeckstfeyxlqzzkgw
```

**Until this is set:** `save-api-key` will return 500 and no new keys can be saved. Existing keys (plaintext, `key_version=v0-plaintext`) will continue to be read as-is by edge functions during the migration window.

### 2. Set `CREATOMATE_WEBHOOK_SECRET` (required for B-02)

```bash
# Generate
openssl rand -hex 32

# Set
supabase secrets set CREATOMATE_WEBHOOK_SECRET=<value> --project-ref psmxeckstfeyxlqzzkgw
```

Then update the Creatomate webhook URL in your account settings to:
```
https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/video-callback?secret=<value>
```

**Until this is set:** The video-callback endpoint logs a warning but accepts all requests (fail-open during migration). Set this before next production deploy.

### 3. Set `KLAP_WEBHOOK_SECRET` (required for B-02)

```bash
openssl rand -hex 32
supabase secrets set KLAP_WEBHOOK_SECRET=<value> --project-ref psmxeckstfeyxlqzzkgw
```

Then update the Klap dashboard webhook URL to:
```
https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/clip-callback?secret=<value>
```

### 4. Push DB migrations

```bash
supabase db push --linked
```

This applies:
- `20260819000000_atomic_render_usage.sql` (C-01)
- `20260819000001_api_key_encryption.sql` (B-01 — column additions + column-level REVOKE)
- `20260819000002_webhook_receipts.sql` (B-02 — idempotency table)

### 5. Deploy edge functions

```bash
supabase functions deploy save-api-key --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy video-callback --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy clip-callback --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy generate-video-v2 --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy clip-video --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy admin-stats --project-ref psmxeckstfeyxlqzzkgw
supabase functions deploy admin-users --project-ref psmxeckstfeyxlqzzkgw
```

### 6. Re-enrollment notice for existing users

Existing rows in `user_api_keys` remain plaintext (`key_version=v0-plaintext`). Edge functions handle both versions transparently. To migrate existing keys to encrypted:
- Display a one-time banner prompting users to re-enter their keys in the Connections panel.
- After the banner is acknowledged and keys re-entered, all new rows will be `v1-aes256gcm`.
- A background migration script could re-encrypt v0 rows using the `USER_API_KEY_ENCRYPTION_SECRET`, but requires a maintenance window and explicit approval due to the destructive nature of overwriting production credential data.

---

## Phase 1 — Next Priority Queue

| ID | Title | Priority | Notes |
|---|---|---|---|
| H-01 | Social platform "Connect" UI is misleading | HIGH | Audit/fix misleading OAuth affordance |
| H-02 | No RLS cross-user test suite | HIGH | Write explicit cross-tenant RLS tests |
| H-03 | No CI pipeline | HIGH | Add GitHub Actions build+lint+test |
| H-04 | Dead edge functions deployed | HIGH | Undeploy generate-video, create-template, debug-template |
| H-05 | No error tracking / observability | HIGH | Add Sentry to frontend + edge functions |
