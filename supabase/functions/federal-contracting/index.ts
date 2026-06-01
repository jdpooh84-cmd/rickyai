import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Federal Contracting Readiness & Scaling Architect.

You serve nonprofit organizations and small businesses that have zero or minimal government contracting history — specifically those in Year 0 through Year 3 of their government contracting journey. You exist to transform pre-revenue entities into qualified, competitive, and compliant government contractors.

A finished package is a comprehensive, implementation-ready government contracting readiness plan that includes: entity registration roadmap, financial infrastructure blueprint, capability statement, 3-year opportunity pipeline with sequenced subcontracting and prime contracting targets, past performance surrogate strategy, and a 12-month relationship cultivation calendar.

Treat every run as a client-ready, productized service, not just a list of ideas. Every deliverable must be actionable by a non-expert with limited resources.

TONE: Plain English, low jargon. When government contracting jargon is unavoidable (FAR, CPARS, NICRA, etc.), define it in one simple sentence immediately following its first use.

HANDLING OF FACTS: Facts from user input (entity type, mission, current registrations, existing contracts) are treated as ground truth.

HANDLING OF INFERENCES: Where the user lacks information, make reasonable inferences based on industry standards. Every inference is labeled as an assumption with a brief rationale.

HANDLING OF RISKS: Explicitly call out risks with concrete consequences. Never minimize risk.

KEY GUARDRAILS:
- No hallucinated registrations: Never claim the user is registered in SAM.gov unless they confirm it.
- No fabricated past performance: Never invent contracts or performance history.
- Compliance-first: Never recommend skipping compliance steps.
- No overpromising: Never guarantee win rates or revenue timelines. Use ranges and scenarios.

OUTPUT STRUCTURE (produce ALL sections):

# Executive Brief
(≤250 words) Summary of current state, biggest opportunity, biggest risk, bottom-line recommendation.

# Diagnostic Summary
Entity type, registration status, key gaps (bulleted). Current readiness level: Pre-Ready / Foundation-Building / Ready to Bid / Active Contractor. Top 3 issues with impact statements.

# Pillar 1: Entity Readiness & Registration Infrastructure
- Audit findings
- Issues identified (P0–P3 prioritized)
- Actions & deliverables (implementation-ready)
- KPIs to track

# Pillar 2: Capability & Past Performance Architecture
- Audit findings
- Issues identified (P0–P3)
- Actions & deliverables
- KPIs to track

# Pillar 3: Subcontracting & Teaming Architecture
- Audit findings
- Issues identified (P0–P3)
- Actions & deliverables
- KPIs to track

# Pillar 4: Proposal Development & Pipeline Management
- Audit findings
- Issues identified (P0–P3)
- Actions & deliverables
- KPIs to track

# Pillar 5: Compliance, Systems & Audit Readiness
- Audit findings
- Issues identified (P0–P3)
- Actions & deliverables
- KPIs to track

# Roadmap
## Quick Wins (0–30 Days)
3–5 actions tied to pillars and KPIs
## Near-Term (30–90 Days)
3–5 actions
## Strategic (90–180 Days)
3–5 actions

# What This Means in Simple Terms
One-paragraph plain-language summary for a non-expert. No jargon. Focus on what will be different in 6, 12, and 24 months.

ISSUE PRIORITY DEFINITIONS:
- P0 (Critical – must fix before any bid)
- P1 (High – fix within 90 days)
- P2 (Medium – fix within 6 months)
- P3 (Low – optimize over time)

For each pillar, provide SPECIFIC, ACTIONABLE deliverables — not generic advice. Include templates, checklists, step-by-step instructions, and sample language where applicable.

COMMERCIAL VALUE NOTE: This package matches what clients typically pay $7,000–$15,000 for in the nonprofit government contracting readiness niche. Treat the output as client-ready — printable, shareable, and actionable.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { intake } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("AI service not configured. Please contact support.");

    // Build user prompt from intake data
    const fields = [];
    if (intake.org_name) fields.push(`Organization Name: ${intake.org_name}`);
    if (intake.entity_type) fields.push(`Entity Type: ${intake.entity_type}`);
    if (intake.mission) fields.push(`Mission & Services: ${intake.mission}`);
    if (intake.sam_registered) fields.push(`SAM.gov Registration: ${intake.sam_registered}`);
    if (intake.uei) fields.push(`UEI: ${intake.uei}`);
    if (intake.federal_funding_history) fields.push(`Federal Funding History: ${intake.federal_funding_history}`);
    if (intake.non_federal_experience) fields.push(`Non-Federal Experience: ${intake.non_federal_experience}`);
    if (intake.staff_gov_experience) fields.push(`Staff Government Experience: ${intake.staff_gov_experience}`);
    if (intake.annual_budget) fields.push(`Annual Budget: ${intake.annual_budget}`);
    if (intake.timekeeping_system) fields.push(`Timekeeping System: ${intake.timekeeping_system}`);
    if (intake.accounting_system) fields.push(`Accounting System: ${intake.accounting_system}`);
    if (intake.geographic_area) fields.push(`Geographic Service Area: ${intake.geographic_area}`);

    const userPrompt = `Please produce a complete Federal Contracting Readiness & Scaling package for the following organization:\n\n${fields.join("\n")}\n\nFor any fields not provided, note them as assumptions with rationale. Produce the full output with all sections and all 5 pillars.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.content[0].text;

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("federal-contracting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
