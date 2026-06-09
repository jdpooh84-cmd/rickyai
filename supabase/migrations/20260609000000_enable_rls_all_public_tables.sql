-- Security hardening: enable RLS on every public table that currently lacks it.
-- This migration is idempotent — enabling RLS on an already-protected table is a no-op.
-- Explicit ALTER TABLE statements cover all 34 known tables.
-- The DO block catches any additional tables created outside migrations.

-- ── Known tables (explicit, always safe) ───────────────────────────────────
ALTER TABLE IF EXISTS public.ad_campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ad_placements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.advertiser_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.affiliate_payouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attribution_touchpoints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.businesses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_outcomes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_flags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.forum_posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.forum_replies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.forum_upvotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.point_history             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_conversions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.strategy_outputs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.strategy_purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tos_acceptances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trial_used_emails         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_tracking            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_api_keys             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_badges               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_bans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_points               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_tool_defaults        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_generation_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.winning_strategies        ENABLE ROW LEVEL SECURITY;

-- ── Catch-all: any table not covered above ──────────────────────────────────
-- Finds every base table in the public schema with rowsecurity = false and
-- enables RLS on it. This catches tables created via the dashboard or Lovable
-- that were never added to a migration file.
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    RAISE NOTICE 'RLS enabled on previously-unprotected table: public.%', tbl.tablename;
  END LOOP;
END;
$$;
