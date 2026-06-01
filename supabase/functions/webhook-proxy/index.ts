import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { scenario, businessId, keyword, videoType, productionMode } = await req.json();

    // Check usage limits before proceeding
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", user.id)
      .gte("period_start", periodStart)
      .limit(1)
      .maybeSingle();

    const renderJobsUsed = usage?.render_jobs_used || 0;
    const RENDER_LIMIT = 50; // per seat per month

    if (renderJobsUsed >= RENDER_LIMIT) {
      return new Response(JSON.stringify({
        error: "Monthly video limit reached",
        code: "USAGE_LIMIT_REACHED",
        usage: { render_jobs_used: renderJobsUsed, limit: RENDER_LIMIT },
        upgrade_required: true,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get webhook config from admin table
    const { data: webhookConfig } = await supabase
      .from("webhook_config")
      .select("*")
      .eq("scenario_type", scenario)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // Get user's external API keys (HeyGen, ElevenLabs etc.)
    const { data: userKeys } = await supabase
      .from("user_api_keys")
      .select("provider, api_key_encrypted")
      .eq("user_id", user.id);

    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });

    // Fetch business data
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();
    if (!business) throw new Error("Business not found");

    const { data: locations } = await supabase
      .from("locations")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1);
    const location = locations?.[0];

    // If webhook is configured, call Make.com
    if (webhookConfig?.webhook_url) {
      const webhookPayload = {
        user_id: user.id,
        business_name: business.business_name,
        business_category: business.business_category,
        niche: business.niche,
        services: business.services,
        target_audience: business.target_audience,
        brand_tone: business.brand_tone,
        location: location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "",
        keyword: keyword || "",
        video_type: videoType || "promotional",
        production_mode: productionMode || "standard",
        // Pass user's own API keys for external services
        heygen_api_key: keyMap["heygen"] || "(place API key here)",
        elevenlabs_api_key: keyMap["elevenlabs"] || "(place API key here)",
        invideo_api_key: keyMap["invideo"] || "(place API key here)",
      };

      const webhookResponse = await fetch(webhookConfig.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });

      if (!webhookResponse.ok) {
        const errText = await webhookResponse.text();
        throw new Error(`Webhook error: ${webhookResponse.status} - ${errText}`);
      }

      // Increment usage
      await incrementUsage(supabase, user.id, periodStart);

      const result = await webhookResponse.json().catch(() => ({ status: "triggered" }));

      const messageMap: Record<string, string> = {
        video_production: "Video production started! Your video will be ready in 5-10 minutes.",
        manus_production: "Manus AI video pipeline triggered! Your video will render and merge with voiceover automatically.",
        research_pipeline: "Research pipeline triggered. Results will appear in your content pipeline.",
        social_posting: "Posting workflow triggered.",
      };

      return new Response(JSON.stringify({
        success: true,
        source: "make_webhook",
        status: "processing",
        scenario,
        data: result,
        message: messageMap[scenario] || "Workflow triggered.",
        usage: { render_jobs_used: renderJobsUsed + 1, limit: RENDER_LIMIT },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: use built-in AI if no webhook configured
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("No webhook configured and ANTHROPIC_API_KEY not available");

    const scriptResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: `You are a video production expert. Generate a complete video production plan. Return valid JSON with: title, description, script (60-90 second narration), scenes (array of scene descriptions with timestamps), voiceover_text, captions (array with timestamp and text), hashtags, target_platform, aspect_ratio.`,
        messages: [
          {
            role: "user",
            content: `Create a ${productionMode === "quick" ? "15-30 second" : productionMode === "longform" ? "5-15 minute" : "60-90 second"} video plan for:
Business: ${business.business_name}
Category: ${business.business_category || "General"}
Niche: ${business.niche || "Not specified"}
Services: ${business.services || "Not specified"}
Target Audience: ${business.target_audience || "General"}
Brand Tone: ${business.brand_tone || "Professional"}
Location: ${location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "Not specified"}
Video Type: ${videoType || "promotional"}
Keyword: ${keyword || "not specified"}`
          }
        ],
      }),
    });

    if (!scriptResponse.ok) {
      throw new Error(`AI error: ${scriptResponse.status}`);
    }

    const scriptData = await scriptResponse.json();
    let content;
    try {
      content = JSON.parse(scriptData.content[0].text);
    } catch {
      content = { raw: scriptData.content[0].text };
    }

    await incrementUsage(supabase, user.id, periodStart);

    return new Response(JSON.stringify({
      success: true,
      source: "built_in_ai",
      status: "completed",
      script: content,
      business_name: business.business_name,
      production_mode: productionMode,
      usage: { render_jobs_used: renderJobsUsed + 1, limit: RENDER_LIMIT },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("webhook-proxy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function incrementUsage(supabase: any, userId: string, periodStart: string) {
  const periodEnd = new Date(new Date(periodStart).getFullYear(), new Date(periodStart).getMonth() + 1, 1).toISOString();
  
  const { data: existing } = await supabase
    .from("usage_tracking")
    .select("id, render_jobs_used")
    .eq("user_id", userId)
    .gte("period_start", periodStart)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("usage_tracking")
      .update({ render_jobs_used: (existing.render_jobs_used || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("usage_tracking")
      .insert({ user_id: userId, render_jobs_used: 1, period_start: periodStart, period_end: periodEnd });
  }
}
