-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  plan          text not null default 'free',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ============================================================
-- PROFILES (one per auth.users row)
-- ============================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name    text,
  role            text not null default 'member', -- owner | admin | member
  terms_accepted  boolean not null default false,
  terms_accepted_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "profiles: self read"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id);

-- Org admins/owners can read all members
create policy "profiles: org read"
  on public.profiles for select
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'owner')
    )
  );

-- ============================================================
-- VERIFICATION CASES
-- ============================================================
create table public.verification_cases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  title           text not null,
  input_type      text not null check (input_type in ('text', 'url', 'doi_list', 'file_upload')),
  raw_input       text,
  source_url      text,
  file_path       text,
  status          text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  pipeline_stage  text,
  domain          text,
  stakes_level    text check (stakes_level in ('low', 'medium', 'high')),
  materiality     text check (materiality in ('low', 'medium', 'high')),
  public_verdict  text check (public_verdict in (
    'VERIFIED_ENOUGH_TO_ACT','PARTIALLY_SUPPORTED','MIXED_OR_UNCERTAIN',
    'UNVERIFIABLE','CONTRADICTED','REQUIRES_QUALIFIED_REVIEW'
  )),
  score           integer check (score between 0 and 100),
  score_version   text,
  user_context    jsonb not null default '{}',
  error_message   text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.verification_cases enable row level security;

create index verification_cases_org_idx on public.verification_cases(organization_id);
create index verification_cases_status_idx on public.verification_cases(status);
create index verification_cases_created_at_idx on public.verification_cases(created_at desc);

create policy "cases: org members read"
  on public.verification_cases for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "cases: org members insert"
  on public.verification_cases for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and created_by = auth.uid()
  );

create policy "cases: org members update own"
  on public.verification_cases for update
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- EXTRACTED CLAIMS
-- ============================================================
create table public.extracted_claims (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.verification_cases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claim_text      text not null,
  claim_type      text not null,
  is_verifiable   boolean not null default true,
  confidence      numeric(4,3) check (confidence between 0 and 1),
  source_location jsonb,
  extraction_model text,
  prompt_version  text,
  created_at      timestamptz not null default now()
);

alter table public.extracted_claims enable row level security;

create index extracted_claims_case_idx on public.extracted_claims(case_id);

create policy "claims: org members read"
  on public.extracted_claims for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "claims: org members insert"
  on public.extracted_claims for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- EVIDENCE SOURCES
