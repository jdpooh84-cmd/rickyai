-- MILESTONE 1: Creatomate Reconciliation Cron
--
-- Schedules the reconcile-renders edge function to run every 10 minutes.
-- This ensures stale Creatomate jobs (where the webhook was missed/lost) are
-- eventually repaired — no video stays stuck in "processing" forever.
--
-- Requires: pg_cron and pg_net extensions (available on Supabase Pro+).
-- If pg_cron is not enabled on this project, enable it via:
--   Supabase Dashboard > Project Settings > Extensions > pg_cron
--   Supabase Dashboard > Project Settings > Extensions > pg_net

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove any existing reconcile-renders cron job so this migration is re-runnable
SELECT cron.unschedule('reconcile-renders-cron')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'reconcile-renders-cron'
  );

-- Schedule: every 10 minutes
-- The RECONCILE_SECRET and project URL are embedded as Postgres config params
-- to avoid hardcoding them. In practice these are set as Supabase secrets and
-- referenced here via current_setting() so the SQL itself never contains a secret.
--
-- OWNER ACTION REQUIRED (after applying this migration):
--   supabase secrets set RECONCILE_SECRET=<random-32-char-string>
--   (also set CREATOMATE_API_KEY if not already set)
--
-- After secrets are set, update the cron job URL below via the Supabase
-- Dashboard > Integrations > Cron Jobs, or re-run this migration.

DO $$
DECLARE
  v_project_url text := current_setting('app.settings.supabase_url', true);
  v_secret      text := current_setting('app.settings.reconcile_secret', true);
  v_url         text;
BEGIN
  IF v_project_url IS NULL OR v_project_url = '' THEN
    v_project_url := 'https://psmxeckstfeyxlqzzkgw.supabase.co';
  END IF;
  IF v_secret IS NULL OR v_secret = '' THEN
    -- Use placeholder — owner must set RECONCILE_SECRET and update the cron
    v_secret := 'PLACEHOLDER_SET_RECONCILE_SECRET';
  END IF;

  v_url := v_project_url || '/functions/v1/reconcile-renders?secret=' || v_secret;

  PERFORM cron.schedule(
    'reconcile-renders-cron',
    '*/10 * * * *',  -- every 10 minutes
    format(
      $$SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{}'::jsonb
        )$$,
      v_url
    )
  );

  RAISE NOTICE 'Reconciliation cron scheduled every 10 minutes → %', v_project_url || '/functions/v1/reconcile-renders';
END $$;
