
CREATE TABLE public.business_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  shot_type text NOT NULL DEFAULT 'environment',
  tags text[] DEFAULT '{}',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  file_size_bytes bigint DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own media"
  ON public.business_media FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_business_media_business ON public.business_media(business_id);
CREATE INDEX idx_business_media_shot_type ON public.business_media(business_id, shot_type);