-- ============================================================
create table public.evidence_sources (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.verification_cases(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  source_type         text not null check (source_type in ('doi', 'url', 'upload')),
  raw_identifier      text not null,
  normalized_identifier text,
  title               text,
  authors             text[],
  published_at        date,
  journal             text,
  source_tier         integer check (source_tier between 1 and 5),
  identity_status     text check (identity_status in ('verified', 'metadata_only', 'unresolved', 'not_found', 'invalid')),
  doi_status          text check (doi_status in (
    'valid_found','valid_not_found','invalid_format','network_error',
    'crossref_found','datacite_found','retracted','corrected',
    'metadata_mismatch','unknown'
  )),
  retraction_status   text check (retraction_status in ('current', 'retracted', 'corrected', 'unknown')),
  is_accessible       boolean not null default false,
  fetch_error         text,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

alter table public.evidence_sources enable row level security;

create index evidence_sources_case_idx on public.evidence_sources(case_id);

create policy "sources: org members read"
  on public.evidence_sources for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "sources: org members insert"
  on public.evidence_sources for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- EVIDENCE MATCHES (claim ↔ source)
-- ============================================================
create table public.evidence_matches (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references public.verification_cases(id) on delete cascade,
  claim_id            uuid not null references public.extracted_claims(id) on delete cascade,
  source_id           uuid not null references public.evidence_sources(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  relationship        text not null check (relationship in ('supports','partially_supports','contradicts','context_only','not_relevant')),
  entailment_score    numeric(5,4) check (entailment_score between 0 and 1),
  passage_text        text,
  passage_locator     jsonb,
  reasoning           jsonb,
  match_model         text,
  prompt_version      text,
  created_at          timestamptz not null default now()
);

alter table public.evidence_matches enable row level security;

create index evidence_matches_case_idx on public.evidence_matches(case_id);
create index evidence_matches_claim_idx on public.evidence_matches(claim_id);

create policy "matches: org members read"
  on public.evidence_matches for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "matches: org members insert"
  on public.evidence_matches for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- PROSECUTOR REVIEWS
-- ============================================================
create table public.prosecutor_reviews (
  id                      uuid primary key default gen_random_uuid(),
  case_id                 uuid not null references public.verification_cases(id) on delete cascade,
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  objections              jsonb not null default '[]',
  recommendation          text not null check (recommendation in (
    'proceed','proceed_with_caution','require_qualified_review','do_not_verify'
  )),
  single_provider_warning boolean not null default false,
  reasoning               text,
  model                   text,
  prompt_version          text,
  created_at              timestamptz not null default now()
);

alter table public.prosecutor_reviews enable row level security;

create index prosecutor_reviews_case_idx on public.prosecutor_reviews(case_id);

create policy "prosecutor: org members read"
  on public.prosecutor_reviews for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "prosecutor: org members insert"
  on public.prosecutor_reviews for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- SCORING RESULTS
-- ============================================================
create table public.scoring_results (
  id                      uuid primary key default gen_random_uuid(),
  case_id                 uuid not null references public.verification_cases(id) on delete cascade,
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  score_version           text not null,
  components              jsonb not null,
  policy_overrides        jsonb not null default '[]',
  verdict                 text not null check (verdict in (
    'VERIFIED_ENOUGH_TO_ACT','PARTIALLY_SUPPORTED','MIXED_OR_UNCERTAIN',
    'UNVERIFIABLE','CONTRADICTED','REQUIRES_QUALIFIED_REVIEW'
  )),
  explanation             jsonb not null,
  stakes_level            text check (stakes_level in ('low','medium','high')),
  materiality             text check (materiality in ('low','medium','high')),
  created_at              timestamptz not null default now()
);

alter table public.scoring_results enable row level security;

create index scoring_results_case_idx on public.scoring_results(case_id);

create policy "scoring: org members read"
  on public.scoring_results for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "scoring: org members insert"
  on public.scoring_results for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICATION REPORTS
-- ============================================================
create table public.verification_reports (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.verification_cases(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_type     text not null default 'full',
  content         jsonb not null,
  apa_references  text[],
  created_at      timestamptz not null default now()
);

alter table public.verification_reports enable row level security;

create index verification_reports_case_idx on public.verification_reports(case_id);

create policy "reports: org members read"
  on public.verification_reports for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "reports: org members insert"
  on public.verification_reports for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICATION JOBS (pipeline queue)
-- ============================================================
create table public.verification_jobs (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.verification_cases(id) on delete cascade,
  job_type    text not null default 'full_pipeline',
  status      text not null default 'queued'
    check (status in ('queued','running','completed','failed','cancelled')),
  payload     jsonb not null default '{}',
  result      jsonb,
  attempts    integer not null default 0,
  max_attempts integer not null default 3,
  error_message text,
  run_after   timestamptz not null default now(),
  started_at  timestamptz,
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.verification_jobs enable row level security;

create index verification_jobs_status_idx on public.verification_jobs(status, run_after);
create index verification_jobs_case_idx on public.verification_jobs(case_id);

-- Jobs are internal — only service role accesses directly.
-- App layer uses cases API to observe status.
create policy "jobs: no direct user access"
  on public.verification_jobs for select
  using (false);

-- ============================================================
-- AUDIT EVENTS
-- ============================================================
create table public.audit_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id        uuid references auth.users(id),
  case_id         uuid references public.verification_cases(id) on delete set null,
  event_type      text not null,
  event_data      jsonb not null default '{}',
  ip_address      inet,
  created_at      timestamptz not null default now()
);

alter table public.audit_events enable row level security;

create index audit_events_org_idx on public.audit_events(organization_id, created_at desc);
create index audit_events_case_idx on public.audit_events(case_id);

create policy "audit: org admins read"
  on public.audit_events for select
  using (
    organization_id in (
      select organization_id from public.profiles
      where id = auth.uid() and role in ('admin','owner')
    )
  );

create policy "audit: insert allowed"
  on public.audit_events for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- COMMITMENTS
-- ============================================================
create table public.commitments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by      uuid not null references auth.users(id),
  title           text not null,
  description     text,
  commitment_text text not null,
  source_url      text,
  committed_at    date,
  committer_name  text,
  committer_role  text,
  status          text not null default 'active'
    check (status in ('active', 'fulfilled', 'expired', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.commitments enable row level security;

create index commitments_org_idx on public.commitments(organization_id);

create policy "commitments: org members read"
  on public.commitments for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "commitments: org members insert"
  on public.commitments for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and created_by = auth.uid()
  );

create policy "commitments: org members update"
  on public.commitments for update
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- ============================================================
-- COMMITMENT EVALUATIONS
-- ============================================================
create table public.commitment_evaluations (
  id                  uuid primary key default gen_random_uuid(),
  commitment_id       uuid not null references public.commitments(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  evaluated_by        uuid not null references auth.users(id),
  evidence_text       text not null,
  verdict             text not null check (verdict in (
    'CONSISTENT','PARTIALLY_CONSISTENT','CONTRADICTED','NOT_EVALUABLE'
  )),
  reasoning           text not null,
  model               text,
  prompt_version      text,
  created_at          timestamptz not null default now()
);

alter table public.commitment_evaluations enable row level security;

create index commitment_evaluations_commitment_idx on public.commitment_evaluations(commitment_id);

create policy "evaluations: org members read"
  on public.commitment_evaluations for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy "evaluations: org members insert"
  on public.commitment_evaluations for insert
  with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and evaluated_by = auth.uid()
  );

-- ============================================================
-- BENCHMARK RUNS
-- ============================================================
create table public.benchmark_runs (
  id              uuid primary key default gen_random_uuid(),
  run_by          uuid references auth.users(id),
  score_version   text not null,
  total_fixtures  integer not null,
  passed          integer not null default 0,
  failed          integer not null default 0,
  gate_results    jsonb not null default '{}',
  all_gates_pass  boolean not null default false,
  details         jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

alter table public.benchmark_runs enable row level security;

create policy "benchmarks: admin read"
  on public.benchmark_runs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','owner')
    )
  );

create policy "benchmarks: admin insert"
  on public.benchmark_runs for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','owner')
    )
  );

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger verification_cases_touch_updated_at
  before update on public.verification_cases
  for each row execute function public.touch_updated_at();

create trigger commitments_touch_updated_at
  before update on public.commitments
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  -- Create a personal organization for the user
  insert into public.organizations (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'My Org'),
    lower(regexp_replace(
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'org'),
      '[^a-z0-9]+', '-', 'g'
    )) || '-' || substr(new.id::text, 1, 8)
  )
  returning id into v_org_id;

  -- Create profile
  insert into public.profiles (id, organization_id, display_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
