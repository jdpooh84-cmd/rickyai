
-- Advertiser accounts for large organizations
CREATE TABLE public.advertiser_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  industry TEXT NOT NULL,
  website_url TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'suspended')),
  balance_cents INTEGER NOT NULL DEFAULT 0,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ad campaigns created by advertisers
CREATE TABLE public.ad_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id UUID NOT NULL REFERENCES public.advertiser_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_industries TEXT[] DEFAULT '{}',
  target_niches TEXT[] DEFAULT '{}',
  target_locations TEXT[] DEFAULT '{}',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  cpc_cents INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual ad placements (the actual ads shown)
CREATE TABLE public.ad_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  placement_type TEXT NOT NULL DEFAULT 'banner' CHECK (placement_type IN ('banner', 'sidebar', 'inline', 'sponsored_tip', 'featured_strategy')),
  headline TEXT NOT NULL,
  body_text TEXT,
  image_url TEXT,
  cta_text TEXT DEFAULT 'Learn More',
  cta_url TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track ad impressions and clicks for billing
CREATE TABLE public.ad_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement_id UUID NOT NULL REFERENCES public.ad_placements(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  user_id UUID,
  user_industry TEXT,
  user_niche TEXT,
  user_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advertiser_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

-- Ad placements are viewable by all authenticated users (they see ads)
CREATE POLICY "Authenticated users can view active ads" ON public.ad_placements FOR SELECT TO authenticated USING (is_active = true);

-- Ad events can be inserted by authenticated users (tracking)
CREATE POLICY "Authenticated users can log ad events" ON public.ad_events FOR INSERT TO authenticated WITH CHECK (true);

-- Advertiser accounts: only viewable by service role for now (admin managed)
CREATE POLICY "Service role manages advertiser accounts" ON public.advertiser_accounts FOR ALL USING (false);

-- Ad campaigns: only viewable by service role for now
CREATE POLICY "Service role manages campaigns" ON public.ad_campaigns FOR ALL USING (false);

-- Updated at triggers
CREATE TRIGGER update_advertiser_accounts_updated_at BEFORE UPDATE ON public.advertiser_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ad_placements_updated_at BEFORE UPDATE ON public.ad_placements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
