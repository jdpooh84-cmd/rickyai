# Ricky AI — Commercial Agent Workforce: Master Build Document

**Version:** 1.0.0
**Date:** 2026-09-04
**Status:** Active Specification

---

## 1. Purpose and Scope

Build a Commercial Agent Workforce as a first-class orchestration layer integrated into Ricky AI's existing multi-tenant SaaS platform. This is not a prototype — it is a production system with full enforcement of entitlements, delegation policies, handoff contracts, tool grants, escalation rules, and audit trails.

The system must coexist with all existing contracts: routes, auth, billing, database schemas, edge functions, and UI flows are preserved unless explicitly extended by this specification.

---

## 2. Architectural Principles

- **Single entry point**: All work enters through `chief_orchestrator`. No lateral or external invocations bypass it.
- **Explicit delegation only**: A manager may delegate to a specialist only when an active `agent_delegation_policies` row permits it.
- **Explicit tool grants only**: An agent may invoke a tool only when an active `agent_tool_grants` row exists.
- **Handoff contracts**: Agents exchange work only when an active `agent_handoff_contracts` row exists and the payload validates.
- **LLM outputs are never authorization**: No instruction embedded in LLM output may override server-side policy enforcement.
- **Business ownership at every boundary**: Every public edge function entry point validates that the requesting user owns the referenced business.
- **RLS always on**: Tenant runtime tables carry Row Level Security. Platform config tables are admin-write only.
- **Additive schema only**: New tables are added alongside existing ones. Existing tables (`agent_manifest`, `orchestrator_projects`, `orchestrator_tasks`, `approvals`, `agent_jobs`) are not modified.
- **npm: specifiers only**: All Deno edge function imports use `npm:` specifiers. `esm.sh` is prohibited.
- **No service-role key in browser**: Service-role credentials are used only in edge functions.

---

## 3. Stack Constraints (Preserved)

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| State | TanStack Query + React Router v6 |
| Backend | Supabase: Postgres + Auth + Storage + Edge Functions (Deno) |
| Billing | Stripe (canonical IDs in `src/lib/stripe.ts`) |
| Deployment | Vercel (frontend), Supabase (edge functions + DB) |
| TypeScript | Strict mode OFF (existing project setting) |

---

## 4. Agent Hierarchy

### Hierarchy Overview

```
chief_orchestrator
├── growth_strategy_manager
│   ├── market_research_specialist
│   ├── competitor_intelligence_specialist
│   ├── brand_strategy_specialist
│   ├── web_presence_audit_specialist
│   └── campaign_strategy_specialist
├── content_studio_manager
│   ├── content_planning_specialist
│   ├── copywriting_specialist
│   ├── scriptwriting_specialist
│   ├── creative_quality_specialist
│   └── seo_local_discovery_specialist
├── video_production_manager
│   ├── video_plan_specialist
│   ├── voiceover_specialist
│   ├── broll_asset_specialist
│   ├── video_render_specialist
│   └── video_quality_specialist
├── distribution_manager
│   ├── channel_strategy_specialist
│   ├── publishing_readiness_specialist
│   ├── performance_analytics_specialist
│   └── optimization_specialist
├── opportunity_intelligence_manager
│   ├── federal_contracting_specialist   [requires: federal_contracting add-on]
│   ├── grant_intelligence_specialist    [requires: grant_intelligence add-on]
│   └── opportunity_qualification_specialist
└── trust_operations_manager
    ├── workflow_quality_specialist
    ├── policy_compliance_specialist
    ├── customer_approval_specialist
    └── incident_triage_specialist
```

### Role Types

| role_type | Description |
|---|---|
| `orchestrator` | Top-level entry point. Delegates to managers. Never calls tools directly. |
| `manager` | Owns a department. Delegates to specialists. May coordinate cross-department via handoffs. |
| `specialist` | Executes work. Calls tools. Cannot delegate further. |

---

## 5. Database Schema

### 5.1 Platform Configuration Tables (Admin-write, no customer RLS write)

#### `agent_departments`
```sql
id              uuid primary key default gen_random_uuid()
slug            text unique not null
display_name    text not null
description     text
icon            text
active          bool not null default true
created_at      timestamptz not null default now()
```

