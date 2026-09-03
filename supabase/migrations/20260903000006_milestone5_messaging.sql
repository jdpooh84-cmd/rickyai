-- Milestone 5: SMS, Email, Lifecycle Automation, Offers

create table if not exists lifecycle_automations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  trigger_event text not null,
  trigger_conditions jsonb default '{}',
  active boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table lifecycle_automations enable row level security;
create policy "owner_automations" on lifecycle_automations for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists lifecycle_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references lifecycle_automations(id) on delete cascade not null,
  step_order int not null,
  delay_minutes int default 0,
  channel text default 'sms' check (channel in ('sms','email','internal')),
  template text,
  active boolean default true
);

alter table lifecycle_steps enable row level security;
create policy "owner_lifecycle_steps" on lifecycle_steps for all using (
  automation_id in (
    select id from lifecycle_automations where business_id in (select id from businesses where user_id = auth.uid())
  )
);

create table if not exists automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid references lifecycle_automations(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  status text default 'active' check (status in ('active','completed','exited')),
  enrolled_at timestamptz default now(),
  exited_at timestamptz,
  exit_reason text
);

alter table automation_enrollments enable row level security;
create policy "owner_enrollments" on automation_enrollments for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists automation_step_executions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references automation_enrollments(id) on delete cascade not null,
  step_id uuid references lifecycle_steps(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending','sent','failed','skipped')),
  scheduled_at timestamptz,
  executed_at timestamptz,
  provider_message_id text,
  error text
);

alter table automation_step_executions enable row level security;
create policy "owner_step_executions" on automation_step_executions for all using (
  enrollment_id in (
    select id from automation_enrollments where business_id in (select id from businesses where user_id = auth.uid())
  )
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  channel text default 'sms' check (channel in ('sms','email')),
  direction text default 'outbound' check (direction in ('inbound','outbound')),
  body text,
  subject text,
  status text default 'queued' check (status in ('queued','sent','delivered','failed','replied','bounced')),
  provider_message_id text,
  automation_id uuid references lifecycle_automations(id) on delete set null,
  campaign_id uuid,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "owner_messages" on messages for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  type text check (type in ('percentage','fixed_amount','free_estimate','free_addon','priority_booking')),
  value numeric default 0,
  minimum_purchase_cents int default 0,
  service_ids text[] default '{}',
  valid_from timestamptz,
  valid_until timestamptz,
  redemption_limit int,
  per_customer_limit int default 1,
  approval_status text default 'pending' check (approval_status in ('pending','approved','rejected')),
  active boolean default false,
  created_at timestamptz default now()
);

alter table offers enable row level security;
create policy "owner_offers" on offers for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists offer_redemptions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  redeemed_at timestamptz default now(),
  value_applied numeric default 0
);

alter table offer_redemptions enable row level security;
create policy "owner_offer_redemptions" on offer_redemptions for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
