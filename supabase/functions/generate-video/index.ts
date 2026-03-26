import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

async function processVideoJob(jobId: string, userId: string, businessId: string, videoType: string, productionMode: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");

    const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];

    const { data: userKeys } = await supabase.from("user_api_keys").select("provider, api_key_encrypted").eq("user_id", userId);
    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });
    const heygenKey = keyMap["heygen"];
    const elevenlabsKey = keyMap["elevenlabs"];

    const locationStr = location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "Not specified";

    // Update status: generating script
    await supabase.from("video_generation_jobs").update({ status: "generating_script", updated_at: new Date().toISOString() }).eq("id", jobId);

    // ── Step 1: Generate script ──
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

    // Save script immediately so user sees progress
    await supabase.from("video_generation_jobs").update({
      status: "generating_images",
      result_payload: { ...scriptContent, scene_images: [], pipeline_steps: { script: "completed", scene_images: "processing" } },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    // ── Step 2: Generate scene images ──
    const sceneImageUrls: string[] = [];
    const scenesToRender = (scriptContent.scenes || []).slice(0, 4);

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
          const images = imgData.choices?.[0]?.message?.images;
          if (images && images.length > 0) {
            let base64Data = images[0]?.image_url?.url || "";
            if (base64Data.startsWith("data:") && base64Data.includes(";base64,")) {
              base64Data = base64Data.split(";base64,")[1];
            }
            if (base64Data) {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              const fileName = `scenes/${userId}/${jobId}/scene-${i + 1}.png`;
              const { error: uploadError } = await supabase.storage.from("media").upload(fileName, bytes, { contentType: "image/png", upsert: true });
              if (!uploadError) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
                sceneImageUrls.push(urlData.publicUrl);
                console.log(`[generate-video] Scene ${i + 1} image uploaded: ${urlData.publicUrl}`);
              }
            }
          }
        } else {
          const errText = await imgResponse.text();
          console.error(`[generate-video] Scene ${i + 1} failed: ${imgResponse.status}`, errText);
        }
      } catch (imgErr) {
        console.error(`[generate-video] Scene ${i + 1} error:`, imgErr);
      }

      // Update progress after each image
      await supabase.from("video_generation_jobs").update({
        result_payload: {
          ...scriptContent,
          scene_images: sceneImageUrls,
          pipeline_steps: { script: "completed", scene_images: `${i + 1}/${scenesToRender.length}` },
        },
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    // ── Step 3: Voiceover (if ElevenLabs key) ──
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && scriptContent.voiceover_script) {
      try {
        await supabase.from("video_generation_jobs").update({ status: "generating_voiceover", updated_at: new Date().toISOString() }).eq("id", jobId);
        const voiceId = "21m00Tcm4TlvDq8ikWAM";
        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "xi-api-key": elevenlabsKey, "Content-Type": "application/json" },
          body: JSON.stringify({ text: scriptContent.voiceover_script, model_id: "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (ttsResponse.ok) {
          const audioBlob = await ttsResponse.blob();
          const audioFileName = `voiceovers/${userId}/${jobId}.mp3`;
          const { error: uploadError } = await supabase.storage.from("media").upload(audioFileName, audioBlob, { contentType: "audio/mpeg", upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("media").getPublicUrl(audioFileName);
            voiceoverUrl = urlData.publicUrl;
          }
        }
      } catch (voiceErr) {
        console.error("[generate-video] Voiceover failed:", voiceErr);
      }
    }

    // ── Step 4: Video composing happens client-side (no API key needed) ──
    // HeyGen is optional premium upgrade; the app auto-composes video in-browser from scene images

    // ── Final update ──
    const hasImages = sceneImageUrls.length > 0;
    const resultPayload = {
      ...scriptContent,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_url: null, // Video is composed client-side
      pipeline_steps: {
        script: "completed",
        scene_images: hasImages ? "completed" : "failed",
        voiceover: voiceoverUrl ? "completed" : elevenlabsKey ? "failed" : "skipped",
        video: "client_compose", // Signal to frontend to compose
      },
      message: hasImages
        ? "🎬 Assembling your video now..."
        : "📝 Script generated! Scene images couldn't be created.",
    };

    await supabase.from("video_generation_jobs").update({
      status: "completed",
      result_payload: resultPayload,
      video_url: null,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    // Save as content post
    if (scriptContent.title) {
      const { error: postErr } = await supabase.from("content_posts").insert({
        user_id: userId,
        business_id: businessId,
        location_id: locations?.[0]?.id ?? null,
        title: scriptContent.title,
        caption: scriptContent.caption || scriptContent.description,
        hashtags: scriptContent.hashtags || [],
        media_url: videoUrl || sceneImageUrls[0] || voiceoverUrl || null,
        media_type: videoUrl ? "video" : hasImages ? "image" : "text",
        platform: scriptContent.target_platform || "instagram",
        video_script: scriptContent.voiceover_script,
        voiceover_script: scriptContent.voiceover_script,
        shot_list: scriptContent.scenes,
        cta: scriptContent.cta,
        status: "media_ready",
        production_tool: heygenKey ? "heygen" : "rickyai",
        thumbnail_url: sceneImageUrls[0] || null,
      });
      if (postErr) console.error("[generate-video] content_posts insert error:", postErr);
    }

    console.log(`[generate-video] Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`[generate-video] Job ${jobId} failed:`, error);
    await supabase.from("video_generation_jobs").update({
      status: "failed",
      error_message: error.message,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

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
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { businessId, videoType, productionMode } = await req.json();

    // Create job record immediately
    const { data: job, error: jobInsertError } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: null,
        provider: "built_in_ai",
        status: "queued",
        request_payload: { businessId, videoType, productionMode },
      })
      .select("id")
      .single();

    if (jobInsertError) throw new Error(`Failed to create job: ${jobInsertError.message}`);

    // Start async processing — returns immediately to client
    const promise = processVideoJob(job.id, user.id, businessId, videoType || "promotional", productionMode || "standard");
    
    // Use EdgeRuntime.waitUntil if available, otherwise just let it run
    try {
      // @ts-ignore — EdgeRuntime.waitUntil is available in Supabase Edge Functions
      EdgeRuntime.waitUntil(promise);
    } catch {
      // Fallback: the promise will still execute
      promise.catch(err => console.error("[generate-video] Background processing error:", err));
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: "queued",
      message: "Video production started! We're generating your script and scene images now.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-video error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
