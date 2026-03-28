import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Niche_Grant_Intel_UGIS (Unified Grant Intelligence System).

Core mission: Given ONE organization and ONE specific focus area (niche), build a complete grant-finding and prioritization brain for them. Treat every run as a productized "grant strategy package" that a consultant could charge real money for, not just a quick list of ideas.

OUTPUT ALL 8 SECTIONS IN ORDER:

# STEP 1 – ORGANIZATIONAL DNA
Rewrite the user's input into:
- A "mission capsule" (3–7 sentences): who they are, who they help, what problems they tackle, what makes them credible.
- 3–7 bullets: niche focus and who benefits.
- 3–7 bullets: strengths or unique angles (lived experience, data, partnerships, faith/community roots, innovation, reputation).

# STEP 2 – PROJECT PROFILE LIBRARY
Create 2–5 realistic "project profiles" that could attract grants. For each:
- Project name
- One-sentence goal
- Who it serves (concrete terms)
- What changes in 12–36 months (outcomes in plain language)
- Rough cost level (small/medium/large relative to org size)
- Type: "Safe/incremental" OR "Transformational/stretch"
Include at least 1 safe and 1 transformational profile.

# STEP 3 – FUNDER UNIVERSE
Map funder lanes for this niche and geography. Consider:
- Federal/state/local government programs
- Major private foundations
- Corporate/pharma/tech giving
- Hospital/health-system/university funding
- Community foundations and DAFs
- Faith-based and community philanthropies
- International/multilateral funders
For each relevant category: why it fits (or doesn't), keywords to search, typical award sizes, competition level, relationship importance.

# STEP 4 – HIGH-FIT OPPORTUNITY BLUEPRINTS
Create 5–15 opportunity blueprint slots (templates, not specific grants). For each:
- Opportunity type description
- Which project profile it fits
- Why high probability of success (alignment, geography, track record, capacity)
- Effort to apply (low/medium/high)
- Payoff if won (small/medium/large)
- Relationship notes (warm connections, pre-work)
Mix steady smaller + bigger transformational opportunities.

# STEP 5 – STRATEGIC VALIDATION (TOP 3–5 BETS)
Explain why focus beats volume. Then identify and label the top 3–5 "Priority Bets" from the blueprints. For each:
- Why it's priority
- What needs to be true to win
- What relationships would raise odds

# STEP 6 – DATA HYGIENE & PUBLIC PROFILE CHECKLIST
Tailored "Grant-Ready Footprint" checklist covering:
- Website basics
- GuideStar/Candid profiles
- Social media and stories
- Key documents (990s, audits, strategic plan, org chart, logic models)
For each: what to check, what "good enough for 2026" looks like, what's likely missing, 1–2 actions for next 60–90 days.

# STEP 7 – 12-MONTH PURSUIT & RELATIONSHIP ROADMAP
A) Next 30 days – "Get grant-ready" (5–10 specific actions)
B) Next 90 days – "Research and first flagship application" (5–10 actions)
C) Next 12 months – "Pipeline and relationship building" (5–10 actions)
Make it concrete and doable for a busy small-to-mid org.

# STEP 8 – HOW TO USE THIS PACK
3–7 bullets covering:
- What to review with leadership/board
- How to brief a grant consultant or writer
- How to turn blueprints into a living pipeline
- How to reuse project profiles across funders
- How often to refresh

End with: "When you find a specific RFP or funder that matches one of these opportunity blueprints, paste its description and I will switch into grant-writing mode to help you design a tailored strategy and narrative."

STYLE: Plain English, low jargon. Define any technical terms on first use. Be specific and actionable — not abstract consulting talk. Every section should feel like something worth paying for.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { intake } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const fields = [];
    if (intake.org_name) fields.push(`Organization Name: ${intake.org_name}`);
    if (intake.website_or_description) fields.push(`Website/Description: ${intake.website_or_description}`);
    if (intake.niche_focus) fields.push(`Niche/Focus Area: ${intake.niche_focus}`);
    if (intake.geography) fields.push(`Geography Served: ${intake.geography}`);
    if (intake.who_served) fields.push(`Who They Serve: ${intake.who_served}`);
    if (intake.budget_size) fields.push(`Annual Budget Size: ${intake.budget_size}`);
    if (intake.program_examples) fields.push(`Program Examples: ${intake.program_examples}`);
    if (intake.hard_limits) fields.push(`Hard Limits/Constraints: ${intake.hard_limits}`);

    const userPrompt = `Build a complete Grant Intelligence Pack for this organization:\n\n${fields.join("\n")}\n\nProduce all 8 steps with full detail. For any missing information, note assumptions and proceed with reasonable defaults.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("grant-intel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
