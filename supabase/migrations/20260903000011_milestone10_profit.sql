-- Milestone 10: Profit Yield Engine

create table if not exists service_economics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  service_name text not null,
  expected_revenue_cents int default 0,
  expected_direct_cost_cents int default 0,
  expected_labor_hours numeric default 0,
  expected_labor_cost_cents int default 0,
  expected_travel_cost_cents int default 0,
  expected_gross_contribution_cents int default 0,
  data_confidence numeric default 0.5,
  sample_size int default 0,
  updated_at timestamptz default now()
);

alter table service_economics enable row level security;
create policy "owner_service_economics" on service_economics for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists resource_capacity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  resource_name text not null,
  resource_type text check (resource_type in ('technician','crew','chair','vehicle','room')),
  date date not null,
  available_minutes int default 480,
  skills text[] default '{}',
  status text default 'available' check (status in ('available','booked','unavailable')),
  created_at timestamptz default now()
);

alter table resource_capacity enable row level security;
create policy "owner_resource_capacity" on resource_capacity for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists yield_decisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  decision_time timestamptz default now(),
  planning_horizon_start date,
  planning_horizon_end date,
  objective text default 'profit' check (objective in ('profit','contribution','revenue')),
  selected_actions jsonb default '[]',
  expected_value_cents bigint default 0,
  confidence numeric default 0.5,
  actual_result jsonb,
  created_at timestamptz default now()
);

alter table yield_decisions enable row level security;
create policy "owner_yield_decisions" on yield_decisions for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
