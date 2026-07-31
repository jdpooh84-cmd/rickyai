-- ═══════════════════════════════════════════════════════════════════════
-- 1. is_test_account flag on profiles
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. clip_generation_jobs — tracks raw-footage → Klap → clips pipeline
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.clip_generation_jobs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id        uuid        NOT NULL,
  source_video_url   text        NOT NULL,
  source_storage_path text,
  provider           text        NOT NULL DEFAULT 'klap',
  external_job_id    text,
  status             text        NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','processing','completed','failed')),
  clip_urls          text[]      NOT NULL DEFAULT '{}',
  clip_count         integer,
  result_payload     jsonb,
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clip_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own clip jobs"
  ON public.clip_generation_jobs
  FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER set_clip_jobs_updated_at
  BEFORE UPDATE ON public.clip_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Test account — partner@rickyai.test / TestRicky2026!
--    email_confirmed_at set immediately; no real email sent.
--    On conflict (already exists): just ensure is_test_account = true.
-- ═══════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_email    text := 'partner@rickyai.test';
  v_password text := 'TestRicky2026!';
  v_user_id  uuid;
BEGIN
  -- If the user already exists, just make sure the flag is set
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET is_test_account = true WHERE user_id = v_user_id;
    RAISE NOTICE 'Test account already exists (%), is_test_account ensured.', v_email;
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  -- Insert the auth user (trigger on_auth_user_created fires and creates the profile row)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Restaurant Partner"}'::jsonb,
    false,
    '', '', '', '',
    now(), now()
  );

  -- Insert identity so email/password login works in GoTrue
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    json_build_object('sub', v_user_id::text, 'email', v_email)::jsonb,
    'email',
    v_email,
    now(), now(), now()
  );

  -- The trigger already created the profile row. Now flag it as test account
  -- and remove the unnecessary 7-day trial (test accounts bypass billing entirely).
  UPDATE public.profiles
  SET
    is_test_account    = true,
    trial_started_at   = null,
    trial_ends_at      = null,
    onboarding_completed = false
  WHERE user_id = v_user_id;

  RAISE NOTICE 'Test account created: email=%, id=%', v_email, v_user_id;
END;
$$;
