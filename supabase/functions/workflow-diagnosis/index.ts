import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosisOpportunity {
  title: string;
  current_state: string;
  automated_state: string;
  implementation_effort: string;
  time_to_value_days: number;
  estimated_hours_saved_per_month: number;
  estimated_revenue_impact: string;
  authority_level_required: number;
  ricky_feature: string;
  priority_score: number;
}

interface DiagnosisReport {
  executive_summary: string;
  maturity_score: number;
  opportunities: DiagnosisOpportunity[];
  recommended_first_action: string;
  missing_setup: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const validated = validate(() => ({
      businessId: requireUuid(body.businessId, "businessId"),
    }));
    if (validated instanceof Response) {
      return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { businessId } = validated;

    // Verify ownership
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, business_name, business_type, timezone, easystart_completed")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!biz) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

    // Load all available business context in parallel
    const [
      knowledgeRes,
      automationsRes,
      appointmentsRes,
      contactsRes,
      messagesRes,
      leadsRes,
      phoneCallsRes,
      experimentsRes,
    ] = await Promise.all([
      supabase
        .from("business_knowledge")
        .select("type, subject, value, confidence")
        .eq("business_id", businessId)
        .limit(50),
      supabase
        .from("lifecycle_automations")
        .select("name, trigger_event, active")
        .eq("business_id", businessId)
        .limit(20),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("phone_calls")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("growth_experiments")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "running"),
    ]);

    const knowledge = knowledgeRes.data || [];
    const automations = automationsRes.data || [];
    const appointmentCount = appointmentsRes.count ?? 0;
    const contactCount = contactsRes.count ?? 0;
    const messageCount = messagesRes.count ?? 0;
    const leadCount = leadsRes.count ?? 0;
    const phoneCallCount = phoneCallsRes.count ?? 0;
    const activeExperimentsCount = experimentsRes.count ?? 0;

    const knowledgeSummary = knowledge
      .slice(0, 20)
      .map((k: { type: string; subject: string; confidence: number }) => `${k.type}: ${k.subject} (confidence: ${k.confidence})`)
      .join("\n");

    const automationSummary = automations
      .map((a: { name: string; trigger_event: string; active: boolean }) => `- ${a.name} (trigger: ${a.trigger_event}, active: ${a.active})`)
      .join("\n");

    const contextSummary = `Business: ${biz.business_name}
Type: ${biz.business_type || "unspecified"}
EasyStart completed: ${biz.easystart_completed ? "yes" : "no"}

Usage metrics (last 30 days or total):
- Contacts total: ${contactCount}
- Leads total: ${leadCount}
- Appointments (30d): ${appointmentCount}
- Messages sent (30d): ${messageCount}
- Phone calls (30d): ${phoneCallCount}
- Active growth experiments: ${activeExperimentsCount}

Automations configured (${automations.length}):
${automationSummary || "None configured"}

Business knowledge facts (${knowledge.length} total, sample):
${knowledgeSummary || "No knowledge facts loaded"}`;

    const systemPrompt = `You are the Workflow Diagnosis Agent for Ricky AI. Your job is to identify the highest-value automation opportunities for a small business owner based on their current Ricky usage data.

Analyze the data and return a JSON report:
{
  "executive_summary": "2-3 sentence summary of current state",
  "maturity_score": 1-10,
  "opportunities": [
    {
      "title": "...",
      "current_state": "what they do manually today",
      "automated_state": "what Ricky would do instead",
      "implementation_effort": "low|medium|high",
      "time_to_value_days": 7-90,
      "estimated_hours_saved_per_month": number,
      "estimated_revenue_impact": "...",
      "authority_level_required": 0-3,
      "ricky_feature": "the existing Ricky feature that delivers this",
      "priority_score": 1-10
    }
  ],
  "recommended_first_action": "one specific thing to do this week",
  "missing_setup": ["list of Ricky features not yet configured that would unlock value"]
}

Rules:
- Maximum 5 opportunities
- Base all claims on the provided data — no invented metrics
- Only recommend features that exist in Ricky
- Sort opportunities by priority_score descending
- Be specific and actionable — not generic advice
- Respond with ONLY valid JSON — no markdown, no explanation`;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), { status: 500, headers: corsHeaders });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: contextSummary }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 502, headers: corsHeaders });
    }

    const anthropicData = await anthropicRes.json();
    const rawContent = anthropicData?.content?.[0]?.text || "";

    let report: DiagnosisReport;
    try {
      const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      report = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse diagnosis report JSON");
      return new Response(JSON.stringify({ error: "AI returned invalid report" }), { status: 502, headers: corsHeaders });
    }

    // Sort opportunities by priority_score descending and cap at 5
    if (Array.isArray(report.opportunities)) {
      report.opportunities = report.opportunities
        .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
        .slice(0, 5);
    }

    // Store result as a completed agent_jobs record
    await supabase.from("agent_jobs").insert({
      business_id: businessId,
      job_type: "workflow_diagnosis",
      status: "completed",
      input_json: { triggered_by: "manual", contact_count: contactCount },
      output_json: report,
      completed_at: now.toISOString(),
    });

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("workflow-diagnosis error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