#### `agent_definitions`
```sql
id                             uuid primary key default gen_random_uuid()
slug                           text unique not null
display_name                   text not null
department_id                  uuid references agent_departments(id)
parent_slug                    text references agent_definitions(slug)
role_type                      text not null check (role_type in ('orchestrator','manager','specialist'))
lifecycle_status               text not null default 'stable' check (lifecycle_status in ('alpha','beta','stable','deprecated','retired'))
semantic_version               text not null default '1.0.0'
description                    text
input_schema                   jsonb not null default '{}'
output_schema                  jsonb not null default '{}'
default_requires_human_approval bool not null default false
concurrency_limit              int not null default 1
timeout_seconds                int not null default 300
retry_max                      int not null default 2
required_plan                  text
required_addon                 text
active                         bool not null default true
created_at                     timestamptz not null default now()
updated_at                     timestamptz not null default now()
```

#### `agent_capabilities`
```sql
id           uuid primary key default gen_random_uuid()
slug         text unique not null
display_name text not null
description  text
category     text
active       bool not null default true
```

#### `agent_definition_capabilities`
```sql
agent_slug      text not null references agent_definitions(slug)
capability_slug text not null references agent_capabilities(slug)
primary key (agent_slug, capability_slug)
```

#### `agent_tool_definitions`
```sql
id           uuid primary key default gen_random_uuid()
slug         text unique not null
display_name text not null
provider     text not null
action_type  text not null
is_read_only bool not null default false
risk_level   text not null default 'low' check (risk_level in ('low','medium','high'))
description  text
active       bool not null default true
created_at   timestamptz not null default now()
```

#### `agent_tool_grants`
```sql
id              uuid primary key default gen_random_uuid()
agent_slug      text not null references agent_definitions(slug)
tool_slug       text not null references agent_tool_definitions(slug)
action_scope    jsonb not null default '{}'
constraints     jsonb not null default '{}'
approval_policy text not null default 'none' check (approval_policy in ('none','always','risk_based'))
active          bool not null default true
created_at      timestamptz not null default now()
unique (agent_slug, tool_slug)
```

#### `agent_delegation_policies`
```sql
id                        uuid primary key default gen_random_uuid()
manager_slug              text not null references agent_definitions(slug)
subordinate_slug          text not null references agent_definitions(slug)
permitted_task_categories text[] not null default '{}'
capability_limits         jsonb not null default '{}'
max_depth                 int not null default 1
requires_approval         bool not null default false
active                    bool not null default true
created_at                timestamptz not null default now()
unique (manager_slug, subordinate_slug)
```

#### `agent_handoff_contracts`
```sql
id                      uuid primary key default gen_random_uuid()
source_slug             text not null references agent_definitions(slug)
destination_slug        text not null references agent_definitions(slug)
task_category           text not null
required_input_schema   jsonb not null default '{}'
output_schema           jsonb not null default '{}'
required_context_keys   text[] not null default '{}'
required_artifact_types text[] not null default '{}'
rejection_policy        text not null default 'fail' check (rejection_policy in ('fail','retry','escalate'))
active                  bool not null default true
created_at              timestamptz not null default now()
unique (source_slug, destination_slug, task_category)
```

#### `agent_escalation_policies`
```sql
id                uuid primary key default gen_random_uuid()
originating_slug  text not null references agent_definitions(slug)
trigger_type      text not null
severity          text not null check (severity in ('low','medium','high','critical'))
destination_slug  text not null references agent_definitions(slug)
customer_notify   bool not null default false
active            bool not null default true
created_at        timestamptz not null default now()
```

---

### 5.2 Runtime Tables (Tenant-scoped with RLS)

#### `agent_workflows`
```sql
id                    uuid primary key default gen_random_uuid()
business_id           uuid not null references businesses(id)
user_id               uuid not null references auth.users(id)
title                 text not null
goal                  text not null
status                text not null default 'draft'
                      check (status in ('draft','queued','running','awaiting_customer_input','awaiting_approval','blocked','completed','failed','cancelled'))
initiating_agent_slug text not null references agent_definitions(slug)
correlation_id        uuid not null default gen_random_uuid()
idempotency_key       text unique
priority              int not null default 5
started_at            timestamptz
completed_at          timestamptz
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

#### `agent_tasks`
```sql
id                    uuid primary key default gen_random_uuid()
workflow_id           uuid not null references agent_workflows(id)
business_id           uuid not null references businesses(id)
parent_task_id        uuid references agent_tasks(id)
assigned_agent_slug   text not null references agent_definitions(slug)
delegation_policy_id  uuid references agent_delegation_policies(id)
status                text not null default 'created'
                      check (status in ('created','queued','claimed','running','awaiting_handoff_acceptance','awaiting_approval','retry_scheduled','blocked','completed','failed','cancelled','expired'))
