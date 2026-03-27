import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const RUNWAY_API_URL = "https://api.dev.runwayml.com/v1";

// ═══════════════════════════════════════════════════════════════════════
// LENGTH PRESETS — user picks Short / Standard / Long
// ═══════════════════════════════════════════════════════════════════════
const PRESETS: Record<string, { targetSeconds: number; sceneCount: number; clipDuration: 5 | 10; ratio: string; label: string }> = {
  short:    { targetSeconds: 30,  sceneCount: 3,  clipDuration: 10, ratio: "720:1280", label: "Short (30s)" },
  standard: { targetSeconds: 60,  sceneCount: 6,  clipDuration: 10, ratio: "1280:720", label: "Standard (60s)" },
  long:     { targetSeconds: 90,  sceneCount: 9,  clipDuration: 10, ratio: "1280:720", label: "Long (90s)" },
};

// ═══════════════════════════════════════════════════════════════════════
// SCRIPT BUILDER — works WITHOUT AI credits, uses business + strategy data
// ═══════════════════════════════════════════════════════════════════════
function buildScriptFromProfile(biz: any, loc: any, strategyData: any, sceneCount: number, clipDur: number) {
  const name = biz.business_name || "Our Business";
  const cat = biz.business_category || "business";
  const svc = biz.services || "premium services";
  const aud = biz.target_audience || "customers";
  const city = loc?.city || "your area";
  const state = loc?.state || "";
  const tone = biz.brand_tone || "friendly";
  const svcList = svc.split(",").map((s: string) => s.trim()).filter(Boolean);
  const primarySvc = svcList[0] || "our signature offering";
  const secondarySvc = svcList.length > 1 ? svcList.slice(1, 3).join(", ") : primarySvc;

  // Try to pull keywords/insights from saved strategy data
  const strategyInsights = strategyData?.keywords?.join(", ") || strategyData?.top_keywords?.join(", ") || "";
  const uniqueSelling = strategyData?.unique_selling_points?.join(". ") || strategyData?.differentiators?.join(". ") || "";

  // Build scene pool following the user's required structure
  const scenePool = [
    // HOOK (1-2 lines)
    {
      shotType: "environment",
      visual: `Stunning exterior of ${name} storefront at golden hour. Warm inviting glow, signage prominent, ${city} street life. Cinematic wide lens.`,
      camera: "slow push-in towards entrance",
      voiceLine: `Looking for the best ${cat} in ${city}? You just found it.`,
      textOverlay: name,
    },
    // WHO WE ARE / WHERE WE ARE
    {
      shotType: "people",
      visual: `Owner or team at ${name} smiling warmly, greeting customers. ${tone} atmosphere, polished interior. Natural warm lighting.`,
      camera: "steadicam walk-through",
      voiceLine: `Welcome to ${name}${city ? ` in ${city}${state ? `, ${state}` : ""}` : ""}. We've been serving our community with pride.`,
      textOverlay: `Welcome to ${name}`,
    },
    // WHAT WE SERVE (food/service focus)
    {
      shotType: "food",
      visual: `Magazine-quality hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, vibrant colors, steam rising. Product fills frame, background softly blurred.`,
      camera: "slow pan across product display",
      voiceLine: `From ${primarySvc} to ${secondarySvc} — every detail crafted with care.${uniqueSelling ? ` ${uniqueSelling}` : ""}`,
      textOverlay: primarySvc,
    },
    {
      shotType: "food",
      visual: `Close-up montage of ${name}'s menu items or service offerings. Multiple items in dynamic composition, vibrant colors, varied angles.`,
      camera: "rack focus transitions between items",
      voiceLine: `We bring you only the best — quality you can taste and feel.`,
      textOverlay: "Something for Everyone",
    },
    // WHY PEOPLE LOVE US (families, locals)
    {
      shotType: "people",
      visual: `Happy ${aud} enjoying their experience at ${name}. Friends, families laughing together. Warm candid moment, natural ambient light.`,
      camera: "lateral tracking shot, smooth dolly",
      voiceLine: `Our ${aud} keep coming back because we make every visit special.${strategyInsights ? ` Known for ${strategyInsights}.` : ""}`,
      textOverlay: "Loved by Locals",
    },
    {
      shotType: "people",
      visual: `Behind-the-scenes at ${name}. Skilled hands at work, attention to detail. Cinematic shallow focus with bokeh.`,
      camera: "dolly-in extreme close-up",
      voiceLine: `Behind every great experience is a team that truly cares.`,
      textOverlay: "Crafted with Care",
    },
    // CALL TO ACTION
    {
      shotType: "environment",
      visual: `Inviting wide shot of ${name}'s interior. ${tone} atmosphere, warm pendant lighting. Clean welcoming space, perfectly arranged.`,
      camera: "overhead crane shot",
      voiceLine: `Come visit ${name} today and see the difference for yourself.`,
      textOverlay: "Visit Us Today!",
    },
    // TAGLINE / SIGN-OFF
    {
      shotType: "environment",
      visual: `${name} logo or storefront signage at twilight. Beautiful bokeh circles of warm light. Elegant branding moment. Clean, memorable.`,
      camera: "slow pull-back reveal",
      voiceLine: `${name} — your go-to ${cat} in ${city}. See you soon!`,
      textOverlay: `${name} — ${city}`,
    },
    // Extra variety scenes for longer videos
    {
      shotType: "food",
      visual: `Top-down flat lay of ${name}'s best offerings arranged artfully. Rich textures, garnishes. Professional food photography style.`,
      camera: "slow overhead rotate",
      voiceLine: `Fresh, delicious, and made just for you. That's our promise.`,
      textOverlay: "Always Fresh",
    },
  ];

  const scenes = scenePool.slice(0, sceneCount);
  while (scenes.length < sceneCount) {
    scenes.push(scenePool[scenes.length % scenePool.length]);
  }

  const formattedScenes = scenes.map((s, i) => ({
    scene_number: i + 1,
    duration_seconds: clipDur,
    visual_description: s.visual,
    text_overlay: s.textOverlay,
    camera_direction: s.camera,
    voiceover_line: s.voiceLine,
    shotType: s.shotType,
  }));

  return {
    title: `${name} — Your Local ${cat}`,
    description: `Discover what makes ${name} the go-to ${cat} in ${city}.`,
    voiceover_script: formattedScenes.map(s => s.voiceover_line).join(" "),
    scene_captions: formattedScenes.map(s => s.voiceover_line),
    scenes: formattedScenes,
    caption: `✨ Discover ${name} in ${city}! ${svc} 🔥 #${name.replace(/\s+/g, "")} #${cat.replace(/\s+/g, "")}`,
    hashtags: [name.replace(/\s+/g, ""), cat.replace(/\s+/g, ""), city.replace(/\s+/g, ""), "smallbusiness"],
    target_platform: "instagram",
    cta: `Visit ${name} today!`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT — only if credits available
// ═══════════════════════════════════════════════════════════════════════
function buildAIPrompt(biz: any, loc: any, preset: typeof PRESETS.standard) {
  const city = loc?.city || "";
  const state = loc?.state || "";
  return `Create a ${preset.targetSeconds}-second promotional video script for:

Business: ${biz.business_name}
Category: ${biz.business_category || "General"}
Services: ${biz.services || "Not specified"}
Target Audience: ${biz.target_audience || "General"}
Brand Tone: ${biz.brand_tone || "Professional"}
Location: ${city}${state ? `, ${state}` : ""}

Script structure for ~${preset.targetSeconds} seconds:
- Hook (1–2 lines, grab attention)
- Who we are / where we are
- What we serve (product/service focus)
- Why people love us (families, locals, regulars)
- Call to action
- Tagline / sign-off

Return JSON:
{
  "title": "video title",
  "description": "short description",
  "voiceover_script": "complete narration, ${preset.targetSeconds >= 60 ? "100-150" : "50-80"} words, friendly local owner tone",
  "scenes": [${Array.from({ length: preset.sceneCount }, (_, i) =>
    `{"scene_number":${i + 1},"duration_seconds":${preset.clipDuration},"visual_description":"VIVID cinematic description","text_overlay":"3-5 word phrase","camera_direction":"camera style","voiceover_line":"narration line","shotType":"food|people|environment"}`
  ).join(",")}],
  "scene_captions": ["line1","line2",...],
  "caption": "social caption with emojis",
  "hashtags": ["tag1","tag2"],
  "target_platform": "instagram",
  "cta": "call to action"
}

Generate exactly ${preset.sceneCount} scenes of ${preset.clipDuration}s each.`;
}

// ═══════════════════════════════════════════════════════════════════════
// RUNWAY HELPERS
// ═══════════════════════════════════════════════════════════════════════
async function pollRunwayTask(taskId: string, key: string, maxAttempts = 120): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!res.ok) throw new Error(`Runway poll failed [${res.status}]: ${await res.text()}`);
    const task = await res.json();
    console.log(`[pipeline] Runway task ${taskId}: ${task.status}`);
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED") throw new Error(`Runway task failed: ${task.failure || "unknown"}`);
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Runway task timed out");
}

