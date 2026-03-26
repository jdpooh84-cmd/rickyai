
-- Remove client-side INSERT and UPDATE on usage_tracking (service role only)
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.usage_tracking;

-- Add unique constraint so service role can upsert
ALTER TABLE public.usage_tracking ADD CONSTRAINT usage_tracking_user_period_unique UNIQUE (user_id, period_start);
