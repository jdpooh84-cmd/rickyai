/**
 * Ricky AI Commercial Agent Workforce — Shared Domain Layer
 *
 * All agent hierarchy enforcement, delegation validation, tool grant checks,
 * handoff validation, escalation routing, and state transitions go through
 * this module. LLM outputs never constitute authorization here.
 *
 * Uses service-role client for platform-config reads (agent_definitions, policies).
 * Uses user-scoped client for tenant data reads to respect RLS.
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

// ---------------------------------------------------------------------------
// ERROR CODES
// ---------------------------------------------------------------------------
export const WorkforceErrorCodes = {
  UNAUTHENTICATED:             "UNAUTHENTICATED",
  FORBIDDEN:                   "FORBIDDEN",
  TENANT_CONTEXT_REQUIRED:     "TENANT_CONTEXT_REQUIRED",
  ENTITLEMENT_REQUIRED:        "ENTITLEMENT_REQUIRED",
  ADDON_REQUIRED:              "ADDON_REQUIRED",
  AGENT_NOT_FOUND:             "AGENT_NOT_FOUND",
  AGENT_DISABLED:              "AGENT_DISABLED",
  DELEGATION_DENIED:           "DELEGATION_DENIED",
  HANDOFF_CONTRACT_MISSING:    "HANDOFF_CONTRACT_MISSING",
  HANDOFF_VALIDATION_FAILED:   "HANDOFF_VALIDATION_FAILED",
  TOOL_PERMISSION_DENIED:      "TOOL_PERMISSION_DENIED",
  APPROVAL_REQUIRED:           "APPROVAL_REQUIRED",
  APPROVAL_EXPIRED:            "APPROVAL_EXPIRED",
  WORKFLOW_STATE_CONFLICT:     "WORKFLOW_STATE_CONFLICT",
  TASK_NOT_ELIGIBLE:           "TASK_NOT_ELIGIBLE",
  IDEMPOTENCY_CONFLICT:        "IDEMPOTENCY_CONFLICT",
  PROVIDER_CONFIGURATION_MISSING: "PROVIDER_CONFIGURATION_MISSING",
  PROVIDER_REQUEST_FAILED:     "PROVIDER_REQUEST_FAILED",
  INTERNAL_ERROR:              "INTERNAL_ERROR",
} as const;

export type WorkforceErrorCode = typeof WorkforceErrorCodes[keyof typeof WorkforceErrorCodes];

export class WorkforceError extends Error {
  constructor(
    public readonly code: WorkforceErrorCode,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "WorkforceError";
  }
}

export function workforceErrorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof WorkforceError) {
    return new Response(
      JSON.stringify({ error: err.message, code: err.code }),
      { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  console.error("[workforce] Unhandled error:", err);
  return new Response(
    JSON.stringify({ error: "Internal server error", code: WorkforceErrorCodes.INTERNAL_ERROR }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ---------------------------------------------------------------------------
// SUPABASE CLIENT HELPERS
// ---------------------------------------------------------------------------
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function userClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
export async function requireUser(authHeader: string | null): Promise<{ id: string; email: string }> {
  if (!authHeader) throw new WorkforceError(WorkforceErrorCodes.UNAUTHENTICATED, "Missing authorization header", 401);
  const client = userClient(authHeader);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new WorkforceError(WorkforceErrorCodes.UNAUTHENTICATED, "Invalid or expired session", 401);
  return { id: user.id, email: user.email ?? "" };
}

// ---------------------------------------------------------------------------
// BUSINESS OWNERSHIP
// ---------------------------------------------------------------------------
export async function requireBusinessOwnership(
  serviceClient_: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<void> {
  const { data, error } = await serviceClient_
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.FORBIDDEN, "Business not found or not owned by user", 403);
  }
}

// ---------------------------------------------------------------------------
// AGENT RESOLUTION
// ---------------------------------------------------------------------------
export interface AgentDefinition {
  id: string;
  slug: string;
  display_name: string;
  department_id: string | null;
  parent_slug: string | null;
  role_type: string;
  lifecycle_status: string;
  semantic_version: string;
  default_requires_human_approval: boolean;
  concurrency_limit: number;
  timeout_seconds: number;
  retry_max: number;
  required_plan: string | null;
  required_addon: string | null;
  active: boolean;
}

export async function resolveAgent(
  svc: SupabaseClient,
  slug: string,
): Promise<AgentDefinition> {
  const { data, error } = await svc
    .from("agent_definitions")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.AGENT_NOT_FOUND, `Agent '${slug}' not found`, 404);
  }
  if (!data.active || data.lifecycle_status !== "active") {
    throw new WorkforceError(WorkforceErrorCodes.AGENT_DISABLED, `Agent '${slug}' is not active`, 400);
  }
  return data as AgentDefinition;
}

// ---------------------------------------------------------------------------
// ENTITLEMENT CHECK
// ---------------------------------------------------------------------------
export async function requireEntitlement(
  svc: SupabaseClient,
  userId: string,
  agent: AgentDefinition,
): Promise<void> {
  if (!agent.required_plan && !agent.required_addon) return;

  const { data: profile, error } = await svc
    .from("profiles")
    .select("subscription_plan, add_ons")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !profile) {
    throw new WorkforceError(WorkforceErrorCodes.FORBIDDEN, "Profile not found", 403);
  }

  if (agent.required_plan) {
    const planOrder = ["creator", "business", "growth", "agency"];
    const userPlanIdx = planOrder.indexOf(profile.subscription_plan ?? "");
    const requiredIdx = planOrder.indexOf(agent.required_plan);
    if (userPlanIdx < requiredIdx) {
      throw new WorkforceError(
        WorkforceErrorCodes.ENTITLEMENT_REQUIRED,
        `Agent '${agent.slug}' requires '${agent.required_plan}' plan or higher`,
        403,
      );
    }
  }

  if (agent.required_addon) {
    const addons: string[] = profile.add_ons ?? [];
    if (!addons.includes(agent.required_addon)) {
      throw new WorkforceError(
        WorkforceErrorCodes.ADDON_REQUIRED,
        `Agent '${agent.slug}' requires '${agent.required_addon}' add-on`,
        403,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// DELEGATION VALIDATION
// ---------------------------------------------------------------------------
export async function validateDelegation(
  svc: SupabaseClient,
  managerSlug: string,
  subordinateSlug: string,
  taskCategory: string,
  currentDepth: number = 0,
): Promise<{ policyId: string; requiresApproval: boolean }> {
  if (currentDepth > 5) {
    throw new WorkforceError(WorkforceErrorCodes.DELEGATION_DENIED, "Maximum delegation depth exceeded", 400);
  }

  const { data: policy, error } = await svc
    .from("agent_delegation_policies")
    .select("id, max_depth, requires_approval, permitted_task_categories")
    .eq("manager_slug", managerSlug)
    .eq("subordinate_slug", subordinateSlug)
    .eq("active", true)
    .maybeSingle();

  if (error || !policy) {
    throw new WorkforceError(
      WorkforceErrorCodes.DELEGATION_DENIED,
      `No active delegation policy: ${managerSlug} → ${subordinateSlug}`,
      403,
    );
  }

  if (currentDepth >= policy.max_depth) {
    throw new WorkforceError(
      WorkforceErrorCodes.DELEGATION_DENIED,
      `Delegation depth ${currentDepth} exceeds policy max ${policy.max_depth}`,
      400,
    );
  }

  const permitted: string[] = policy.permitted_task_categories ?? [];
  if (!permitted.includes(taskCategory)) {
    throw new WorkforceError(
      WorkforceErrorCodes.DELEGATION_DENIED,
      `Task category '${taskCategory}' not permitted for ${managerSlug} → ${subordinateSlug}`,
      403,
    );
  }

  return { policyId: policy.id, requiresApproval: policy.requires_approval };
}

// ---------------------------------------------------------------------------
// CYCLE DETECTION — prevents delegation loops
// ---------------------------------------------------------------------------
export async function detectDelegationCycle(
  svc: SupabaseClient,
  proposedManagerSlug: string,
  proposedSubordinateSlug: string,
): Promise<void> {
  // BFS: check if subordinateSlug can eventually delegate back to managerSlug
  const visited = new Set<string>();
  const queue = [proposedSubordinateSlug];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === proposedManagerSlug) {
      throw new WorkforceError(
        WorkforceErrorCodes.DELEGATION_DENIED,
        `Delegation loop detected: ${proposedManagerSlug} → ... → ${proposedSubordinateSlug} → ${proposedManagerSlug}`,
        400,
      );
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const { data: downstreamPolicies } = await svc
      .from("agent_delegation_policies")
      .select("subordinate_slug")
      .eq("manager_slug", current)
      .eq("active", true);

    for (const p of downstreamPolicies ?? []) {
      queue.push(p.subordinate_slug);
    }
  }
}

// ---------------------------------------------------------------------------
// TOOL GRANT VALIDATION
// ---------------------------------------------------------------------------
export async function validateToolGrant(
  svc: SupabaseClient,
  agentSlug: string,
  toolSlug: string,
): Promise<{ grantId: string; approvalPolicy: string }> {
  const { data: grant, error } = await svc
    .from("agent_tool_grants")
    .select("id, approval_policy")
    .eq("agent_slug", agentSlug)
    .eq("tool_slug", toolSlug)
    .eq("active", true)
    .maybeSingle();

  if (error || !grant) {
    throw new WorkforceError(
      WorkforceErrorCodes.TOOL_PERMISSION_DENIED,
      `Agent '${agentSlug}' has no grant for tool '${toolSlug}'`,
      403,
    );
  }

  return { grantId: grant.id, approvalPolicy: grant.approval_policy };
}

// ---------------------------------------------------------------------------
// HANDOFF VALIDATION
// ---------------------------------------------------------------------------
export async function validateHandoff(
  svc: SupabaseClient,
  sourceSlug: string,
  destinationSlug: string,
  taskCategory: string,
  inputPayload: Record<string, unknown>,
): Promise<{ contractId: string; requiresApproval: boolean }> {
  const { data: contract, error } = await svc
    .from("agent_handoff_contracts")
    .select("id, required_context_keys, requires_approval")
    .eq("source_slug", sourceSlug)
    .eq("destination_slug", destinationSlug)
    .eq("task_category", taskCategory)
    .eq("active", true)
    .maybeSingle();

  if (error || !contract) {
    throw new WorkforceError(
      WorkforceErrorCodes.HANDOFF_CONTRACT_MISSING,
      `No active handoff contract: ${sourceSlug} → ${destinationSlug} (${taskCategory})`,
      400,
    );
  }

  const requiredKeys: string[] = contract.required_context_keys ?? [];
  const missingKeys = requiredKeys.filter((k) => !(k in inputPayload));
  if (missingKeys.length > 0) {
    throw new WorkforceError(
      WorkforceErrorCodes.HANDOFF_VALIDATION_FAILED,
      `Handoff missing required context keys: ${missingKeys.join(", ")}`,
      400,
    );
  }

  return { contractId: contract.id, requiresApproval: contract.requires_approval };
}

// ---------------------------------------------------------------------------
// WORKFLOW LIFECYCLE
// ---------------------------------------------------------------------------
export async function createWorkflow(
  svc: SupabaseClient,
  params: {
    businessId: string;
    userId: string;
    title: string;
    goal: string;
    initiatingAgentSlug?: string;
    idempotencyKey?: string;
    priority?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const { data: existing } = await svc
    .from("agent_workflows")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("idempotency_key", params.idempotencyKey ?? "__none__")
    .maybeSingle();

  if (existing) {
    throw new WorkforceError(
      WorkforceErrorCodes.IDEMPOTENCY_CONFLICT,
      "Workflow with this idempotency key already exists",
      409,
    );
  }

  const { data, error } = await svc
    .from("agent_workflows")
    .insert({
      business_id:           params.businessId,
      user_id:               params.userId,
      title:                 params.title,
      goal:                  params.goal,
      status:                "queued",
      initiating_agent_slug: params.initiatingAgentSlug ?? "chief_orchestrator",
      idempotency_key:       params.idempotencyKey ?? null,
      priority:              params.priority ?? 5,
      metadata:              params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to create workflow", 500);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// TASK LIFECYCLE
// ---------------------------------------------------------------------------
export async function createTask(
  svc: SupabaseClient,
  params: {
    workflowId: string;
    businessId: string;
    assignedAgentSlug: string;
    title: string;
    taskCategory?: string;
    inputContext?: Record<string, unknown>;
    parentTaskId?: string;
    delegationPolicyId?: string;
    idempotencyKey?: string;
  },
): Promise<string> {
  const { data, error } = await svc
    .from("agent_tasks")
    .insert({
      workflow_id:          params.workflowId,
      business_id:          params.businessId,
      parent_task_id:       params.parentTaskId ?? null,
      assigned_agent_slug:  params.assignedAgentSlug,
      delegation_policy_id: params.delegationPolicyId ?? null,
      title:                params.title,
      task_category:        params.taskCategory ?? null,
      status:               "queued",
      input_context:        params.inputContext ?? {},
      idempotency_key:      params.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to create task", 500);
  }

  return data.id;
}

export async function completeTask(
  svc: SupabaseClient,
  taskId: string,
  outputResult: Record<string, unknown>,
): Promise<void> {
  const { error } = await svc
    .from("agent_tasks")
    .update({
      status:       "completed",
      output_result: outputResult,
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .in("status", ["running", "claimed"]);

  if (error) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to complete task", 500);
  }
}

export async function failTask(
  svc: SupabaseClient,
  taskId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const { data: task } = await svc
    .from("agent_tasks")
    .select("retry_count, workflow_id")
    .eq("id", taskId)
    .maybeSingle();

  const { error } = await svc
    .from("agent_tasks")
    .update({
      status:        "failed",
      error_code:    errorCode,
      error_message: errorMessage,
      completed_at:  new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to update task status", 500);
  }
}

export async function scheduleRetry(
  svc: SupabaseClient,
  taskId: string,
  delayMs: number = 30_000,
): Promise<void> {
  const { data: task } = await svc
    .from("agent_tasks")
    .select("retry_count, assigned_agent_slug")
    .eq("id", taskId)
    .maybeSingle();

  if (!task) return;

  const agent = await resolveAgent(svc, task.assigned_agent_slug);
  if (task.retry_count >= agent.retry_max) {
    await failTask(svc, taskId, "MAX_RETRIES_EXCEEDED", "Maximum retries reached");
    return;
  }

  const retryAt = new Date(Date.now() + delayMs).toISOString();
  await svc
    .from("agent_tasks")
    .update({
      status:      "retry_scheduled",
      retry_count: task.retry_count + 1,
      lease_expires_at: retryAt,
    })
    .eq("id", taskId);
}

// ---------------------------------------------------------------------------
// APPROVALS
// ---------------------------------------------------------------------------
export async function createApproval(
  svc: SupabaseClient,
  params: {
    workflowId: string;
    taskId?: string;
    businessId: string;
    actionType: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    humanSummary: string;
    requestedPayload: Record<string, unknown>;
    expiresInHours?: number;
    idempotencyKey?: string;
  },
): Promise<string> {
  const expiresAt = params.expiresInHours
    ? new Date(Date.now() + params.expiresInHours * 3_600_000).toISOString()
    : null;

  const { data, error } = await svc
    .from("agent_approvals")
    .insert({
      workflow_id:       params.workflowId,
      task_id:           params.taskId ?? null,
      business_id:       params.businessId,
      action_type:       params.actionType,
      risk_level:        params.riskLevel,
      human_summary:     params.humanSummary,
      requested_payload: params.requestedPayload,
      status:            "pending",
      expires_at:        expiresAt,
      idempotency_key:   params.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to create approval", 500);
  }

  return data.id;
}

export async function resolveApproval(
  svc: SupabaseClient,
  approvalId: string,
  userId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const { data: approval } = await svc
    .from("agent_approvals")
    .select("id, status, expires_at, business_id")
    .eq("id", approvalId)
    .maybeSingle();

  if (!approval) {
    throw new WorkforceError(WorkforceErrorCodes.TASK_NOT_ELIGIBLE, "Approval not found", 404);
  }
  if (approval.status !== "pending") {
    throw new WorkforceError(
      WorkforceErrorCodes.IDEMPOTENCY_CONFLICT,
      `Approval already resolved: ${approval.status}`,
      409,
    );
  }
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    throw new WorkforceError(WorkforceErrorCodes.APPROVAL_EXPIRED, "Approval has expired", 400);
  }

  await svc
    .from("agent_approvals")
    .update({
      status:      decision,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", approvalId);
}

// ---------------------------------------------------------------------------
// ESCALATION
// ---------------------------------------------------------------------------
export async function createEscalation(
  svc: SupabaseClient,
  params: {
    workflowId: string;
    taskId?: string;
    businessId: string;
    originatingSlug: string;
    triggerType: string;
    severity: "low" | "medium" | "high" | "critical";
    context: Record<string, unknown>;
  },
): Promise<string> {
  // Find escalation policy
  const { data: policy } = await svc
    .from("agent_escalation_policies")
    .select("id, destination_slug, customer_notify")
    .eq("originating_slug", params.originatingSlug)
    .eq("trigger_type", params.triggerType)
    .eq("active", true)
    .maybeSingle();

  const { data, error } = await svc
    .from("agent_escalations")
    .insert({
      workflow_id:      params.workflowId,
      task_id:          params.taskId ?? null,
      business_id:      params.businessId,
      originating_slug: params.originatingSlug,
      policy_id:        policy?.id ?? null,
      trigger_type:     params.triggerType,
      severity:         params.severity,
      status:           "open",
      context:          params.context,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to create escalation", 500);
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// EXECUTION EVENTS
// ---------------------------------------------------------------------------
export async function recordEvent(
  svc: SupabaseClient,
  params: {
    workflowId: string;
    taskId?: string;
    businessId: string;
    agentSlug?: string;
    eventType: string;
    payload?: Record<string, unknown>;
    correlationId?: string;
  },
): Promise<void> {
  await svc.from("agent_execution_events").insert({
    workflow_id:    params.workflowId,
    task_id:        params.taskId ?? null,
    business_id:    params.businessId,
    agent_slug:     params.agentSlug ?? null,
    event_type:     params.eventType,
    payload:        params.payload ?? {},
    correlation_id: params.correlationId ?? null,
  });
}

// ---------------------------------------------------------------------------
// TOOL INVOCATION AUDIT
// ---------------------------------------------------------------------------
export async function recordToolInvocation(
  svc: SupabaseClient,
  params: {
    taskId?: string;
    businessId: string;
    agentSlug: string;
    toolSlug: string;
    grantId?: string;
    inputRedacted?: Record<string, unknown>;
    outputRedacted?: Record<string, unknown>;
    success: boolean;
    errorCode?: string;
    durationMs?: number;
  },
): Promise<void> {
  await svc.from("agent_tool_invocations").insert({
    task_id:         params.taskId ?? null,
    business_id:     params.businessId,
    agent_slug:      params.agentSlug,
    tool_slug:       params.toolSlug,
    grant_id:        params.grantId ?? null,
    input_redacted:  params.inputRedacted ?? {},
    output_redacted: params.outputRedacted ?? {},
    success:         params.success,
    error_code:      params.errorCode ?? null,
    duration_ms:     params.durationMs ?? null,
  });
}
