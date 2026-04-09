
ALTER TABLE public.video_generation_jobs
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS manus_task_id text,
  ADD COLUMN IF NOT EXISTS fallback_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_polled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS poll_attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.video_generation_jobs.pipeline_stage IS 'queued | generating_images | submitted_to_manus | polling_manus | composing_browser | completed | failed';
