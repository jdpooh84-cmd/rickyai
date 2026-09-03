-- Milestone 9: Growth Genome

create table if not exists growth_genome_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid unique references businesses(id) on delete cascade not null,
  participation_status text default 'disabled' check (participation_status in ('disabled','read_only','contribute')),
  use_network_insights boolean default false,
  contribute_anonymized boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table growth_genome_settings enable row level security;
create policy "owner_genome_settings" on growth_genome_settings for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists genome_contributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  experiment_family text,
  context_industry text,
  context_size_bucket text,
  context_geo_type text,
  metric text,
  control_exposures int default 0,
  control_conversions int default 0,
  treatment_exposures int default 0,
  treatment_conversions int default 0,
  effect_estimate numeric,
  created_at timestamptz default now()
);

alter table genome_contributions enable row level security;
create policy "owner_genome_contributions" on genome_contributions for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists genome_aggregate_findings (
  id uuid primary key default gen_random_uuid(),
  experiment_family text,
  context_hash text,
  similar_businesses int default 0,
  total_observations int default 0,
  effect_estimate numeric,
  uncertainty numeric,
  evidence_level text default 'anecdotal' check (evidence_level in ('anecdotal','weak','moderate','strong')),
  updated_at timestamptz default now()
);

alter table genome_aggregate_findings enable row level security;
create policy "genome_aggregate_read" on genome_aggregate_findings for select using (true);
