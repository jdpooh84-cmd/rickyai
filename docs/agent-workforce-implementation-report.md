# Agent Workforce — Implementation Ledger

**Started:** 2026-09-04
**Branch:** claude/rickyai-byo-creatomate-api-c9c4ka
**Spec:** `docs/ricky-ai-commercial-agent-workforce-master-build.md`

---

## Status

| Field | Value |
|---|---|
| Started | 2026-09-04 |
| Branch | claude/rickyai-byo-creatomate-api-c9c4ka |
| Last Updated | 2026-09-04 |
| Overall Progress | Step 1 of N — Specification persisted |

---

## Requirements Status

| # | Requirement | Status |
|---|---|---|
| 1 | Migration: `agent_departments` table + seed data | NOT YET STARTED |
| 2 | Migration: `agent_definitions` table + 22 agent seeds | NOT YET STARTED |
| 3 | Migration: `agent_capabilities` + `agent_definition_capabilities` | NOT YET STARTED |
| 4 | Migration: `agent_tool_definitions` + `agent_tool_grants` | NOT YET STARTED |
| 5 | Migration: `agent_delegation_policies` + `agent_handoff_contracts` + `agent_escalation_policies` | NOT YET STARTED |
| 6 | Migration: `agent_workflows` + RLS | NOT YET STARTED |
| 7 | Migration: `agent_tasks` + RLS | NOT YET STARTED |
| 8 | Migration: `agent_handoffs` + RLS | NOT YET STARTED |
| 9 | Migration: `agent_escalations` + RLS | NOT YET STARTED |
| 10 | Migration: `agent_approvals` + RLS | NOT YET STARTED |
| 11 | Migration: `agent_execution_events` + `agent_tool_invocations` + RLS | NOT YET STARTED |
| 12 | Migration: `agent_performance_rollups` + RLS | NOT YET STARTED |
| 13 | Migration: seed delegation policies, handoff contracts, escalation policies, tool grants | NOT YET STARTED |
| 14 | Shared domain layer: `_shared/workforce.ts` (all domain functions) | NOT YET STARTED |
| 15 | Edge function: `workforce-orchestrate` | NOT YET STARTED |
| 16 | Edge function: `workforce-task-claim` | NOT YET STARTED |
| 17 | Edge function: `workforce-task-complete` | NOT YET STARTED |
| 18 | Edge function: `workforce-task-fail` + retry/escalation | NOT YET STARTED |
| 19 | Edge function: `workforce-handoff` | NOT YET STARTED |
| 20 | Edge function: `workforce-approval-request` | NOT YET STARTED |
| 21 | Edge function: `workforce-approval-resolve` | NOT YET STARTED |
| 22 | Edge function: `workforce-escalation-ack` | NOT YET STARTED |
| 23 | Edge function: `workforce-status` | NOT YET STARTED |
| 24 | UI: `WorkforcePanel` + `WorkflowCard` components | NOT YET STARTED |
| 25 | UI: `AgentApprovalQueue` + `ApprovalModal` components | NOT YET STARTED |
| 26 | UI: `WorkflowDetailDrawer` + `EscalationBanner` components | NOT YET STARTED |
| 27 | Dashboard integration: `activeSection = 'workforce'` in `Dashboard.tsx` | NOT YET STARTED |
| 28 | Entitlement enforcement: plan + add-on checks in orchestrate + task execution | NOT YET STARTED |
| 29 | Enforcement test: delegation cycle detection, handoff contract validation, tool grant checks | NOT YET STARTED |
| 30 | End-to-end smoke test: full workflow through chief_orchestrator → manager → specialist | NOT YET STARTED |

---

## Completed

_(none yet)_

---

## In Progress

- **Step 1**: Persisting specification and ledger to filesystem
  - `docs/ricky-ai-commercial-agent-workforce-master-build.md` — written
  - `docs/agent-workforce-implementation-report.md` — written (this file)

---

## Migrations Created

_(none yet)_

| Migration File | Description | Applied to Prod |
|---|---|---|
| _(empty)_ | | |

---

## Edge Functions Created/Changed

_(none yet)_

| Function | Action | Deployed |
|---|---|---|
| _(empty)_ | | |

---

## UI Components Created/Changed

_(none yet)_

