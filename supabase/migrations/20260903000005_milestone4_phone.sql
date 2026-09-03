-- Milestone 4: Ricky Reception (AI Phone Answering)

create table if not exists phone_calls (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  call_sid text,
  from_number text,
  to_number text,
  direction text default 'inbound' check (direction in ('inbound','outbound')),
  status text default 'ringing' check (status in ('ringing','in_progress','completed','missed','failed')),
  duration_seconds int default 0,
  recording_url text,
  transcript text,
  summary text,
  outcome text check (outcome in ('appointment_booked','callback_requested','info_provided','escalated','no_action','spam')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

alter table phone_calls enable row level security;
create policy "owner_phone_calls" on phone_calls for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

create table if not exists phone_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid unique references businesses(id) on delete cascade not null,
  phone_mode text default 'disabled' check (phone_mode in ('always_ai','after_hours','overflow','disabled')),
  ai_number text,
  fallback_number text,
  after_hours_start time,
  after_hours_end time,
  greeting_message text,
  business_personality text default 'friendly' check (business_personality in ('professional','friendly','formal','casual')),
  voice_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table phone_settings enable row level security;
create policy "owner_phone_settings" on phone_settings for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
