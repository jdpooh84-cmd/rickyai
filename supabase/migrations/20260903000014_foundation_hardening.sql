-- Foundation Hardening Migration
-- Adds: timezone support, audit_logs, business_integrations, feature_flags

-- ── Timezone on businesses and locations ──────────────────────────────────
alter table businesses add column if not exists timezone text not null default 'America/New_York';
alter table locations  add column if not exists timezone text;

-- ── Audit logs (immutable, append-only) ───────────────────────────────────
create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id) on delete set null,
  actor_id      uuid,                  -- auth.uid() of the person/service acting
  actor_type    text not null default 'user'
                  check (actor_type in ('user','system','edge_function','webhook')),
  action        text not null,         -- e.g. "automation.updated", "offer.approved"
  target_type   text,                  -- e.g. "lifecycle_automation", "offer"
  target_id     uuid,
  metadata      jsonb default '{}',
  ip_address    text,
  created_at    timestamptz not null default now()
);

-- Audit logs are immutable — no UPDATE or DELETE
alter table audit_logs enable row level security;
create policy "owner_read_audit_logs" on audit_logs
  for select using (
    business_id in (select id from businesses where user_id = auth.uid())
  );
-- Only system (service role) may insert — RLS blocks direct inserts from anon/user clients
-- (service-role key bypasses RLS by design; edge functions use service role)

create index if not exists idx_audit_logs_business_created on audit_logs (business_id, created_at desc);
create index if not exists idx_audit_logs_actor on audit_logs (actor_id, created_at desc);
create index if not exists idx_audit_logs_action on audit_logs (action, created_at desc);

-- ── Business integrations ─────────────────────────────────────────────────
create table if not exists business_integrations (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid references businesses(id) on delete cascade not null,
  provider            text not null,    -- 'google_calendar', 'twilio', 'sendgrid', etc.
  integration_type    text not null,    -- 'calendar', 'voice', 'email', 'sms', 'crm'
  status              text not null default 'disconnected'
                        check (status in ('connected','degraded','disconnected','reconnect_required')),
  display_label       text,             -- user-friendly label, e.g. "My Google Calendar"
  configuration       jsonb default '{}',  -- non-secret config (scopes, calendar IDs)
  credential_reference text,            -- opaque reference to server-side secret (not the secret itself)
  last_checked_at     timestamptz,
  last_success_at     timestamptz,
  last_error_code     text,
  last_error_detail   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (business_id, provider, integration_type)
);

alter table business_integrations enable row level security;
create policy "owner_integrations" on business_integrations
  for all using (
    business_id in (select id from businesses where user_id = auth.uid())
  );

create index if not exists idx_business_integrations_status on business_integrations (status, last_checked_at);

create or replace function touch_integration_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_integration_updated_at
  before update on business_integrations
  for each row execute function touch_integration_updated_at();

-- ── Platform feature flags ────────────────────────────────────────────────
-- These are platform-level flags controlled by admins, not per-business.
-- Per-business overrides use the 'overrides' jsonb column.
create table if not exists feature_flags (
  id          uuid primary key default gen_random_uuid(),
  flag_key    text not null unique,     -- e.g. 'ricky_reception', 'growth_lab'
  description text,
  stage       text not null default 'disabled'
                check (stage in ('disabled','internal','beta','ga')),
  enabled_for_all boolean not null default false,
  -- jsonb: { "business_id_1": true, "business_id_2": false }
  overrides   jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Feature flags are platform-admin-only — no RLS for owner reads;
-- edge functions read via service role. Admins manage via the admin dashboard.
-- Seed the initial flags used by Ricky OS:
insert into feature_flags (flag_key, description, stage) values
  ('ricky_reception',   'AI phone reception via Twilio + OpenAI Realtime', 'internal'),
  ('ricky_email',       'Full email campaign + lifecycle engine', 'beta'),
  ('growth_lab',        'Controlled A/B experiment engine', 'beta'),
  ('growth_genome',     'Privacy-safe cross-business network evidence', 'internal'),
  ('profit_yield',      'Deterministic profit yield optimization', 'beta'),
  ('easystart_v2',      'Guided EasyStart onboarding wizard', 'ga'),
  ('ricky_chat_action', 'Ricky Chat → structured action execution', 'beta'),
  ('website_research',  'Automated website knowledge extraction', 'ga')
on conflict (flag_key) do nothing;

create or replace function touch_feature_flag_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_feature_flag_updated_at
  before update on feature_flags
  for each row execute function touch_feature_flag_updated_at();
