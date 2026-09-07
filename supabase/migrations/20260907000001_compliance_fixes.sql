-- Compliance fixes migration
-- 1. Update handle_new_user to read email_marketing_opt_in from signup metadata
-- 2. Add unsubscribe_token to profiles for one-click unsubscribe links

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Update handle_new_user trigger — persist marketing opt-in from signup
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id,
    display_name,
    trial_started_at,
    trial_ends_at,
    email_marketing_opt_in
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    now(),
    now() + interval '7 days',
    coalesce(
      (new.raw_user_meta_data ->> 'email_marketing_opt_in')::boolean,
      false
    )
  );
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Add unsubscribe_token to contacts (one-click email unsubscribe per CAN-SPAM)
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.contacts
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists contacts_unsubscribe_token_idx
  on public.contacts (unsubscribe_token);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Backfill default: existing profiles that have no preference retain their
--    current value (DEFAULT true from the column definition stays as-is).
--    New signups via the updated trigger will default to false (opt-out).
-- ──────────────────────────────────────────────────────────────────────────────
