import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, requireString, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const rawBody = await req.json();
    const { businessId, url } = rawBody;

    const validated = validate(() => ({
      businessId: requireUuid(businessId, "businessId"),
      url: requireString(url, "url", 500),
    }));
    if (validated instanceof Response) return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Verify business ownership
    const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).eq("user_id", user.id).maybeSingle();
    if (!biz) return new Response(JSON.stringify({ error: "Business not found" }), { status: 403, headers: corsHeaders });

    // Create research job
    const { data: job } = await supabase.from("website_research_jobs").insert({
      business_id: businessId,
      url,
      status: "running",
    }).select().single();

    const jobId = job?.id;

    const pagesToFetch = [url, `${url}/services`, `${url}/about`, `${url}/contact`, `${url}/faq`, `${url}/hours`];
    let allText = "";
    let pagesFound = 0;

    for (const pageUrl of pagesToFetch) {
      try {
        const res = await fetch(pageUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const html = await res.text();
          const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000);
          allText += `\n--- PAGE: ${pageUrl} ---\n${text}`;
          pagesFound++;
        }
      } catch {
        // skip failed pages
      }
    }

    // Use Claude to extract structured facts
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let facts: Array<{ type: string; subject: string; value: Record<string, unknown>; confidence: number }> = [];

    if (anthropicKey && allText) {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Extract business facts from this website content. Return a JSON array of facts with this structure: [{"type":"service|hour|faq|policy|service_area|general","subject":"fact name","value":{"text":"..."},"confidence":0.0-1.0}]. Extract services offered, business hours, service areas, FAQs, and policies. Limit to 20 facts max.\n\nContent:\n${allText.slice(0, 4000)}`
          }],
        }),
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const content = claudeData.content?.[0]?.text || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try { facts = JSON.parse(jsonMatch[0]); } catch { facts = []; }
        }
      }
    }

    // Insert facts into business_knowledge
    if (facts.length > 0) {
      const rows = facts.map(f => ({
        business_id: businessId,
        type: f.type || "general",
        subject: f.subject || "Unknown",
        value: f.value || {},
        source_url: url,
        confidence: Math.min(1, Math.max(0, f.confidence || 0.5)),
        verification_status: "unverified",
      }));
      await supabase.from("business_knowledge").insert(rows);
    }

    // Update job status
    await supabase.from("website_research_jobs").update({
      status: "completed",
      pages_found: pagesFound,
      facts_extracted: facts.length,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, pagesFound, factsExtracted: facts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
