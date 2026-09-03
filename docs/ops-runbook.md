# Ricky AI — Ops Runbook

Last updated: 2026-09-03

## Deployment

### Frontend (Vercel)
```bash
npx vercel --prod
```
Primary URL: https://rickyai.vercel.app

### Edge Functions (Supabase)
Deploy one:
```
& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw
```
Deploy all (run for each changed function):
```
send-message, video-callback, handle-call, handle-call-gather,
create-checkout, check-subscription, stripe-webhook, reconcile-renders,
run-automations, send-appointment-reminders, aggregate-genome,
ricky-orchestrator, workflow-diagnosis, generate-video-v2, landing-page
```

### Database Migrations
```
& "C:\Users\jodan\supabase-bin\supabase.exe" db push --linked
```
Apply any pending migrations in `/supabase/migrations/`. Always verify migration order by timestamp prefix.

## Required Supabase Secrets

Set via: Supabase Dashboard → Project Settings → Edge Functions → Secrets

| Secret | Used by | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | create-checkout, check-subscription, stripe-webhook | YES |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | YES — get from Stripe Dashboard → Webhooks |
| `TWILIO_ACCOUNT_SID` | send-message, handle-call, handle-call-gather | SMS/voice only |
| `TWILIO_AUTH_TOKEN` | send-message, handle-call, handle-call-gather | SMS/voice only |
| `TWILIO_PHONE_NUMBER` | send-message | SMS only |
| `SENDGRID_API_KEY` | send-message | Email only |
| `SENDGRID_FROM_EMAIL` | send-message | Email only |
| `CREATOMATE_API_KEY` | generate-video-v2 | Video only |
| `CREATOMATE_WEBHOOK_SECRET` | video-callback | YES — must match URL registered with Creatomate |
| `OPENAI_API_KEY` | handle-call-gather | AI voice only |
| `ANTHROPIC_API_KEY` | ricky-orchestrator, workflow-diagnosis | Orchestrator only |
| `RECONCILE_SECRET` | reconcile-renders, run-automations, send-appointment-reminders, aggregate-genome | YES — pg_cron uses this |
| `ELEVENLABS_API_KEY` | generate-video-v2 | Video with ElevenLabs TTS |

If any RECONCILE_SECRET-authenticated function is deployed without this secret set, pg_cron jobs will fall back to an unauthenticated placeholder. **Set it before deploying.**

## Stripe Webhook Setup

After deploying `stripe-webhook`:
1. Go to Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the "Signing secret" and set as `STRIPE_WEBHOOK_SECRET` in Supabase secrets.

## Creatomate Webhook Setup

Register this URL with Creatomate:
```
https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/video-callback?secret=<CREATOMATE_WEBHOOK_SECRET>
```
The `secret` query param must match the `CREATOMATE_WEBHOOK_SECRET` secret in Supabase.

## Rollback

### Frontend rollback
Vercel keeps deployment history. Roll back via the Vercel dashboard or:
```bash
npx vercel rollback
```

### Edge function rollback
Re-deploy the previous version from git:
```bash
git checkout <previous-commit> -- supabase/functions/<name>/index.ts
# then deploy
```

### Migration rollback
Supabase does not support automatic migration rollback. Write a compensating migration manually and run `db push`.

## Incident Response

### Symptom: Videos not completing (stuck in "processing")
1. Check `video_generation_jobs` for rows stuck in non-terminal status older than 30 min
2. Run `reconcile-renders` manually: invoke the edge function with the `RECONCILE_SECRET`
3. Check Creatomate dashboard for render status
4. Verify `CREATOMATE_WEBHOOK_SECRET` matches what's in the Creatomate webhook URL

### Symptom: No subscription changes after Stripe payment
1. Check Stripe webhook delivery logs in Stripe Dashboard → Developers → Webhooks
2. Confirm `stripe-webhook` function is deployed and `STRIPE_WEBHOOK_SECRET` is set
3. Manually trigger check-subscription from the frontend if needed (60s auto-refresh)

### Symptom: pg_cron jobs not running
1. Check `cron.job_run_details` in Supabase SQL editor for errors
2. Verify `RECONCILE_SECRET` is set in Supabase secrets
3. Verify the edge function URL in the cron migration is the correct project ref

### Symptom: Users can't log in
1. Check Supabase Auth logs
2. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` match the project
3. Check for `user_bans` entries if specific users are blocked

### Symptom: Twilio calls not working
1. Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are set
2. Check `phone_settings` table for the called number
3. Check Twilio webhook URL points to `handle-call` edge function
4. Verify `handle-call-gather` webhook URL matches the Supabase project

## Monitoring

- Supabase Edge Function logs: Dashboard → Edge Functions → Logs
- pg_cron: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;`
- Stuck video jobs: `SELECT * FROM video_generation_jobs WHERE status NOT IN ('completed','failed') AND created_at < now() - interval '30 min';`
- Failed messages: `SELECT * FROM messages WHERE status = 'failed' ORDER BY created_at DESC LIMIT 50;`
- Issue reports: `SELECT * FROM issue_reports WHERE status = 'open' ORDER BY created_at DESC;`
