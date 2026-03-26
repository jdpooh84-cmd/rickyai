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

    const { businessId, videoType, productionMode, generateVoiceover } = await req.json();

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

    // Get user's API keys for external services
    const { data: userKeys } = await supabase
      .from("user_api_keys")
      .select("provider, api_key_encrypted")
      .eq("user_id", user.id);

    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });

    const heygenKey = keyMap["heygen"];
    const elevenlabsKey = keyMap["elevenlabs"];

    // Create job record
    const { data: job, error: jobInsertError } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: location?.id ?? null,
        provider: heygenKey ? "heygen" : "built_in_ai",
        status: "processing",
        request_payload: { businessId, videoType, productionMode },
      })
      .select("id")
      .single();

    if (jobInsertError) throw new Error(`Failed to create video job: ${jobInsertError.message}`);
    jobId = job.id;

    const locationStr = location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "Not specified";

    // Step 1: Generate the script via AI
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
            content: `You are a video production expert specializing in short-form social media content. Generate a complete, broadcast-ready video script. Return valid JSON only.`,
          },
          {
            role: "user",
            content: `Create a ${productionMode === "quick" ? "15-30 second" : productionMode === "longform" ? "2-3 minute" : "45-90 second"} video script for:

Business: ${business.business_name}
Category: ${business.business_category || "General"}
Niche: ${business.niche || "Not specified"}
Services: ${business.services || "Not specified"}
Target Audience: ${business.target_audience || "General"}
Brand Tone: ${business.brand_tone || "Professional"}
Location: ${locationStr}
Video Type: ${videoType || "promotional"}

Return JSON with:
{
  "title": "video title",
  "description": "short description for social media",
  "voiceover_script": "The complete word-for-word narration to be read aloud. Write naturally, conversationally. 30-60 words for quick, 80-150 for standard, 200+ for longform.",
  "scenes": [
    {
      "scene_number": 1,
      "duration_seconds": 5,
      "visual_description": "what the camera sees - describe the shot in detail",
      "text_overlay": "text shown on screen",
      "camera_direction": "push in / pan left / static / etc"
    }
  ],
  "caption": "social media post caption with emojis",
  "hashtags": ["relevant", "hashtags"],
  "target_platform": "tiktok/instagram/youtube",
  "aspect_ratio": "${productionMode === "quick" ? "9:16" : "16:9"}",
  "music_mood": "upbeat/calm/dramatic/etc",
  "cta": "call to action text"
}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!scriptResponse.ok) {
      const errText = await scriptResponse.text();
      throw new Error(`AI script generation failed: ${scriptResponse.status} ${errText}`);
    }

    const scriptData = await scriptResponse.json();
    let scriptContent;
    try {
      scriptContent = JSON.parse(scriptData.choices[0].message.content);
    } catch {
      throw new Error("Failed to parse AI script response");
    }

    // Step 2: If user has ElevenLabs key, generate voiceover
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && scriptContent.voiceover_script) {
      try {
        console.log("[generate-video] Generating ElevenLabs voiceover...");
        const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - professional female voice
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenlabsKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: scriptContent.voiceover_script,
              model_id: "eleven_monolingual_v1",
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          }
        );

        if (ttsResponse.ok) {
          // Upload audio to Supabase storage
          const audioBlob = await ttsResponse.blob();
          const audioFileName = `voiceovers/${user.id}/${job.id}.mp3`;

          // Ensure storage bucket exists
          await supabase.storage.createBucket("media", { public: true }).catch(() => {});

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("media")
            .upload(audioFileName, audioBlob, { contentType: "audio/mpeg", upsert: true });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from("media").getPublicUrl(audioFileName);
            voiceoverUrl = urlData.publicUrl;
            console.log("[generate-video] Voiceover uploaded:", voiceoverUrl);
          } else {
            console.error("[generate-video] Voiceover upload error:", uploadError);
          }
        } else {
          const errText = await ttsResponse.text();
          console.error("[generate-video] ElevenLabs error:", ttsResponse.status, errText);
        }
      } catch (voiceErr) {
        console.error("[generate-video] Voiceover generation failed:", voiceErr);
        // Non-fatal — continue without voiceover
      }
    }

    // Step 3: If user has HeyGen key, generate actual video
    let videoUrl: string | null = null;
    let heygenJobId: string | null = null;
    if (heygenKey) {
      try {
        console.log("[generate-video] Creating HeyGen video...");

        // Use HeyGen's v2 API to create a talking avatar video
        const heygenPayload: any = {
          video_inputs: [
            {
              character: {
                type: "avatar",
                avatar_id: "Anna_public_3_20240108", // Public avatar
                avatar_style: "normal",
              },
              voice: {
                type: "text",
                input_text: scriptContent.voiceover_script || scriptContent.description || `Welcome to ${business.business_name}!`,
                voice_id: "1bd001e7e50f421d891986aed6e1b4a", // Default professional voice
              },
              background: {
                type: "color",
                value: "#f5f5f5",
              },
            },
          ],
          dimension: {
            width: productionMode === "quick" ? 1080 : 1920,
            height: productionMode === "quick" ? 1920 : 1080,
          },
          test: false,
        };

        const heygenResponse = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: {
            "X-Api-Key": heygenKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(heygenPayload),
        });

        if (heygenResponse.ok) {
          const heygenData = await heygenResponse.json();
          heygenJobId = heygenData.data?.video_id;
          console.log("[generate-video] HeyGen video submitted:", heygenJobId);

          // Poll for completion (up to 5 minutes)
          if (heygenJobId) {
            let attempts = 0;
            const maxAttempts = 30; // 30 * 10s = 5 minutes
            while (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 10000)); // Wait 10s
              attempts++;

              const statusResponse = await fetch(
                `https://api.heygen.com/v1/video_status.get?video_id=${heygenJobId}`,
                { headers: { "X-Api-Key": heygenKey } }
              );

              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                const status = statusData.data?.status;
                console.log(`[generate-video] HeyGen poll #${attempts}: ${status}`);

                if (status === "completed") {
                  videoUrl = statusData.data?.video_url;
                  break;
                } else if (status === "failed") {
                  console.error("[generate-video] HeyGen video failed:", statusData.data?.error);
                  break;
                }
              }
            }
          }
        } else {
          const errText = await heygenResponse.text();
          console.error("[generate-video] HeyGen API error:", heygenResponse.status, errText);
        }
      } catch (heygenErr) {
        console.error("[generate-video] HeyGen generation failed:", heygenErr);
        // Non-fatal — we still have the script
      }
    }

    // Update job with results
    const finalStatus = videoUrl ? "completed" : "script_ready";
    const resultPayload = {
      ...scriptContent,
      voiceover_url: voiceoverUrl,
      video_url: videoUrl,
      heygen_job_id: heygenJobId,
      pipeline_steps: {
        script: "completed",
        voiceover: voiceoverUrl ? "completed" : elevenlabsKey ? "failed" : "skipped_no_key",
        video: videoUrl ? "completed" : heygenKey ? (heygenJobId ? "processing" : "failed") : "skipped_no_key",
      },
    };

    await supabase
      .from("video_generation_jobs")
      .update({
        status: finalStatus,
        result_payload: resultPayload,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Also save as content post for Ready to Post
    if (scriptContent.title) {
      await supabase.from("content_posts").insert({
        user_id: user.id,
        business_id: businessId,
        location_id: location?.id ?? null,
        title: scriptContent.title,
        caption: scriptContent.caption || scriptContent.description,
        hashtags: scriptContent.hashtags || [],
        media_url: videoUrl || voiceoverUrl || null,
        media_type: videoUrl ? "video" : voiceoverUrl ? "audio" : "text",
        platform: scriptContent.target_platform || "instagram",
        video_script: scriptContent.voiceover_script,
        voiceover_script: scriptContent.voiceover_script,
        shot_list: scriptContent.scenes,
        cta: scriptContent.cta,
        status: videoUrl ? "media_ready" : "caption_ready",
        production_tool: heygenKey ? "heygen" : "rickyai",
      }).catch(e => console.error("[generate-video] content_posts insert error:", e));
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: finalStatus,
      script: scriptContent,
      voiceover_url: voiceoverUrl,
      video_url: videoUrl,
      pipeline_steps: resultPayload.pipeline_steps,
      business_name: business.business_name,
      production_mode: productionMode,
      message: videoUrl
        ? "🎬 Video produced successfully! Download or share it directly."
        : voiceoverUrl
        ? "🎙️ Script + voiceover ready! Connect HeyGen to auto-generate the final video."
        : heygenKey
        ? "⏳ Video is being rendered by HeyGen. Check back in a few minutes."
        : "📝 Script generated! Connect HeyGen ($24/mo) + ElevenLabs (free tier) to produce the full video automatically.",
      next_steps: !heygenKey ? [
        "Connect HeyGen API key in Settings to generate real videos",
        "Connect ElevenLabs API key for professional voiceovers",
        "Or export this script to CapCut / Canva and produce manually"
      ] : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-video error:", error);

    if (jobId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("video_generation_jobs")
          .update({ status: "failed", error_message: error.message, updated_at: new Date().toISOString() })
          .eq("id", jobId);
      } catch {}
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