async function renderRunwayClip(imageUrl: string, promptText: string, key: string, duration: number, ratio: string): Promise<string | null> {
  const body = {
    model: "gen4_turbo",
    promptImage: imageUrl,
    promptText: `Cinematic, smooth motion, professional commercial. ${promptText}. High quality, vibrant colors.`,
    duration,
    ratio,
  };
  console.log(`[pipeline] Runway request: duration=${duration}, ratio=${ratio}, prompt="${promptText.substring(0, 80)}..."`);
  const res = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[pipeline] Runway create error [${res.status}]:`, errText);
    if (errText.toLowerCase().includes("enough credits")) throw new Error("RUNWAY_CREDITS_EXHAUSTED");
    return null;
  }
  const task = await res.json();
  console.log(`[pipeline] Runway clip task: ${task.id}`);
  const completed = await pollRunwayTask(task.id, key);
  return completed.output?.[0] || null;
}

// ═══════════════════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════
const MIN_REAL_IMAGE_BYTES = 5000;

async function isRealImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
    return parseInt(res.headers.get("content-length") || "0") >= MIN_REAL_IMAGE_BYTES;
  } catch { return false; }
}

async function findAllExistingImages(supabase: any, userId: string): Promise<string[]> {
  const urls: string[] = [];
  const { data: folders } = await supabase.storage.from("media").list(`scenes/${userId}`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  if (!folders?.length) return urls;
  for (const folder of folders) {
    if (!folder.name) continue;
    const { data: images } = await supabase.storage.from("media").list(`scenes/${userId}/${folder.name}`, { limit: 20 });
    if (!images) continue;
    for (const img of images) {
      if (img.name?.includes("placeholder")) continue;
      if (/\.(png|jpg|jpeg)$/i.test(img.name || "")) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(`scenes/${userId}/${folder.name}/${img.name}`);
        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }
    }
    if (urls.length >= 10) break;
  }
  return urls;
}

/** Generate a simple PNG placeholder (dark gradient) */
function create128Png(colorIndex: number): Uint8Array {
  const colors = [[26, 26, 46], [45, 19, 44], [13, 27, 42], [33, 37, 41], [27, 27, 47], [11, 12, 16]];
  const [r, g, b] = colors[colorIndex % colors.length];
  const W = 128, H = 128;
  const rawRows: number[] = [];
  for (let y = 0; y < H; y++) {
    rawRows.push(0);
    for (let x = 0; x < W; x++) {
      rawRows.push(Math.min(255, r + Math.floor((x + y) / 4)), Math.min(255, g + Math.floor((x + y) / 6)), Math.min(255, b + Math.floor((x + y) / 3)));
    }
  }
  const raw = new Uint8Array(rawRows);
  const header = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = createPngChunk("IHDR", [0,0,0,128, 0,0,0,128, 8, 2, 0, 0, 0]);
  const idat = createPngChunk("IDAT", Array.from(deflateStored(raw)));
  const iend = createPngChunk("IEND", []);
  return new Uint8Array([...header, ...ihdr, ...idat, ...iend]);
}
function createPngChunk(type: string, data: number[]): number[] {
  const tb = Array.from(type).map(c => c.charCodeAt(0));
  const chunk = [...tb, ...data];
  const crc = crc32(new Uint8Array(chunk));
  return [(data.length >> 24) & 0xff, (data.length >> 16) & 0xff, (data.length >> 8) & 0xff, data.length & 0xff, ...chunk, (crc >> 24) & 0xff, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff];
}
function deflateStored(data: Uint8Array): Uint8Array {
  const len = data.length;
  const r = new Uint8Array(2 + 5 + len + 4);
  r[0] = 0x78; r[1] = 0x01; r[2] = 0x01;
  r[3] = len & 0xff; r[4] = (len >> 8) & 0xff;
  r[5] = ~len & 0xff; r[6] = (~len >> 8) & 0xff;
  r.set(data, 7);
  const a = adler32(data);
  r[7+len]=(a>>24)&0xff; r[8+len]=(a>>16)&0xff; r[9+len]=(a>>8)&0xff; r[10+len]=a&0xff;
  return r;
}
function adler32(d: Uint8Array): number { let a=1,b=0; for(let i=0;i<d.length;i++){a=(a+d[i])%65521;b=(b+a)%65521;} return(b<<16)|a; }
function crc32(d: Uint8Array): number { let c=0xffffffff; for(let i=0;i<d.length;i++){c^=d[i];for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);} return(c^0xffffffff)>>>0; }

async function getSceneImage(supabase: any, userId: string, jobId: string, sceneIndex: number, scene: any, biz: any, lovableKey: string, creditsExhausted: boolean, existingImages: string[]): Promise<{ url: string; isReal: boolean }> {
  // Priority 1: Real photos from Supabase storage
  if (existingImages.length > 0) {
    const url = existingImages[sceneIndex % existingImages.length];
    const real = await isRealImage(url);
    if (real) {
      console.log(`[pipeline] Scene ${sceneIndex + 1}: using existing real photo`);
      return { url, isReal: true };
    }
  }

  // Priority 2: AI image generation (if credits available)
  if (!creditsExhausted) {
    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: `Generate a high-quality promotional photograph for "${biz.business_name}". Scene: ${scene.visual_description}. Style: cinematic, commercial photography. No text in image.` }],
          modalities: ["image", "text"],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const images = data.choices?.[0]?.message?.images;
        if (images?.length > 0) {
          let b64 = images[0]?.image_url?.url || "";
          if (b64.startsWith("data:") && b64.includes(";base64,")) b64 = b64.split(";base64,")[1];
          if (b64) {
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            if (bytes.length >= MIN_REAL_IMAGE_BYTES) {
              const fn = `scenes/${userId}/${jobId}/scene-${sceneIndex + 1}.png`;
              const { error } = await supabase.storage.from("media").upload(fn, bytes, { contentType: "image/png", upsert: true });
              if (!error) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
                return { url: urlData.publicUrl, isReal: true };
              }
            }
          }
        }
      } else if (res.status === 402) {
        throw new Error("CREDITS_EXHAUSTED");
      }
    } catch (e: any) {
      if (e.message === "CREDITS_EXHAUSTED") throw e;
      console.error(`[pipeline] AI image error scene ${sceneIndex + 1}:`, e);
    }
  }

  // Priority 3: Cycle existing images even if they didn't pass isReal above
  if (existingImages.length > 0) {
    return { url: existingImages[sceneIndex % existingImages.length], isReal: true };
  }

  // Last resort: placeholder
  const png = create128Png(sceneIndex);
  const fn = `scenes/${userId}/${jobId}/scene-${sceneIndex + 1}-placeholder.png`;
  const { error } = await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
  if (error) return { url: "", isReal: false };
  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
  return { url: urlData.publicUrl, isReal: false };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════
async function processVideoJob(jobId: string, userId: string, businessId: string, videoType: string, lengthMode: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const runwayKey = Deno.env.get("RUNWAY_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updateJob = (fields: Record<string, any>) =>
    supabase.from("video_generation_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    // ── Load business + location ──
    const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");
    const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];

    // ── Load saved strategy data (for script enrichment) ──
    const { data: strategyRows } = await supabase.from("strategy_outputs").select("output_data").eq("business_id", businessId).eq("user_id", userId).order("step_number", { ascending: true }).limit(10);
    const strategyData = strategyRows?.reduce((acc: any, row: any) => ({ ...acc, ...(row.output_data || {}) }), {}) || {};

    // ── User API keys ──
    const { data: userKeys } = await supabase.from("user_api_keys").select("provider, api_key_encrypted").eq("user_id", userId);
    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });
    const elevenlabsKey = keyMap["elevenlabs"];
    const userRunwayKey = keyMap["runway"] || runwayKey;

    const preset = PRESETS[lengthMode] || PRESETS.standard;
    console.log(`[pipeline] ═══ Starting job ${jobId} ═══`);
    console.log(`[pipeline] Length: ${preset.label}, Scenes: ${preset.sceneCount}, Target: ${preset.targetSeconds}s`);
    console.log(`[pipeline] Runway key: ${userRunwayKey ? "YES" : "NO"}, ElevenLabs: ${elevenlabsKey ? "YES" : "NO"}`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 1: SCRIPT (AI if possible, profile-based fallback always works)
    // ════════════════════════════════════════════════════════════════════
    await updateJob({ status: "generating_script", result_payload: { pipeline_step: "script", message: "✍️ Writing your script..." } });

    let script: any;
    let usedAI = false;

    try {
      const prompt = buildAIPrompt(business, location, preset);
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: "You are a video production expert. Return valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        if (res.status === 402) throw new Error("CREDITS_EXHAUSTED");
        throw new Error(`AI error: ${res.status}`);
      }
      const data = await res.json();
      script = JSON.parse(data.choices[0].message.content);
      usedAI = true;
      console.log(`[pipeline] AI script generated: "${script.title}"`);
    } catch (e: any) {
      console.log(`[pipeline] AI unavailable (${e.message}), building script from profile + strategy data`);
      
      // Also try to load last saved script for this business
      const { data: lastScript } = await supabase.from("strategy_outputs").select("output_data")
        .eq("business_id", businessId).eq("step_number", 8).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      
      if (lastScript?.output_data?.voiceover_script) {
        console.log(`[pipeline] Using last saved script from strategy_outputs`);
        script = lastScript.output_data;
      } else {
        script = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
      }
    }

    // Normalize scenes
    if (!script.scene_captions?.length) {
      script.scene_captions = (script.scenes || []).map((s: any) => s.voiceover_line || s.text_overlay || "");
    }
    while ((script.scenes?.length || 0) < preset.sceneCount) {
      const extra = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
      script.scenes = [...(script.scenes || []), ...extra.scenes.slice(0, preset.sceneCount - (script.scenes?.length || 0))];
    }
    script.scenes = script.scenes.slice(0, preset.sceneCount);
    script.voiceover_script = script.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
    script.scene_captions = script.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");

    console.log(`[pipeline] Script ready: ${script.scenes.length} scenes, ~${script.voiceover_script.split(" ").length} words`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 2: IMAGES (real photos first, AI backup, never block)
    // ════════════════════════════════════════════════════════════════════
    await updateJob({
      status: "generating_images",
      result_payload: { ...script, scene_images: [], video_clips: [], pipeline_step: "images", message: "🎨 Finding best photos..." },
    });

    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    const existingRealImages = await findAllExistingImages(supabase, userId);
    console.log(`[pipeline] Found ${existingRealImages.length} existing real photos in storage`);

    const sceneImageUrls: string[] = [];
    const sceneImageIsReal: boolean[] = [];
    let imageCreditsExhausted = false;

    for (let i = 0; i < script.scenes.length; i++) {
      try {
        const result = await getSceneImage(supabase, userId, jobId, i, script.scenes[i], business, lovableKey, imageCreditsExhausted, existingRealImages);
        sceneImageUrls.push(result.url);
        sceneImageIsReal.push(result.isReal);
      } catch (e: any) {
        if (e.message === "CREDITS_EXHAUSTED") imageCreditsExhausted = true;
        // Fallback: cycle existing or placeholder
        if (existingRealImages.length > 0) {
          sceneImageUrls.push(existingRealImages[i % existingRealImages.length]);
          sceneImageIsReal.push(true);
        } else {
          const png = create128Png(i);
          const fn = `scenes/${userId}/${jobId}/scene-${i + 1}-placeholder.png`;
          await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
          const { data: u } = supabase.storage.from("media").getPublicUrl(fn);
          sceneImageUrls.push(u.publicUrl);
          sceneImageIsReal.push(false);
        }
      }

      await updateJob({
        result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "images", message: `🎨 Photos: ${sceneImageUrls.length}/${script.scenes.length}` },
      });
    }

    const realImageCount = sceneImageIsReal.filter(Boolean).length;
    console.log(`[pipeline] Images: ${sceneImageUrls.length} total, ${realImageCount} real`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 3: VOICEOVER (ElevenLabs if available, otherwise browser TTS)
    // ════════════════════════════════════════════════════════════════════
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && script.voiceover_script) {
      try {
        await updateJob({ status: "generating_voiceover", result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "voiceover", message: "🎙️ Recording voiceover..." } });
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": elevenlabsKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: script.voiceover_script,
            model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true, speed: 1.0 },
          }),
        });
        if (ttsRes.ok) {
          const audioBlob = await ttsRes.blob();
          const audioFn = `voiceovers/${userId}/${jobId}.mp3`;
          const { error } = await supabase.storage.from("media").upload(audioFn, audioBlob, { contentType: "audio/mpeg", upsert: true });
          if (!error) {
            const { data: urlData } = supabase.storage.from("media").getPublicUrl(audioFn);
            voiceoverUrl = urlData.publicUrl;
            console.log(`[pipeline] ✅ Voiceover ready`);
          }
        }
      } catch (e) {
        console.error("[pipeline] Voiceover error:", e);
      }
    } else {
      console.log("[pipeline] No ElevenLabs key — browser TTS fallback");
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 4: RUNWAY RENDERING (only for real images)
    // ════════════════════════════════════════════════════════════════════
    const videoClips: string[] = [];

    if (!userRunwayKey) {
      console.log("[pipeline] No Runway key — slideshow mode");
    } else if (realImageCount === 0) {
      console.log("[pipeline] No real images — skipping Runway");
    } else {
      const scenesToRender = sceneImageUrls
        .map((url, i) => ({ url, index: i, isReal: sceneImageIsReal[i] }))
        .filter(s => s.isReal);

      console.log(`[pipeline] 🎬 Rendering ${scenesToRender.length} Runway clips`);
      await updateJob({
        status: "rendering_video",
        result_payload: {
          ...script, scene_images: sceneImageUrls, voiceover_url: voiceoverUrl, video_clips: [],
          pipeline_step: "runway", message: `🎬 Rendering ${scenesToRender.length} clips...`,
          total_clips: scenesToRender.length, clips_completed: 0,
        },
      });

      const variations = ["slow zoom in", "gentle pan left to right", "dolly forward", "slow pull back reveal", "overhead tilt down", "tracking shot right"];

      for (let ci = 0; ci < scenesToRender.length; ci++) {
        const { url: imgUrl, index: sceneIdx } = scenesToRender[ci];
        const scene = script.scenes[sceneIdx];
        const prompt = `${scene?.visual_description || `Professional video for ${business.business_name}`}. Camera: ${scene?.camera_direction || "smooth motion"}, ${variations[ci % variations.length]}.`;

        try {
          console.log(`[pipeline] Rendering clip ${ci + 1}/${scenesToRender.length}...`);
          const clipUrl = await renderRunwayClip(imgUrl, prompt, userRunwayKey, preset.clipDuration, preset.ratio);
          if (clipUrl) {
            const vidRes = await fetch(clipUrl);
            if (vidRes.ok) {
              const blob = await vidRes.blob();
              const fn = `videos/${userId}/${jobId}/clip-${sceneIdx + 1}.mp4`;
              const { error } = await supabase.storage.from("media").upload(fn, blob, { contentType: "video/mp4", upsert: true });
              if (!error) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
                videoClips.push(urlData.publicUrl);
              }
            }
          }
        } catch (e: any) {
          if (e.message === "RUNWAY_CREDITS_EXHAUSTED") {
            console.error("[pipeline] Runway credits exhausted — stopping");
            break;
          }
          console.error(`[pipeline] Clip ${ci + 1} failed:`, e);
        }

        await updateJob({
          result_payload: {
            ...script, scene_images: sceneImageUrls, voiceover_url: voiceoverUrl, video_clips: videoClips,
            pipeline_step: "runway", message: `🎬 Rendered ${videoClips.length}/${scenesToRender.length}`,
            total_clips: scenesToRender.length, clips_completed: videoClips.length,
          },
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 5: FINAL RESULT
    // ════════════════════════════════════════════════════════════════════
    const hasClips = videoClips.length > 0;
    const hasImages = sceneImageUrls.length > 0;
    const totalDuration = hasClips
      ? videoClips.length * preset.clipDuration
      : hasImages ? preset.targetSeconds : 0;

    let statusMessage: string;
    let finalStatus: string;
    let isFallback = false;

    if (hasClips) {
      statusMessage = `🎬 ${videoClips.length} Runway clips ready (${totalDuration}s)! Assembling your final video...`;
      finalStatus = "completed";
    } else if (hasImages && realImageCount > 0) {
      statusMessage = `🎬 ${sceneImageUrls.length} photos ready — assembling slideshow video (~${totalDuration}s) with captions${voiceoverUrl ? " and voiceover" : ""}.`;
      finalStatus = "completed";
    } else if (hasImages) {
      statusMessage = `⚠️ Fallback mode: creating branded slideshow from available assets. Upload real photos for better results.`;
      finalStatus = "completed";
      isFallback = true;
    } else {
      statusMessage = `❌ No images available. Please upload photos for your business and try again.`;
      finalStatus = "failed";
    }

    const resultPayload = {
      ...script,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_clips: videoClips,
      video_url: videoClips[0] || null,
      total_duration_seconds: totalDuration,
      is_fallback: isFallback,
      used_ai_script: usedAI,
      real_image_count: realImageCount,
      length_mode: lengthMode,
      pipeline_steps: {
        script: "completed",
        images: realImageCount > 0 ? "completed" : hasImages ? "placeholders_only" : "failed",
        voiceover: voiceoverUrl ? "completed" : "browser_tts_fallback",
        runway: hasClips ? "completed" : userRunwayKey ? "failed_or_exhausted" : "no_key",
      },
      message: statusMessage,
    };

    await updateJob({
      status: finalStatus,
      result_payload: resultPayload,
      video_url: videoClips[0] || null,
      ...(finalStatus === "failed" ? { error_message: statusMessage } : {}),
    });

    // Save as content post
    if (script.title && finalStatus !== "failed") {
      await supabase.from("content_posts").insert({
        user_id: userId,
        business_id: businessId,
        location_id: locations?.[0]?.id ?? null,
        title: script.title,
        caption: script.caption || script.description,
        hashtags: script.hashtags || [],
        media_url: videoClips[0] || sceneImageUrls[0] || null,
        media_type: hasClips ? "video" : "image",
        platform: script.target_platform || "instagram",
        video_script: script.voiceover_script,
        voiceover_script: script.voiceover_script,
        shot_list: script.scenes,
        cta: script.cta,
        status: "media_ready",
        production_tool: hasClips ? "runway" : "rickyai_slideshow",
        thumbnail_url: sceneImageUrls[0] || null,
      }).then(({ error }) => { if (error) console.error("[pipeline] content_posts error:", error); });
    }

    console.log(`[pipeline] ═══ Job ${jobId} ${finalStatus} ═══`);
    console.log(`[pipeline]   Clips: ${videoClips.length}, Images: ${sceneImageUrls.length} (${realImageCount} real), Duration: ${totalDuration}s`);
  } catch (error) {
    console.error(`[pipeline] ═══ Job ${jobId} FATAL ERROR ═══`, error);
    await updateJob({ status: "failed", error_message: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HTTP HANDLER
// ═══════════════════════════════════════════════════════════════════════
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

    const { businessId, videoType, lengthMode } = await req.json();

    const { data: job, error: jobErr } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: null,
        provider: Deno.env.get("RUNWAY_API_KEY") ? "runway" : "built_in_ai",
        status: "queued",
        request_payload: { businessId, videoType, lengthMode },
      })
      .select("id")
      .single();

    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    const promise = processVideoJob(job.id, user.id, businessId, videoType || "promotional", lengthMode || "standard");
    try {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
    } catch {
      promise.catch(err => console.error("[pipeline] Background error:", err));
    }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: "queued",
      message: "🎬 Video production started!",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[pipeline] Handler error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