input_context         jsonb not null default '{}'
output_result         jsonb
retry_count           int not null default 0
lease_expires_at      timestamptz
correlation_id        uuid not null default gen_random_uuid()
idempotency_key       text
created_at            timestamptz not null default now()
updated_at            timestamptz not null default now()
```

#### `agent_handoffs`
```sql
id                  uuid primary key default gen_random_uuid()
source_task_id      uuid not null references agent_tasks(id)
destination_task_id uuid references agent_tasks(id)
contract_id         uuid not null references agent_handoff_contracts(id)
task_category       text not null
input_payload       jsonb not null default '{}'
output_payload      jsonb
status              text not null default 'proposed'
                    check (status in ('proposed','accepted','rejected','completed','failed','cancelled'))
rejection_reason    text
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
```

#### `agent_escalations`
```sql
id                uuid primary key default gen_random_uuid()
workflow_id       uuid not null references agent_workflows(id)
task_id           uuid references agent_tasks(id)
originating_slug  text not null references agent_definitions(slug)
policy_id         uuid references agent_escalation_policies(id)
trigger_type      text not null
severity          text not null check (severity in ('low','medium','high','critical'))
status            text not null default 'open'
                  check (status in ('open','acknowledged','resolved','dismissed'))
context           jsonb not null default '{}'
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

#### `agent_approvals`
```sql
id                uuid primary key default gen_random_uuid()
workflow_id       uuid not null references agent_workflows(id)
task_id           uuid references agent_tasks(id)
business_id       uuid not null references businesses(id)
action_type       text not null
risk_level        text not null check (risk_level in ('low','medium','high','critical'))
human_summary     text not null
requested_payload jsonb not null default '{}'
status            text not null default 'pending'
                  check (status in ('pending','approved','rejected','expired','cancelled'))
expires_at        timestamptz not null
resolved_at       timestamptz
resolved_by       uuid references auth.users(id)
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()
```

#### `agent_execution_events`
```sql
id             uuid primary key default gen_random_uuid()
workflow_id    uuid not null references agent_workflows(id)
task_id        uuid references agent_tasks(id)
agent_slug     text not null references agent_definitions(slug)
event_type     text not null
payload        jsonb not null default '{}'
correlation_id uuid not null
created_at     timestamptz not null default now()
```

#### `agent_tool_invocations`
```sql
id              uuid primary key default gen_random_uuid()
task_id         uuid not null references agent_tasks(id)
agent_slug      text not null references agent_definitions(slug)
tool_slug       text not null references agent_tool_definitions(slug)
grant_id        uuid not null references agent_tool_grants(id)
input_redacted  jsonb not null default '{}'
output_redacted jsonb
success         bool not null
error_code      text
duration_ms     int
created_at      timestamptz not null default now()
```

#### `agent_performance_rollups`
```sql
id               uuid primary key default gen_random_uuid()
business_id      uuid not null references businesses(id)
period_start     timestamptz not null
period_end       timestamptz not null
agent_slug       text not null references agent_definitions(slug)
total_tasks      int not null default 0
completed_tasks  int not null default 0
failed_tasks     int not null default 0
avg_duration_ms  int
escalation_count int not null default 0
approval_count   int not null default 0
created_at       timestamptz not null default now()
unique (business_id, agent_slug, period_start, period_end)
```

---

## 6. State Machines

### 6.1 Workflow States

```
draft
  └─[queue]──► queued
                 └─[claim]──► running
                               ├─[needs_input]──► awaiting_customer_input ─► running
                               ├─[needs_approval]──► awaiting_approval ─► running
                               ├─[blocked]──► blocked ─► running
                               ├─[done]──► completed
                               ├─[error]──► failed
                               └─[cancel]──► cancelled
```

### 6.2 Task States

