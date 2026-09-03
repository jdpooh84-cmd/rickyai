-- Agent manifest: defines each agent, its authority ceiling, and its KPIs
create table if not exists agent_manifest (
  id uuid primary key default gen_random_uuid(),
  agent_key text unique not null,  -- e.g. 'workflow_diagnosis', 'growth_scout', 'yield_optimizer'
  display_name text not null,
  description text,
  authority_ceiling int default 2 check (authority_ceiling between 0 and 4),
  tools_allowed text[] default '{}',
  kpi_metric text,
  active boolean default true,
  created_at timestamptz default now()
);
-- no RLS on agent_manifest — it is platform config, not tenant data
alter table agent_manifest enable row level security;
create policy "agent_manifest_public_read" on agent_manifest for select using (true);

-- Orchestrator projects: goals decomposed by the AI COO
create table if not exists orchestrator_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  title text not null,
  goal text not null,
  status text default 'active' check (status in ('active','paused','completed','cancelled')),
  priority int default 5 check (priority between 1 and 10),
  owner_agent text,  -- agent_manifest.agent_key of the responsible agent
  due_at timestamptz,
  completed_at timestamptz,
  executive_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table orchestrator_projects enable row level security;
create policy "owner_orchestrator_projects" on orchestrator_projects for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

-- Orchestrator tasks: individual work units within a project
create table if not exists orchestrator_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references orchestrator_projects(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade not null,
  agent_key text not null,
  title text not null,
  description text,
  authority_level int default 0 check (authority_level between 0 and 4),
  status text default 'pending' check (status in ('pending','running','completed','blocked','failed','awaiting_approval')),
  input_context jsonb default '{}',
  output_result jsonb,
  approval_id uuid references approvals(id) on delete set null,
  agent_job_id uuid references agent_jobs(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
alter table orchestrator_tasks enable row level security;
create policy "owner_orchestrator_tasks" on orchestrator_tasks for all using (
  business_id in (select id from businesses where user_id = auth.uid())
);

-- Seed agent manifest with the specialist agents Ricky already has
insert into agent_manifest (agent_key, display_name, description, authority_ceiling, tools_allowed, kpi_metric) values
  ('workflow_diagnosis', 'Workflow Diagnosis', 'Analyzes business workflows and surfaces automation opportunities with ROI estimates', 1, '{"business_knowledge","contacts","lifecycle_automations"}', 'opportunities identified, estimated hours saved'),
  ('growth_scout', 'Growth Scout', 'Researches market position, competitors, and growth opportunities', 1, '{"strategy_outputs","ai-strategy"}', 'opportunities per scan, decision usefulness'),
  ('yield_optimizer', 'Profit Yield Optimizer', 'Optimizes service mix and capacity allocation for maximum contribution', 2, '{"service_economics","resource_capacity","yield-engine"}', 'expected contribution increase'),
  ('engagement_sender', 'Engagement Sender', 'Sends approved lifecycle messages and appointment reminders', 3, '{"send-message","messages","contacts"}', 'sent rate, reply rate, consent compliance'),
  ('appointment_manager', 'Appointment Manager', 'Books, confirms, and manages appointment calendar', 2, '{"book-appointment","appointments","contacts"}', 'booking conversion, no-show rate'),
  ('campaign_launcher', 'Campaign Launcher', 'Executes approved campaign plans across channels', 3, '{"campaign_executions","send-message"}', 'leads generated, cost per lead'),
  ('reputation_manager', 'Reputation Manager', 'Sends review requests and manages referral workflows', 3, '{"review_requests","track-referral","send-message"}', 'reviews collected, referrals generated'),
  ('qa_reviewer', 'QA Reviewer', 'Reviews outputs from other agents before release or send', 1, '{}', 'defects caught, review turnaround'),
  ('ricky_coo', 'Ricky COO', 'Orchestrates all agents, decomposes goals, issues decision packets', 2, '{"all"}', 'projects on-time, blockers resolved, weekly brief quality')
on conflict (agent_key) do nothing;
