import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── External service URLs ──
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
const RUNWAY_API_URL = "https://api.dev.runwayml.com/v1";

// ═══════════════════════════════════════════════════════════════════════
// VIDEO PRODUCTION CONFIG — change these values to tune cost vs quality
// ═══════════════════════════════════════════════════════════════════════
const CONFIG = {
  MIN_DURATION_SECONDS: 45,
  DEFAULT_DURATION_SECONDS: 90,
  MAX_SCENES: 10,
  RUNWAY_MODEL: "gen4_turbo",
  RUNWAY_CLIP_DURATION: 10 as 5 | 10,
  ELEVENLABS_VOICE_ID: "JBFqnCBsd6RMkjVDRZzb",   // "George" — warm male
  ELEVENLABS_MODEL: "eleven_multilingual_v2",
  /** Images smaller than this are considered placeholders — skip Runway for them */
  MIN_REAL_IMAGE_BYTES: 5000,
};

// Production presets — controls Runway API call count
const PRESETS: Record<string, { minDuration: number; sceneCount: number; clipDuration: 5 | 10; ratio: string }> = {
  quick:    { minDuration: 45,  sceneCount: 5,  clipDuration: 10, ratio: "720:1280" },
  standard: { minDuration: 60,  sceneCount: 6,  clipDuration: 10, ratio: "1280:720" },
  longform: { minDuration: 90,  sceneCount: 9,  clipDuration: 10, ratio: "1280:720" },
};

