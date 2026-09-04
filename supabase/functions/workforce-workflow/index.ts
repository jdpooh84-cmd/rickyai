/**
 * workforce-workflow — Workflow creation, listing, and detail.
 *
 * POST /create   — Create a new agent workflow
 * GET  /list     — List workflows for a business
 * GET  /detail   — Workflow detail with tasks and timeline
 */

import { requireUuid, requireString, validate } from "../_shared/validate.ts";
import {
  serviceClient, userClient, requireUser, requireBusinessOwnership,
  resolveAgent, requireEntitlement, createWorkflow, createTask,
  validateDelegation, recordEvent, workforceErrorResponse,
  WorkforceError, WorkforceErrorCodes,
} from "../_shared/workforce.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() ?? "";

  try {
    const authHeader = req.headers.get("Authorization");
    const user = await requireUser(authHeader);
    const svc = serviceClient();

    // ------------------------------------------------------------------
    // POST /create
    // ------------------------------------------------------------------
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const validated = validate(() => ({
        businessId:    requireUuid(body.businessId, "businessId"),
        goal:          requireString(body.goal, "goal", 2000),
        title:         requireString(body.title ?? body.goal.substring(0, 100), "title", 200),
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey.substring(0, 200) : null,
      }));
      if (validated instanceof Response) return validated;
      const { businessId, goal, title, idempotencyKey } = validated;

      await requireBusinessOwnership(svc, user.id, businessId);

      // Validate the initiating agent exists and is accessible
      const orchestrator = await resolveAgent(svc, "chief_orchestrator");
      await requireEntitlement(svc, user.id, orchestrator);

      const priority = typeof body.priority === "number"
        ? Math.min(10, Math.max(1, Math.round(body.priority)))
        : 5;

      const workflowId = await createWorkflow(svc, {
        businessId,
        userId: user.id,
        title,
        goal,
        initiatingAgentSlug: "chief_orchestrator",
        idempotencyKey: idempotencyKey ?? undefined,
        priority,
        metadata: { source: body.source ?? "ui" },
      });

      // Create the initial orchestrator task
      await createTask(svc, {
        workflowId,
        businessId,
        assignedAgentSlug: "chief_orchestrator",
        title: `Orchestrate: ${title}`,
        taskCategory: "orchestration",
        inputContext: { goal, businessId, source: body.source ?? "ui" },
      });

      await recordEvent(svc, {
        workflowId,
        businessId,
        agentSlug: "chief_orchestrator",
        eventType: "workflow_created",
        payload: { goal, title, priority },
      });

      return new Response(
        JSON.stringify({ workflowId, status: "queued" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // GET /list
    // ------------------------------------------------------------------
    if (action === "list" && req.method === "GET") {
      const businessId = url.searchParams.get("businessId");
      if (!businessId) {
        return new Response(
          JSON.stringify({ error: "businessId is required", code: WorkforceErrorCodes.TENANT_CONTEXT_REQUIRED }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await requireBusinessOwnership(svc, user.id, businessId);

      const status = url.searchParams.get("status");
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "25"), 100);

      let query = svc
        .from("agent_workflows")
        .select("id, title, goal, status, priority, initiating_agent_slug, created_at, updated_at, started_at, completed_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to list workflows", 500);

      return new Response(
        JSON.stringify({ workflows: data ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // GET /detail
    // ------------------------------------------------------------------
    if (action === "detail" && req.method === "GET") {
      const workflowId = url.searchParams.get("workflowId");
      if (!workflowId) {
        return new Response(
          JSON.stringify({ error: "workflowId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Verify ownership via RLS — use user-scoped client
      const uClient = userClient(authHeader!);
      const { data: workflow, error: wErr } = await uClient
        .from("agent_workflows")
        .select("*")
        .eq("id", workflowId)
        .maybeSingle();

      if (wErr || !workflow) {
        return new Response(
          JSON.stringify({ error: "Workflow not found", code: WorkforceErrorCodes.FORBIDDEN }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: tasks } = await uClient
        .from("agent_tasks")
        .select("id, title, task_category, assigned_agent_slug, status, retry_count, error_code, created_at, updated_at, started_at, completed_at")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: true });

      const { data: events } = await uClient
        .from("agent_execution_events")
        .select("id, agent_slug, event_type, created_at, payload")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: true })
        .limit(100);

      const { data: escalations } = await uClient
        .from("agent_escalations")
        .select("id, originating_slug, trigger_type, severity, status, created_at")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false });

      const { data: approvals } = await uClient
        .from("agent_approvals")
        .select("id, action_type, risk_level, human_summary, status, expires_at, created_at, resolved_at")
        .eq("workflow_id", workflowId)
        .order("created_at", { ascending: false });

      return new Response(
        JSON.stringify({
          workflow,
          tasks: tasks ?? [],
          events: events ?? [],
          escalations: escalations ?? [],
          approvals: approvals ?? [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return workforceErrorResponse(err, corsHeaders);
  }
});
