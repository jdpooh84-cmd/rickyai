
DROP POLICY "System can insert activity log" ON public.admin_activity_log;
CREATE POLICY "Authenticated users can insert activity log" ON public.admin_activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
