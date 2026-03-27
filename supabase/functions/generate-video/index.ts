import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const RUNWAY_API_URL = "https://api.dev.runwayml.com/v1";

// Duration targets in seconds
const DURATION_TARGETS: Record<string, { min: number; scenes: number; perClip: 5 | 10 }> = {
  quick: { min: 45, scenes: 9, perClip: 5 },
  standard: { min: 60, scenes: 6, perClip: 10 },
  longform: { min: 90, scenes: 9, perClip: 10 },
};

// ── Template-based scene builder (no AI credits needed) ──
function buildTemplateScenes(business: any, location: any, videoType: string, sceneCount: number) {
  const name = business.business_name || "Our Business";
  const category = business.business_category || "business";
  const services = business.services || "premium services";
  const audience = business.target_audience || "customers";
  const city = location?.city || "";
  const tone = business.brand_tone || "professional";

  const templates = [
    { visual: `Stunning exterior shot of ${name} storefront at golden hour, warm inviting lighting, ${city}`, text: name, camera: "slow push in" },
    { visual: `Close-up of ${category} work in progress, hands crafting with care, shallow depth of field`, text: `Quality ${category}`, camera: "slow pan right" },
    { visual: `Happy ${audience} enjoying ${services} at ${name}, candid smiles, natural light`, text: "Happy Customers", camera: "static wide" },
    { visual: `Detail shot showcasing the best of ${services}, professional lighting, product photography style`, text: services.split(",")[0]?.trim() || "Our Best", camera: "slow zoom in" },
    { visual: `Team members at ${name} working together, ${tone} atmosphere, collaborative energy`, text: "Our Team", camera: "dolly left" },
    { visual: `Behind-the-scenes look at ${category} preparation, organized workspace, attention to detail`, text: "Behind the Scenes", camera: "tracking shot" },
    { visual: `Wide establishing shot of ${city} skyline or neighborhood where ${name} operates`, text: city || "Our Community", camera: "aerial pan" },
    { visual: `Customer testimonial moment, genuine reaction to ${services}, warm emotional lighting`, text: "5-Star Experience", camera: "medium close-up" },
    { visual: `Montage-style quick cuts of ${name}'s signature offerings, vibrant colors, dynamic angles`, text: "What We Offer", camera: "quick cuts" },
    { visual: `Final beauty shot of ${name}'s signature product or service, dramatic lighting, hero angle`, text: "Visit Us Today", camera: "slow pull back" },
    { visual: `Interior atmosphere of ${name}, cozy or ${tone} ambiance, inviting spaces`, text: "Step Inside", camera: "steadicam walk" },
    { visual: `${name} logo or signage with bokeh background, elegant ${tone} branding moment`, text: `${name} — ${city}`, camera: "rack focus" },
  ];

  return templates.slice(0, sceneCount).map((t, i) => ({
    scene_number: i + 1,
    duration_seconds: 5,
    visual_description: t.visual,
    text_overlay: t.text,
    camera_direction: t.camera,
  }));
}

function buildTemplateScript(business: any, location: any, videoType: string, scenes: any[]) {
  const name = business.business_name;
  const category = business.business_category || "business";
  const services = business.services || "services";
  const city = location?.city || "your area";

  return {
    title: `${name} — Your Local ${category}`,
    description: `Discover what makes ${name} the go-to ${category} in ${city}.`,
    voiceover_script: `Welcome to ${name}, your trusted ${category} in ${city}. We specialize in ${services}. Our dedicated team is here to deliver an exceptional experience every time. Visit us today and see why our customers keep coming back.`,
    scenes,
    caption: `✨ Discover ${name} in ${city}! ${services} 🔥 #${name.replace(/\s+/g, "")} #${category} #${city.replace(/\s+/g, "")}`,
    hashtags: [name.replace(/\s+/g, ""), category, city.replace(/\s+/g, ""), "smallbusiness", "local"],
    target_platform: videoType === "promotional" ? "instagram" : "tiktok",
    aspect_ratio: "9:16",
    music_mood: "upbeat",
    cta: `Visit ${name} today!`,
  };
}

// ── Runway helpers ──
async function pollRunwayTask(taskId: string, runwayKey: string, maxAttempts = 120): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${runwayKey}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!res.ok) throw new Error(`Runway poll failed [${res.status}]: ${await res.text()}`);
    const task = await res.json();
    console.log(`[generate-video] Runway task ${taskId} status: ${task.status}`);
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED") throw new Error(`Runway task failed: ${task.failure || "unknown"}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Runway task timed out");
}

