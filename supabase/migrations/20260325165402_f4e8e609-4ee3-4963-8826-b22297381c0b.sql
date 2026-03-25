-- Track emails that have used their free trial (prevents re-registration abuse)
CREATE TABLE public.trial_used_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trial_used_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.trial_used_emails
  FOR ALL TO public USING (false);

-- Add email marketing opt-in to profiles (auto-opted in on signup)
ALTER TABLE public.profiles ADD COLUMN email_marketing_opt_in boolean NOT NULL DEFAULT true;

-- Trigger: when a user signs up, record their email as trial-used
CREATE OR REPLACE FUNCTION public.record_trial_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.trial_used_emails (email)
  VALUES (NEW.email)
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_record_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_trial_email();

-- Function to check if an email has used its trial (callable from client)
CREATE OR REPLACE FUNCTION public.check_trial_used(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trial_used_emails WHERE email = check_email
  );
$$