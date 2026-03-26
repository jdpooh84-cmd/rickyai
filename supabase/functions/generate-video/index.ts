import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

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

    // ── Step 1: Generate the script via AI ──
    const scriptResponse = await fetch(AI_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are a video production expert specializing in short-form social media content. Generate a complete, broadcast-ready video script. Return valid JSON only." },
          { role: "user", content: `Create a ${productionMode === "quick" ? "15-30 second" : productionMode === "longform" ? "2-3 minute" : "45-90 second"} video script for:

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
  "voiceover_script": "The complete word-for-word narration. 30-60 words for quick, 80-150 for standard, 200+ for longform.",
  "scenes": [
    {
      "scene_number": 1,
      "duration_seconds": 5,
      "visual_description": "what the camera sees - describe in detail for AI image generation",
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
}` },
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

    // ── Step 2: Generate scene images using built-in AI (FREE) ──
    const sceneImageUrls: string[] = [];
    const scenesToRender = (scriptContent.scenes || []).slice(0, 4);

    // Ensure storage bucket exists
    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    for (let i = 0; i < scenesToRender.length; i++) {
      const scene = scenesToRender[i];
      try {
        console.log(`[generate-video] Generating scene image ${i + 1}/${scenesToRender.length}...`);
        const imgResponse = await fetch(AI_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: IMAGE_MODEL,
            messages: [{
              role: "user",
              content: `Generate a high-quality, professional promotional photograph for "${business.business_name}" (${business.business_category || "business"}). Scene: ${scene.visual_description}. Style: cinematic, vibrant, commercial photography, social media ready. Location: ${locationStr}. Do NOT include any text in the image.`,
            }],
            modalities: ["image", "text"],
          }),
        });

        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          const message = imgData.choices?.[0]?.message;
          const images = message?.images;

          if (images && images.length > 0) {
            let base64Data = images[0]?.image_url?.url || "";
            if (base64Data.startsWith("data:") && base64Data.includes(";base64,")) {
              base64Data = base64Data.split(";base64,")[1];
            }

            if (base64Data) {
              // Decode base64 to bytes
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              const fileName = `scenes/${user.id}/${job.id}/scene-${i + 1}.png`;
              const { error: uploadError } = await supabase.storage
                .from("media")
                .upload(fileName, bytes, { contentType: "image/png", upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
                sceneImageUrls.push(urlData.publicUrl);
                console.log(`[generate-video] Scene ${i + 1} image uploaded: ${urlData.publicUrl}`);
              } else {
                console.error(`[generate-video] Scene ${i + 1} upload error:`, uploadError);
              }
            }
          }
        } else {
          const errText = await imgResponse.text();
          console.error(`[generate-video] Scene ${i + 1} image generation failed: ${imgResponse.status}`, errText);
        }
      } catch (imgErr) {
        console.error(`[generate-video] Scene ${i + 1} image error:`, imgErr);
        // Non-fatal — continue
      }
    }

    // ── Step 3: If user has ElevenLabs key, generate voiceover ──
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && scriptContent.voiceover_script) {
      try {
        console.log("[generate-video] Generating ElevenLabs voiceover...");
        const voiceId = "21m00Tcm4TlvDq8ikWAM";
        const ttsResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: { "xi-api-key": elevenlabsKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: scriptContent.voiceover_script,
              model_id: "eleven_monolingual_v1",
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          }
        );

        if (ttsResponse.ok) {
          const audioBlob = await ttsResponse.blob();
          const audioFileName = `voiceovers/${user.id}/${job.id}.mp3`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("media")
            .upload(audioFileName, audioBlob, { contentType: "audio/mpeg", upsert: true });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from("media").getPublicUrl(audioFileName);
            voiceoverUrl = urlData.publicUrl;
          }
        }
      } catch (voiceErr) {
        console.error("[generate-video] Voiceover generation failed:", voiceErr);
      }
    }

    // ── Step 4: If user has HeyGen key, generate actual video ──
    let videoUrl: string | null = null;
    let heygenJobId: string | null = null;
    if (heygenKey) {
      try {
        const heygenPayload = {
          video_inputs: [{
            character: { type: "avatar", avatar_id: "Anna_public_3_20240108", avatar_style: "normal" },
            voice: {
              type: "text",
              input_text: scriptContent.voiceover_script || scriptContent.description || `Welcome to ${business.business_name}!`,
              voice_id: "1bd001e7e50f421d891986aed6e1b4a",
            },
            background: { type: "color", value: "#f5f5f5" },
          }],
          dimension: {
            width: productionMode === "quick" ? 1080 : 1920,
            height: productionMode === "quick" ? 1920 : 1080,
          },
          test: false,
        };

        const heygenResponse = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
          body: JSON.stringify(heygenPayload),
        });

        if (heygenResponse.ok) {
          const heygenData = await heygenResponse.json();
          heygenJobId = heygenData.data?.video_id;

          if (heygenJobId) {
            let attempts = 0;
            while (attempts < 30) {
              await new Promise(r => setTimeout(r, 10000));
              attempts++;
              const statusResponse = await fetch(
                `https://api.heygen.com/v1/video_status.get?video_id=${heygenJobId}`,
                { headers: { "X-Api-Key": heygenKey } }
              );
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.data?.status === "completed") {
                  videoUrl = statusData.data?.video_url;
                  break;
                } else if (statusData.data?.status === "failed") break;
              }
            }
          }
        }
      } catch (heygenErr) {
        console.error("[generate-video] HeyGen generation failed:", heygenErr);
      }
    }

    // ── Update job with results ──
    const hasImages = sceneImageUrls.length > 0;
    const finalStatus = videoUrl ? "completed" : hasImages ? "media_ready" : "script_ready";
    const resultPayload = {
      ...scriptContent,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_url: videoUrl,
      heygen_job_id: heygenJobId,
      pipeline_steps: {
        script: "completed",
        scene_images: hasImages ? "completed" : "failed",
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

    // Save as content post for Ready to Post
    if (scriptContent.title) {
      const { error: postErr } = await supabase.from("content_posts").insert({
        user_id: user.id,
        business_id: businessId,
        location_id: location?.id ?? null,
        title: scriptContent.title,
        caption: scriptContent.caption || scriptContent.description,
        hashtags: scriptContent.hashtags || [],
        media_url: videoUrl || sceneImageUrls[0] || voiceoverUrl || null,
        media_type: videoUrl ? "video" : hasImages ? "image" : voiceoverUrl ? "audio" : "text",
        platform: scriptContent.target_platform || "instagram",
        video_script: scriptContent.voiceover_script,
        voiceover_script: scriptContent.voiceover_script,
        shot_list: scriptContent.scenes,
        cta: scriptContent.cta,
        status: videoUrl ? "media_ready" : hasImages ? "media_ready" : "caption_ready",
        production_tool: heygenKey ? "heygen" : "rickyai",
        thumbnail_url: sceneImageUrls[0] || null,
      });
      if (postErr) console.error("[generate-video] content_posts insert error:", postErr);
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: finalStatus,
      script: scriptContent,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_url: videoUrl,
      pipeline_steps: resultPayload.pipeline_steps,
      business_name: business.business_name,
      production_mode: productionMode,
      message: videoUrl
        ? "🎬 Video produced successfully! Download or share it directly."
        : hasImages
        ? `🖼️ ${sceneImageUrls.length} professional scene images + script generated! Import them into CapCut or Canva to assemble your video in minutes.`
        : voiceoverUrl
        ? "🎙️ Script + voiceover ready! Connect HeyGen to auto-generate the final video."
        : "📝 Script generated! Connect ElevenLabs (free tier) for voiceover or HeyGen ($24/mo) for full video.",
      next_steps: videoUrl ? [] : [
        hasImages ? "Import these scene images into CapCut (free) to create your video" : null,
        hasImages ? "Or use Canva Video to turn these scenes into an animated slideshow" : null,
        !elevenlabsKey ? "Add ElevenLabs API key (free tier) for professional voiceover" : null,
        !heygenKey ? "Add HeyGen API key ($24/mo) for fully automated video rendering" : null,
      ].filter(Boolean),
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
