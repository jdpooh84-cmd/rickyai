# Disaster Recovery — Ricky AI

## Scope

This document covers recovery procedures for the Ricky AI production system.
**Supabase project**: `psmxeckstfeyxlqzzkgw`
**Canonical frontend**: `https://rickyai.vercel.app`

---

## 1. Bad Deployment (Frontend)

**Symptoms**: App broken after a Vercel deploy.

**Recovery**:
1. Go to Vercel dashboard → rickyai project → Deployments
2. Click the last known-good deployment
3. Select "Redeploy" (promotes that build to production without a new build)
4. Verify `https://rickyai.vercel.app` is working

**Prevention**: CI/CD blocks merges if `npm run build` fails.

---

## 2. Accidental Destructive Migration

**Symptoms**: Data missing, columns dropped, constraints broken after `db push`.

**Assessment**:
```
# Check what migration ran
supabase migration list --project-ref psmxeckstfeyxlqzzkgw

# Inspect recent schema changes via Supabase Dashboard → Database → Schema
```

**Recovery**:
1. **Do not panic and run another migration blindly.**
2. Identify the destructive migration file in `supabase/migrations/`.
3. Write a **forward-fix migration** that restores the missing structure.
   - Never use DROP to "undo" — write an additive fix.
   - Restore columns as nullable with defaults if data is lost.
4. If data rows are gone and backups are available:
   - Supabase Dashboard → Database → Backups → Point-in-time restore (Pro+ plan)
   - Download the backup and restore specific tables via SQL.
5. Push the forward-fix migration.
6. Verify application functionality.

**Prevention**:
- Review every migration carefully before `db push --linked`.
- Never run destructive SQL (DROP TABLE, DROP COLUMN, TRUNCATE) against production without explicit owner approval.

---

## 3. Database Loss / Corruption

**Supabase automated backups**:
- Free/Pro plans: daily backups, 7-day retention
- Enterprise plans: point-in-time recovery up to 30 days

**Recovery**:
1. Supabase Dashboard → Database → Backups
2. Choose the most recent backup before the incident
3. Click "Restore" — this creates a new project from that backup
4. Update environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) in Vercel and Supabase secrets to point to the restored project
5. Re-deploy edge functions to the new project

**Note**: If the plan does not support point-in-time recovery, the recovery window is the last daily backup. Upgrade to Pro+ to reduce data loss window.

---

## 4. Credential Compromise

**Suspected compromise of any secret**:

### SUPABASE_SERVICE_ROLE_KEY
```
OWNER ACTION REQUIRED
Supabase Dashboard → Settings → API → Service Role Key → Rotate
Update in: Supabase Function Secrets, Vercel env vars
```

### STRIPE_SECRET_KEY
```
OWNER ACTION REQUIRED
Stripe Dashboard → Developers → API Keys → Roll secret key
Update in: Supabase Function Secrets
```

### TWILIO_AUTH_TOKEN
```
OWNER ACTION REQUIRED
Twilio Console → Account → API Keys → Rotate primary credential
Update TWILIO_AUTH_TOKEN in Supabase Function Secrets
```

### OPENAI_API_KEY / ANTHROPIC_API_KEY
Revoke key in provider dashboard. Issue a new key. Update Supabase secrets.

### CREATOMATE_API_KEY
Revoke in Creatomate dashboard. Issue new key. Update Supabase secrets.

**After any rotation**:
1. Redeploy all affected edge functions
2. Verify functionality with a smoke test
3. Check that no committed code contains the old key (Git history search)

---

## 5. Queue / Background Job Failure

**Symptoms**: Videos stuck, messages not sending, automations not running.

**Diagnosis**:
```sql
-- Check stuck agent jobs
SELECT job_type, status, attempt_count, last_error, created_at
FROM agent_jobs
WHERE status IN ('running', 'queued', 'retryable')
  AND created_at < NOW() - INTERVAL '30 minutes'
ORDER BY created_at;
```

**Recovery**:
- Jobs with `attempt_count < max_attempts` and `status = 'retryable'` will retry automatically on next clock tick.
- Jobs with `status = 'running'` older than 1 hour are likely stalled — manually set to `retryable`:
```sql
UPDATE agent_jobs
SET status = 'retryable', next_attempt_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '1 hour';
```
- Jobs in `failed` state require human review of `last_error` before retry.

---

## 6. Provider Outage

### Creatomate down
- Videos queue in `waiting_external` state.
- When Creatomate recovers, `reconcile-renders` (runs every 10 min) repairs stale jobs automatically.
- No manual action required unless outage is >24 hours.

### Twilio down
- Inbound calls follow the `fallback_number` configured in `phone_settings`.
- If fallback not set: calls receive recorded unavailability message.
- SMS sends will fail and be marked `failed` in the `messages` table.

### OpenAI down
- AI generation features return errors.
- Existing strategy/content results remain available.
- Video generation fails at script phase; jobs marked `failed`.

### SendGrid down
- Email sends queue with status `queued` or fail with status `failed`.
- Retry when provider recovers.

### Stripe down
- Checkout may be unavailable.
- Existing subscriptions are unaffected — Stripe serves subscription state from cache.

---

## 7. Failed Webhook Storm

**Symptom**: Thousands of webhook deliveries retrying, database under load.

**Response**:
1. Check `webhook_receipts` table — idempotency layer prevents duplicate processing.
2. If the webhook endpoint is responding 5xx: check edge function logs in Supabase dashboard.
3. Temporarily disable the specific function (`verify_jwt` can't disable it, but you can deploy a version that returns 200 immediately while you investigate).
4. After fixing the underlying issue, redeploy and let the provider retry normally.

---

## 8. Supabase Personal Access Token Compromise

A personal access token (PAT) is used by the Supabase CLI, not by the application.

**If compromised**:
```
OWNER ACTION REQUIRED
Supabase Dashboard → Account → Access Tokens
Revoke the compromised token.
Issue a new one for CLI use.
```

The application does not use the PAT at runtime — only the anon key and service role key matter for production.

---

## Monitoring Links

| Resource | URL |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard/project/psmxeckstfeyxlqzzkgw |
| Edge Function Logs | Supabase Dashboard → Functions → select function → Logs |
| Vercel Deployment | https://vercel.com/dashboard |
| Stripe Webhooks | https://dashboard.stripe.com/webhooks |
| Twilio Console | https://console.twilio.com |

---

*Last updated: 2026-09-03*
