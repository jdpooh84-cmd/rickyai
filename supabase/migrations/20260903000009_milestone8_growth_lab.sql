-- Milestone 8: Growth Lab

create table if not exists growth_experiments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  hypothesis text,
  experiment_family text,
  status text default 'draft' check (status in ('draft','running','paused','completed','abandoned')),
  control_description text,
  treatment_description text,
  metric text,
  minimum_sample int default 100,
  minimum_runtime_days int default 7,
  guardrails jsonb default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  winner text check (winner in ('control','treatment','inconclusive','too_early')),
  created_at timestamptz default now()
);

alter table growth_experiments enable row level security;
create policy "owner_experiments" on growth_experiments for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists growth_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references growth_experiments(id) on delete cascade not null,
  name text not null,
  allocation_start int not null,
  allocation_end int not null
);

alter table growth_experiment_variants enable row level security;
create policy "owner_experiment_variants" on growth_experiment_variants for all using (
  experiment_id in (
    select id from growth_experiments where business_id in (select id from businesses where user_id = auth.uid())
  )
);

create table if not exists growth_experiment_exposures (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references growth_experiments(id) on delete cascade not null,
  variant_id uuid references growth_experiment_variants(id) on delete cascade not null,
  subject_id text not null,
  business_id uuid references businesses(id) on delete cascade not null,
  exposed_at timestamptz default now()
);

alter table growth_experiment_exposures enable row level security;
create policy "owner_exposures" on growth_experiment_exposures for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists growth_experiment_outcomes (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid references growth_experiments(id) on delete cascade not null,
  variant_id uuid references growth_experiment_variants(id) on delete cascade not null,
  subject_id text not null,
  metric_value numeric,
  converted boolean default false,
  occurred_at timestamptz default now()
);

alter table growth_experiment_outcomes enable row level security;
create policy "owner_outcomes" on growth_experiment_outcomes for all using (
  experiment_id in (
    select id from growth_experiments where business_id in (select id from businesses where user_id = auth.uid())
  )
);

create table if not exists growth_findings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  experiment_id uuid references growth_experiments(id) on delete set null,
  finding_text text not null,
  effect_estimate numeric,
  confidence_level text default 'low' check (confidence_level in ('low','moderate','high')),
  applicable_context jsonb default '{}',
  created_at timestamptz default now()
);

alter table growth_findings enable row level security;
create policy "owner_findings" on growth_findings for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
