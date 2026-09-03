-- Milestone 11: Business Health Monitor & Executive Brief

create table if not exists health_alerts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  type text not null,
  severity text default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  message text,
  data jsonb default '{}',
  acknowledged boolean default false,
  acknowledged_at timestamptz,
  created_at timestamptz default now()
);

alter table health_alerts enable row level security;
create policy "owner_health_alerts" on health_alerts for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists executive_briefs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  period_start date,
  period_end date,
  revenue_attributed_cents bigint default 0,
  appointments_booked int default 0,
  leads_recovered int default 0,
  top_campaign text,
  hours_saved_estimate numeric default 0,
  pending_approvals int default 0,
  current_experiment text,
  next_recommended_action text,
  generated_at timestamptz default now()
);

alter table executive_briefs enable row level security;
create policy "owner_briefs" on executive_briefs for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