// ═══════════════════════════════════════════════════════════════════════
// MARKETING SCRIPT TEMPLATE (six-beat structure)
// ═══════════════════════════════════════════════════════════════════════
const SCRIPT_BEATS = [
  { id: "hook",        label: "Intro Hook",         seconds: 8,  guideline: "1–2 punchy sentences, grab attention" },
  { id: "problem",     label: "Problem / Desire",   seconds: 10, guideline: "Pain point or desire this business solves" },
  { id: "positioning", label: "Brand Positioning",   seconds: 15, guideline: "Who we are, why trust us" },
  { id: "proof",       label: "Proof / Specifics",   seconds: 25, guideline: "Menu items, features, social proof" },
  { id: "offer",       label: "Offer + CTA",         seconds: 15, guideline: "Clear call to action" },
  { id: "signoff",     label: "Tagline / Sign-off",  seconds: 10, guideline: "Memorable tagline, logo, sign-off" },
];

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE SCENE BUILDER — works for ANY business, no AI credits needed
// ═══════════════════════════════════════════════════════════════════════
function buildTemplateScenes(biz: any, loc: any, count: number, clipDur: number) {
  const name = biz.business_name || "Our Business";
  const cat = biz.business_category || "business";
  const svc = biz.services || "premium services";
  const aud = biz.target_audience || "customers";
  const city = loc?.city || "your area";
  const tone = biz.brand_tone || "professional";
  const svcList = svc.split(",").map((s: string) => s.trim()).filter(Boolean);
  const primarySvc = svcList[0] || "our signature offering";
  const secondarySvc = svcList.length > 1 ? svcList.slice(0, 2).join(" and ") : primarySvc;

  const pool = [
    // HOOK
    { beat: "hook", visual: `Stunning golden-hour exterior of ${name} storefront. Warm amber light glows through clean windows, neon OPEN sign visible. ${city} street life bustling softly in background. Inviting signage prominent. Cinematic wide lens, discovering a hidden gem.`, camera: "slow push-in towards subject, cinematic depth", text: name, voice: `Looking for the best ${cat} in ${city}? Look no further.`, shot: "environment" },
    // PROBLEM
    { beat: "problem", visual: `Close-up of a real person's face lighting up with delight as they experience ${name}. Genuine warm smile, shallow depth of field, natural soft window light. Authentic candid moment of discovery and satisfaction.`, camera: "handheld natural movement, intimate documentary feel", text: `The ${cat} You Deserve`, voice: `You deserve a ${cat} experience that actually delivers — quality you can see and feel.`, shot: "people" },
    // POSITIONING
    { beat: "positioning", visual: `The owner or lead team member at ${name} warmly greeting customers. ${tone} atmosphere, polished interior visible. Authentic leadership moment, confident body language, warm interior lighting.`, camera: "steadicam walk-through following a person", text: `Welcome to ${name}`, voice: `Welcome to ${name}. We've been proudly serving ${city} with passion and dedication.`, shot: "people" },
    { beat: "positioning", visual: `Behind-the-scenes craftsmanship at ${name}. Skilled hands working with care and precision. Detail-oriented process shot, cinematic shallow focus with bokeh. Steam, texture, or motion adding life.`, camera: "dolly-in extreme close-up with shallow depth of field", text: "Crafted with Care", voice: `Every detail is crafted with care, because your experience matters most to us.`, shot: "action" },
    // PROOF
    { beat: "proof", visual: `Magazine-quality hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, rich vibrant colors, steam or sparkle. Product fills 70% of frame, background softly blurred. Premium, aspirational.`, camera: "slow pan right across the scene", text: primarySvc, voice: `From ${svc}, we bring you only the best.`, shot: "product_closeup" },
    { beat: "proof", visual: `Group of happy ${aud} enjoying their experience at ${name}. Friends or family laughing together. Natural candid moment, warm ambient light. Diverse group, genuine joy.`, camera: "lateral tracking shot, smooth dolly", text: "Happy Customers", voice: `Our ${aud} love what we do — and their smiles say it all.`, shot: "people" },
    { beat: "proof", visual: `Quick montage-style collage of ${name}'s offerings. Multiple items in dynamic composition. Vibrant saturated colors, varied angles (top-down, 45-degree, side). Each item beautifully lit.`, camera: "rack focus transition", text: "Something for Everyone", voice: `Whether it's ${secondarySvc}, there's something for everyone.`, shot: "product_closeup" },
    // OFFER
    { beat: "offer", visual: `Inviting wide shot of ${name}'s interior or main service area. ${tone} atmosphere with warm pendant lighting. Clean welcoming space, perfectly arranged. Sense of anticipation.`, camera: "overhead crane shot at 45-degree angle", text: "Visit Us Today!", voice: `Come visit ${name} today and experience the difference for yourself.`, shot: "environment" },
    // SIGNOFF
    { beat: "signoff", visual: `${name} logo or storefront signage. Beautiful bokeh circles of warm light in background. Elegant branding moment at golden hour. Clean, recognizable, memorable.`, camera: "slow pull-back reveal", text: `${name} — ${city}`, voice: `${name}. Your go-to ${cat} in ${city}. See you soon!`, shot: "branding" },
    { beat: "signoff", visual: `Final beauty shot: exterior of ${name} at twilight. Warm lights glowing from within, street alive with soft energy. Cinematic ultra-wide with slight lens flare.`, camera: "slow pull-back reveal", text: name, voice: `${name} — where every visit is worth it.`, shot: "environment" },
  ];

  const scenes = pool.slice(0, count);
  while (scenes.length < count) scenes.push(pool[scenes.length % pool.length]);

  return scenes.map((s, i) => ({
    scene_number: i + 1,
    duration_seconds: clipDur,
    visual_description: s.visual,
    text_overlay: s.text,
    camera_direction: s.camera,
    voiceover_line: s.voice,
    beat_id: s.beat,
    priority_shot: s.shot,
  }));
}

