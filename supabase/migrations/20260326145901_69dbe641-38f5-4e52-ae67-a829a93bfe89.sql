-- Deduplicate strategy outputs so upserts can safely target one row per user/business/step
WITH ranked_strategy_outputs AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, business_id, step_number
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS row_num
  FROM public.strategy_outputs
)
DELETE FROM public.strategy_outputs
WHERE id IN (
  SELECT id
  FROM ranked_strategy_outputs
  WHERE row_num > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS strategy_outputs_user_business_step_key
ON public.strategy_outputs (user_id, business_id, step_number);

CREATE UNIQUE INDEX IF NOT EXISTS usage_tracking_user_period_key
ON public.usage_tracking (user_id, period_start);

CREATE TABLE IF NOT EXISTS public.video_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id UUID NULL REFERENCES public.locations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'built_in_ai',
  status TEXT NOT NULL DEFAULT 'queued',
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_payload JSONB NULL,
  video_url TEXT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.video_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video jobs"
ON public.video_generation_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video jobs"
ON public.video_generation_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video jobs"
ON public.video_generation_jobs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS video_generation_jobs_user_created_idx
ON public.video_generation_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_generation_jobs_business_status_idx
ON public.video_generation_jobs (business_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_video_generation_jobs_updated_at ON public.video_generation_jobs;
CREATE TRIGGER update_video_generation_jobs_updated_at
BEFORE UPDATE ON public.video_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();