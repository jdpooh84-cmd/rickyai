import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { businessId, locationId, productionMode, postFrequency, postSchedule, videoFormat } = await req.json();

    // Fetch business
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();
    if (!business) throw new Error("Business not found");

    // Fetch location
    let location = null;
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .eq("user_id", user.id)
        .single();
      location = loc;
    }

    // Fetch all prior strategy outputs for context
    const { data: priorOutputs } = await supabase
      .from("strategy_outputs")
      .select("step_number, step_name, output_data")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .order("step_number");

    const priorContext = priorOutputs?.map(o =>
      `Step ${o.step_number} (${o.step_name}): ${JSON.stringify(o.output_data).slice(0, 2000)}`
    ).join("\n\n") || "No prior strategy data available.";

    const formatSpec = videoFormat === "16:9"
      ? "16:9 horizontal (1920x1080) for YouTube, webinars, desktop"
      : "9:16 vertical (1080x1920) for TikTok, Reels, Shorts, Stories";

    const modeDesc = productionMode === "quick" ? "15-30 second social-first clips"
      : productionMode === "longform" ? "5-15 minute deep-dive content"
      : "1-3 minute balanced videos";

    const systemPrompt = `You are a full-service video content strategist and campaign planner for local businesses. You generate an ENTIRE campaign blueprint in a single response — episode ideas, hooks, derivatives, scripts, production specs, posting schedule, and compliance notes. You output structured JSON that downstream tools can consume directly as a "spec sheet." Return valid JSON only.`;

    const userPrompt = `Generate a complete Campaign Blueprint for this business in ONE shot. This is the "DNA" file that production tools will read.

BUSINESS CONTEXT:
Business: ${business.business_name}
Owner: ${business.owner_name || "Not specified"}
Category: ${business.business_category || "Not specified"}
Niche: ${business.niche || "Not specified"}
Website: ${business.website_url || "None"}
Target Audience: ${business.target_audience || "Not specified"}
Brand Tone: ${business.brand_tone || "Not specified"}
Services: ${business.services || "Not specified"}
Competitors: ${business.competitors || "Not specified"}
Content Goals: ${business.content_goals || "Not specified"}
Location: ${location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "Not specified"}

PRIOR STRATEGY DATA (use for context):
${priorContext}

PRODUCTION SETTINGS:
- Mode: ${modeDesc}
- Video Format: ${formatSpec}
- Posting Frequency: ${postFrequency?.replace("x", "") || "1"} posts per day
- Schedule Type: ${postSchedule || "weekly"}

Return this exact JSON structure:

{
  "campaign_name": "...",
  "campaign_summary": "...",
  "video_format": {
    "aspect_ratio": "${videoFormat || "9:16"}",
    "resolution": "${videoFormat === "16:9" ? "1920x1080" : "1080x1920"}",
    "orientation": "${videoFormat === "16:9" ? "horizontal" : "vertical"}"
  },
  "episodes": [
    {
      "episode_number": 1,
      "title": "...",
      "hook": "...opening hook (first 3 seconds)...",
      "body_outline": "...main content beats...",
      "cta": "...call to action...",
      "duration": "${productionMode === "quick" ? "30s" : productionMode === "longform" ? "8 min" : "90s"}",
      "mood": "energetic|calm|urgent|inspiring|educational",
      "music_cue": "...genre/mood description...",
      "broll_cues": ["...visual descriptions for B-roll..."],
      "text_overlays": ["...key text to show on screen..."],
      "pacing": "fast|medium|slow",
      "derivatives": [
        {"platform": "TikTok", "hook_variation": "...", "duration": "15s", "format": "9:16"},
        {"platform": "YouTube Shorts", "hook_variation": "...", "duration": "30s", "format": "9:16"},
        {"platform": "Instagram Reels", "hook_variation": "...", "duration": "30s", "format": "9:16"},
        {"platform": "Facebook", "hook_variation": "...", "duration": "60s", "format": "16:9"},
        {"platform": "LinkedIn", "hook_variation": "...", "duration": "60s", "format": "16:9"}
      ],
      "production_prompts": {
        "heygen": "...exact paste-ready prompt...",
        "invideo": "...exact paste-ready prompt...",
        "capcut": "...editing workflow...",
        "canva": "...template instructions...",
        "elevenlabs_voiceover": "...voiceover script with tone direction..."
      }
    }
  ],
  "posting_schedule": {
    "daily_posts": ${postFrequency?.replace("x", "") || "1"},
    "best_times_by_platform": [
      {"platform": "TikTok", "times": ["..."], "timezone_note": "Adjust based on audience location"},
      {"platform": "Instagram", "times": ["..."], "timezone_note": "..."},
      {"platform": "YouTube", "times": ["..."], "timezone_note": "..."}
    ],
    "weekly_calendar": [
      {"day": "Monday", "episodes": [1], "platforms": ["..."], "times": ["..."]}
    ]
  },
  "compliance_check": {
    "status": "pass|flag",
    "flagged_items": [
      {"episode": 1, "issue": "...", "severity": "high|medium|low", "suggestion": "..."}
    ],
    "brand_safe": true,
    "legal_notes": ["...any claims that need disclaimers..."],
    "music_clearance": ["...notes on music licensing..."]
  },
  "spec_sheet": {
    "brand_colors": ["...hex colors from business branding..."],
    "font_suggestions": ["..."],
    "logo_placement": "top-left|top-right|bottom-right",
    "watermark": false,
    "intro_template": "...description of standard intro...",
    "outro_template": "...description of standard outro with CTA..."
  },
  "weekly_review_prompt": "...the master prompt to use next week after reviewing performance CSV. This prompt should be updated based on what content performed best..."
}

Generate 4-7 episodes covering different content angles. Make hooks platform-specific and attention-grabbing. Include disclaimers noting posting times may differ by location and target audience.`;

    const aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    let outputData;
    try {
      outputData = JSON.parse(content);
    } catch {
      outputData = { raw: content };
    }

    // Save as strategy output step 14 (Campaign Blueprint)
    await supabase.from("strategy_outputs").upsert(
      {
        user_id: user.id,
        business_id: businessId,
        location_id: locationId || null,
        step_number: 14,
        step_name: "Campaign Blueprint",
        output_data: outputData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,business_id,step_number", ignoreDuplicates: false }
    ).then(({ error }) => {
      if (error) {
        // Fallback insert
        supabase.from("strategy_outputs").insert({
          user_id: user.id,
          business_id: businessId,
          location_id: locationId || null,
          step_number: 14,
          step_name: "Campaign Blueprint",
          output_data: outputData,
        });
      }
    });

    return new Response(JSON.stringify(outputData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