async function renderRunwayClip(
  imageUrl: string,
  promptText: string,
  runwayKey: string,
  duration: number,
  ratio: string,
): Promise<string | null> {
  const res = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${runwayKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: "gen4_turbo",
      promptImage: imageUrl,
      promptText: `Cinematic, smooth motion, professional commercial. ${promptText}. High quality, vibrant colors.`,
      duration,
      ratio,
    }),
  });
  if (!res.ok) {
    console.error(`[generate-video] Runway create error [${res.status}]:`, await res.text());
    return null;
  }
  const task = await res.json();
  console.log(`[generate-video] Runway clip task created: ${task.id}`);
  const completed = await pollRunwayTask(task.id, runwayKey);
  return completed.output?.[0] || null;
}

// ── Find a real image from storage to use as Runway seed ──
async function findExistingSceneImage(supabase: any, userId: string): Promise<string | null> {
  // Look for any previously generated scene image for this user (real AI images, not placeholders)
  const { data: files } = await supabase.storage.from("media").list(`scenes/${userId}`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  if (!files || files.length === 0) return null;

  // List subfolders (job IDs) and find images
  for (const folder of files) {
    if (!folder.name) continue;
    const { data: images } = await supabase.storage.from("media").list(`scenes/${userId}/${folder.name}`, { limit: 10 });
    if (!images) continue;
    for (const img of images) {
      // Skip placeholder images (they're too small)
      if (img.name?.includes("placeholder")) continue;
      if (img.name?.endsWith(".png") || img.name?.endsWith(".jpg")) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(`scenes/${userId}/${folder.name}/${img.name}`);
        console.log(`[generate-video] Found existing scene image: ${urlData.publicUrl}`);
        return urlData.publicUrl;
      }
    }
  }
  return null;
}

