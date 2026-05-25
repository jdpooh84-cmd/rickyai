ALTER TABLE public.video_generation_jobs ADD COLUMN IF NOT EXISTS storage_path TEXT;
UPDATE storage.buckets SET public = false WHERE id = 'media';
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', false) ON CONFLICT (id) DO NOTHING;
SELECT cron.schedule('rickyai-reap-stuck-jobs','*/2 * * * *',$$UPDATE public.video_generation_jobs SET status='failed',pipeline_stage='reaped_by_cron',error_message='Auto-failed after 10 minute timeout',updated_at=now() WHERE status IN ('queued','generating_script','generating_voiceover','rendering_video','processing') AND created_at < now() - INTERVAL '10 minutes';$$);
