-- Security hardening migration
-- Fixes identified in production security audit:
-- 1. feature_flags RLS missing
-- 2. increment_lp_submissions search_path injection risk
-- 3. admin_activity_log open INSERT policy
-- 4. issue_reports table for in-app bug reporting

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. feature_flags — enable RLS (table was created without it)
-- ──────────────────────────────────────────────────────────────────────────────

alter table feature_flags enable row level security;

-- Admin-only write access
create policy "feature_flags_admin_all"
  on feature_flags
  for all
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Business owners can read flags that explicitly include their business_id
-- in the overrides JSONB or are in 'ga' stage (generally available)
create policy "feature_flags_business_read"
  on feature_flags
  for select
  using (
    stage = 'ga'
    or (
      select overrides ? (
        select id::text from businesses where user_id = auth.uid() limit 1
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Fix increment_lp_submissions — add search_path to prevent injection
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function increment_lp_submissions(page_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update landing_pages set submissions = submissions + 1 where id = page_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Fix admin_activity_log INSERT policy — restrict to admin role only
-- ──────────────────────────────────────────────────────────────────────────────

drop policy if exists "Authenticated users can insert" on admin_activity_log;
drop policy if exists "admin_log_insert_auth" on admin_activity_log;

create policy "admin_log_insert_admin_only"
  on admin_activity_log
  for insert
  with check (has_role(auth.uid(), 'admin'));

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. issue_reports — in-app defect reporting table
-- ──────────────────────────────────────────────────────────────────────────────

create table if not exists issue_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  business_id  uuid references businesses(id) on delete set null,
  title        text not null,
  description  text not null,
  category     text not null default 'bug' check (category in ('bug','feature','ux','billing','other')),
  severity     text not null default 'medium' check (severity in ('low','medium','high','critical')),
  page_context text,
  metadata     jsonb default '{}',
  status       text not null default 'open' check (status in ('open','triaged','in_progress','resolved','closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table issue_reports enable row level security;

-- Users can submit and read their own reports
create policy "issue_reports_owner"
  on issue_reports
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can see all reports
create policy "issue_reports_admin_read"
  on issue_reports
  for select
  using (has_role(auth.uid(), 'admin'));

create policy "issue_reports_admin_update"
  on issue_reports
  for update
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

create index if not exists issue_reports_user_idx on issue_reports (user_id);
create index if not exists issue_reports_status_idx on issue_reports (status);
create index if not exists issue_reports_created_idx on issue_reports (created_at desc);

create trigger issue_reports_updated_at
  before update on issue_reports
  for each row execute function update_updated_at_column();