function buildTemplateScript(biz: any, loc: any, scenes: any[]) {
  const name = biz.business_name;
  const cat = biz.business_category || "business";
  const svc = biz.services || "services";
  const city = loc?.city || "your area";
  return {
    title: `${name} — Your Local ${cat}`,
    description: `Discover what makes ${name} the go-to ${cat} in ${city}.`,
    voiceover_script: scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" "),
    scene_captions: scenes.map((s: any) => s.voiceover_line || s.text_overlay || ""),
    scenes,
    caption: `✨ Discover ${name} in ${city}! ${svc} 🔥 #${name.replace(/\s+/g, "")} #${cat}`,
    hashtags: [name.replace(/\s+/g, ""), cat, city.replace(/\s+/g, ""), "smallbusiness"],
    target_platform: "instagram",
    aspect_ratio: "16:9",
    music_mood: "upbeat",
    cta: `Visit ${name} today!`,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT PROMPT — enforces the six-beat marketing structure
// ═══════════════════════════════════════════════════════════════════════
function buildAIPrompt(biz: any, loc: any, preset: typeof PRESETS.standard) {
  const beats = SCRIPT_BEATS.map(b => `- ${b.label} (~${b.seconds}s): ${b.guideline}`).join("\n");
  const city = loc?.city || "";
  const state = loc?.state || "";
  return `Create a ${preset.minDuration}-second promotional video script for:

Business: ${biz.business_name}
Category: ${biz.business_category || "General"}
Services: ${biz.services || "Not specified"}
Target Audience: ${biz.target_audience || "General"}
Brand Tone: ${biz.brand_tone || "Professional"}
Location: ${city}${state ? `, ${state}` : ""}

Follow this six-beat marketing structure:
${beats}

Return JSON:
{
  "title": "video title",
  "description": "short description",
  "voiceover_script": "complete narration, ${preset.minDuration >= 60 ? "100-150" : "60-80"} words, friendly local owner tone",
  "scenes": [${Array.from({ length: preset.sceneCount }, (_, i) =>
    `{"scene_number":${i + 1},"duration_seconds":${preset.clipDuration},"visual_description":"VERY VIVID description: setting, people, camera, mood, lighting, textures, colors. Specific enough for AI video generation.","text_overlay":"3-5 word phrase","camera_direction":"specific camera style","voiceover_line":"exact narration","beat_id":"hook|problem|positioning|proof|offer|signoff","priority_shot":"product_closeup|people|environment|action|branding"}`
  ).join(",")}],
  "scene_captions": ["line1","line2",...],
  "caption": "social caption with emojis",
  "hashtags": ["tag1","tag2"],
  "target_platform": "instagram",
  "aspect_ratio": "${preset.ratio.includes("720") ? "9:16" : "16:9"}",
  "music_mood": "upbeat",
  "cta": "call to action"
}

Generate exactly ${preset.sceneCount} scenes of ${preset.clipDuration}s each.
Every scene MUST have voiceover_line. scene_captions must match voiceover_lines in order.`;
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
    model: CONFIG.RUNWAY_MODEL,
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

/** Check if an image URL points to a real image (not a tiny placeholder) */
async function isRealImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;
    const contentLength = parseInt(res.headers.get("content-length") || "0");
    // Real AI-generated or user-uploaded images are typically >5KB
    return contentLength >= CONFIG.MIN_REAL_IMAGE_BYTES;
  } catch {
    return false;
  }
}

async function findExistingImage(supabase: any, userId: string): Promise<string | null> {
  const { data: files } = await supabase.storage.from("media").list(`scenes/${userId}`, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
  if (!files?.length) return null;
  for (const folder of files) {
    if (!folder.name) continue;
    const { data: images } = await supabase.storage.from("media").list(`scenes/${userId}/${folder.name}`, { limit: 10 });
    if (!images) continue;
    for (const img of images) {
      if (img.name?.includes("placeholder")) continue;
      if (img.name?.endsWith(".png") || img.name?.endsWith(".jpg")) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(`scenes/${userId}/${folder.name}/${img.name}`);
        return urlData.publicUrl;
      }
    }
  }
  return null;
}

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

