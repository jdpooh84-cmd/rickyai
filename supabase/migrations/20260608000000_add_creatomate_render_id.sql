ALTER TABLE public.video_generation_jobs ADD COLUMN IF NOT EXISTS creatomate_render_id TEXT;
ALTER TABLE public.video_generation_jobs ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;
