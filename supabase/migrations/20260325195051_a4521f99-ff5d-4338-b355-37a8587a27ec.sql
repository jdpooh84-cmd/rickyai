
-- ToS acceptance tracking
CREATE TABLE public.tos_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tos_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.tos_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own acceptances" ON public.tos_acceptances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own acceptances" ON public.tos_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User bans table for content moderation
CREATE TABLE public.user_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offense_number integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  banned_at timestamptz NOT NULL DEFAULT now(),
  ban_expires_at timestamptz,
  is_permanent boolean NOT NULL DEFAULT false,
  issued_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bans" ON public.user_bans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all bans" ON public.user_bans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Content flags for admin monitoring
CREATE TABLE public.content_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid NOT NULL,
  reported_by uuid,
  content_type text NOT NULL,
  content_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage flags" ON public.content_flags
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create flags" ON public.content_flags
  FOR INSERT WITH CHECK (auth.uid() = reported_by);
