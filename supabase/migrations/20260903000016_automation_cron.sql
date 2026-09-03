-- AUTOMATION CRON JOBS
--
-- Schedules three new pg_cron workers:
--   run-automations         — every 5 minutes  (lifecycle step execution)
--   send-appointment-reminders — every 15 minutes (appointment confirmation + reminder SMS)
--   aggregate-genome        — every hour        (growth genome aggregation pipeline)
--
-- Follows the same pattern as 20260903000002_reconcile_cron.sql.
-- Requires: pg_cron and pg_net extensions (available on Supabase Pro+).
--
-- OWNER ACTION REQUIRED (if not already done):
--   supabase secrets set RECONCILE_SECRET=<random-32-char-string>
--   (also set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
--    SENDGRID_API_KEY, SENDGRID_FROM_EMAIL as needed)

-- Add unique constraint needed by aggregate-genome upsert
ALTER TABLE genome_aggregate_findings
  ADD CONSTRAINT IF NOT EXISTS genome_agg_family_context_unique
  UNIQUE (experiment_family, context_hash);

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any pre-existing jobs with these names (makes migration re-runnable)
SELECT cron.unschedule('run-automations')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-automations');

SELECT cron.unschedule('send-appointment-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-appointment-reminders');

SELECT cron.unschedule('aggregate-genome')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-genome');

-- Schedule all three workers using DO block to resolve config values safely
DO $$
DECLARE
  v_project_url text := current_setting('app.settings.supabase_url', true);
  v_secret      text := current_setting('app.settings.reconcile_secret', true);
BEGIN
  IF v_project_url IS NULL OR v_project_url = '' THEN
    v_project_url := 'https://psmxeckstfeyxlqzzkgw.supabase.co';
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    v_secret := 'PLACEHOLDER_SET_RECONCILE_SECRET';
  END IF;

  -- Run automation steps every 5 minutes
  PERFORM cron.schedule(
    'run-automations',
    '*/5 * * * *',
    format(
      $$SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        )$$,
      v_project_url || '/functions/v1/run-automations?secret=' || v_secret
    )
  );

  -- Send appointment reminders/confirmations every 15 minutes
  PERFORM cron.schedule(
    'send-appointment-reminders',
    '*/15 * * * *',
    format(
      $$SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        )$$,
      v_project_url || '/functions/v1/send-appointment-reminders?secret=' || v_secret
    )
  );

  -- Aggregate genome findings every hour
  PERFORM cron.schedule(
    'aggregate-genome',
    '0 * * * *',
    format(
      $$SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        )$$,
      v_project_url || '/functions/v1/aggregate-genome?secret=' || v_secret
    )
  );

  RAISE NOTICE 'Automation cron jobs scheduled:';
  RAISE NOTICE '  run-automations          → every 5 min  → %', v_project_url || '/functions/v1/run-automations';
  RAISE NOTICE '  send-appointment-reminders → every 15 min → %', v_project_url || '/functions/v1/send-appointment-reminders';
  RAISE NOTICE '  aggregate-genome         → every hour  → %', v_project_url || '/functions/v1/aggregate-genome';
END $$;