async function getSceneImage(supabase: any, userId: string, jobId: string, sceneIndex: number, scene: any, biz: any, lovableKey: string, creditsExhausted: boolean): Promise<{ url: string; isReal: boolean }> {
  // Try AI image generation first
  if (!creditsExhausted) {
    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          messages: [{ role: "user", content: `Generate a high-quality promotional photograph for "${biz.business_name}". Scene: ${scene.visual_description}. Camera: ${scene.camera_direction}. Style: cinematic, vibrant, commercial photography. No text in image.` }],
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
            if (bytes.length >= CONFIG.MIN_REAL_IMAGE_BYTES) {
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

  // Fallback: reuse existing real image
  const existing = await findExistingImage(supabase, userId);
  if (existing) {
    const real = await isRealImage(existing);
    return { url: existing, isReal: real };
  }

  // Last resort: placeholder (marked as NOT real — Runway will be skipped)
  const png = create128Png(sceneIndex);
  const fn = `scenes/${userId}/${jobId}/scene-${sceneIndex + 1}-placeholder.png`;
  const { error } = await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
  if (error) return { url: "", isReal: false };
  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
  return { url: urlData.publicUrl, isReal: false };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PIPELINE — one cohesive flow
// ═══════════════════════════════════════════════════════════════════════
async function processVideoJob(jobId: string, userId: string, businessId: string, videoType: string, productionMode: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
  const runwayKey = Deno.env.get("RUNWAY_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const updateJob = (fields: Record<string, any>) =>
    supabase.from("video_generation_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    // ── Load business data ──
    const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");
    const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];

    // User API keys
    const { data: userKeys } = await supabase.from("user_api_keys").select("provider, api_key_encrypted").eq("user_id", userId);
    const keyMap: Record<string, string> = {};
    userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });
    const elevenlabsKey = keyMap["elevenlabs"];
    const userRunwayKey = keyMap["runway"] || runwayKey;

    const preset = PRESETS[productionMode] || PRESETS.standard;
    console.log(`[pipeline] ═══ Starting job ${jobId} ═══`);
    console.log(`[pipeline] Mode: ${productionMode}, Scenes: ${preset.sceneCount}, Clip: ${preset.clipDuration}s, Ratio: ${preset.ratio}`);
    console.log(`[pipeline] Runway key: ${userRunwayKey ? "YES" : "NO"}, ElevenLabs key: ${elevenlabsKey ? "YES" : "NO"}`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 1: GENERATE SCRIPT (AI or template fallback)
    // ════════════════════════════════════════════════════════════════════
    await updateJob({ status: "generating_script", result_payload: { pipeline_step: "script", message: "✍️ Writing your marketing script..." } });

    let script: any;
    let usedTemplate = false;

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
        throw new Error(`AI script failed: ${res.status}`);
      }
      const data = await res.json();
      script = JSON.parse(data.choices[0].message.content);
      console.log(`[pipeline] AI script generated: "${script.title}"`);
    } catch (e: any) {
      console.log(`[pipeline] AI script unavailable (${e.message}), using template`);
      usedTemplate = true;
      const scenes = buildTemplateScenes(business, location, preset.sceneCount, preset.clipDuration);
      script = buildTemplateScript(business, location, scenes);
    }

    // Ensure scene_captions
    if (!script.scene_captions?.length) {
      script.scene_captions = (script.scenes || []).map((s: any) => s.voiceover_line || s.text_overlay || "");
    }
    // Pad scenes to preset count
    while ((script.scenes?.length || 0) < preset.sceneCount) {
      const extra = buildTemplateScenes(business, location, preset.sceneCount, preset.clipDuration);
      script.scenes = [...(script.scenes || []), ...extra.slice(0, preset.sceneCount - (script.scenes?.length || 0))];
    }
    script.scenes = script.scenes.slice(0, preset.sceneCount);
    script.voiceover_script = script.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
    script.scene_captions = script.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");

    console.log(`[pipeline] Script ready: ${script.scenes.length} scenes, ~${script.voiceover_script.split(" ").length} words`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 2: GENERATE SCENE IMAGES
    // ════════════════════════════════════════════════════════════════════
    await updateJob({
      status: "generating_images",
      result_payload: { ...script, scene_images: [], video_clips: [], pipeline_step: "images", message: "🎨 Creating scene images..." },
    });

    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    const sceneImageUrls: string[] = [];
    const sceneImageIsReal: boolean[] = []; // Track which images are real vs placeholder
    let imageCreditsExhausted = false;

    for (let i = 0; i < script.scenes.length; i++) {
      try {
        const result = await getSceneImage(supabase, userId, jobId, i, script.scenes[i], business, lovableKey, imageCreditsExhausted);
        sceneImageUrls.push(result.url);
        sceneImageIsReal.push(result.isReal);
      } catch (e: any) {
        if (e.message === "CREDITS_EXHAUSTED") imageCreditsExhausted = true;
        const existing = await findExistingImage(supabase, userId);
        if (existing) {
          const real = await isRealImage(existing);
          sceneImageUrls.push(existing);
          sceneImageIsReal.push(real);
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
        result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "images", message: `🎨 Scene images: ${sceneImageUrls.length}/${script.scenes.length}` },
      });
    }

    const realImageCount = sceneImageIsReal.filter(Boolean).length;
    console.log(`[pipeline] Images ready: ${sceneImageUrls.length} total, ${realImageCount} real, ${sceneImageUrls.length - realImageCount} placeholders`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 3: VOICEOVER (ElevenLabs or skip for browser TTS fallback)
    // ════════════════════════════════════════════════════════════════════
    let voiceoverUrl: string | null = null;
    if (elevenlabsKey && script.voiceover_script) {
      try {
        await updateJob({ status: "generating_voiceover", result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "voiceover", message: "🎙️ Recording voiceover..." } });
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": elevenlabsKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: script.voiceover_script,
            model_id: CONFIG.ELEVENLABS_MODEL,
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
            console.log(`[pipeline] ✅ Voiceover ready: ${voiceoverUrl}`);
          }
        } else {
          console.error(`[pipeline] ❌ ElevenLabs TTS failed [${ttsRes.status}]`);
        }
      } catch (e) {
        console.error("[pipeline] ❌ Voiceover error:", e);
      }
    } else {
      console.log("[pipeline] ℹ️ No ElevenLabs key — browser TTS will be used client-side");
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 4: RUNWAY MULTI-CLIP RENDERING
    // ══════════════════════════════════════════════════════════════════
    // CRITICAL: Only send REAL images to Runway. Placeholder images waste credits
    // and Runway rejects them anyway (too small). This is the key credit-saving guard.
    // ════════════════════════════════════════════════════════════════════
    const videoClips: string[] = [];

    if (!userRunwayKey) {
      console.log("[pipeline] ℹ️ No Runway key — client-side compose will handle video assembly");
    } else if (realImageCount === 0) {
      console.log("[pipeline] ⚠️ No real images available — SKIPPING Runway to save credits. All images are placeholders.");
      console.log("[pipeline] ℹ️ To get Runway video clips, ensure AI image credits are available or upload real photos.");
    } else {
      // Only render clips for scenes that have real images
      const scenesToRender = sceneImageUrls
        .map((url, i) => ({ url, index: i, isReal: sceneImageIsReal[i] }))
        .filter(s => s.isReal);

      console.log(`[pipeline] 🎬 Rendering ${scenesToRender.length} Runway clips (skipping ${sceneImageUrls.length - scenesToRender.length} placeholder scenes)`);

      await updateJob({
        status: "rendering_video",
        result_payload: {
          ...script, scene_images: sceneImageUrls, voiceover_url: voiceoverUrl, video_clips: [],
          pipeline_step: "runway", message: `🎬 Rendering ${scenesToRender.length} clips with Runway AI (${preset.clipDuration}s each)...`,
          total_clips: scenesToRender.length, clips_completed: 0,
        },
      });

      for (let ci = 0; ci < scenesToRender.length; ci++) {
        const { url: imgUrl, index: sceneIdx } = scenesToRender[ci];
        const scene = script.scenes[sceneIdx];
        const voLine = scene?.voiceover_line || script.scene_captions?.[sceneIdx] || "";
        const visPrompt = scene?.visual_description || `Professional video for ${business.business_name}`;
        const camDir = scene?.camera_direction || "smooth cinematic motion";
        const prompt = `${visPrompt}. Camera: ${camDir}.${voLine ? ` The narrator says: "${voLine}"` : ""}`;

        try {
          console.log(`[pipeline] Rendering clip ${ci + 1}/${scenesToRender.length} (scene ${sceneIdx + 1})...`);
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
        } catch (e) {
          console.error(`[pipeline] ❌ Clip ${ci + 1} (scene ${sceneIdx + 1}) failed:`, e);
        }

        await updateJob({
          result_payload: {
            ...script, scene_images: sceneImageUrls, voiceover_url: voiceoverUrl, video_clips: videoClips,
            pipeline_step: "runway", message: `🎬 Rendered ${videoClips.length}/${scenesToRender.length} clips...`,
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
      : hasImages ? sceneImageUrls.length * 4 : 0;

    const meetsMinimum = totalDuration >= CONFIG.MIN_DURATION_SECONDS;

    let statusMessage: string;
    let finalStatus: string;

    if (hasClips && meetsMinimum) {
      statusMessage = `🎬 ${videoClips.length} video clips ready (${totalDuration}s total)! Assembling your final video...`;
      finalStatus = "completed";
    } else if (hasClips && !meetsMinimum) {
      statusMessage = `⚠️ ${videoClips.length} clips rendered (${totalDuration}s) — below ${CONFIG.MIN_DURATION_SECONDS}s min. Video will be assembled from available clips.`;
      finalStatus = "completed";
    } else if (hasImages && !userRunwayKey) {
      statusMessage = `🎬 ${sceneImageUrls.length} scene images ready — assembling slideshow with captions and voiceover. Connect Runway for AI motion video.`;
      finalStatus = "completed";
    } else if (hasImages && realImageCount === 0) {
      statusMessage = `⚠️ Only placeholder images available — Runway was skipped to save credits. AI image credits need to be replenished, or upload your own photos to get Runway video clips.`;
      finalStatus = "completed";
    } else if (hasImages && userRunwayKey) {
      statusMessage = `⚠️ Runway rendering failed for all clips. Assembling slideshow from ${sceneImageUrls.length} images.`;
      finalStatus = "completed";
    } else {
      statusMessage = "❌ Pipeline failed: no images or clips could be generated. Check API credits and try again.";
      finalStatus = "failed";
    }

    const resultPayload = {
      ...script,
      scene_images: sceneImageUrls,
      scene_image_quality: sceneImageIsReal.map(r => r ? "real" : "placeholder"),
      voiceover_url: voiceoverUrl,
      video_clips: videoClips,
      video_url: videoClips[0] || null,
      total_duration_seconds: totalDuration,
      meets_minimum_duration: meetsMinimum,
      used_template: usedTemplate,
      production_mode: productionMode,
      real_image_count: realImageCount,
      placeholder_image_count: sceneImageUrls.length - realImageCount,
      pipeline_steps: {
        script: "completed",
        scene_images: hasImages ? (realImageCount > 0 ? "completed" : "placeholders_only") : "failed",
        voiceover: voiceoverUrl ? "completed" : elevenlabsKey ? "failed" : "browser_tts_fallback",
        video_clips: hasClips ? "completed" : userRunwayKey ? (realImageCount === 0 ? "skipped_no_real_images" : "failed") : "client_compose",
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
        media_type: hasClips ? "video" : hasImages ? "image" : "text",
        platform: script.target_platform || "instagram",
        video_script: script.voiceover_script,
        voiceover_script: script.voiceover_script,
        shot_list: script.scenes,
        cta: script.cta,
        status: "media_ready",
        production_tool: hasClips ? "runway" : "rickyai",
        thumbnail_url: sceneImageUrls[0] || null,
      }).then(({ error }) => { if (error) console.error("[pipeline] content_posts error:", error); });
    }

    console.log(`[pipeline] ═══ Job ${jobId} ${finalStatus} ═══`);
    console.log(`[pipeline]   Clips: ${videoClips.length}, Images: ${sceneImageUrls.length} (${realImageCount} real), Duration: ${totalDuration}s, MinMet: ${meetsMinimum}`);
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

    const { businessId, videoType, productionMode } = await req.json();

    const { data: job, error: jobErr } = await supabase
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

    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    const promise = processVideoJob(job.id, user.id, businessId, videoType || "promotional", productionMode || "standard");
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
      message: "🎬 Video production started! Script → Images → Voiceover → Runway → Final video.",
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
