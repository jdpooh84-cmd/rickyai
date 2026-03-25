-- Create businesses table
CREATE TABLE public.businesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name TEXT,
  business_name TEXT NOT NULL,
  business_category TEXT,
  niche TEXT,
  website_url TEXT,
  google_business_profile TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  linkedin_url TEXT,
  target_audience TEXT,
  brand_tone TEXT,
  services TEXT,
  competitors TEXT,
  content_goals TEXT,
  referral_goals TEXT,
  funding_goals TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own businesses"
  ON public.businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own businesses"
  ON public.businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own businesses"
  ON public.businesses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own businesses"
  ON public.businesses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT DEFAULT 'US',
  service_area TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own locations"
  ON public.locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own locations"
  ON public.locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own locations"
  ON public.locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own locations"
  ON public.locations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();