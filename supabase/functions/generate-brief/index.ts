import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hours saved estimates per task type
const TIME_SAVINGS = {
  appointment_booked: 0.25,   // 15 min per booked appt (scheduling time saved)
  message_sent: 0.1,          // 6 min per message
  lead_contacted: 0.2,        // 12 min per lead follow-up
  approval_handled: 0.05,     // 3 min per auto-approved action
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const rawBody = await req.json();
    const { businessId } = rawBody;

    const validated = validate(() => ({
      businessId: requireUuid(businessId, "businessId"),
    }));
    if (validated instanceof Response) return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).eq("user_id", user.id).maybeSingle();
    if (!biz) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const periodStart = weekAgo.toISOString().split("T")[0];
    const periodEnd = now.toISOString().split("T")[0];

    // Gather data from last 7 days
    const [
      { data: appointments },
      { data: leads },
      { data: msgs },
      { data: campaigns },
      { data: pendingApprovals },
      { data: experiments },
    ] = await Promise.all([
      supabase.from("appointments").select("id, status, created_at").eq("business_id", businessId).gte("created_at", weekAgo.toISOString()),
      supabase.from("leads").select("id, status, created_at").eq("business_id", businessId).gte("created_at", weekAgo.toISOString()),
      supabase.from("messages").select("id, direction, status, created_at").eq("business_id", businessId).gte("created_at", weekAgo.toISOString()),
      supabase.from("campaign_executions").select("id, status, revenue_attributed_cents").eq("business_id", businessId),
      supabase.from("approvals").select("id").eq("business_id", businessId).eq("status", "pending"),
      supabase.from("growth_experiments").select("id, name, status").eq("business_id", businessId).eq("status", "running"),
    ]);

    const appointmentsBooked = (appointments || []).filter(a => a.status === "confirmed").length;
    const leadsConverted = (leads || []).filter(l => l.status === "converted").length;
    const messagesSent = (msgs || []).filter(m => m.direction === "outbound").length;
    const revenueAttributed = (campaigns || []).reduce((s, c) => s + (c.revenue_attributed_cents || 0), 0);
    const pendingApprovalsCount = (pendingApprovals || []).length;
    const currentExperiment = (experiments || [])[0]?.name || null;

    // Calculate hours saved
    const hoursSaved =
      appointmentsBooked * TIME_SAVINGS.appointment_booked +
      messagesSent * TIME_SAVINGS.message_sent +
      leadsConverted * TIME_SAVINGS.lead_contacted;

    // Generate health alerts
    const alerts = [];

    if (appointmentsBooked === 0 && (leads || []).length > 3) {
      alerts.push({
        business_id: businessId,
        type: "low_conversion",
        severity: "warning",
        title: "Leads not converting to appointments",
        message: `${(leads || []).length} leads this week but 0 appointments booked. Consider a more aggressive follow-up sequence.`,
        data: { leads: (leads || []).length, appointments: appointmentsBooked },
      });
    }

    if (pendingApprovalsCount > 5) {
      alerts.push({
        business_id: businessId,
        type: "approval_backlog",
        severity: "warning",
        title: "Approval backlog building up",
        message: `${pendingApprovalsCount} actions waiting for your approval. Ricky is paused on these tasks until you review.`,
        data: { count: pendingApprovalsCount },
      });
    }

    // Insert alerts
    if (alerts.length > 0) {
      await supabase.from("health_alerts").insert(alerts);
    }

    // Insert brief
    const { data: brief } = await supabase.from("executive_briefs").insert({
      business_id: businessId,
      period_start: periodStart,
      period_end: periodEnd,
      revenue_attributed_cents: revenueAttributed,
      appointments_booked: appointmentsBooked,
      leads_recovered: leadsConverted,
      hours_saved_estimate: hoursSaved,
      pending_approvals: pendingApprovalsCount,
      current_experiment: currentExperiment,
      next_recommended_action: appointmentsBooked === 0
        ? "Follow up with open leads to convert them to appointments"
        : pendingApprovalsCount > 0
        ? "Review pending approvals so Ricky can continue automated tasks"
        : "Consider launching a reactivation campaign for inactive customers",
      generated_at: now.toISOString(),
    }).select().single();

    return new Response(JSON.stringify({ brief, alertsGenerated: alerts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
