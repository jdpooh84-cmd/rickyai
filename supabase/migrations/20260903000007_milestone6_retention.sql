-- Milestone 6: Estimate Recovery, Reviews, Retention, Reactivation

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  type text default 'estimate' check (type in ('estimate','quote','proposal')),
  value_cents int default 0,
  status text default 'draft' check (status in ('draft','sent','viewed','accepted','declined','expired')),
  external_reference text,
  notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now()
);

alter table opportunities enable row level security;
create policy "owner_opportunities" on opportunities for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists review_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  status text default 'pending' check (status in ('pending','sent','responded','skipped')),
  sent_at timestamptz,
  response_sentiment text check (response_sentiment in ('positive','neutral','negative')),
  created_at timestamptz default now()
);

alter table review_requests enable row level security;
create policy "owner_review_requests" on review_requests for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists reactivation_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  segment_type text check (segment_type in ('inactive_90','inactive_180','maintenance_due','seasonal')),
  status text default 'draft' check (status in ('draft','active','completed')),
  contacts_targeted int default 0,
  contacts_responded int default 0,
  appointments_booked int default 0,
  revenue_attributed_cents bigint default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table reactivation_campaigns enable row level security;
create policy "owner_reactivation" on reactivation_campaigns for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
