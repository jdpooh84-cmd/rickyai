-- Milestone 2: Contacts, Leads, Customer Memory, Business Knowledge

-- contacts
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  first_name text,
  last_name text,
  phone_e164 text,
  email text,
  preferred_channel text default 'sms' check (preferred_channel in ('sms','email','phone')),
  sms_consent_status text default 'unknown' check (sms_consent_status in ('unknown','granted','revoked')),
  email_consent_status text default 'unknown' check (email_consent_status in ('unknown','granted','revoked')),
  do_not_contact boolean default false,
  customer_status text default 'prospect' check (customer_status in ('prospect','lead','customer','inactive','lost')),
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table contacts enable row level security;
create policy "owner_contacts" on contacts for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

-- leads
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  location_id uuid references locations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  source text,
  campaign_id uuid,
  status text default 'new' check (status in ('new','contacted','qualified','disqualified','converted','lost')),
  service_interest text,
  urgency text default 'medium' check (urgency in ('low','medium','high','emergency')),
  qualification_status text,
  estimated_value numeric,
  lost_reason text,
  created_at timestamptz default now(),
  converted_at timestamptz,
  updated_at timestamptz default now()
);

alter table leads enable row level security;
create policy "owner_leads" on leads for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

-- customer_memory
create table if not exists customer_memory (
  contact_id uuid primary key references contacts(id) on delete cascade,
  summary text,
  known_preferences jsonb default '{}',
  prior_services text[] default '{}',
  open_issues text[] default '{}',
  last_interaction_summary text,
  updated_at timestamptz default now()
);

alter table customer_memory enable row level security;
create policy "owner_customer_memory" on customer_memory for all using (
  contact_id in (
    select id from contacts where business_id in (select id from businesses where user_id = auth.uid())
  )
);

-- business_knowledge
create table if not exists business_knowledge (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  type text default 'general' check (type in ('service','hour','faq','policy','service_area','general')),
  subject text not null,
  value jsonb default '{}',
  source_url text,
  confidence numeric default 0.5 check (confidence >= 0 and confidence <= 1),
  verification_status text default 'unverified' check (verification_status in ('unverified','owner_verified','owner_corrected','owner_supplied','deprecated')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table business_knowledge enable row level security;
create policy "owner_business_knowledge" on business_knowledge for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

-- website_research_jobs
create table if not exists website_research_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  url text not null,
  status text default 'queued' check (status in ('queued','running','completed','failed')),
  pages_found int default 0,
  facts_extracted int default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table website_research_jobs enable row level security;
create policy "owner_research_jobs" on website_research_jobs for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
