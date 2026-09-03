import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireString, requireUuid, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskPlan {
  agent_key: string;
  title: string;
  description: string;
  authority_level: number;
  input_context: Record<string, unknown>;
  depends_on_task_index: number | null;
}

interface ProjectPlan {
  project_title: string;
  executive_summary: string;
  estimated_value: string;
  tasks: TaskPlan[];
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
      goal: requireString(body.goal, "goal", 2000),
    }));
    if (validated instanceof Response) {
      return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { businessId, goal } = validated;
    const priority = typeof body.priority === "number" ? Math.min(10, Math.max(1, Math.round(body.priority))) : 5;

    // Verify business ownership
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, business_name, business_type, timezone")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!biz) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    // Load recent projects for context (last 5)
    const { data: recentProjects } = await supabase
      .from("orchestrator_projects")
      .select("title, goal, status, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentContext = (recentProjects || [])
      .map((p: { title: string; status: string }) => `- "${p.title}" (${p.status})`)
      .join("\n");

    const systemPrompt = `You are Ricky COO, the AI orchestrator for ${biz.business_name}. You decompose business goals into concrete execution plans.

Your authority levels:
- L0 (auto): analyze, research, summarize, classify, draft internally
- L1 (auto): prepare plans, proposals, reports — no external action
- L2 (auto with log): update internal records, tag contacts, schedule internal tasks
- L3 (approval required): send SMS/email externally, publish content, modify live automations
- L4 (human-only): financial transactions, legal actions, delete data, access sensitive records

For each goal, produce a JSON project plan:
{
  "project_title": "...",
  "executive_summary": "...",
  "estimated_value": "...",
  "tasks": [
    {
      "agent_key": "one of: workflow_diagnosis|growth_scout|yield_optimizer|engagement_sender|appointment_manager|campaign_launcher|reputation_manager|qa_reviewer",
      "title": "...",
      "description": "...",
      "authority_level": 0-4,
      "input_context": { ...relevant context for the agent... },
      "depends_on_task_index": null or integer
    }
  ]
}

Rules:
- Maximum 8 tasks per project
- L3 tasks must have a clear "human_summary" explaining exactly what will be sent/published and to whom
- L4 tasks: describe them but mark them for human-only execution — never create them as automated tasks
- Always include a qa_reviewer task after any L3 task
- Err toward fewer, higher-value tasks rather than many small tasks
- If the goal is unclear, create a workflow_diagnosis task first to gather information
- Respond with ONLY valid JSON — no markdown, no explanation`;

    const userPrompt = `Business: ${biz.business_name} (${biz.business_type || "small business"})
Timezone: ${biz.timezone || "UTC"}
${recentContext ? `\nRecent projects:\n${recentContext}` : ""}

Goal: ${goal}`;

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
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ error: "AI planning failed" }), { status: 502, headers: corsHeaders });
    }

    const anthropicData = await anthropicRes.json();
    const rawContent = anthropicData?.content?.[0]?.text || "";

    let plan: ProjectPlan;
    try {
      // Strip any markdown fences if present
      const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      plan = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse orchestrator plan JSON");
      return new Response(JSON.stringify({ error: "AI returned invalid plan" }), { status: 502, headers: corsHeaders });
    }

    // Validate plan shape minimally
    if (!plan.project_title || !Array.isArray(plan.tasks)) {
      return new Response(JSON.stringify({ error: "AI plan is missing required fields" }), { status: 502, headers: corsHeaders });
    }

    // Cap tasks at 8
    const tasks = plan.tasks.slice(0, 8);

    // Insert the project
    const { data: project, error: projErr } = await supabase
      .from("orchestrator_projects")
      .insert({
        business_id: businessId,
        title: plan.project_title,
        goal,
        status: "active",
        priority,
        owner_agent: "ricky_coo",
        executive_summary: plan.executive_summary || null,
      })
      .select("id")
      .single();

    if (projErr || !project) {
      console.error("Failed to insert project:", projErr?.message);
      return new Response(JSON.stringify({ error: "Failed to create project" }), { status: 500, headers: corsHeaders });
    }

    const projectId = project.id;
    let tasksCreated = 0;
    let approvalsRequired = 0;

    for (const task of tasks) {
      const authorityLevel = typeof task.authority_level === "number"
        ? Math.min(4, Math.max(0, task.authority_level))
        : 0;

      let taskStatus: string;
      if (authorityLevel <= 2) {
        taskStatus = "pending";
      } else if (authorityLevel === 3) {
        taskStatus = "awaiting_approval";
      } else {
        // L4: document but do not execute
        taskStatus = "blocked";
      }

      const { data: insertedTask, error: taskErr } = await supabase
        .from("orchestrator_tasks")
        .insert({
          project_id: projectId,
          business_id: businessId,
          agent_key: task.agent_key || "workflow_diagnosis",
          title: task.title || "Unnamed task",
          description: task.description || null,
          authority_level: authorityLevel,
          status: taskStatus,
          input_context: task.input_context || {},
        })
        .select("id")
        .single();

      if (taskErr || !insertedTask) {
        console.error("Failed to insert task:", taskErr?.message);
        continue;
      }

      tasksCreated++;

      if (authorityLevel <= 2) {
        // Queue for automated execution
        await supabase.from("agent_jobs").insert({
          business_id: businessId,
          job_type: task.agent_key || "workflow_diagnosis",
          status: "queued",
          input_json: {
            orchestrator_task_id: insertedTask.id,
            project_id: projectId,
            ...(task.input_context || {}),
          },
        });
      } else if (authorityLevel === 3) {
        // Create approval record
        const humanSummary = (task.input_context as Record<string, unknown>)?.human_summary as string
          || task.description
          || task.title;

        const { data: approval, error: approvalErr } = await supabase
          .from("approvals")
          .insert({
            business_id: businessId,
            action_type: task.agent_key || "external_action",
            risk_level: "high",
            human_summary: humanSummary,
            status: "pending",
            expires_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          })
          .select("id")
          .single();

        if (!approvalErr && approval) {
          // Link approval to task
          await supabase
            .from("orchestrator_tasks")
            .update({ approval_id: approval.id })
            .eq("id", insertedTask.id);
          approvalsRequired++;
        }
      }
      // L4: inserted as blocked, no agent_jobs or approvals created
    }

    console.log(`Orchestrator project created: ${projectId}, tasks: ${tasksCreated}, approvals: ${approvalsRequired}`);

    return new Response(
      JSON.stringify({
        projectId,
        title: plan.project_title,
        executiveSummary: plan.executive_summary || null,
        estimatedValue: plan.estimated_value || null,
        tasksCreated,
        approvalsRequired,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("ricky-orchestrator error:", msg);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