```
created
  └─[enqueue]──► queued
                   └─[claim]──► claimed
                                  └─[start]──► running
                                               ├─[handoff]──► awaiting_handoff_acceptance ─► running
                                               ├─[approval]──► awaiting_approval ─► running
                                               ├─[retry_sched]──► retry_scheduled ─► queued
                                               ├─[block]──► blocked ─► running
                                               ├─[done]──► completed
                                               ├─[error]──► failed
                                               ├─[cancel]──► cancelled
                                               └─[ttl]──► expired
```

---

## 7. Enforcement Rules

### 7.1 Delegation Enforcement (enforced in `validateDelegation`)

1. A delegation policy row `(manager_slug, subordinate_slug)` must exist and be `active = true`.
2. The requested `task_category` must appear in `permitted_task_categories[]`.
3. The delegation chain depth from the original workflow entry must not exceed `max_depth`.
4. No delegation cycle: an agent slug must not appear twice in the current delegation chain.
5. Sideways delegation (specialist → specialist) is forbidden unless an explicit policy exists.
6. Upward delegation (specialist → manager) is forbidden unless an explicit policy exists.

### 7.2 Handoff Enforcement (enforced in `validateHandoff`)

7. A handoff contract row `(source_slug, destination_slug, task_category)` must exist and be `active = true`.
8. The `input_payload` must contain every key listed in `required_context_keys`.
9. All artifact types listed in `required_artifact_types` must be present in the payload.
10. Payload must pass JSON Schema validation against `required_input_schema`.

### 7.3 Tool Call Enforcement (enforced in `validateToolGrant`)

11. A tool grant row `(agent_slug, tool_slug)` must exist and be `active = true`.
12. If `approval_policy = 'always'`, a resolved `agent_approvals` row must exist for this invocation.
13. If `approval_policy = 'risk_based'` and tool `risk_level` is `high`, approval is required.

### 7.4 Entitlement Enforcement (enforced at task creation AND before protected execution)

14. If `agent_definitions.required_plan` is set, the business's active plan must include that plan tier.
15. If `agent_definitions.required_addon` is set, the business must have an active subscription to that add-on.
16. Enforced server-side via `check-subscription` edge function data; never client-only.

### 7.5 Ownership and Auth

17. Every public edge function entry point validates `auth.uid()` against the business record.
18. RLS policies on all runtime tables enforce `business_id` isolation between tenants.

### 7.6 LLM Output Integrity

19. LLM-generated content is treated as data, never as authorization or policy.
20. No agent may elevate its own permissions or those of another agent via a completion payload.

---

## 8. Shared Domain Layer — `_shared/workforce.ts`

The shared edge function module exposes the following functions. All business logic for the workforce system is centralized here.

### Workflow Lifecycle
- `createWorkflow(params)` — Creates a new `agent_workflows` row; validates business ownership and entitlement.
- `queueWorkflow(workflowId)` — Transitions `draft → queued`.
- `startWorkflow(workflowId)` — Transitions `queued → running`.
- `completeWorkflow(workflowId, result)` — Transitions `running → completed`.
- `failWorkflow(workflowId, error)` — Transitions `running → failed`.

### Task Lifecycle
- `createTask(params)` — Creates a new `agent_tasks` row; validates delegation policy.
- `claimTask(taskId, agentSlug)` — Transitions `queued → claimed`; sets `lease_expires_at`.
- `startTask(taskId)` — Transitions `claimed → running`.
- `completeTask(taskId, output)` — Transitions `running → completed`; propagates to workflow if terminal.
- `failTask(taskId, errorCode)` — Transitions `running → failed`; triggers retry or escalation policy.
- `scheduleRetry(taskId)` — Transitions `running → retry_scheduled` if `retry_count < retry_max`.

### Policy Enforcement
- `resolveAgent(slug)` — Loads agent definition; throws `AGENT_NOT_FOUND` or `AGENT_DISABLED`.
- `validateDelegation(managerSlug, subordinateSlug, taskCategory, chainDepth)` — Enforces all delegation rules; throws `DELEGATION_DENIED`.
- `preventCycles(chainSlugs, newSlug)` — Returns true if adding `newSlug` would create a loop.
- `validateToolGrant(agentSlug, toolSlug, approvalContext?)` — Enforces tool grant rules; throws `TOOL_PERMISSION_DENIED`.
- `validateHandoff(sourceSlug, destSlug, taskCategory, payload)` — Validates contract existence and payload; throws `HANDOFF_CONTRACT_MISSING` or `HANDOFF_VALIDATION_FAILED`.

