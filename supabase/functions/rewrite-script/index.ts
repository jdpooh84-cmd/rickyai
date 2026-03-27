import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

// ═══ Template-based rewrite — works with zero AI credits ═══
const HOOK_VARIANTS = [
  (name: string, cat: string, city: string) => `Discover why ${city} locals love ${name}.`,
  (name: string, cat: string, city: string) => `Ready for the best ${cat} experience? Meet ${name}.`,
  (name: string, cat: string, city: string) => `${name} — where ${city} comes for amazing ${cat}.`,
  (name: string, cat: string, city: string) => `Your search for great ${cat} in ${city} ends here.`,
  (name: string, cat: string, city: string) => `${city}'s favorite ${cat} spot? That's ${name}.`,
  (name: string, cat: string, city: string) => `Step inside ${name} and see what makes us special.`,
];

const CTA_VARIANTS = [
  (name: string) => `Visit ${name} today — you won't regret it!`,
  (name: string) => `Come see us at ${name}. We can't wait to serve you!`,
  (name: string) => `Follow us and discover more from ${name}.`,
  (name: string) => `${name} — your next favorite experience is waiting.`,
  (name: string) => `Book your visit to ${name} now!`,
];

function templateRewrite(originalScript: any, biz: any, loc: any): any {
  const name = biz.business_name || "Our Business";
  const cat = biz.business_category || "business";
  const city = loc?.city || "your area";
  const scenes = originalScript?.scenes || [];
  
  if (scenes.length === 0) {
    return { ...originalScript, title: `${name} — Fresh Promo`, usedFallbackScript: true };
  }

  // Pick random variants different from current text
  const hookIdx = Math.floor(Math.random() * HOOK_VARIANTS.length);
  const ctaIdx = Math.floor(Math.random() * CTA_VARIANTS.length);

  const rewrittenScenes = scenes.map((scene: any, i: number) => {
    const isFirst = i === 0;
    const isLast = i === scenes.length - 1;
    
    let newVoiceover = scene.voiceover_line || "";
    let newOverlay = scene.text_overlay || "";
    
    if (isFirst) {
      newVoiceover = HOOK_VARIANTS[hookIdx](name, cat, city);
      newOverlay = name;
    } else if (isLast) {
      newVoiceover = CTA_VARIANTS[ctaIdx](name);
      newOverlay = `Visit ${name}!`;
    } else {
      // Middle scenes: rephrase by swapping sentence structure
      const phrases = [
        `We take pride in our ${scene.shotType || "craft"}.`,
        `Quality ${scene.shotType || "service"} is what sets ${name} apart.`,
        `Experience the ${name} difference — ${scene.shotType || "excellence"} in every detail.`,
        `At ${name}, every ${scene.shotType || "moment"} is crafted with care.`,
        `This is what makes ${name} a ${city} favorite.`,
      ];
      newVoiceover = phrases[i % phrases.length];
      if (scene.text_overlay) {
        newOverlay = scene.text_overlay.split(" ").reverse().join(" ") !== scene.text_overlay
          ? scene.text_overlay
          : `${name} — ${scene.shotType || "Quality"}`;
      }
    }

    return {
      ...scene,
      voiceover_line: newVoiceover,
      text_overlay: newOverlay,
    };
  });

  const fullVoiceover = rewrittenScenes.map((s: any) => s.voiceover_line).join(" ");

  return {
    title: `${name} — ${cat.charAt(0).toUpperCase() + cat.slice(1)} Promo`,
    scenes: rewrittenScenes,
    voiceover_script: fullVoiceover,
    usedFallbackScript: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: corsHeaders });

    const { currentScript, businessId, lengthMode } = await req.json();
    if (!currentScript || !businessId) {
      return new Response(JSON.stringify({ error: "Missing currentScript or businessId" }), { status: 400, headers: corsHeaders });
    }

    // Fetch business profile
    const { data: biz } = await supabase.from("businesses").select("*").eq("id", businessId).single();
    if (!biz) return new Response(JSON.stringify({ error: "Business not found" }), { status: 404, headers: corsHeaders });

    // Fetch location
    const { data: loc } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("is_primary", true).maybeSingle();

    // Fetch any strategy data for context
    const { data: strategyRows } = await supabase
      .from("strategy_outputs")
      .select("output_data, step_name")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(3);

    const strategyContext = strategyRows?.map(r => `${r.step_name}: ${JSON.stringify(r.output_data).slice(0, 500)}`).join("\n") || "";

    // Serialize the current script for the prompt
    const currentScriptText = currentScript.scenes
      ?.map((s: any, i: number) => `Scene ${i + 1} (${s.shotType || "general"}, ${s.duration_seconds}s): ${s.voiceover_line || ""} | On-screen: ${s.text_overlay || ""}`)
      .join("\n") || JSON.stringify(currentScript);

    // Determine which LLM to use: check user's connected API keys
    let aiUrl = AI_URL;
    let aiModel = DEFAULT_MODEL;
    let aiHeaders: Record<string, string> = {};
    let providerUsed = "lovable_ai";

    const { data: userKeys } = await supabase
      .from("user_api_keys")
      .select("provider, api_key_encrypted")
      .eq("user_id", user.id)
      .eq("is_valid", true);

    const openaiKey = userKeys?.find(k => k.provider === "openai");
    const claudeKey = userKeys?.find(k => k.provider === "anthropic" || k.provider === "claude");

    if (openaiKey) {
      aiUrl = "https://api.openai.com/v1/chat/completions";
      aiModel = "gpt-4o";
      aiHeaders = { "Authorization": `Bearer ${openaiKey.api_key_encrypted}`, "Content-Type": "application/json" };
      providerUsed = "openai";
    } else if (claudeKey) {
      aiUrl = "https://api.anthropic.com/v1/messages";
      aiModel = "claude-sonnet-4-20250514";
      aiHeaders = { "x-api-key": claudeKey.api_key_encrypted, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
      providerUsed = "anthropic";
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "No AI service available. Connect ChatGPT or Claude in your settings, or try again later." }), { status: 503, headers: corsHeaders });
      }
      aiHeaders = { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    }

    const brandContext = [
      `Business: ${biz.business_name}`,
      biz.business_category ? `Category: ${biz.business_category}` : "",
      biz.services ? `Services: ${biz.services}` : "",
      biz.target_audience ? `Audience: ${biz.target_audience}` : "",
      biz.brand_tone ? `Brand tone: ${biz.brand_tone}` : "",
      biz.niche ? `Niche: ${biz.niche}` : "",
      loc ? `Location: ${loc.city}, ${loc.state || ""}` : "",
      strategyContext ? `Strategy insights:\n${strategyContext}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are a professional video script writer for small business promos.
Rewrite the script below with fresh wording: different hook, varied phrasing, but keep the same meaning, scene count, and approximate durations.
Use the brand context to keep it specific to this business.
Return ONLY valid JSON matching this structure (no markdown, no backticks):
{
  "title": "string",
  "scenes": [{ "shotType": "string", "visual": "string", "camera": "string", "voiceover_line": "string", "text_overlay": "string", "duration_seconds": number }],
  "voiceover_script": "string (full narration combined)"
}

Brand context:
${brandContext}

Length mode: ${lengthMode || "standard"}`;

    let rewrittenScript: any = null;

    // ── Try AI rewrite, fall back to template-based rewrite if credits exhausted ──
    try {
      if (providerUsed === "anthropic") {
        const resp = await fetch(aiUrl, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            model: aiModel,
            max_tokens: 2000,
            system: systemPrompt,
            messages: [{ role: "user", content: `Here is the current script to rewrite:\n\n${currentScriptText}` }],
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Anthropic error:", resp.status, errText);
          throw new Error(`AI_PROVIDER_ERROR_${resp.status}`);
        }
        const data = await resp.json();
        const text = data.content?.[0]?.text || "";
        rewrittenScript = JSON.parse(text);
      } else {
        const resp = await fetch(aiUrl, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Here is the current script to rewrite:\n\n${currentScriptText}` },
            ],
            temperature: 0.9,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error("AI error:", resp.status, errText);
          throw new Error(`AI_PROVIDER_ERROR_${resp.status}`);
        }
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
        rewrittenScript = JSON.parse(cleaned);
      }
    } catch (aiErr: any) {
      console.log("AI rewrite failed, using template fallback:", aiErr.message);
      // Template-based rewrite — no AI needed
      rewrittenScript = templateRewrite(currentScript, biz, loc);
      providerUsed = "template_fallback";
    }

    if (!rewrittenScript?.scenes?.length) {
      // Last resort: return shuffled original
      rewrittenScript = templateRewrite(currentScript, biz, loc);
      providerUsed = "template_fallback";
    }

    return new Response(JSON.stringify({ script: rewrittenScript, providerUsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("rewrite-script error:", err);
    return new Response(JSON.stringify({ error: err.message || "Script rewrite failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
