-- =============================================================================
-- Agent Workforce Schema — Platform Registry + Runtime Tables
-- Additive migration: existing agent_manifest, orchestrator_projects/tasks,
-- approvals, and agent_jobs tables are left untouched.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------------
create table if not exists agent_departments (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  display_name text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table agent_departments enable row level security;
create policy "agent_departments_public_read" on agent_departments for select using (true);

-- ---------------------------------------------------------------------------
-- AGENT DEFINITIONS
-- ---------------------------------------------------------------------------
create table if not exists agent_definitions (
  id                            uuid primary key default gen_random_uuid(),
  slug                          text unique not null,
  display_name                  text not null,
  description                   text,
  department_id                 uuid references agent_departments(id) on delete set null,
  parent_slug                   text references agent_definitions(slug) on delete set null,
  role_type                     text not null check (role_type in ('orchestrator','manager','specialist')),
  lifecycle_status              text not null default 'active' check (lifecycle_status in ('draft','active','deprecated','disabled')),
  semantic_version              text not null default '1.0.0',
  prompt_template_ref           text,
  input_schema                  jsonb default '{}',
  output_schema                 jsonb default '{}',
  default_requires_human_approval boolean not null default false,
  concurrency_limit             int not null default 5,
  timeout_seconds               int not null default 300,
  retry_max                     int not null default 3,
  required_plan                 text,
  required_addon                text,
  active                        boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
alter table agent_definitions enable row level security;
create policy "agent_definitions_public_read" on agent_definitions for select using (true);

create trigger agent_definitions_updated_at
  before update on agent_definitions
  for each row execute function moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- CAPABILITIES
-- ---------------------------------------------------------------------------
create table if not exists agent_capabilities (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  description  text,
  category     text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table agent_capabilities enable row level security;
create policy "agent_capabilities_public_read" on agent_capabilities for select using (true);

create table if not exists agent_definition_capabilities (
  agent_slug      text not null references agent_definitions(slug) on delete cascade,
  capability_slug text not null references agent_capabilities(slug) on delete cascade,
  primary key (agent_slug, capability_slug)
);
alter table agent_definition_capabilities enable row level security;
create policy "agent_def_caps_public_read" on agent_definition_capabilities for select using (true);

-- ---------------------------------------------------------------------------
-- TOOL DEFINITIONS AND GRANTS
-- ---------------------------------------------------------------------------
create table if not exists agent_tool_definitions (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  description  text,
  provider     text,
  action_type  text,
  is_read_only boolean not null default false,
  risk_level   text not null default 'low' check (risk_level in ('low','medium','high','critical')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table agent_tool_definitions enable row level security;
create policy "agent_tool_defs_public_read" on agent_tool_definitions for select using (true);

create table if not exists agent_tool_grants (
  id              uuid primary key default gen_random_uuid(),
  agent_slug      text not null references agent_definitions(slug) on delete cascade,
  tool_slug       text not null references agent_tool_definitions(slug) on delete cascade,
  action_scope    jsonb not null default '{}',
  constraints     jsonb not null default '{}',
  approval_policy text not null default 'none' check (approval_policy in ('none','always','high_risk')),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (agent_slug, tool_slug)
);
alter table agent_tool_grants enable row level security;
create policy "agent_tool_grants_public_read" on agent_tool_grants for select using (true);

-- ---------------------------------------------------------------------------
-- DELEGATION POLICIES
-- ---------------------------------------------------------------------------
create table if not exists agent_delegation_policies (
  id                       uuid primary key default gen_random_uuid(),
  manager_slug             text not null references agent_definitions(slug) on delete cascade,
  subordinate_slug         text not null references agent_definitions(slug) on delete cascade,
  permitted_task_categories text[] not null default '{}',
  capability_limits        jsonb not null default '{}',
  max_depth                int not null default 3,
  requires_approval        boolean not null default false,
  priority_constraint      int,
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  constraint no_self_delegation check (manager_slug <> subordinate_slug),
  unique (manager_slug, subordinate_slug)
);
alter table agent_delegation_policies enable row level security;
create policy "delegation_policies_public_read" on agent_delegation_policies for select using (true);

-- ---------------------------------------------------------------------------
-- HANDOFF CONTRACTS
-- ---------------------------------------------------------------------------
create table if not exists agent_handoff_contracts (
  id                      uuid primary key default gen_random_uuid(),
  source_slug             text not null references agent_definitions(slug) on delete cascade,
  destination_slug        text not null references agent_definitions(slug) on delete cascade,
  task_category           text not null,
  required_input_schema   jsonb not null default '{}',
  output_schema           jsonb not null default '{}',
  required_context_keys   text[] not null default '{}',
  required_artifact_types text[] not null default '{}',
  requires_approval       boolean not null default false,
  rejection_policy        text not null default 'escalate' check (rejection_policy in ('escalate','retry','fail','notify')),
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  unique (source_slug, destination_slug, task_category)
);
alter table agent_handoff_contracts enable row level security;
create policy "handoff_contracts_public_read" on agent_handoff_contracts for select using (true);

-- ---------------------------------------------------------------------------
-- ESCALATION POLICIES
-- ---------------------------------------------------------------------------
create table if not exists agent_escalation_policies (
  id                uuid primary key default gen_random_uuid(),
  originating_slug  text references agent_definitions(slug) on delete cascade,
  department_id     uuid references agent_departments(id) on delete cascade,
  trigger_type      text not null,
  severity          text not null default 'medium' check (severity in ('low','medium','high','critical')),
  destination_slug  text not null references agent_definitions(slug) on delete cascade,
  required_context  jsonb not null default '{}',
  customer_notify   boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint escalation_origin_check check (originating_slug is not null or department_id is not null)
);
alter table agent_escalation_policies enable row level security;
create policy "escalation_policies_public_read" on agent_escalation_policies for select using (true);

-- ---------------------------------------------------------------------------
-- POLICY VERSIONS (audit trail for registry changes)
-- ---------------------------------------------------------------------------
create table if not exists agent_policy_versions (
  id           uuid primary key default gen_random_uuid(),
  table_name   text not null,
  record_id    uuid not null,
  version      int not null default 1,
  snapshot     jsonb not null,
  changed_by   uuid,
  changed_at   timestamptz not null default now()
);
alter table agent_policy_versions enable row level security;
create policy "policy_versions_admin_only" on agent_policy_versions for select
  using (exists (select 1 from profiles where user_id = auth.uid() and is_admin = true));

-- ---------------------------------------------------------------------------
-- RUNTIME: WORKFLOWS
-- ---------------------------------------------------------------------------
create table if not exists agent_workflows (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  user_id               uuid not null references profiles(user_id) on delete cascade,
  title                 text not null,
  goal                  text not null,
  status                text not null default 'draft' check (status in (
    'draft','queued','running','awaiting_customer_input','awaiting_approval',
    'blocked','completed','failed','cancelled'
  )),
  initiating_agent_slug text references agent_definitions(slug) on delete set null,
  correlation_id        text,
  idempotency_key       text,
  priority              int not null default 5 check (priority between 1 and 10),
  metadata              jsonb not null default '{}',
  started_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique nulls not distinct (business_id, idempotency_key)
);
alter table agent_workflows enable row level security;
create policy "agent_workflows_owner" on agent_workflows for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create trigger agent_workflows_updated_at
  before update on agent_workflows
  for each row execute function moddatetime(updated_at);
create index if not exists agent_workflows_business_status on agent_workflows(business_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RUNTIME: TASKS
-- ---------------------------------------------------------------------------
create table if not exists agent_tasks (
  id                   uuid primary key default gen_random_uuid(),
  workflow_id          uuid not null references agent_workflows(id) on delete cascade,
  business_id          uuid not null references businesses(id) on delete cascade,
  parent_task_id       uuid references agent_tasks(id) on delete set null,
  assigned_agent_slug  text references agent_definitions(slug) on delete set null,
  delegation_policy_id uuid references agent_delegation_policies(id) on delete set null,
  title                text not null,
  task_category        text,
  status               text not null default 'created' check (status in (
    'created','queued','claimed','running','awaiting_handoff_acceptance',
    'awaiting_approval','retry_scheduled','blocked','completed','failed','cancelled','expired'
  )),
  input_context        jsonb not null default '{}',
  output_result        jsonb,
  retry_count          int not null default 0,
  lease_expires_at     timestamptz,
  correlation_id       text,
  idempotency_key      text,
  error_code           text,
  error_message        text,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique nulls not distinct (workflow_id, idempotency_key)
);
alter table agent_tasks enable row level security;
create policy "agent_tasks_owner" on agent_tasks for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create trigger agent_tasks_updated_at
  before update on agent_tasks
  for each row execute function moddatetime(updated_at);
create index if not exists agent_tasks_workflow on agent_tasks(workflow_id, status);
create index if not exists agent_tasks_business_status on agent_tasks(business_id, status, created_at desc);
create index if not exists agent_tasks_agent_slug on agent_tasks(assigned_agent_slug, status);

-- ---------------------------------------------------------------------------
-- RUNTIME: HANDOFFS
-- ---------------------------------------------------------------------------
create table if not exists agent_handoffs (
  id                   uuid primary key default gen_random_uuid(),
  source_task_id       uuid not null references agent_tasks(id) on delete cascade,
  destination_task_id  uuid references agent_tasks(id) on delete set null,
  contract_id          uuid references agent_handoff_contracts(id) on delete set null,
  task_category        text not null,
  input_payload        jsonb not null default '{}',
  output_payload       jsonb,
  status               text not null default 'proposed' check (status in (
    'proposed','accepted','rejected','completed','failed','cancelled'
  )),
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
alter table agent_handoffs enable row level security;
create policy "agent_handoffs_owner" on agent_handoffs for all using (
  source_task_id in (
    select id from agent_tasks where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  )
);
create trigger agent_handoffs_updated_at
  before update on agent_handoffs
  for each row execute function moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RUNTIME: ESCALATIONS
-- ---------------------------------------------------------------------------
create table if not exists agent_escalations (
  id               uuid primary key default gen_random_uuid(),
  workflow_id      uuid not null references agent_workflows(id) on delete cascade,
  task_id          uuid references agent_tasks(id) on delete set null,
  business_id      uuid not null references businesses(id) on delete cascade,
  originating_slug text references agent_definitions(slug) on delete set null,
  policy_id        uuid references agent_escalation_policies(id) on delete set null,
  trigger_type     text not null,
  severity         text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status           text not null default 'open' check (status in ('open','acknowledged','resolved','dismissed')),
  context          jsonb not null default '{}',
  resolved_at      timestamptz,
  resolved_by      uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table agent_escalations enable row level security;
create policy "agent_escalations_owner" on agent_escalations for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create trigger agent_escalations_updated_at
  before update on agent_escalations
  for each row execute function moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- RUNTIME: APPROVALS (workforce-scoped — extends existing approvals table pattern)
-- ---------------------------------------------------------------------------
create table if not exists agent_approvals (
  id               uuid primary key default gen_random_uuid(),
  workflow_id      uuid not null references agent_workflows(id) on delete cascade,
  task_id          uuid references agent_tasks(id) on delete set null,
  business_id      uuid not null references businesses(id) on delete cascade,
  action_type      text not null,
  risk_level       text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  human_summary    text,
  requested_payload jsonb not null default '{}',
  status           text not null default 'pending' check (status in (
    'pending','approved','rejected','expired','cancelled'
  )),
  expires_at       timestamptz,
  resolved_at      timestamptz,
  resolved_by      uuid references profiles(user_id) on delete set null,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique nulls not distinct (workflow_id, idempotency_key)
);
alter table agent_approvals enable row level security;
create policy "agent_approvals_owner" on agent_approvals for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create trigger agent_approvals_updated_at
  before update on agent_approvals
  for each row execute function moddatetime(updated_at);
create index if not exists agent_approvals_business_status on agent_approvals(business_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RUNTIME: EXECUTION EVENTS (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists agent_execution_events (
  id             uuid primary key default gen_random_uuid(),
  workflow_id    uuid not null references agent_workflows(id) on delete cascade,
  task_id        uuid references agent_tasks(id) on delete set null,
  business_id    uuid not null references businesses(id) on delete cascade,
  agent_slug     text,
  event_type     text not null,
  payload        jsonb not null default '{}',
  correlation_id text,
  created_at     timestamptz not null default now()
);
alter table agent_execution_events enable row level security;
create policy "agent_execution_events_owner" on agent_execution_events for select using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create policy "agent_execution_events_service_insert" on agent_execution_events for insert
  with check (true);
create index if not exists agent_exec_events_workflow on agent_execution_events(workflow_id, created_at desc);
create index if not exists agent_exec_events_task on agent_execution_events(task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RUNTIME: TOOL INVOCATIONS (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists agent_tool_invocations (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid references agent_tasks(id) on delete cascade,
  business_id     uuid not null references businesses(id) on delete cascade,
  agent_slug      text,
  tool_slug       text,
  grant_id        uuid references agent_tool_grants(id) on delete set null,
  input_redacted  jsonb not null default '{}',
  output_redacted jsonb not null default '{}',
  success         boolean not null default false,
  error_code      text,
  duration_ms     int,
  created_at      timestamptz not null default now()
);
alter table agent_tool_invocations enable row level security;
create policy "agent_tool_invocations_owner" on agent_tool_invocations for select using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create policy "agent_tool_invocations_service_insert" on agent_tool_invocations for insert
  with check (true);
create index if not exists agent_tool_inv_task on agent_tool_invocations(task_id, created_at desc);
create index if not exists agent_tool_inv_business on agent_tool_invocations(business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- PERFORMANCE ROLLUPS
-- ---------------------------------------------------------------------------
create table if not exists agent_performance_rollups (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references businesses(id) on delete cascade,
  period_start     timestamptz not null,
  period_end       timestamptz not null,
  agent_slug       text,
  total_tasks      int not null default 0,
  completed_tasks  int not null default 0,
  failed_tasks     int not null default 0,
  cancelled_tasks  int not null default 0,
  avg_duration_ms  int,
  escalation_count int not null default 0,
  approval_count   int not null default 0,
  approval_turnaround_avg_ms int,
  created_at       timestamptz not null default now(),
  unique (business_id, period_start, period_end, agent_slug)
);
alter table agent_performance_rollups enable row level security;
create policy "agent_perf_rollups_owner" on agent_performance_rollups for select using (
  business_id in (select id from businesses where user_id = auth.uid())
);
create policy "agent_perf_rollups_service_insert" on agent_performance_rollups for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- HELPER: expire pending approvals via callable function
-- ---------------------------------------------------------------------------
create or replace function expire_agent_approvals()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  update agent_approvals
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and expires_at is not null
    and expires_at < now();
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