### Escalation
- `resolveEscalation(originatingSlug, triggerType, severity)` — Looks up active escalation policy and creates an `agent_escalations` row.

### Approval
- `requestApproval(workflowId, taskId, businessId, actionType, riskLevel, summary, payload, ttlSeconds)` — Creates `agent_approvals` row; transitions task to `awaiting_approval`.
- `resolveApproval(approvalId, decision, resolvedBy)` — Sets `approved|rejected`; resumes or fails task.

### Audit
- `recordEvent(workflowId, taskId, agentSlug, eventType, payload, correlationId)` — Inserts into `agent_execution_events`.
- `recordToolInvocation(taskId, agentSlug, toolSlug, grantId, input, output, success, errorCode, durationMs)` — Inserts into `agent_tool_invocations`.

---

## 9. Error Codes

All errors returned by workforce edge functions use structured JSON `{ "error": "<CODE>", "message": "...", "details": {...} }`.

| Code | Meaning |
|---|---|
| `UNAUTHENTICATED` | No valid session |
| `FORBIDDEN` | Session authenticated but lacks permission |
| `TENANT_CONTEXT_REQUIRED` | No business_id provided or derivable |
| `ENTITLEMENT_REQUIRED` | Plan does not include this feature |
| `ADDON_REQUIRED` | Add-on subscription not active |
| `AGENT_NOT_FOUND` | No agent_definitions row for slug |
| `AGENT_DISABLED` | Agent exists but active=false |
| `DELEGATION_DENIED` | No active policy permits this delegation |
| `HANDOFF_CONTRACT_MISSING` | No active handoff contract for source→dest+category |
| `HANDOFF_VALIDATION_FAILED` | Payload fails required schema or missing keys |
| `TOOL_PERMISSION_DENIED` | No active grant for agent+tool |
| `APPROVAL_REQUIRED` | Action requires human approval before proceeding |
| `APPROVAL_EXPIRED` | Approval window passed without resolution |
| `WORKFLOW_STATE_CONFLICT` | Workflow is not in a valid state for this transition |
| `TASK_NOT_ELIGIBLE` | Task is not in a valid state for this operation |
| `IDEMPOTENCY_CONFLICT` | Duplicate idempotency_key on different parameters |
| `PROVIDER_CONFIGURATION_MISSING` | Required API key or secret not in Supabase secrets |
| `PROVIDER_REQUEST_FAILED` | External provider returned an error |
| `INTERNAL_ERROR` | Unexpected server-side failure |

---

## 10. Plan Entitlement Matrix

Entitlement is enforced using the existing `PLANS` constant in `src/lib/stripe.ts` and the `check-subscription` edge function. The workforce system extends entitlement checks with two additional checks:

| Entitlement | How Enforced |
|---|---|
| Base plan (Creator/Starter/Growth/Agency) | `agent_definitions.required_plan` checked against subscription tier |
| Federal Contracting add-on ($50/mo) | `agent_definitions.required_addon = 'federal_contracting'` checked against active add-on subscriptions |
| Grant Intelligence add-on ($50/mo) | `agent_definitions.required_addon = 'grant_intelligence'` checked against active add-on subscriptions |

Agents requiring add-ons:
- `federal_contracting_specialist` — `required_addon = 'federal_contracting'`
- `grant_intelligence_specialist` — `required_addon = 'grant_intelligence'`

Entitlement is checked:
1. At workflow creation time (reject if base plan or add-on not active)
2. Before any protected task execution (re-check in case subscription lapsed)

---

## 11. Edge Functions Required

| Function Name | Purpose |
|---|---|
| `workforce-orchestrate` | Public entry point; validates auth + ownership; creates workflow; delegates to chief_orchestrator |
| `workforce-task-claim` | Claims a queued task with lease; used by agent runners |
| `workforce-task-complete` | Marks task complete with output |
| `workforce-task-fail` | Marks task failed; triggers retry or escalation |
| `workforce-handoff` | Proposes and validates a handoff between agents |
| `workforce-approval-request` | Creates approval record and notifies customer |
| `workforce-approval-resolve` | Customer approves or rejects; resumes workflow |
| `workforce-escalation-ack` | Acknowledges an open escalation |
| `workforce-status` | Returns workflow + task status for a business (RLS enforced) |

---

## 12. UI Components Required

