-- Milestone 7: Campaign Execution, Landing Pages, Approval Center

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  action_type text not null,
  risk_level text default 'medium' check (risk_level in ('low','medium','high')),
  payload jsonb default '{}',
  human_summary text,
  status text default 'pending' check (status in ('pending','approved','rejected','expired')),
  expires_at timestamptz,
  requested_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(user_id) on delete set null
);

alter table approvals enable row level security;
create policy "owner_approvals" on approvals for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists campaign_executions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  campaign_id uuid,
  status text default 'draft' check (status in ('draft','review','approved','scheduled','live','completed','paused')),
  budget_cents int default 0,
  spend_cents int default 0,
  impressions int default 0,
  clicks int default 0,
  leads_generated int default 0,
  appointments_booked int default 0,
  revenue_attributed_cents bigint default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table campaign_executions enable row level security;
create policy "owner_campaign_executions" on campaign_executions for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists landing_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  campaign_id uuid,
  slug text not null,
  title text,
  headline text,
  offer_text text,
  cta_text text default 'Get Started',
  active boolean default true,
  views int default 0,
  submissions int default 0,
  created_at timestamptz default now()
);

alter table landing_pages enable row level security;
create policy "owner_landing_pages" on landing_pages for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
