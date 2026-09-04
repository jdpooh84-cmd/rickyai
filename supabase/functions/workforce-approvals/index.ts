/**
 * workforce-approvals — Customer approval inbox and decision endpoint.
 *
 * GET  /list     — Pending approvals for a business
 * POST /decide   — Approve or reject a pending approval (idempotent)
 */

import { requireUuid, requireOneOf, validate } from "../_shared/validate.ts";
import {
  serviceClient, userClient, requireUser, requireBusinessOwnership,
  resolveApproval, recordEvent, workforceErrorResponse,
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

      // Expire stale pending approvals first
      await svc.rpc("expire_agent_approvals");

      const statusFilter = url.searchParams.get("status") ?? "pending";
      const uClient = userClient(authHeader!);
      const { data: approvals, error } = await uClient
        .from("agent_approvals")
        .select("id, workflow_id, task_id, action_type, risk_level, human_summary, status, expires_at, created_at, resolved_at, requested_payload")
        .eq("business_id", businessId)
        .eq("status", statusFilter)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new WorkforceError(WorkforceErrorCodes.INTERNAL_ERROR, "Failed to fetch approvals", 500);

      return new Response(
        JSON.stringify({ approvals: approvals ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // POST /decide
    // ------------------------------------------------------------------
    if (action === "decide" && req.method === "POST") {
      const body = await req.json();
      const validated = validate(() => ({
        approvalId: requireUuid(body.approvalId, "approvalId"),
        decision:   requireOneOf(body.decision, "decision", ["approved", "rejected"] as const),
      }));
      if (validated instanceof Response) return validated;
      const { approvalId, decision } = validated;

      // Verify the approval belongs to this user's business via RLS
      const uClient = userClient(authHeader!);
      const { data: approval } = await uClient
        .from("agent_approvals")
        .select("id, business_id, workflow_id, task_id, status, expires_at, action_type")
        .eq("id", approvalId)
        .maybeSingle();

      if (!approval) {
        return new Response(
          JSON.stringify({ error: "Approval not found", code: WorkforceErrorCodes.FORBIDDEN }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // resolveApproval enforces: not already resolved, not expired, atomic update
      await resolveApproval(svc, approvalId, user.id, decision);

      // Record the decision as an execution event
      await recordEvent(svc, {
        workflowId:  approval.workflow_id,
        taskId:      approval.task_id ?? undefined,
        businessId:  approval.business_id,
        agentSlug:   "customer_approval_specialist",
        eventType:   `approval_${decision}`,
        payload: {
          approvalId,
          actionType: approval.action_type,
          decidedBy: user.id,
        },
      });

      // If approved and task_id is set, advance task to queued so it can be picked up
      if (decision === "approved" && approval.task_id) {
        await svc
          .from("agent_tasks")
          .update({ status: "queued" })
          .eq("id", approval.task_id)
          .eq("status", "awaiting_approval");
      }

      return new Response(
        JSON.stringify({ success: true, decision, approvalId }),
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
