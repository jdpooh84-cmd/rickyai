-- Milestone 3: Appointments & Scheduling

create table if not exists appointment_types (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name text not null,
  duration_minutes int default 60,
  buffer_minutes int default 0,
  price_cents int default 0,
  description text,
  color text default '#6366f1',
  active boolean default true,
  created_at timestamptz default now()
);

alter table appointment_types enable row level security;
create policy "owner_appointment_types" on appointment_types for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  day_of_week int check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  active boolean default true
);

alter table availability_rules enable row level security;
create policy "owner_availability" on availability_rules for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  appointment_type_id uuid references appointment_types(id) on delete set null,
  staff_name text,
  status text default 'requested' check (status in ('requested','confirmed','rescheduled','cancelled','completed','no_show')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  external_calendar_event_id text,
  notes text,
  reminder_sent_at timestamptz,
  confirmation_sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table appointments enable row level security;
create policy "owner_appointments" on appointments for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists appointment_holds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  appointment_type_id uuid references appointment_types(id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  contact_id uuid references contacts(id) on delete set null,
  expires_at timestamptz not null,
  converted boolean default false,
  created_at timestamptz default now()
);

alter table appointment_holds enable row level security;
create policy "owner_holds" on appointment_holds for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  provider text check (provider in ('google','outlook')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expiry timestamptz,
  calendar_id text,
  sync_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table calendar_connections enable row level security;
create policy "owner_calendar_connections" on calendar_connections for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
