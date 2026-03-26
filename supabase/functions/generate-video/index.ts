import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let jobId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { businessId, videoType, productionMode } = await req.json();

    const requestPayload = { businessId, videoType, productionMode };

    // Fetch business data
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();
    if (!business) throw new Error("Business not found");

    // Fetch location
    const { data: locations } = await supabase
      .from("locations")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1);
    const location = locations?.[0];

    const { data: job, error: jobInsertError } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: location?.id ?? null,
        provider: "built_in_ai",
        status: "processing",
        request_payload: requestPayload,
      })
      .select("id")
      .single();

    if (jobInsertError) throw new Error(`Failed to create video job: ${jobInsertError.message}`);
    jobId = job.id;

    // Generate video script using AI
    const scriptResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a video production expert. Generate a detailed video production prompt that would be given to an AI video generator. The prompt should describe the visual content, mood, camera movements, and style. Return valid JSON."
          },
          {
            role: "user",
            content: `Create a ${productionMode === "quick" ? "15-30 second social media" : productionMode === "longform" ? "detailed long-form" : "1-2 minute standard"} video prompt for this business:

Business: ${business.business_name}
Category: ${business.business_category || "General"}
Niche: ${business.niche || "Not specified"}
Services: ${business.services || "Not specified"}
Target Audience: ${business.target_audience || "General"}
Brand Tone: ${business.brand_tone || "Professional"}
Location: ${location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "Not specified"}
Video Type: ${videoType || "promotional"}

Return JSON:
{
  "video_prompt": "...detailed prompt for AI video generation describing scenes, visuals, mood, camera movement...",
  "title": "...video title...",
  "description": "...short description...",
  "suggested_text_overlay": "...text to show on video...",
  "target_platform": "...best platform for this video...",
  "aspect_ratio": "${productionMode === "quick" ? "9:16" : "16:9"}",
  "hashtags": ["...relevant hashtags..."]
}`
          }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!scriptResponse.ok) {
      const errText = await scriptResponse.text();
      throw new Error(`AI script error: ${scriptResponse.status} ${errText}`);
    }

    const scriptData = await scriptResponse.json();
    let scriptContent;
    try {
      scriptContent = JSON.parse(scriptData.choices[0].message.content);
    } catch {
      throw new Error("Failed to parse AI script response");
    }

    await supabase
      .from("video_generation_jobs")
      .update({
        status: "completed",
        result_payload: scriptContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      script: scriptContent,
      business_name: business.business_name,
      production_mode: productionMode,
      status: "completed",
      message: "Video brief generated and saved. Your setup now survives refreshes and interruptions.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-video error:", error);

    try {
      if (jobId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from("video_generation_jobs")
          .update({
            status: "failed",
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    } catch (jobUpdateError) {
      console.error("generate-video job update error:", jobUpdateError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
