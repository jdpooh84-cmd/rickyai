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
// RUNWAY PRESET CONFIG — single source of truth for valid Runway params
// ═══════════════════════════════════════════════════════════════════════
const RUNWAY_CONFIG = {
  DEFAULT_MODEL: "gen4_turbo",
  // Runway-accepted ratios (exact pixel ratios)
  RATIO_LANDSCAPE: "1280:720",
  RATIO_VERTICAL: "720:1280",
  // Runway Gen-4 Turbo accepted durations (seconds, must be a number)
  DURATION_SHORT: 5 as const,
  DURATION_STANDARD: 10 as const,
  DURATION_LONG: 10 as const,   // Runway max per clip is 10s; we stitch for longer
  API_VERSION: "2024-11-06",
};

type Orientation = "landscape" | "vertical";

interface PipelinePreset {
  targetSeconds: number;
  sceneCount: number;
  clipDuration: 5 | 10;
  orientation: Orientation;
  ratio: string;
  label: string;
}

function buildPreset(lengthMode: string, orientation: Orientation = "landscape"): PipelinePreset {
  const ratio = orientation === "vertical" ? RUNWAY_CONFIG.RATIO_VERTICAL : RUNWAY_CONFIG.RATIO_LANDSCAPE;
  switch (lengthMode) {
    case "short":
      return { targetSeconds: 30, sceneCount: 3, clipDuration: RUNWAY_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Short (30s)" };
    case "long":
      return { targetSeconds: 90, sceneCount: 9, clipDuration: RUNWAY_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Long (90s)" };
    case "standard":
    default:
      return { targetSeconds: 60, sceneCount: 6, clipDuration: RUNWAY_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Standard (60s)" };
  }
}

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

  const strategyInsights = strategyData?.keywords?.join(", ") || strategyData?.top_keywords?.join(", ") || "";
  const uniqueSelling = strategyData?.unique_selling_points?.join(". ") || strategyData?.differentiators?.join(". ") || "";

  // Randomization seed so each call produces different output
  const rand = () => Math.random();
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => rand() - 0.5);

  // Multiple hook variants
  const hooks = [
    { voiceLine: `Looking for the best ${cat} in ${city}? You just found it.`, textOverlay: name },
    { voiceLine: `${city}, meet your new favorite ${cat} spot — ${name}.`, textOverlay: `Discover ${name}` },
    { voiceLine: `Craving something amazing? ${name} in ${city} has you covered.`, textOverlay: `${name} — ${city}` },
    { voiceLine: `What makes ${name} the talk of ${city}? Let us show you.`, textOverlay: `Why ${name}?` },
    { voiceLine: `Stop scrolling. ${name} is about to change your ${cat} game.`, textOverlay: name },
    { voiceLine: `${city}'s best-kept secret? It's called ${name}.`, textOverlay: `Secret's Out` },
  ];

  // Multiple CTA/closing variants
  const closings = [
    { voiceLine: `${name} — your go-to ${cat} in ${city}. See you soon!`, textOverlay: `${name} — ${city}` },
    { voiceLine: `Come visit ${name} today. We can't wait to serve you!`, textOverlay: `Visit Us Today!` },
    { voiceLine: `Follow ${name} for more. Link in bio!`, textOverlay: `Follow ${name}` },
    { voiceLine: `Ready for the ${name} experience? Walk in or order online today.`, textOverlay: `Order Now` },
    { voiceLine: `${name} — where every visit feels like coming home. See you there!`, textOverlay: `Welcome Home` },
  ];

  // Large pool of middle scenes with variety
  const middleScenes = [
    {
      shotType: "people",
      visual: `Owner or team at ${name} smiling warmly, greeting customers. ${tone} atmosphere, polished interior.`,
      camera: "steadicam walk-through",
      voiceLine: `Welcome to ${name}${city ? ` in ${city}${state ? `, ${state}` : ""}` : ""}. We've been serving our community with pride.`,
      textOverlay: `Welcome to ${name}`,
    },
    {
      shotType: "food",
      visual: `Hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, vibrant colors, steam rising.`,
      camera: "slow pan across product display",
      voiceLine: `From ${primarySvc} to ${secondarySvc} — every detail crafted with care.${uniqueSelling ? ` ${uniqueSelling}` : ""}`,
      textOverlay: primarySvc,
    },
    {
      shotType: "food",
      visual: `Close-up montage of ${name}'s offerings. Multiple items, dynamic composition, vibrant colors.`,
      camera: "rack focus transitions between items",
      voiceLine: `We bring you only the best — quality you can see and taste.`,
      textOverlay: "Something for Everyone",
    },
    {
      shotType: "people",
      visual: `Happy ${aud} enjoying their experience at ${name}. Friends, families laughing together.`,
      camera: "lateral tracking shot, smooth dolly",
      voiceLine: `Our ${aud} keep coming back because we make every visit count.${strategyInsights ? ` Known for ${strategyInsights}.` : ""}`,
      textOverlay: "Loved by Locals",
    },
    {
      shotType: "people",
      visual: `Behind-the-scenes at ${name}. Skilled hands at work, attention to detail. Cinematic shallow focus.`,
      camera: "dolly-in extreme close-up",
      voiceLine: `Behind every great experience is a team that truly cares.`,
      textOverlay: "Crafted with Care",
    },
    {
      shotType: "environment",
      visual: `Inviting wide shot of ${name}'s interior. ${tone} atmosphere, warm pendant lighting.`,
      camera: "overhead crane shot",
      voiceLine: `Come visit ${name} today and see the difference for yourself.`,
      textOverlay: "Step Inside",
    },
    {
      shotType: "food",
      visual: `Top-down flat lay of ${name}'s best offerings arranged artfully. Rich textures, garnishes.`,
      camera: "slow overhead rotate",
      voiceLine: `Fresh, delicious, and made just for you. That's our promise.`,
      textOverlay: "Always Fresh",
    },
    {
      shotType: "people",
      visual: `A family enjoying a meal together at ${name}. Warm smiles, shared plates, golden light.`,
      camera: "medium shot, gentle push-in",
      voiceLine: `${name} isn't just ${cat} — it's where memories are made.`,
      textOverlay: "Family Moments",
    },
    {
      shotType: "environment",
      visual: `${name} team preparing for the day. Organized, energetic, morning light streaming in.`,
      camera: "tracking shot through the space",
      voiceLine: `Every day starts with one goal: make your experience unforgettable.`,
      textOverlay: "Ready for You",
    },
    {
      shotType: "food",
      visual: `Action shot of ${primarySvc} being prepared. Hands in motion, ingredients flying, energy and precision.`,
      camera: "dynamic handheld, close-up",
      voiceLine: `Watch the magic happen. Real craft, real passion, real flavor.`,
      textOverlay: "Made with Passion",
    },
    {
      shotType: "people",
      visual: `Regular customers giving thumbs up, leaving reviews, sharing on social media.`,
      camera: "medium close-up, natural light",
      voiceLine: `Don't just take our word for it — our fans speak for themselves.`,
      textOverlay: "★★★★★",
    },
    {
      shotType: "environment",
      visual: `${name} exterior at night with warm glow, neon signs, inviting entrance.`,
      camera: "slow dolly approaching entrance",
      voiceLine: `Whether it's lunch, dinner, or a late-night craving — ${name} is here for you.`,
      textOverlay: "Open for You",
    },
  ];

  // Build the scene list with randomization
  const chosenHook = pick(hooks);
  const chosenClosing = pick(closings);
  const shuffledMiddles = shuffle(middleScenes);
  const neededMiddles = Math.max(0, sceneCount - 2); // first + last are hook/closing

  const scenes: any[] = [];

  // Scene 1: Hook (random variant)
  scenes.push({
    shotType: "environment",
    visual: `Stunning exterior of ${name} storefront at golden hour. Warm inviting glow, signage prominent, ${city} street life.`,
    camera: "slow push-in towards entrance",
    voiceLine: chosenHook.voiceLine,
    textOverlay: chosenHook.textOverlay,
  });

  // Middle scenes: shuffled selection
  for (let i = 0; i < neededMiddles && i < shuffledMiddles.length; i++) {
    scenes.push(shuffledMiddles[i]);
  }

  // Last scene: CTA/closing (random variant)
  scenes.push({
    shotType: "environment",
    visual: `${name} logo or storefront signage at twilight. Beautiful bokeh, elegant branding moment.`,
    camera: "slow pull-back reveal",
    voiceLine: chosenClosing.voiceLine,
    textOverlay: chosenClosing.textOverlay,
  });

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
    title: `${name} — ${pick(["Your Local", "Discover", "Experience", "Meet", "Welcome to"])} ${cat}`,
    description: `Discover what makes ${name} the go-to ${cat} in ${city}.`,
    voiceover_script: formattedScenes.map(s => s.voiceover_line).join(" "),
    scene_captions: formattedScenes.map(s => s.voiceover_line),
    scenes: formattedScenes,
    caption: `✨ Discover ${name} in ${city}! ${svc} 🔥 #${name.replace(/\s+/g, "")} #${cat.replace(/\s+/g, "")}`,
    hashtags: [name.replace(/\s+/g, ""), cat.replace(/\s+/g, ""), city.replace(/\s+/g, ""), "smallbusiness"],
    target_platform: "instagram",
    cta: chosenClosing.voiceLine,
    usedFallbackScript: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MANUS VISUAL SCRIPT BUILDER — cinematic shot-by-shot descriptions
// ═══════════════════════════════════════════════════════════════════════
const CAMERA_MOVEMENTS: Record<string, string[]> = {
  food: ["slow push-in", "overhead orbit clockwise", "lateral dolly left-to-right", "rack focus foreground-to-background", "slow tilt down reveal"],
  people: ["steadicam walk-through", "lateral tracking right-to-left", "gentle push-in", "handheld follow", "dolly around subject"],
  environment: ["slow push-in towards entrance", "overhead crane descending", "pull-back reveal", "slow pan left-to-right", "ascending drone-style reveal"],
};
const LIGHTING_MOODS: Record<string, string[]> = {
  food: ["warm golden rim light, vibrant colors", "soft diffused overhead, steam catching light", "dramatic side light, rich shadows", "bright natural window light, fresh feel"],
  people: ["warm ambient candlelight, natural skin tones", "soft backlight with lens flare", "golden hour window light, warm contrast", "bright cheerful daylight, upbeat energy"],
  environment: ["golden hour exterior, warm glow from inside", "twilight blue hour with warm interior contrast", "bright midday, clean shadows", "moody atmospheric with neon accents"],
};
const SHOT_SIZES = { food: ["extreme close-up", "close-up", "medium close-up", "overhead flat-lay"], people: ["medium shot", "medium close-up", "wide shot", "over-the-shoulder"], environment: ["wide establishing shot", "medium wide shot", "low-angle wide shot", "aerial wide shot"] };
const TRANSITIONS_IN = ["fade in from black", "soft crossfade", "whip pan from previous", "match cut", "smooth morph transition"];
const TRANSITIONS_OUT = ["soft crossfade to next", "quick cut", "slow fade", "motion blur transition", "match dissolve"];

function buildManusVisualScript(script: any, biz: any, preset: PipelinePreset, videoId: string) {
  const scenes = script.scenes || [];
  const aspectRatio = preset.orientation === "vertical" ? "9:16" : "16:9";
  const totalDuration = scenes.reduce((sum: number, s: any) => sum + (s.duration_seconds || preset.clipDuration), 0);

  const shots = scenes.map((scene: any, i: number) => {
    const shotType = scene.shotType || "environment";
    const camPool = CAMERA_MOVEMENTS[shotType] || CAMERA_MOVEMENTS.environment;
    const lightPool = LIGHTING_MOODS[shotType] || LIGHTING_MOODS.environment;
    const sizePool = SHOT_SIZES[shotType] || SHOT_SIZES.environment;

    const shotSize = sizePool[i % sizePool.length];
    const cameraMovement = camPool[i % camPool.length];
    const lighting = lightPool[i % lightPool.length];
    const transIn = i === 0 ? "fade in from black" : TRANSITIONS_IN[(i) % TRANSITIONS_IN.length];
    const transOut = i === scenes.length - 1 ? "fade to black" : TRANSITIONS_OUT[(i) % TRANSITIONS_OUT.length];

    const subject = scene.visual_description?.split(".")[0] || `${biz.business_name} ${shotType} scene`;
    const envDetails = scene.visual_description?.split(".").slice(1).join(".").trim() || "";

    // Build the full cinematic prompt text for Manus
    const promptText = `${shotSize} of ${subject}, ${scene.camera_direction || cameraMovement}, ${lighting}, ${envDetails}. Style: cinematic, crisp, high-detail, natural motion, no cheesy stock footage look.`;

    return {
      index: i + 1,
      label: scene.text_overlay || `Scene ${i + 1}`,
      voice_lines: scene.voiceover_line || "",
      estimated_duration_seconds: scene.duration_seconds || preset.clipDuration,
      shot_type: shotSize,
      shot_category: shotType,
      subject,
      camera_angle: shotType === "food" ? "eye-level" : shotType === "environment" ? "low angle" : "eye-level",
      camera_movement: scene.camera_direction || cameraMovement,
      composition: scene.visual_description || "",
      lighting,
      color_grade: shotType === "food" ? "rich warm tones, slightly desaturated background" : "natural warm tones, balanced contrast",
      visual_style: "cinematic, crisp, realistic",
      environment_details: envDetails,
      action: scene.visual_description?.match(/\b(walking|smiling|greeting|serving|cooking|eating|laughing)\b/i)?.[0] || "subtle natural movement",
      transition_in: transIn,
      transition_out: transOut,
      on_screen_text: scene.text_overlay || "",
      brand_elements: i === 0 || i === scenes.length - 1 ? `${biz.business_name} logo/signage` : "",
      constraints: "no text covering key subjects, no extreme camera shake, maintain brand consistency",
      prompt_text: promptText,
      notes_for_ricky: i === 0 ? "Opening hook — keep high energy" : i === scenes.length - 1 ? "Closing CTA — end with brand recall" : "",
    };
  });

  return {
    version: "1.0",
    video_id: `vid_${videoId}`,
    business_id: biz.id,
    business_name: biz.business_name,
    platform: script.target_platform || "tiktok",
    aspect_ratio: aspectRatio,
    style: "cinematic",
    mood: "warm, inviting, high-energy",
    primary_product: biz.services?.split(",")[0]?.trim() || biz.business_category || "signature offering",
    brand_notes: `${biz.brand_tone || "Professional"} tone, ${biz.business_category || "business"} category`,
    target_audience: biz.target_audience || "local customers",
    estimated_total_duration_seconds: totalDuration,
    shots,
    manus_prompt: buildManusPromptText(script, biz, shots, aspectRatio),
  };
}

function buildManusPromptText(script: any, biz: any, shots: any[], aspectRatio: string): string {
  const shotDescriptions = shots.map((s: any) =>
    `Shot ${s.index} (${s.estimated_duration_seconds}s): ${s.prompt_text}\nVO: "${s.voice_lines}"\nOn-screen: "${s.on_screen_text}"`
  ).join("\n\n");

  return `Create a ${aspectRatio} cinematic promotional video for ${biz.business_name}.

BRAND CONTEXT:
- Business: ${biz.business_name} (${biz.business_category || "local business"})
- Services: ${biz.services || "various"}
- Audience: ${biz.target_audience || "local customers"}
- Tone: ${biz.brand_tone || "friendly and professional"}

APPROVED VOICEOVER SCRIPT:
"${script.voiceover_script}"

CINEMATIC SHOT LIST (follow this exact scene order):
${shotDescriptions}

DIRECTION:
- Follow the scene order exactly as listed above
- Aim for smooth transitions between shots
- Match the overall tone: cinematic, high contrast, natural motion, no cheesy stock footage look
- Use warm, inviting color grading throughout
- Ensure brand elements (logo, signage) are visible in opening and closing shots
- Total duration: approximately ${shots.reduce((s: number, sh: any) => s + sh.estimated_duration_seconds, 0)} seconds`;
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT — only if credits available
// ═══════════════════════════════════════════════════════════════════════
function buildAIPrompt(biz: any, loc: any, preset: PipelinePreset) {
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
      headers: { "Authorization": `Bearer ${key}`, "X-Runway-Version": RUNWAY_CONFIG.API_VERSION },
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

async function renderRunwayClip(imageUrl: string, promptText: string, key: string, preset: PipelinePreset): Promise<string | null> {
  const body = {
    model: RUNWAY_CONFIG.DEFAULT_MODEL,
    promptImage: imageUrl,
    promptText: `Cinematic, smooth motion, professional commercial. ${promptText}. High quality, vibrant colors.`,
    duration: preset.clipDuration,  // always a number (5 or 10)
    ratio: preset.ratio,            // always from RUNWAY_CONFIG
  };
  console.log(`[pipeline] Runway request: model=${body.model}, duration=${body.duration}, ratio=${body.ratio}, prompt="${promptText.substring(0, 80)}..."`);
  const res = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "X-Runway-Version": RUNWAY_CONFIG.API_VERSION },
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

// ── Business Media Library (NEW — per-business uploaded assets) ──
interface BusinessMediaRow {
  id: string;
  public_url: string;
  file_type: string;
  shot_type: string;
  file_name: string;
}

async function fetchBusinessMedia(supabase: any, businessId: string): Promise<BusinessMediaRow[]> {
  const { data } = await supabase
    .from("business_media")
    .select("id, public_url, file_type, shot_type, file_name")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return (data || []) as BusinessMediaRow[];
}

function pickMediaForScene(library: BusinessMediaRow[], shotType: string, usedIds: Set<string>): BusinessMediaRow | null {
  // Prefer matching shotType not yet used
  let match = library.find(m => m.shot_type === shotType && !usedIds.has(m.id));
  if (!match) match = library.find(m => !usedIds.has(m.id)); // any unused
  if (!match && library.length > 0) match = library[usedIds.size % library.length]; // cycle
  if (match) usedIds.add(match.id);
  return match || null;
}

// ── Motion prompt builder for Runway per-scene animation ──
const MOTION_PROMPTS: Record<string, string[]> = {
  food: [
    "Slow dramatic push-in with shallow depth of field, warm golden lighting, steam gently rising. Camera glides smoothly forward revealing texture and detail.",
    "Overhead top-down slowly rotating clockwise, warm ambient light, ingredients glistening. Gentle orbit revealing the full composition.",
    "Low-angle sliding dolly left to right, dramatic rim lighting, background softly blurred bokeh. Cinematic food commercial feel.",
    "Rack focus from background to foreground hero item, warm color grading, subtle lens flare. Magazine-quality product reveal.",
  ],
  people: [
    "Steadicam walk-through following subjects, natural warm lighting, candid moments, slight handheld energy. Documentary-style intimacy.",
    "Smooth lateral tracking shot right to left, warm ambient light, genuine smiles and laughter. Lifestyle brand feel.",
    "Medium close-up with gentle push-in, soft natural backlight, authentic expressions. Warm inviting atmosphere.",
  ],
  environment: [
    "Slow cinematic push-in towards entrance, golden hour lighting, warm glow from windows. Establishing shot with grandeur.",
    "Wide crane-style overhead descending gently, revealing interior space, warm pendant lighting. Architectural beauty shot.",
    "Smooth pull-back reveal from detail to wide establishing shot, twilight bokeh, signage prominent. Brand reveal moment.",
  ],
};

function getMotionPrompt(shotType: string, index: number): string {
  const pool = MOTION_PROMPTS[shotType] || MOTION_PROMPTS.environment;
  return pool[index % pool.length];
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

async function getSceneImage(
  supabase: any, userId: string, jobId: string, sceneIndex: number, scene: any, biz: any,
  lovableKey: string, creditsExhausted: boolean, existingImages: string[],
  businessMedia: BusinessMediaRow[], usedMediaIds: Set<string>,
): Promise<{ url: string; isReal: boolean; motionPrompt: string }> {
  const shotType = scene?.shotType || "environment";
  const motionPrompt = getMotionPrompt(shotType, sceneIndex);

  // Priority 0: Business media library (user-uploaded assets)
  const libraryMatch = pickMediaForScene(businessMedia.filter(m => m.file_type === "image"), shotType, usedMediaIds);
  if (libraryMatch) {
    const real = await isRealImage(libraryMatch.public_url);
    if (real) {
      console.log(`[pipeline] Scene ${sceneIndex + 1}: using business media library (${libraryMatch.shot_type}: ${libraryMatch.file_name})`);
      return { url: libraryMatch.public_url, isReal: true, motionPrompt };
    }
  }

  // Priority 1: Real photos from old Supabase storage paths
  if (existingImages.length > 0) {
    const url = existingImages[sceneIndex % existingImages.length];
    const real = await isRealImage(url);
    if (real) {
      console.log(`[pipeline] Scene ${sceneIndex + 1}: using existing real photo`);
      return { url, isReal: true, motionPrompt };
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
                return { url: urlData.publicUrl, isReal: true, motionPrompt };
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

  // Priority 3: Cycle existing images
  if (existingImages.length > 0) {
    return { url: existingImages[sceneIndex % existingImages.length], isReal: true, motionPrompt };
  }

  // Last resort: placeholder
  const png = create128Png(sceneIndex);
  const fn = `scenes/${userId}/${jobId}/scene-${sceneIndex + 1}-placeholder.png`;
  const { error } = await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
  if (error) return { url: "", isReal: false, motionPrompt };
  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
  return { url: urlData.publicUrl, isReal: false, motionPrompt };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════
async function processVideoJob(jobId: string, userId: string, businessId: string, videoType: string, lengthMode: string, orientation: Orientation = "landscape") {
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
    const elevenlabsKey = keyMap["elevenlabs"] || Deno.env.get("ELEVENLABS_API_KEY") || "";
    const userRunwayKey = keyMap["runway"] || runwayKey;

    const preset = buildPreset(lengthMode, orientation);
    console.log(`[pipeline] ═══ Starting job ${jobId} ═══`);
    console.log(`[pipeline] Preset: ${preset.label}, orientation=${preset.orientation}, ratio=${preset.ratio}, scenes=${preset.sceneCount}, clipDur=${preset.clipDuration}s`);
    console.log(`[pipeline] Runway key: ${userRunwayKey ? "YES" : "NO"}, ElevenLabs: ${elevenlabsKey ? "YES" : "NO"}`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 1: SCRIPT — use approved script if provided, else generate
    // ════════════════════════════════════════════════════════════════════
    await updateJob({ status: "generating_script", result_payload: { pipeline_step: "script", message: "✍️ Loading your approved script..." } });

    let script: any;
    let usedFallbackScript = false;

    // Check if an approved script was passed from the UI
    const { data: jobRow } = await supabase.from("video_generation_jobs").select("request_payload").eq("id", jobId).single();
    const passedScript = (jobRow?.request_payload as any)?.approvedScript;

    if (passedScript?.scenes?.length > 0) {
      console.log(`[pipeline] Using pre-approved script: "${passedScript.title}"`);
      script = passedScript;
      usedFallbackScript = !!passedScript.usedFallbackScript;
    } else {
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
        script.usedFallbackScript = false;
        console.log(`[pipeline] AI script generated: "${script.title}"`);
      } catch (e: any) {
        console.log(`[pipeline] AI unavailable (${e.message}), building script from saved data + profile`);
        usedFallbackScript = true;

        const { data: lastScript } = await supabase.from("strategy_outputs").select("output_data")
          .eq("business_id", businessId).eq("step_number", 8).order("updated_at", { ascending: false }).limit(1).maybeSingle();

        if (lastScript?.output_data?.voiceover_script) {
          console.log(`[pipeline] Using last saved script from strategy_outputs`);
          script = lastScript.output_data;
        } else {
          script = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
        }
        script.usedFallbackScript = true;
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

    // ═══ BUILD MANUS VISUAL SCRIPT (cinematic shot list) ═══
    const manusVisualScript = buildManusVisualScript(script, business, preset, jobId);
    script.manus_visual_script = manusVisualScript;

    console.log(`[pipeline] Script ready: ${script.scenes.length} scenes, ~${script.voiceover_script.split(" ").length} words, fallback=${usedFallbackScript}`);
    console.log(`[pipeline] Manus visual script: ${manusVisualScript.shots.length} shots, style=${manusVisualScript.style}`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 2: IMAGES (business media library → old storage → AI → placeholder)
    // ════════════════════════════════════════════════════════════════════
    await updateJob({
      status: "generating_images",
      result_payload: { ...script, scene_images: [], video_clips: [], pipeline_step: "images", message: "🎨 Finding best photos..." },
    });

    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    // Fetch business media library (user-uploaded assets)
    const businessMedia = await fetchBusinessMedia(supabase, businessId);
    const businessVideos = businessMedia.filter(m => m.file_type === "video");
    const businessImages = businessMedia.filter(m => m.file_type === "image");
    console.log(`[pipeline] Business media library: ${businessImages.length} images, ${businessVideos.length} videos`);

    const existingRealImages = await findAllExistingImages(supabase, userId);
    console.log(`[pipeline] Found ${existingRealImages.length} existing real photos in old storage`);

    const sceneImageUrls: string[] = [];
    const sceneImageIsReal: boolean[] = [];
    const sceneMotionPrompts: string[] = [];
    const sceneVideoClipUrls: string[] = []; // pre-existing video clips from library
    let imageCreditsExhausted = false;
    const usedMediaIds = new Set<string>();

    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      const shotType = scene?.shotType || "environment";

      // Check for matching video clip in library first
      const videoMatch = pickMediaForScene(businessVideos, shotType, usedMediaIds);
      if (videoMatch) {
        sceneVideoClipUrls.push(videoMatch.public_url);
        sceneImageUrls.push(videoMatch.public_url); // placeholder for tracking
        sceneImageIsReal.push(true);
        sceneMotionPrompts.push(""); // no motion needed for video
        console.log(`[pipeline] Scene ${i + 1}: using uploaded video clip (${videoMatch.file_name})`);
      } else {
        try {
          const result = await getSceneImage(supabase, userId, jobId, i, scene, business, lovableKey, imageCreditsExhausted, existingRealImages, businessImages, usedMediaIds);
          sceneImageUrls.push(result.url);
          sceneImageIsReal.push(result.isReal);
          sceneMotionPrompts.push(result.motionPrompt);
        } catch (e: any) {
          if (e.message === "CREDITS_EXHAUSTED") imageCreditsExhausted = true;
          const motionPrompt = getMotionPrompt(shotType, i);
          if (existingRealImages.length > 0) {
            sceneImageUrls.push(existingRealImages[i % existingRealImages.length]);
            sceneImageIsReal.push(true);
            sceneMotionPrompts.push(motionPrompt);
          } else {
            const png = create128Png(i);
            const fn = `scenes/${userId}/${jobId}/scene-${i + 1}-placeholder.png`;
            await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
            const { data: u } = supabase.storage.from("media").getPublicUrl(fn);
            sceneImageUrls.push(u.publicUrl);
            sceneImageIsReal.push(false);
            sceneMotionPrompts.push(motionPrompt);
          }
        }
      }

      await updateJob({
        result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "images", message: `🎨 Photos: ${sceneImageUrls.length}/${script.scenes.length}` },
      });
    }

    const realImageCount = sceneImageIsReal.filter(Boolean).length;
    console.log(`[pipeline] Images: ${sceneImageUrls.length} total, ${realImageCount} real, ${sceneVideoClipUrls.length} pre-existing video clips`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 3: VOICEOVER (ElevenLabs if user opted in, otherwise captions only)
    // ════════════════════════════════════════════════════════════════════
    let voiceoverUrl: string | null = null;
    let voiceoverMessage = "";

    // Check if user explicitly enabled ElevenLabs voiceover
    const { data: voToolDefault } = await supabase
      .from("user_tool_defaults")
      .select("default_provider")
      .eq("user_id", userId)
      .eq("tool_type", "voice")
      .maybeSingle();
    const useElevenLabs = voToolDefault?.default_provider === "elevenlabs";

    // Check if user chose a specific voice ID
    const { data: voiceDefault } = await supabase
      .from("user_tool_defaults")
      .select("default_provider")
      .eq("user_id", userId)
      .eq("tool_type", "elevenlabs_voice_id")
      .maybeSingle();
    // Default to George (friendly male) if no voice chosen
    const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
    const voiceId = voiceDefault?.default_provider || DEFAULT_VOICE_ID;

    if (useElevenLabs && elevenlabsKey && script.voiceover_script) {
      try {
        await updateJob({ status: "generating_voiceover", result_payload: { ...script, scene_images: sceneImageUrls, video_clips: [], pipeline_step: "voiceover", message: "🎙️ Recording voiceover with ElevenLabs..." } });
        console.log(`[pipeline] Calling ElevenLabs TTS, voice=${voiceId}`);
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
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
            console.log(`[pipeline] ✅ ElevenLabs voiceover ready`);
          }
        } else {
          const errBody = await ttsRes.text();
          console.error(`[pipeline] ElevenLabs TTS failed [${ttsRes.status}]: ${errBody}`);
          voiceoverMessage = "We couldn't reach ElevenLabs for voiceover this time, so we used captions only. You can retry later without losing your video.";
        }
      } catch (e) {
        console.error("[pipeline] ElevenLabs voiceover error:", e);
        voiceoverMessage = "We couldn't reach ElevenLabs for voiceover this time, so we used captions only. You can retry later without losing your video.";
      }
    } else if (useElevenLabs && !elevenlabsKey) {
      console.log("[pipeline] User wants ElevenLabs but no key found — captions only");
      voiceoverMessage = "ElevenLabs is enabled but no API key was found. Please reconnect your ElevenLabs account in Settings.";
    } else {
      console.log("[pipeline] Voiceover not enabled — captions only");
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 4: RUNWAY RENDERING (with detailed motion prompts per scene)
    // ════════════════════════════════════════════════════════════════════
    const videoClips: string[] = [...sceneVideoClipUrls]; // start with pre-existing library clips

    if (!userRunwayKey) {
      console.log("[pipeline] No Runway key — slideshow mode");
    } else if (realImageCount === 0) {
      console.log("[pipeline] No real images — skipping Runway");
    } else {
      const scenesToRender = sceneImageUrls
        .map((url, i) => ({ url, index: i, isReal: sceneImageIsReal[i], motionPrompt: sceneMotionPrompts[i] }))
        .filter(s => s.isReal && s.motionPrompt); // only render images, not pre-existing videos

      console.log(`[pipeline] 🎬 Rendering ${scenesToRender.length} Runway clips (model=${RUNWAY_CONFIG.DEFAULT_MODEL}, ratio=${preset.ratio}, dur=${preset.clipDuration})`);
      await updateJob({
        status: "rendering_video",
        result_payload: {
          ...script, scene_images: sceneImageUrls, voiceover_url: voiceoverUrl, video_clips: videoClips,
          pipeline_step: "runway", message: `🎬 Rendering ${scenesToRender.length} clips...`,
          total_clips: scenesToRender.length, clips_completed: 0,
        },
      });

      for (let ci = 0; ci < scenesToRender.length; ci++) {
        const { url: imgUrl, index: sceneIdx, motionPrompt } = scenesToRender[ci];
        const scene = script.scenes[sceneIdx];
        // Use the detailed motion prompt instead of generic variations
        const prompt = `${scene?.visual_description || `Professional video for ${business.business_name}`}. ${motionPrompt}`;

        try {
          console.log(`[pipeline] Rendering clip ${ci + 1}/${scenesToRender.length} with motion: "${motionPrompt.substring(0, 60)}..."`);
          const clipUrl = await renderRunwayClip(imgUrl, prompt, userRunwayKey, preset);
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
            pipeline_step: "runway", message: `🎬 Rendered ${videoClips.length}/${scenesToRender.length + sceneVideoClipUrls.length}`,
            total_clips: scenesToRender.length, clips_completed: videoClips.length - sceneVideoClipUrls.length,
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

    if (usedFallbackScript) {
      statusMessage += " ℹ️ This video used your saved strategy data because AI credits were low.";
    }
    if (voiceoverMessage) {
      statusMessage += ` 🎙️ ${voiceoverMessage}`;
    }

    const resultPayload = {
      ...script,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_clips: videoClips,
      video_url: videoClips[0] || null,
      total_duration_seconds: totalDuration,
      is_fallback: isFallback,
      usedFallbackScript,
      used_ai_script: !usedFallbackScript,
      real_image_count: realImageCount,
      length_mode: lengthMode,
      orientation,
      runway_preset: {
        model: RUNWAY_CONFIG.DEFAULT_MODEL,
        ratio: preset.ratio,
        clipDuration: preset.clipDuration,
      },
      pipeline_steps: {
        script: "completed",
        images: realImageCount > 0 ? "completed" : hasImages ? "placeholders_only" : "failed",
        voiceover: voiceoverUrl ? "completed" : useElevenLabs ? "elevenlabs_failed" : "captions_only",
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
    console.log(`[pipeline]   Clips: ${videoClips.length}, Images: ${sceneImageUrls.length} (${realImageCount} real), Duration: ${totalDuration}s, FallbackScript: ${usedFallbackScript}`);
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

    const { businessId, videoType, lengthMode, orientation, mode, approvedScript } = await req.json();

    // ── SCRIPT-ONLY MODE: generate script and return synchronously ──
    if (mode === "script_only") {
      const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", user.id).single();
      if (!business) throw new Error("Business not found");
      const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", user.id).limit(1);
      const location = locations?.[0];
      const { data: strategyRows } = await supabase.from("strategy_outputs").select("output_data").eq("business_id", businessId).eq("user_id", user.id).order("step_number", { ascending: true }).limit(10);
      const strategyData = strategyRows?.reduce((acc: any, row: any) => ({ ...acc, ...(row.output_data || {}) }), {}) || {};

      const preset = buildPreset(lengthMode || "standard", orientation || "landscape");
      let script: any;
      let usedFallbackScript = false;

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
        script.usedFallbackScript = false;
      } catch (e: any) {
        usedFallbackScript = true;
        const { data: lastScript } = await supabase.from("strategy_outputs").select("output_data")
          .eq("business_id", businessId).eq("step_number", 8).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (lastScript?.output_data?.voiceover_script) {
          script = lastScript.output_data;
        } else {
          script = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
        }
        script.usedFallbackScript = true;
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

      // Build cinematic visual script for script_only mode too
      const manusVisualScript = buildManusVisualScript(script, business, preset, "preview");
      script.manus_visual_script = manusVisualScript;

      return new Response(JSON.stringify({
        success: true,
        script,
        usedFallbackScript,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: job, error: jobErr } = await supabase
      .from("video_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        location_id: null,
        provider: Deno.env.get("RUNWAY_API_KEY") ? "runway" : "built_in_ai",
        status: "queued",
        request_payload: { businessId, videoType, lengthMode, orientation: orientation || "landscape", approvedScript: approvedScript || null },
      })
      .select("id")
      .single();

    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    const promise = processVideoJob(job.id, user.id, businessId, videoType || "promotional", lengthMode || "standard", orientation || "landscape");
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
