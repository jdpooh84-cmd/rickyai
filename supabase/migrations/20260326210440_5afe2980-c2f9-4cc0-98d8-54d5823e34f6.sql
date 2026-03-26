-- Content posts table for draft-to-published workflow
CREATE TABLE public.content_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id),
  title text NOT NULL,
  caption text,
  hashtags text[],
  cta text,
  video_script text,
  voiceover_script text,
  shot_list jsonb,
  platform text NOT NULL DEFAULT 'tiktok',
  platform_version jsonb,
  media_url text,
  thumbnail_url text,
  media_type text DEFAULT 'video',
  status text NOT NULL DEFAULT 'idea',
  scheduled_at timestamptz,
  posted_at timestamptz,
  production_tool text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own posts"
  ON public.content_posts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Default tool preferences table
CREATE TABLE public.user_tool_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool_type text NOT NULL,
  default_provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, tool_type)
);

ALTER TABLE public.user_tool_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own defaults"
  ON public.user_tool_defaults FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_content_posts_updated_at
  BEFORE UPDATE ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tool_defaults_updated_at
  BEFORE UPDATE ON public.user_tool_defaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();