// ── Placeholder image generator — 128x128 solid color PNG (>512 bytes for Runway) ──
async function generatePlaceholderImage(
  supabase: any,
  userId: string,
  jobId: string,
  sceneIndex: number,
  businessName: string,
  overlayText: string,
): Promise<string | null> {
  // First try to find a real existing image from previous jobs
  const existingImage = await findExistingSceneImage(supabase, userId);
  if (existingImage) {
    console.log(`[generate-video] Scene ${sceneIndex + 1}: reusing real image as Runway seed`);
    return existingImage;
  }

  // Create a 128x128 PNG (well above Runway's 512-byte minimum)
  const pngBytes = create128Png(sceneIndex);
  console.log(`[generate-video] Generated 128x128 placeholder: ${pngBytes.length} bytes`);
  const fileName = `scenes/${userId}/${jobId}/scene-${sceneIndex + 1}-placeholder.png`;
  const { error } = await supabase.storage.from("media").upload(fileName, pngBytes, { contentType: "image/png", upsert: true });
  if (error) {
    console.error(`[generate-video] Placeholder upload error:`, error);
    return null;
  }
  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
  console.log(`[generate-video] Placeholder image for scene ${sceneIndex + 1}: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

// Creates a valid 128x128 PNG with a gradient color (Runway needs >= 512 bytes)
function create128Png(colorIndex: number): Uint8Array {
  const colors = [[26, 26, 46], [45, 19, 44], [13, 27, 42], [33, 37, 41], [27, 27, 47], [11, 12, 16]];
  const [r, g, b] = colors[colorIndex % colors.length];
  const W = 128, H = 128;
  // Raw pixel data: filter byte (0) + RGB per pixel, per row
  const rawRows: number[] = [];
  for (let y = 0; y < H; y++) {
    rawRows.push(0); // filter byte
    for (let x = 0; x < W; x++) {
      // Slight gradient so the image isn't perfectly uniform
      const rr = Math.min(255, r + Math.floor((x + y) / 4));
      const gg = Math.min(255, g + Math.floor((x + y) / 6));
      const bb = Math.min(255, b + Math.floor((x + y) / 3));
      rawRows.push(rr, gg, bb);
    }
  }
  const raw = new Uint8Array(rawRows);
  const header = [137, 80, 78, 71, 13, 10, 26, 10];
  // IHDR: 128x128, bit depth 8, color type 2 (RGB)
  const ihdrData = [0,0,0,128, 0,0,0,128, 8, 2, 0, 0, 0];
  const ihdr = createPngChunk("IHDR", ihdrData);
  const deflated = deflateStored(raw);
  const idat = createPngChunk("IDAT", Array.from(deflated));
  const iend = createPngChunk("IEND", []);
  return new Uint8Array([...header, ...ihdr, ...idat, ...iend]);
}

function createPngChunk(type: string, data: number[]): number[] {
  const length = data.length;
  const typeBytes = Array.from(type).map(c => c.charCodeAt(0));
  const chunk = [...typeBytes, ...data];
  const crc = crc32(new Uint8Array(chunk));
  return [
    (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff,
    ...chunk,
    (crc >> 24) & 0xff, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff,
  ];
}

function deflateStored(data: Uint8Array): Uint8Array {
  // zlib header (78 01) + stored block + adler32
  const len = data.length;
  const result = new Uint8Array(2 + 5 + len + 4);
  result[0] = 0x78; result[1] = 0x01; // zlib header
  result[2] = 0x01; // final block, stored
  result[3] = len & 0xff; result[4] = (len >> 8) & 0xff;
  result[5] = ~len & 0xff; result[6] = (~len >> 8) & 0xff;
  result.set(data, 7);
  const adler = adler32(data);
  result[7 + len] = (adler >> 24) & 0xff;
  result[8 + len] = (adler >> 16) & 0xff;
  result[9 + len] = (adler >> 8) & 0xff;
  result[10 + len] = adler & 0xff;
  return result;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b = (b + a) % 65521; }
  return (b << 16) | a;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) { crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  }
  return (crc ^ 0xffffffff) >>> 0;
}


// ── Main job processor ──
async function processVideoJob(jobId: string, userId: string, businessId: string, videoType: string, productionMode: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const runwayKey = Deno.env.get("RUNWAY_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updateJob = (fields: Record<string, any>) =>
    supabase.from("video_generation_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");

    const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];

    const { data: userKeys } = await supabase.from("user_api_keys").select("provider, api_key_encrypted").eq("user_id", userId);
    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });
    const elevenlabsKey = keyMap["elevenlabs"];
    const userRunwayKey = keyMap["runway"] || runwayKey;

    const config = DURATION_TARGETS[productionMode] || DURATION_TARGETS.standard;
    const ratio = productionMode === "quick" ? "720:1280" : "1280:720";
    const locationStr = location ? `${location.city}, ${location.state || ""} ${location.country || "US"}` : "";

    // ── Step 1: Generate script ──
    await updateJob({ status: "generating_script", result_payload: { pipeline_steps: { script: "processing" }, message: "✍️ Writing your video script..." } });

    let scriptContent: any;
    let usedTemplate = false;

    try {
      const scriptResponse = await fetch(AI_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "You are a video production expert. Generate a complete video script. Return valid JSON only." },
            { role: "user", content: `Create a ${config.min}-second promotional video script for:

Business: ${business.business_name}
Category: ${business.business_category || "General"}
Services: ${business.services || "Not specified"}
Target Audience: ${business.target_audience || "General"}
Brand Tone: ${business.brand_tone || "Professional"}
Location: ${locationStr}

Return JSON with:
{
  "title": "video title",
  "description": "short description",
  "voiceover_script": "complete narration, ${config.min >= 60 ? "100-150" : "60-80"} words",
  "scenes": [${Array.from({ length: config.scenes }, (_, i) => `{"scene_number":${i + 1},"duration_seconds":5,"visual_description":"detailed scene for AI image generation","text_overlay":"overlay text","camera_direction":"camera move"}`).join(",")}],
  "caption": "social media caption with emojis",
  "hashtags": ["relevant","hashtags"],
  "target_platform": "instagram",
  "aspect_ratio": "${productionMode === "quick" ? "9:16" : "16:9"}",
  "music_mood": "upbeat",
  "cta": "call to action"
}` },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!scriptResponse.ok) {
        const status = scriptResponse.status;
        if (status === 402) {
          console.log("[generate-video] AI credits exhausted, using template fallback");
          throw new Error("CREDITS_EXHAUSTED");
        }
        throw new Error(`AI script failed: ${status}`);
      }

      const scriptData = await scriptResponse.json();
      scriptContent = JSON.parse(scriptData.choices[0].message.content);
    } catch (err: any) {
      // Fallback to template-based script
      console.log("[generate-video] Using template-based script builder");
      usedTemplate = true;
      const scenes = buildTemplateScenes(business, location, videoType, config.scenes);
      scriptContent = buildTemplateScript(business, location, videoType, scenes);
    }

    // Ensure we have enough scenes
    while ((scriptContent.scenes?.length || 0) < config.scenes) {
      const extra = buildTemplateScenes(business, location, videoType, config.scenes);
      const missing = config.scenes - (scriptContent.scenes?.length || 0);
      scriptContent.scenes = [...(scriptContent.scenes || []), ...extra.slice(0, missing)];
    }
    scriptContent.scenes = scriptContent.scenes.slice(0, config.scenes);

    await updateJob({
      status: "generating_images",
      result_payload: {
        ...scriptContent,
        scene_images: [],
        video_clips: [],
        pipeline_steps: { script: "completed", scene_images: "processing", video_clips: "pending" },
        message: "🎨 Creating scene images...",
        used_template: usedTemplate,
      },
    });

    // ── Step 2: Generate scene images ──
    const sceneImageUrls: string[] = [];
    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    let imageCreditsExhausted = false;

    for (let i = 0; i < scriptContent.scenes.length; i++) {
      const scene = scriptContent.scenes[i];
      try {
        let imgUrl: string | null = null;

        // Always try AI image generation (even for template scripts)
        if (!imageCreditsExhausted) {
          const imgResponse = await fetch(AI_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: IMAGE_MODEL,
              messages: [{ role: "user", content: `Generate a high-quality promotional photograph for "${business.business_name}". Scene: ${scene.visual_description}. Style: cinematic, vibrant, commercial photography. No text in image.` }],
              modalities: ["image", "text"],
            }),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const images = imgData.choices?.[0]?.message?.images;
            if (images?.length > 0) {
              let base64Data = images[0]?.image_url?.url || "";
              if (base64Data.startsWith("data:") && base64Data.includes(";base64,")) {
                base64Data = base64Data.split(";base64,")[1];
              }
              if (base64Data) {
                const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const fileName = `scenes/${userId}/${jobId}/scene-${i + 1}.png`;
                const { error: uploadError } = await supabase.storage.from("media").upload(fileName, bytes, { contentType: "image/png", upsert: true });
                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
                  imgUrl = urlData.publicUrl;
                }
              }
            }
          } else if (imgResponse.status === 402) {
            console.log("[generate-video] Image credits exhausted at scene", i + 1);
            imageCreditsExhausted = true;
          }
        }

        // Fallback: generate a simple colored placeholder image so Runway still has input
        if (!imgUrl) {
          console.log(`[generate-video] Scene ${i + 1}: using generated placeholder image`);
          imgUrl = await generatePlaceholderImage(supabase, userId, jobId, i, business.business_name, scene.text_overlay || `Scene ${i + 1}`);
        }

        if (imgUrl) {
          sceneImageUrls.push(imgUrl);
        }
      } catch (imgErr) {
        console.error(`[generate-video] Scene ${i + 1} image error:`, imgErr);
      }

      // Progress update
      await updateJob({
        result_payload: {
          ...scriptContent,
          scene_images: sceneImageUrls,
          video_clips: [],
          pipeline_steps: { script: "completed", scene_images: `${i + 1}/${scriptContent.scenes.length}`, video_clips: "pending" },
          message: `🎨 Scene images: ${sceneImageUrls.length}/${scriptContent.scenes.length}`,
        },
      });
    }

    // ── Step 3: Voiceover (optional) ──
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && scriptContent.voiceover_script) {
      try {
        await updateJob({ status: "generating_voiceover" });
        const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
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

    // ── Step 4: Runway multi-clip rendering ──
    const videoClips: string[] = [];
    if (userRunwayKey && sceneImageUrls.length > 0) {
      await updateJob({
        status: "rendering_video",
        result_payload: {
          ...scriptContent,
          scene_images: sceneImageUrls,
          voiceover_url: voiceoverUrl,
          video_clips: [],
          pipeline_steps: { script: "completed", scene_images: "completed", voiceover: voiceoverUrl ? "completed" : "skipped", video_clips: "rendering" },
          message: `🎬 Rendering ${sceneImageUrls.length} video clips with Runway AI... This takes 2-5 minutes.`,
          total_clips: sceneImageUrls.length,
          clips_completed: 0,
        },
      });

      for (let i = 0; i < sceneImageUrls.length; i++) {
        const scene = scriptContent.scenes[i];
        const prompt = scene?.visual_description || `Professional promotional video for ${business.business_name}`;

        try {
          console.log(`[generate-video] Rendering Runway clip ${i + 1}/${sceneImageUrls.length}...`);
          const clipUrl = await renderRunwayClip(sceneImageUrls[i], prompt, userRunwayKey, config.perClip, ratio);

          if (clipUrl) {
            // Download and upload to our storage
            const videoResponse = await fetch(clipUrl);
            if (videoResponse.ok) {
              const videoBlob = await videoResponse.blob();
              const videoFileName = `videos/${userId}/${jobId}/clip-${i + 1}.mp4`;
              const { error: uploadError } = await supabase.storage.from("media").upload(videoFileName, videoBlob, { contentType: "video/mp4", upsert: true });
              if (!uploadError) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(videoFileName);
                videoClips.push(urlData.publicUrl);
                console.log(`[generate-video] Clip ${i + 1} stored: ${urlData.publicUrl}`);
              }
            }
          }
        } catch (clipErr) {
          console.error(`[generate-video] Clip ${i + 1} failed:`, clipErr);
        }

        // Progress update per clip
        await updateJob({
          result_payload: {
            ...scriptContent,
            scene_images: sceneImageUrls,
            voiceover_url: voiceoverUrl,
            video_clips: videoClips,
            pipeline_steps: { script: "completed", scene_images: "completed", voiceover: voiceoverUrl ? "completed" : "skipped", video_clips: `${videoClips.length}/${sceneImageUrls.length}` },
            message: `🎬 Rendered ${videoClips.length}/${sceneImageUrls.length} clips...`,
            total_clips: sceneImageUrls.length,
            clips_completed: videoClips.length,
          },
        });
      }
    } else if (!userRunwayKey) {
      console.log("[generate-video] No Runway API key — will use client-side compose");
    }

    // ── Final update ──
    const hasClips = videoClips.length > 0;
    const hasImages = sceneImageUrls.length > 0;
    const totalDuration = hasClips ? videoClips.length * config.perClip : hasImages ? sceneImageUrls.length * 4 : 0;

    const resultPayload = {
      ...scriptContent,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_clips: videoClips,
      video_url: videoClips[0] || null, // first clip as preview
      total_duration_seconds: totalDuration,
      used_template: usedTemplate,
      pipeline_steps: {
        script: "completed",
        scene_images: hasImages ? "completed" : "failed",
        voiceover: voiceoverUrl ? "completed" : elevenlabsKey ? "failed" : "skipped",
        video_clips: hasClips ? "completed" : userRunwayKey ? "failed" : "client_compose",
      },
      message: hasClips
        ? `🎬 ${videoClips.length} video clips ready (${totalDuration}s total)! Assembling your final video...`
        : hasImages
          ? "🎬 Scene images ready — assembling your video now..."
          : "📝 Script ready but images couldn't be generated.",
    };

    await updateJob({
      status: "completed",
      result_payload: resultPayload,
      video_url: videoClips[0] || null,
    });

    // Save as content post
    if (scriptContent.title) {
      await supabase.from("content_posts").insert({
        user_id: userId,
        business_id: businessId,
        location_id: locations?.[0]?.id ?? null,
        title: scriptContent.title,
        caption: scriptContent.caption || scriptContent.description,
        hashtags: scriptContent.hashtags || [],
        media_url: videoClips[0] || sceneImageUrls[0] || null,
        media_type: hasClips ? "video" : hasImages ? "image" : "text",
        platform: scriptContent.target_platform || "instagram",
        video_script: scriptContent.voiceover_script,
        voiceover_script: scriptContent.voiceover_script,
        shot_list: scriptContent.scenes,
        cta: scriptContent.cta,
        status: "media_ready",
        production_tool: hasClips ? "runway" : "rickyai",
        thumbnail_url: sceneImageUrls[0] || null,
      }).then(({ error }) => { if (error) console.error("[generate-video] content_posts insert error:", error); });
    }

    console.log(`[generate-video] Job ${jobId} completed. Clips: ${videoClips.length}, Images: ${sceneImageUrls.length}, Duration: ${totalDuration}s`);
  } catch (error) {
    console.error(`[generate-video] Job ${jobId} failed:`, error);
    await updateJob({ status: "failed", error_message: error.message });
  }
}

// ── HTTP handler ──
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

    const { data: job, error: jobInsertError } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: null,
        provider: Deno.env.get("RUNWAY_API_KEY") ? "runway" : "built_in_ai",
        status: "queued",
        request_payload: { businessId, videoType, productionMode },
      })
      .select("id")
      .single();

    if (jobInsertError) throw new Error(`Failed to create job: ${jobInsertError.message}`);

    const promise = processVideoJob(job.id, user.id, businessId, videoType || "promotional", productionMode || "standard");
    try {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
    } catch {
      promise.catch(err => console.error("[generate-video] Background error:", err));
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: "queued",
      message: "Video production started! Script → Images → Runway clips → Final video.",
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
