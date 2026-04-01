
-- Campaign outcomes table: links campaign assets to real business results
CREATE TABLE public.campaign_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  location_id UUID REFERENCES public.locations(id),
  
  -- Asset linkage
  content_post_id UUID REFERENCES public.content_posts(id),
  video_job_id UUID REFERENCES public.video_generation_jobs(id),
  strategy_output_id UUID REFERENCES public.strategy_outputs(id),
  
  -- Campaign metadata
  campaign_name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'general',
  campaign_goal TEXT,
  offer TEXT,
  cta_used TEXT,
  target_audience TEXT,
  content_format TEXT,
  platform TEXT,
  launched_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracked outcomes (quantitative)
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  form_submissions INTEGER DEFAULT 0,
  lead_captures INTEGER DEFAULT 0,
  appointment_requests INTEGER DEFAULT 0,
  bookings INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  repeat_purchases INTEGER DEFAULT 0,
  revenue_cents INTEGER DEFAULT 0,
  
  -- Manual / qualitative input
  calls_received INTEGER DEFAULT 0,
  customer_feedback TEXT,
  what_customers_mentioned TEXT,
  felt_successful BOOLEAN,
  manual_notes TEXT,
  
  -- Attribution
  attribution_model TEXT DEFAULT 'last_touch',
  attribution_score NUMERIC(5,2) DEFAULT 0,
  
  -- Optimization signals (AI-generated)
  what_worked JSONB DEFAULT '[]'::jsonb,
  what_failed JSONB DEFAULT '[]'::jsonb,
  optimization_signals JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attribution touchpoints: tracks the journey across multiple campaigns
CREATE TABLE public.attribution_touchpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  outcome_id UUID REFERENCES public.campaign_outcomes(id) ON DELETE CASCADE,
  
  touchpoint_type TEXT NOT NULL,
  touchpoint_source TEXT,
  touchpoint_content TEXT,
  position_in_journey INTEGER DEFAULT 1,
  
  credit_first_touch NUMERIC(5,4) DEFAULT 0,
  credit_last_touch NUMERIC(5,4) DEFAULT 0,
  credit_linear NUMERIC(5,4) DEFAULT 0,
  credit_time_decay NUMERIC(5,4) DEFAULT 0,
  credit_owner_confirmed NUMERIC(5,4) DEFAULT 0,
  
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for campaign_outcomes
ALTER TABLE public.campaign_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own outcomes"
  ON public.campaign_outcomes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS for attribution_touchpoints
ALTER TABLE public.attribution_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own touchpoints"
  ON public.attribution_touchpoints FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_campaign_outcomes_updated_at
  BEFORE UPDATE ON public.campaign_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
