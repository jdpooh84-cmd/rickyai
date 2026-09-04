/**
 * workforce-performance — Metrics and performance rollups.
 *
 * GET /summary  — Business-level workforce metrics
 * POST /rollup  — Trigger a metrics rollup (RECONCILE_SECRET protected)
 */

import { requireUuid, validate } from "../_shared/validate.ts";
import {
  serviceClient, userClient, requireUser, requireBusinessOwnership,
  workforceErrorResponse, WorkforceError, WorkforceErrorCodes,
} from "../_shared/workforce.ts";
import { constantTimeEqual } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop() ?? "";

  try {
    // ------------------------------------------------------------------
    // POST /rollup — internal cron endpoint
    // ------------------------------------------------------------------
    if (action === "rollup" && req.method === "POST") {
      const reconcileSecret = Deno.env.get("RECONCILE_SECRET") ?? "";
      const providedSecret = req.headers.get("x-reconcile-secret") ?? "";
      if (!reconcileSecret || !constantTimeEqual(reconcileSecret, providedSecret)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const svc = serviceClient();
      const periodEnd = new Date();
      const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

      // Aggregate completed/failed/cancelled tasks per business per agent
      const { data: taskMetrics } = await svc
        .from("agent_tasks")
        .select("business_id, assigned_agent_slug, status")
        .gte("updated_at", periodStart.toISOString())
        .lte("updated_at", periodEnd.toISOString());

      // Group by business_id + agent_slug
      const groups = new Map<string, {
        businessId: string;
        agentSlug: string;
        total: number;
        completed: number;
        failed: number;
        cancelled: number;
      }>();

      for (const row of taskMetrics ?? []) {
        const key = `${row.business_id}::${row.assigned_agent_slug ?? "unknown"}`;
        if (!groups.has(key)) {
          groups.set(key, {
            businessId: row.business_id,
            agentSlug: row.assigned_agent_slug ?? "unknown",
            total: 0, completed: 0, failed: 0, cancelled: 0,
          });
        }
        const g = groups.get(key)!;
        g.total++;
        if (row.status === "completed") g.completed++;
        else if (row.status === "failed") g.failed++;
        else if (row.status === "cancelled") g.cancelled++;
      }

      // Upsert rollups
      const rollups = Array.from(groups.values()).map((g) => ({
        business_id:     g.businessId,
        period_start:    periodStart.toISOString(),
        period_end:      periodEnd.toISOString(),
        agent_slug:      g.agentSlug,
        total_tasks:     g.total,
        completed_tasks: g.completed,
        failed_tasks:    g.failed,
        cancelled_tasks: g.cancelled,
      }));

      if (rollups.length > 0) {
        await svc.from("agent_performance_rollups").upsert(rollups, {
          onConflict: "business_id,period_start,period_end,agent_slug",
        });
      }

      return new Response(
        JSON.stringify({ processed: rollups.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ------------------------------------------------------------------
    // GET /summary — customer-facing metrics
    // ------------------------------------------------------------------
    if (action === "summary" && req.method === "GET") {
      const authHeader = req.headers.get("Authorization");
      const user = await requireUser(authHeader);
      const svc = serviceClient();

      const businessId = url.searchParams.get("businessId");
      if (!businessId) {
        return new Response(
          JSON.stringify({ error: "businessId is required", code: WorkforceErrorCodes.TENANT_CONTEXT_REQUIRED }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      await requireBusinessOwnership(svc, user.id, businessId);

      const uClient = userClient(authHeader!);

      // Active/recent workflows
      const { data: workflowCounts } = await uClient.rpc("count_workflows_by_status", {
        p_business_id: businessId,
      }).catch(() => ({ data: null }));

      // Directly query for counts
      const { data: workflows } = await uClient
        .from("agent_workflows")
        .select("status")
        .eq("business_id", businessId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const statusCounts: Record<string, number> = {};
      for (const w of workflows ?? []) {
        statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1;
      }

      // Pending approvals count
      const { count: pendingApprovals } = await uClient
        .from("agent_approvals")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "pending");

      // Open escalations count
      const { count: openEscalations } = await uClient
        .from("agent_escalations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "open");

      // Recent performance rollups
      const { data: rollups } = await uClient
        .from("agent_performance_rollups")
        .select("agent_slug, total_tasks, completed_tasks, failed_tasks, escalation_count")
        .eq("business_id", businessId)
        .order("period_start", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({
          workflowStatusCounts: statusCounts,
          pendingApprovals: pendingApprovals ?? 0,
          openEscalations: openEscalations ?? 0,
          recentRollups: rollups ?? [],
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
