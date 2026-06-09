import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


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
  const svc = biz.services || "great service";
  const aud = biz.target_audience || "customers";
  const scenes = originalScript?.scenes || [];
  
  if (scenes.length === 0) {
    return { ...originalScript, title: `${name} — Fresh Promo`, usedFallbackScript: true };
  }

  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Pick random hook and CTA different each time
  const hookIdx = Math.floor(Math.random() * HOOK_VARIANTS.length);
  const ctaIdx = Math.floor(Math.random() * CTA_VARIANTS.length);

  // Large pool of middle-scene voiceover variants keyed by shotType
  const middleVoiceovers: Record<string, string[]> = {
    food: [
      `From our kitchen to your table — every bite tells a story.`,
      `Taste the difference that quality makes at ${name}.`,
      `Freshness you can see, flavor you can feel.`,
      `Handcrafted with the best ingredients ${city} has to offer.`,
      `Our ${svc.split(",")[0]?.trim() || "menu"} is made to impress.`,
      `This isn't fast food — this is ${name}.`,
    ],
    people: [
      `Our team makes every ${aud} feel like family.`,
      `Real smiles, real service, real ${city} hospitality.`,
      `${name}'s crew brings the energy every single day.`,
      `Our ${aud} are the reason we do what we do.`,
      `Community-first — that's the ${name} way.`,
      `Friendly faces you'll want to come back to.`,
    ],
    environment: [
      `Step inside and feel the ${name} difference.`,
      `A space designed for ${aud} who appreciate the details.`,
      `${name}'s atmosphere? Unmatched in ${city}.`,
      `Where comfort meets quality — welcome to ${name}.`,
      `${city}'s favorite spot for a reason.`,
      `Come for the ${cat}, stay for the vibe.`,
    ],
  };

  const middleOverlays: string[] = [
    `${name} Quality`, "Made Different", `${city} Favorite`, "Taste the Love",
    "Experience It", "Only the Best", `Since Day One`, "You Deserve This",
    "Built on Passion", "Come Hungry", "Stay Awhile", "Worth the Trip",
  ];

  const rewrittenScenes = scenes.map((scene: any, i: number) => {
    const isFirst = i === 0;
    const isLast = i === scenes.length - 1;
    const shotType = scene.shotType || "environment";
    
    let newVoiceover = scene.voiceover_line || "";
    let newOverlay = scene.text_overlay || "";
    
    if (isFirst) {
      newVoiceover = HOOK_VARIANTS[hookIdx](name, cat, city);
      newOverlay = pick([name, `Discover ${name}`, `${name} — ${city}`, `Meet ${name}`]);
    } else if (isLast) {
      newVoiceover = CTA_VARIANTS[ctaIdx](name);
      newOverlay = pick([`Visit ${name}!`, `Follow ${name}`, `Order Now`, `See You Soon!`]);
    } else {
      const pool = middleVoiceovers[shotType] || middleVoiceovers.environment;
      newVoiceover = pick(pool);
      newOverlay = pick(middleOverlays);
    }

    return { ...scene, voiceover_line: newVoiceover, text_overlay: newOverlay };
  });

  const fullVoiceover = rewrittenScenes.map((s: any) => s.voiceover_line).join(" ");
  const titles = [
    `${name} — ${cat.charAt(0).toUpperCase() + cat.slice(1)} Promo`,
    `Discover ${name} in ${city}`,
    `${name} — Made for ${aud}`,
    `Why ${city} Loves ${name}`,
    `Experience ${name}`,
  ];

  return {
    title: pick(titles),
    scenes: rewrittenScenes,
    voiceover_script: fullVoiceover,
    scene_captions: rewrittenScenes.map((s: any) => s.voiceover_line),
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const providerUsed = ANTHROPIC_API_KEY ? "anthropic" : "template_fallback";

    if (!ANTHROPIC_API_KEY) {
      const rewrittenScript = templateRewrite(currentScript, biz, loc);
      return new Response(JSON.stringify({ script: rewrittenScript, providerUsed: "template_fallback" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // ── Try AI rewrite, fall back to template-based rewrite if AI unavailable ──
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
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
