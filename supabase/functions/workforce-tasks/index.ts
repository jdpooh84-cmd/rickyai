/**
 * workforce-tasks — Task execution, handoff, and escalation.
 *
 * POST /handoff    — Propose a handoff from one agent to another
 * POST /escalate   — Create an escalation record
 * GET  /departments — List departments and agent overview (public registry read)
 */

import { requireUuid, requireString, requireOneOf, optionalString, validate } from "../_shared/validate.ts";
import {
  serviceClient, userClient, requireUser, requireBusinessOwnership,
  resolveAgent, requireEntitlement, validateHandoff, validateDelegation,
  createTask, createEscalation, recordEvent, validateToolGrant,
  recordToolInvocation, workforceErrorResponse,
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
    // GET /departments — Agent directory for the UI
    // ------------------------------------------------------------------
    if (action === "departments" && req.method === "GET") {
      const { data: departments } = await svc
        .from("agent_departments")
        .select("id, slug, display_name, description")
        .eq("active", true)
        .order("display_name");

      const { data: agents } = await svc
        .from("agent_definitions")
        .select("slug, display_name, description, department_id, parent_slug, role_type, required_plan, required_addon, active")
        .eq("active", true)
        .eq("lifecycle_status", "active")
        .order("role_type")
        .order("display_name");

      return new Response(
        JSON.stringify({ departments: departments ?? [], agents: agents ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // POST /handoff — Propose a handoff between agents
    // ------------------------------------------------------------------
    if (action === "handoff" && req.method === "POST") {
      const body = await req.json();
      const validated = validate(() => ({
        sourceTaskId:   requireUuid(body.sourceTaskId, "sourceTaskId"),
        destinationSlug: requireString(body.destinationSlug, "destinationSlug", 100),
        taskCategory:   requireString(body.taskCategory, "taskCategory", 100),
        businessId:     requireUuid(body.businessId, "businessId"),
      }));
      if (validated instanceof Response) return validated;
      const { sourceTaskId, destinationSlug, taskCategory, businessId } = validated;

      await requireBusinessOwnership(svc, user.id, businessId);

      // Resolve source task to get source agent
      const { data: sourceTask } = await svc
        .from("agent_tasks")
        .select("id, workflow_id, assigned_agent_slug, status, business_id")
        .eq("id", sourceTaskId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (!sourceTask) {
        throw new WorkforceError(WorkforceErrorCodes.FORBIDDEN, "Source task not found", 404);
      }

      const sourceSlug = sourceTask.assigned_agent_slug;
      const inputPayload: Record<string, unknown> = body.inputPayload ?? {};

      // Validate handoff contract
      const { contractId, requiresApproval } = await validateHandoff(
        svc, sourceSlug, destinationSlug, taskCategory, inputPayload,
      );

      // Validate destination agent exists and is entitled
      const destAgent = await resolveAgent(svc, destinationSlug);
      await requireEntitlement(svc, user.id, destAgent);

      // Create destination task
      const destTaskId = await createTask(svc, {
        workflowId:       sourceTask.workflow_id,
        businessId,
        assignedAgentSlug: destinationSlug,
        title:            body.title ?? `${taskCategory} via handoff`,
        taskCategory,
        inputContext:     inputPayload,
        parentTaskId:     sourceTaskId,
      });

      // Record handoff
      await svc.from("agent_handoffs").insert({
        source_task_id:      sourceTaskId,
        destination_task_id: destTaskId,
        contract_id:         contractId,
        task_category:       taskCategory,
        input_payload:       inputPayload,
        status:              requiresApproval ? "proposed" : "accepted",
      });

      // Update destination task status
      if (requiresApproval) {
        await svc.from("agent_tasks").update({ status: "awaiting_approval" }).eq("id", destTaskId);
      }

      await recordEvent(svc, {
        workflowId: sourceTask.workflow_id,
        taskId:     sourceTaskId,
        businessId,
        agentSlug:  sourceSlug,
        eventType:  "handoff_proposed",
        payload: { destinationSlug, taskCategory, contractId, destTaskId },
      });

      return new Response(
        JSON.stringify({ destTaskId, requiresApproval, contractId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // POST /escalate
    // ------------------------------------------------------------------
    if (action === "escalate" && req.method === "POST") {
      const body = await req.json();
      const validated = validate(() => ({
        workflowId:      requireUuid(body.workflowId, "workflowId"),
        businessId:      requireUuid(body.businessId, "businessId"),
        originatingSlug: requireString(body.originatingSlug, "originatingSlug", 100),
        triggerType:     requireString(body.triggerType, "triggerType", 100),
        severity:        requireOneOf(body.severity ?? "medium", "severity", ["low","medium","high","critical"] as const),
      }));
      if (validated instanceof Response) return validated;
      const { workflowId, businessId, originatingSlug, triggerType, severity } = validated;

      await requireBusinessOwnership(svc, user.id, businessId);

      const escalationId = await createEscalation(svc, {
        workflowId,
        taskId: body.taskId,
        businessId,
        originatingSlug,
        triggerType,
        severity,
        context: body.context ?? {},
      });

      await recordEvent(svc, {
        workflowId,
        businessId,
        agentSlug: originatingSlug,
        eventType: "escalation_created",
        payload: { escalationId, triggerType, severity },
      });

      return new Response(
        JSON.stringify({ escalationId }),
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