| Component | File | Action |
|---|---|---|
| _(empty)_ | | |

---

## Tests Created

_(none yet)_

| Test File | Coverage |
|---|---|
| _(empty)_ | |

---

## Test Results

_(none yet)_

---

## Repository Findings

### Existing Infrastructure (as of 2026-09-04)

| Finding | Location |
|---|---|
| Existing `agent_manifest` table | `supabase/migrations/20260903000018_orchestrator.sql` — 9 agents seeded |
| Existing `orchestrator_projects` table | Same migration |
| Existing `orchestrator_tasks` table | Same migration — references `approvals.id` and `agent_jobs.id` |
| Existing `OrchestratorDashboard.tsx` | `src/components/OrchestratorDashboard.tsx` |
| Existing `ApprovalCenter.tsx` | `src/components/ApprovalCenter.tsx` |
| Existing `ricky-orchestrator` edge function | `supabase/functions/ricky-orchestrator/` |
| Existing `_shared/validate.ts` | `supabase/functions/_shared/validate.ts` — exports `ValidationError`, `requireUuid`, `requireString`, `validate()` |
| Existing `_shared/credential-service.ts` | `supabase/functions/_shared/credential-service.ts` — BYO key encryption |
| Existing `_shared/audit.ts` | `supabase/functions/_shared/audit.ts` |
| Existing `approvals` table | Referenced by `orchestrator_tasks.approval_id` |
| Existing `agent_jobs` table | Referenced by `orchestrator_tasks.agent_job_id` |
| No existing delegation policy enforcement | New tables required |
| No existing handoff contracts | New tables required |
| No existing escalation system | New tables required |
| TypeScript strict mode | OFF (existing project setting — preserve) |

### Gaps vs. Spec

- The 9 agents in `agent_manifest` do not map to the 22-agent hierarchy in the spec; new `agent_definitions` table supersedes it without dropping it.
- No existing enforcement of task category restrictions, delegation depth, or cycle detection.
- No existing tool grant registry.
- No existing performance rollup infrastructure.

---

## Architectural Decisions

| Decision | Rationale |
|---|---|
| Extend existing orchestrator schema, do not replace | Backward compatibility; existing `OrchestratorDashboard` and `ApprovalCenter` remain functional during migration |
| New `agent_definitions` table supersedes `agent_manifest` | `agent_manifest` kept for backward compat; new slug-keyed table is the authoritative registry |
| Use existing `approvals` table pattern for `agent_approvals` | Check for column conflicts before creating; if conflict, alias or extend |
| All enforcement in `_shared/workforce.ts` | Single source of truth; prevents per-function drift |
| RLS on all runtime tables, admin-write-only on config tables | Tenant isolation without row-level leakage |
| Idempotency keys on workflows and tasks | Prevent duplicate creation under retry |

---

## External Configuration Still Required

| Item | Notes |
|---|---|
| `CREATOMATE_WEBHOOK_URL` | Must be set in Supabase secrets (existing pipeline requirement) |
| `CREATOMATE_WEBHOOK_SECRET` | Must be registered with Creatomate dashboard (existing pipeline requirement) |
| `STRIPE_WEBHOOK_SECRET` | Required after Stripe dashboard webhook registration |
| `USER_API_KEY_ENCRYPTION_SECRET` | Must be 64-hex-char; required for BYO key encryption |
| Migrations 19 and 20 from previous session | Not yet confirmed applied to production |

---

## Deployment Requirements

```bash
# Apply a new migration
& "C:\Users\jodan\supabase-bin\supabase.exe" db push --linked

# Deploy an edge function
& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw
```

**Supabase project ref:** `psmxeckstfeyxlqzzkgw`
**Frontend:** `npx vercel --prod` → `rickyai.vercel.app`

---

## Known Risks

| Risk | Mitigation |
|---|---|
| `agent_approvals` column conflicts with existing `approvals` table | Audit both schemas before migration 10 |
| Delegation cycle detection performance at scale | Keep chain depth bounded by `max_depth`; index `parent_task_id` |
| LLM provider selection not yet decided | Decision must be made before implementing agent reasoning logic |
| Real-time task status approach not decided | Polling at 5s interval is safe default until Realtime is evaluated |
| Migration 19 + 20 production status unknown | Confirm via `supabase migrations list --linked` before next push |
