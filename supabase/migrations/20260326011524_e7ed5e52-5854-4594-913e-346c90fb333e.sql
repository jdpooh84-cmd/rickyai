CREATE TABLE public.webhook_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_type text NOT NULL UNIQUE,
  webhook_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage webhook config"
ON public.webhook_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read active webhooks"
ON public.webhook_config
FOR SELECT
TO authenticated
USING (is_active = true);