
CREATE TABLE public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  api_key_encrypted text NOT NULL,
  is_valid boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own keys" ON public.user_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own keys" ON public.user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own keys" ON public.user_api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own keys" ON public.user_api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.strategy_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  output_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outputs" ON public.strategy_outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own outputs" ON public.strategy_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own outputs" ON public.strategy_outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own outputs" ON public.strategy_outputs FOR DELETE USING (auth.uid() = user_id);