| Component | Location | Purpose |
|---|---|---|
| `WorkforcePanel` | `src/components/workforce/WorkforcePanel.tsx` | Container panel; list and launch workflows |
| `WorkflowCard` | `src/components/workforce/WorkflowCard.tsx` | Single workflow status card with progress |
| `AgentApprovalQueue` | `src/components/workforce/AgentApprovalQueue.tsx` | Customer-facing approval inbox |
| `ApprovalModal` | `src/components/workforce/ApprovalModal.tsx` | Approve/reject single action |
| `WorkflowDetailDrawer` | `src/components/workforce/WorkflowDetailDrawer.tsx` | Task-by-task breakdown of a workflow |
| `EscalationBanner` | `src/components/workforce/EscalationBanner.tsx` | Surfaced when open critical escalations exist |

Integrate `WorkforcePanel` into `Dashboard.tsx` as a new section (`activeSection = 'workforce'`).
`AgentApprovalQueue` may share UI patterns with the existing `ApprovalCenter.tsx`.

---

## 13. Migrations Plan

All migrations are additive. Existing tables are not dropped or altered destructively.

| Migration | Content |
|---|---|
| `20260904000001_agent_departments.sql` | `agent_departments` table + initial department seed data |
| `20260904000002_agent_definitions.sql` | `agent_definitions` table + all 22 agent seeds |
| `20260904000003_agent_capabilities.sql` | `agent_capabilities` + `agent_definition_capabilities` tables |
| `20260904000004_agent_tools.sql` | `agent_tool_definitions` + `agent_tool_grants` tables |
| `20260904000005_agent_policies.sql` | `agent_delegation_policies` + `agent_handoff_contracts` + `agent_escalation_policies` tables |
| `20260904000006_agent_workflows.sql` | `agent_workflows` + RLS policies |
| `20260904000007_agent_tasks.sql` | `agent_tasks` + RLS policies |
| `20260904000008_agent_handoffs.sql` | `agent_handoffs` + RLS policies |
| `20260904000009_agent_escalations.sql` | `agent_escalations` + RLS policies |
| `20260904000010_agent_approvals.sql` | `agent_approvals` + RLS policies |
| `20260904000011_agent_events.sql` | `agent_execution_events` + `agent_tool_invocations` + RLS |
| `20260904000012_agent_rollups.sql` | `agent_performance_rollups` + RLS |
| `20260904000013_agent_seeds_policies.sql` | Seed delegation policies, handoff contracts, escalation policies, tool grants |

---

## 14. Security Considerations

- All runtime tables carry RLS; no tenant can read or write another tenant's rows.
- Platform config tables (`agent_definitions`, `agent_tool_definitions`, etc.) are read-only for authenticated users; writes require service role.
- Approval payloads are stored as `requested_payload jsonb` — sensitive field values must be redacted before storage if they contain secrets.
- Tool invocation logs store `input_redacted` and `output_redacted` — callers must strip credentials before logging.
- Idempotency keys prevent duplicate workflow/task creation under transient retries.
- Lease expiry (`lease_expires_at`) prevents abandoned tasks from blocking queues indefinitely.
- Delegation cycle detection (`preventCycles`) runs in the shared domain layer before any task is created.

---

## 15. Contracts Preserved (Do Not Break)

See `CONTRACTS.md` for the full protected contract list. This build additionally treats the following as protected:

- `agent_definitions.slug` values (slugs are foreign keys across the schema; renames require a migration)
- The `(manager_slug, subordinate_slug)` uniqueness on `agent_delegation_policies`
- The `(source_slug, destination_slug, task_category)` uniqueness on `agent_handoff_contracts`
- Workflow and task state machine transitions (new transitions require spec update and explicit approval)
- Error code strings (used by frontend error handling; changing codes breaks UI error messages)

---

## 16. Open Questions / Decisions Deferred

- Real-time task status updates: Supabase Realtime vs. TanStack Query polling (recommend polling at 5s initially)
- LLM provider for agent reasoning: Anthropic Claude API via `_shared/` wrapper vs. direct per-function calls
- Agent runner execution model: inline Deno edge function per agent vs. queue-based dispatch
- Performance rollup scheduling: Supabase pg_cron vs. a daily edge function trigger
- Notification delivery for customer approvals: Supabase Realtime, email via Resend, or in-app toast only
