
-- Fix the ad_events policy to require authenticated user_id
DROP POLICY "Authenticated users can log ad events" ON public.ad_events;
CREATE POLICY "Authenticated users can log ad events" ON public.ad_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Allow authenticated users to view their own events
CREATE POLICY "Users can view own ad events" ON public.ad_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
