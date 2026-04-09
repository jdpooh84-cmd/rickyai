import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
// ═══════════════════════════════════════════════════════════════════════
// VIDEO CONFIG — Manus AI is the primary video generator
// ═══════════════════════════════════════════════════════════════════════
const VIDEO_PIPELINE_CONFIG = {
  RATIO_LANDSCAPE: "16:9",
  RATIO_VERTICAL: "9:16",
  DURATION_SHORT: 5 as const,
  DURATION_STANDARD: 10 as const,
  DURATION_LONG: 10 as const,
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
  const ratio = orientation === "vertical" ? VIDEO_PIPELINE_CONFIG.RATIO_VERTICAL : VIDEO_PIPELINE_CONFIG.RATIO_LANDSCAPE;
  // MINIMUM 60 seconds enforced on all videos
  switch (lengthMode) {
    case "short":
      return { targetSeconds: 60, sceneCount: 6, clipDuration: VIDEO_PIPELINE_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Standard (60s)" };
    case "long":
      return { targetSeconds: 90, sceneCount: 9, clipDuration: VIDEO_PIPELINE_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Long (90s)" };
    case "extended":
      return { targetSeconds: 120, sceneCount: 12, clipDuration: VIDEO_PIPELINE_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Extended (120s)" };
    case "standard":
    default:
      return { targetSeconds: 60, sceneCount: 6, clipDuration: VIDEO_PIPELINE_CONFIG.DURATION_STANDARD, orientation, ratio, label: "Standard (60s)" };
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

  // Time-seeded randomization so no two calls produce the same script
  const seed = Date.now();
  const rand = () => { const x = Math.sin(seed + Math.random() * 10000) * 10000; return x - Math.floor(x); };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => rand() - 0.5);

  // ── LARGE HOOK POOL (18 variants) ──
  const hooks = [
    { voiceLine: `Looking for the best ${cat} in ${city}? You just found it.`, textOverlay: name },
    { voiceLine: `${city}, meet your new favorite ${cat} — ${name}.`, textOverlay: `Discover ${name}` },
    { voiceLine: `Craving something amazing? ${name} in ${city}${state ? `, ${state}` : ""} has you covered.`, textOverlay: `${name} — ${city}` },
    { voiceLine: `What makes ${name} the talk of ${city}? Let us show you.`, textOverlay: `Why ${name}?` },
    { voiceLine: `Stop scrolling. ${name} is about to change your ${cat} game.`, textOverlay: name },
    { voiceLine: `${city}'s best-kept secret? It's called ${name}.`, textOverlay: `Secret's Out` },
    { voiceLine: `Three words: ${name}, ${city}. Need we say more?`, textOverlay: `${name} ✦ ${city}` },
    { voiceLine: `Picture this: the perfect ${cat} experience. That's ${name}.`, textOverlay: `Picture This` },
    { voiceLine: `Forget everything you thought you knew about ${cat}. ${name} rewrites the rules.`, textOverlay: `New Standard` },
    { voiceLine: `One taste. One visit. That's all it takes to fall in love with ${name}.`, textOverlay: `Fall in Love` },
    { voiceLine: `${name} didn't come to play — we came to set the standard in ${city}.`, textOverlay: `The Standard` },
    { voiceLine: `There's ${cat}… and then there's ${name}. The difference is everything.`, textOverlay: `The Difference` },
    { voiceLine: `Ask anyone in ${city} where to go for ${cat}. They'll say ${name}.`, textOverlay: `Ask Around` },
    { voiceLine: `Welcome to the place ${city} can't stop talking about.`, textOverlay: `Welcome` },
    { voiceLine: `If you haven't tried ${name} yet, this is your sign.`, textOverlay: `Your Sign` },
    { voiceLine: `Let's take you inside ${city}'s most talked-about ${cat}.`, textOverlay: `Step Inside` },
    { voiceLine: `Every great neighborhood deserves a great ${cat}. ${city} has ${name}.`, textOverlay: `Neighborhood Gem` },
    { voiceLine: `What happens when passion meets ${cat}? You get ${name}.`, textOverlay: `Passion Meets ${cat}` },
  ];

  // ── LARGE CLOSING POOL (12 variants) ──
  const closings = [
    { voiceLine: `${name} — your go-to ${cat} in ${city}${state ? `, ${state}` : ""}. See you soon!`, textOverlay: `${name} — ${city}` },
    { voiceLine: `Come visit ${name} today. We can't wait to serve you!`, textOverlay: `Visit Us Today!` },
    { voiceLine: `Follow ${name} for more. Link in bio!`, textOverlay: `Follow ${name}` },
    { voiceLine: `Ready for the ${name} experience? Walk in or order online today.`, textOverlay: `Order Now` },
    { voiceLine: `${name} — where every visit feels like coming home. See you there!`, textOverlay: `Welcome Home` },
    { voiceLine: `Don't just take our word for it — come see for yourself. ${name}, ${city}.`, textOverlay: `See for Yourself` },
    { voiceLine: `Your next favorite ${cat} experience starts at ${name}. Let's go!`, textOverlay: `Let's Go!` },
    { voiceLine: `Tag someone who needs to know about ${name}!`, textOverlay: `Tag a Friend` },
    { voiceLine: `${name}. ${city}. Every single time.`, textOverlay: `Every Time` },
    { voiceLine: `Life's too short for average ${cat}. Choose ${name}.`, textOverlay: `Choose ${name}` },
    { voiceLine: `Save this. Share this. Visit ${name}.`, textOverlay: `Save & Share` },
    { voiceLine: `The doors are open. The team is ready. ${name} is waiting for you.`, textOverlay: `We're Waiting` },
  ];

  // ── EXPANDED MIDDLE SCENES (20 variants) ──
  const middleScenes = [
    { shotType: "people", visual: `Owner or team at ${name} smiling warmly, greeting customers. ${tone} atmosphere.`, camera: "steadicam walk-through", voiceLine: `Welcome to ${name}${city ? ` in ${city}${state ? `, ${state}` : ""}` : ""}. Serving our community with pride.`, textOverlay: `Welcome to ${name}` },
    { shotType: "food", visual: `Hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, vibrant colors.`, camera: "slow pan across product", voiceLine: `From ${primarySvc} to ${secondarySvc} — every detail crafted with care.${uniqueSelling ? ` ${uniqueSelling}` : ""}`, textOverlay: primarySvc },
    { shotType: "food", visual: `Close-up montage of ${name}'s offerings. Dynamic composition, vibrant colors.`, camera: "rack focus transitions", voiceLine: `Only the best — quality you can see and taste.`, textOverlay: "Something for Everyone" },
    { shotType: "people", visual: `Happy ${aud} enjoying their experience at ${name}. Laughing together.`, camera: "lateral tracking dolly", voiceLine: `Our ${aud} keep coming back.${strategyInsights ? ` Known for ${strategyInsights}.` : ""}`, textOverlay: "Loved by Locals" },
    { shotType: "people", visual: `Behind-the-scenes at ${name}. Skilled hands at work, attention to detail.`, camera: "dolly-in extreme close-up", voiceLine: `Behind every great experience is a team that truly cares.`, textOverlay: "Crafted with Care" },
    { shotType: "environment", visual: `Inviting wide shot of ${name}'s interior. ${tone} atmosphere, warm lighting.`, camera: "overhead crane shot", voiceLine: `Come see the difference for yourself.`, textOverlay: "Step Inside" },
    { shotType: "food", visual: `Top-down flat lay of ${name}'s best offerings arranged artfully.`, camera: "slow overhead rotate", voiceLine: `Fresh, delicious, and made just for you.`, textOverlay: "Always Fresh" },
    { shotType: "people", visual: `A family enjoying time together at ${name}. Warm smiles, golden light.`, camera: "medium shot, gentle push-in", voiceLine: `${name} isn't just ${cat} — it's where memories are made.`, textOverlay: "Family Moments" },
    { shotType: "environment", visual: `${name} team preparing for the day. Organized, energetic, morning light.`, camera: "tracking shot through space", voiceLine: `Every day starts with one goal: make your experience unforgettable.`, textOverlay: "Ready for You" },
    { shotType: "food", visual: `Action shot of ${primarySvc} being prepared. Hands in motion, energy and precision.`, camera: "dynamic handheld close-up", voiceLine: `Real craft, real passion, real flavor.`, textOverlay: "Made with Passion" },
    { shotType: "people", visual: `Regular customers giving thumbs up, sharing on social media.`, camera: "medium close-up, natural light", voiceLine: `Our fans speak for themselves.`, textOverlay: "★★★★★" },
    { shotType: "environment", visual: `${name} exterior at night with warm glow, inviting entrance.`, camera: "slow dolly approaching entrance", voiceLine: `Whether it's lunch, dinner, or a late-night craving — ${name} is here.`, textOverlay: "Open for You" },
    { shotType: "food", visual: `Extreme close-up of textures — melted cheese, crispy edges, fresh garnish on ${primarySvc}.`, camera: "macro lens slow pull-out", voiceLine: `The details tell the story. Every texture, every flavor — intentional.`, textOverlay: "Every Detail" },
    { shotType: "people", visual: `Staff member carefully packaging a to-go order with a handwritten thank-you note.`, camera: "over-the-shoulder medium shot", voiceLine: `Whether you dine in or take out, the ${name} touch goes with you.`, textOverlay: "The Extra Mile" },
    { shotType: "environment", visual: `Wide aerial-style shot of ${city} with ${name}'s location highlighted by warm light.`, camera: "ascending drone reveal", voiceLine: `Right here in the heart of ${city}${state ? `, ${state}` : ""} — a ${cat} worth the trip.`, textOverlay: `Heart of ${city}` },
    { shotType: "people", visual: `A first-time customer walking in, eyes lighting up at the atmosphere.`, camera: "following steadicam from behind", voiceLine: `First timers become regulars. That's the ${name} effect.`, textOverlay: "The Effect" },
    { shotType: "food", visual: `Side-by-side comparison: raw ingredients transforming into a finished ${primarySvc}.`, camera: "timelapse-style sequence", voiceLine: `From scratch to served — we put the work in so you taste the difference.`, textOverlay: "From Scratch" },
    { shotType: "environment", visual: `Cozy corner of ${name} — a couple sharing a quiet moment, ambient music vibes.`, camera: "soft focus medium wide", voiceLine: `It's not just about the ${cat}. It's about the feeling.`, textOverlay: "The Feeling" },
    { shotType: "people", visual: `Group of friends cheering, clinking glasses, celebrating at ${name}.`, camera: "wide shot with confetti energy", voiceLine: `Birthdays, milestones, random Tuesdays — ${name} makes them all special.`, textOverlay: "Celebrate Here" },
    { shotType: "food", visual: `${name}'s newest or seasonal offering, presented with dramatic flair.`, camera: "rotating pedestal shot", voiceLine: `Always evolving, always surprising. Ask about what's new.`, textOverlay: "What's New" },
  ];

  // ── STRUCTURAL VARIANCE — pick a random architecture ──
  const structures = ["linear", "bookend", "reverse", "middle_heavy"] as const;
  const structure = pick([...structures]);

  const chosenHook = pick(hooks);
  const chosenClosing = pick(closings);
  const shuffledMiddles = shuffle(middleScenes);
  const neededMiddles = Math.max(0, sceneCount - 2);

  const scenes: any[] = [];

  // Hook visual variants
  const hookVisuals = [
    `Stunning exterior of ${name} storefront at golden hour. Warm inviting glow, signage prominent, ${city} street life.`,
    `Drone-style sweeping shot descending toward ${name}'s entrance. ${city} skyline visible, dramatic reveal.`,
    `Quick-cut montage: hands preparing ${primarySvc}, a smile, the ${name} sign — all in 3 seconds. High energy.`,
    `Slow-motion shot of the ${name} door opening, warm light spilling out, a customer stepping inside.`,
    `Time-lapse of ${city} transitioning from morning to evening, ending with ${name} lit up at night.`,
  ];

  // Closing visual variants
  const closingVisuals = [
    `${name} logo or storefront signage at twilight. Beautiful bokeh, elegant branding moment.`,
    `Happy customers walking out of ${name}, waving goodbye, takeaway bags in hand. Warm sunset.`,
    `Animated text reveal of ${name}'s address and social handles over a blurred background of the interior.`,
    `Overhead shot of a full table at ${name} — food, drinks, hands reaching in. Community moment.`,
  ];

  if (structure === "reverse") {
    // Start with CTA, end with hook — inverted structure
    scenes.push({ shotType: "environment", visual: pick(closingVisuals), camera: "slow pull-back reveal", voiceLine: chosenClosing.voiceLine, textOverlay: chosenClosing.textOverlay });
    for (let i = 0; i < neededMiddles && i < shuffledMiddles.length; i++) scenes.push(shuffledMiddles[i]);
    scenes.push({ shotType: "environment", visual: pick(hookVisuals), camera: "slow push-in towards entrance", voiceLine: chosenHook.voiceLine, textOverlay: chosenHook.textOverlay });
  } else if (structure === "middle_heavy") {
    // Short hook, extra middles, short close
    scenes.push({ shotType: "environment", visual: pick(hookVisuals), camera: "quick whip pan", voiceLine: chosenHook.voiceLine, textOverlay: chosenHook.textOverlay });
    for (let i = 0; i < neededMiddles + 1 && i < shuffledMiddles.length && scenes.length < sceneCount - 1; i++) scenes.push(shuffledMiddles[i]);
    scenes.push({ shotType: "environment", visual: pick(closingVisuals), camera: "snap zoom to logo", voiceLine: chosenClosing.voiceLine, textOverlay: chosenClosing.textOverlay });
  } else {
    // Linear or bookend (standard flow)
    scenes.push({ shotType: "environment", visual: pick(hookVisuals), camera: "slow push-in towards entrance", voiceLine: chosenHook.voiceLine, textOverlay: chosenHook.textOverlay });
    for (let i = 0; i < neededMiddles && i < shuffledMiddles.length; i++) scenes.push(shuffledMiddles[i]);
    scenes.push({ shotType: "environment", visual: pick(closingVisuals), camera: "slow pull-back reveal", voiceLine: chosenClosing.voiceLine, textOverlay: chosenClosing.textOverlay });
  }

  // Trim or pad to exact sceneCount
  while (scenes.length > sceneCount) scenes.pop();
  while (scenes.length < sceneCount) {
    const extra = shuffledMiddles[scenes.length % shuffledMiddles.length];
    if (extra) scenes.push(extra);
    else break;
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

  // Title variants
  const titlePrefixes = ["Your Local", "Discover", "Experience", "Meet", "Welcome to", "Introducing", "Inside", "The Story of", "Why People Love", "A Taste of", "Behind the Scenes at"];

  return {
    title: `${name} — ${pick(titlePrefixes)} ${cat}`,
    description: `Discover what makes ${name} the go-to ${cat} in ${city}.`,
    voiceover_script: formattedScenes.map(s => s.voiceover_line).join(" "),
    scene_captions: formattedScenes.map(s => s.voiceover_line),
    scenes: formattedScenes,
    caption: `${pick(["✨", "🔥", "💯", "🎬", "⭐"])} ${pick(["Discover", "Experience", "Meet", "Fall in love with", "Check out"])} ${name} in ${city}! ${svc} ${pick(["🔥", "💪", "✨", "🎯"])} #${name.replace(/\s+/g, "")} #${cat.replace(/\s+/g, "")}`,
    hashtags: [name.replace(/\s+/g, ""), cat.replace(/\s+/g, ""), city.replace(/\s+/g, ""), "smallbusiness", pick(["localbusiness", "supportlocal", "shoplocal", "communitylove"])],
    target_platform: pick(["instagram", "tiktok", "facebook"]),
    cta: chosenClosing.voiceLine,
    usedFallbackScript: true,
    _generationId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    _structure: structure,
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
    const promptText = `${shotSize} of ${subject}, ${scene.camera_direction || cameraMovement}, ${lighting}, ${envDetails}. Style: cinematic, crisp, high-detail, natural motion, photorealistic. DO NOT: generic stock footage, robotic movement, flat lighting.`;

    // Derive emotional beat from scene position
    const emotionalBeats = ["intrigue", "discovery", "connection", "desire", "action"];
    const beatIndex = Math.min(Math.floor(i / Math.max(1, scenes.length / emotionalBeats.length)), emotionalBeats.length - 1);

    // Negative prompts per shot type
    const negativePrompts: Record<string, string> = {
      food: "no flat overhead lighting, no plastic-looking food, no cluttered backgrounds",
      people: "no stiff posed shots, no fake smiles, no empty restaurant feel",
      environment: "no harsh fluorescent lighting, no cluttered signage, no dirty surfaces",
    };

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
      emotional_beat: scene.emotional_beat || emotionalBeats[beatIndex],
      negative_prompt: scene.negative_prompt || negativePrompts[shotType] || "no generic stock footage",
      prompt_text: promptText,
      notes_for_ricky: i === 0 ? "Opening hook — unexpected angle, grab attention in 2s" : i === scenes.length - 1 ? "Closing CTA — memorable brand moment, not generic" : `Scene ${i + 1} — ${emotionalBeats[beatIndex]} beat`,
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
  // SLIMMED PROMPT — reduced context load per Manus support recommendation
  const tone = biz.brand_tone || "friendly";
  const cat = biz.business_category || "local business";
  const city = biz.locations?.[0]?.city || "";
  const totalDur = shots.reduce((s: number, sh: any) => s + sh.estimated_duration_seconds, 0);

  return `═══ VIDEO BRIEF — ${biz.business_name} ═══
Format: ${aspectRatio} | Duration: ${totalDur}s | Style: cinematic, photorealistic
Business: ${biz.business_name} (${cat}) in ${city}
Tone: ${tone} | Audience: ${biz.target_audience || "local customers"}
Services: ${biz.services || "various"}
${biz.competitors ? `Differentiate from: ${biz.competitors}` : ""}

RULES: Unique bespoke video. No templates. No generic stock footage look. Vary shot sizes. Natural motion. ${city} location ONLY.

VOICEOVER: "${script.voiceover_script}"

SHOT LIST (render each scene individually):
${shots.map((s: any) => `S${s.index} (${s.estimated_duration_seconds}s): ${s.shot_type} — ${s.subject}. Camera: ${s.camera_movement}. Light: ${s.lighting}. Text: "${s.on_screen_text}". VO: "${s.voice_lines}". Avoid: ${s.negative_prompt || "generic look"}`).join("\n")}

Emotional arc: Intrigue → Discovery → Connection → Desire → Action. Each shot transitions seamlessly. Color grade consistent throughout.`;
}

// Build per-scene prompts for sub-task architecture (each scene = 1 Manus task)
function buildPerScenePrompts(script: any, biz: any, shots: any[], aspectRatio: string): string[] {
  const tone = biz.brand_tone || "friendly";
  const city = biz.locations?.[0]?.city || "";
  const context = `Business: ${biz.business_name} (${biz.business_category || "business"}) in ${city}. Tone: ${tone}. Style: cinematic, photorealistic.`;

  return shots.map((s: any) => {
    return `${context}
Render ONE scene (${s.estimated_duration_seconds}s, ${aspectRatio}):
${s.shot_type} of ${s.subject}. Camera: ${s.camera_movement}. Lighting: ${s.lighting}.
On-screen text: "${s.on_screen_text}". Voiceover: "${s.voice_lines}".
Emotional beat: ${s.emotional_beat || "engage"}. Avoid: ${s.negative_prompt || "generic stock footage"}.
Natural motion, no robotic movement, cinematic depth of field.`;
  });
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT — only if credits available
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// BUSINESS DNA ANALYZER — extracts strategic insights for video creation
// ═══════════════════════════════════════════════════════════════════════
function analyzeBusinessDNA(biz: any, loc: any, strategyData: any) {
  const name = biz.business_name || "Business";
  const cat = biz.business_category || "local business";
  const svc = biz.services || "";
  const aud = biz.target_audience || "";
  const tone = biz.brand_tone || "professional";
  const city = loc?.city || "";
  const state = loc?.state || "";
  const competitors = biz.competitors || "";
  const goals = biz.content_goals || "";
  const niche = biz.niche || cat;
  const website = biz.website_url || "";

  // Derive brand personality from tone
  const toneMap: Record<string, { visualStyle: string; pacing: string; colorMood: string; musicVibe: string }> = {
    "friendly": { visualStyle: "warm, approachable, natural light", pacing: "moderate with moments of energy", colorMood: "warm golds, soft oranges, cream", musicVibe: "upbeat acoustic, feel-good" },
    "professional": { visualStyle: "clean, polished, structured compositions", pacing: "measured, confident", colorMood: "navy, silver, white", musicVibe: "corporate inspirational, subtle" },
    "fun": { visualStyle: "vibrant, dynamic, playful angles", pacing: "fast cuts, high energy", colorMood: "saturated primaries, pops of neon", musicVibe: "upbeat pop, energetic" },
    "luxury": { visualStyle: "dramatic lighting, cinematic depth of field", pacing: "slow, deliberate, editorial", colorMood: "deep black, gold accents, rich burgundy", musicVibe: "orchestral, ambient elegance" },
    "edgy": { visualStyle: "high contrast, gritty textures, unconventional angles", pacing: "rapid cuts mixed with slow-mo", colorMood: "desaturated with bold accent pops", musicVibe: "electronic, bass-heavy" },
    "community-focused": { visualStyle: "candid, documentary-style, real moments", pacing: "natural rhythm, breathing room", colorMood: "earth tones, greens, warm neutrals", musicVibe: "indie folk, heartfelt" },
  };
  const brandProfile = toneMap[tone.toLowerCase()] || toneMap["friendly"];

  // Competitive differentiation
  const competitorList = competitors.split(",").map((c: string) => c.trim()).filter(Boolean);
  const diffStrategy = competitorList.length > 0
    ? `Differentiate from competitors (${competitorList.slice(0, 3).join(", ")}). Show what makes ${name} DIFFERENT, not just good.`
    : `Position ${name} as the category leader in ${city || "the area"}.`;

  // Audience emotional triggers
  const audienceSegments = aud.split(",").map((a: string) => a.trim()).filter(Boolean);
  const emotionalHooks = audienceSegments.map((seg: string) => {
    if (/famil/i.test(seg)) return "belonging, togetherness, making memories";
    if (/student|college|young/i.test(seg)) return "value, social proof, FOMO, convenience";
    if (/professional|business/i.test(seg)) return "efficiency, quality, trust, status";
    if (/foodie|lover/i.test(seg)) return "sensory pleasure, discovery, craft appreciation";
    return "trust, quality, community connection";
  });

  return {
    name, cat, svc, aud, tone, city, state, niche, website, goals,
    brandProfile,
    diffStrategy,
    emotionalHooks: [...new Set(emotionalHooks)],
    competitorList,
    serviceList: svc.split(",").map((s: string) => s.trim()).filter(Boolean),
    strategyKeywords: strategyData?.keywords || strategyData?.top_keywords || [],
    usp: strategyData?.unique_selling_points || strategyData?.differentiators || [],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT PROMPT — deep business analysis + cinematic direction
// ═══════════════════════════════════════════════════════════════════════
function buildAIPrompt(biz: any, loc: any, preset: PipelinePreset, strategyData: any = {}) {
  const dna = analyzeBusinessDNA(biz, loc, strategyData);
  const uniqueSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Pick a random creative angle to force variety
  const angles = [
    "Tell the story through a customer's first visit — their discovery moment",
    "Show the transformation: before they found this business vs. after",
    "Frame it as a love letter from the business to the community",
    "Use a 'day in the life' structure showing peak moments across one day",
    "Start with an unexpected question that challenges assumptions about the industry",
    "Build around a single powerful statistic or customer testimonial moment",
    "Use sensory storytelling — make the viewer feel textures, smells, sounds",
    "Frame the business as the neighborhood's secret weapon",
    "Tell the story backwards — start with the satisfied customer, rewind to show why",
    "Use a comparison structure: 'Some do X. We do Y. Here's the difference.'",
  ];
  const chosenAngle = angles[Math.floor(Math.random() * angles.length)];

  return `You are a senior video creative director. You've been hired to create a ${preset.targetSeconds}-second video for a REAL business. You must LEARN this business first, then create.

═══ GENERATION ID: ${uniqueSeed} — ZERO TEMPLATE POLICY ═══
Do NOT reuse any default video structure. This is a bespoke production.

═══ BUSINESS DNA (study this carefully) ═══
Business: ${dna.name}
Category: ${dna.cat}
Niche: ${dna.niche}
Services: ${dna.svc || "Not specified"}
Target Audience: ${dna.aud || "General"}
Audience Emotional Triggers: ${dna.emotionalHooks.join("; ")}
Brand Tone: ${dna.tone}
Location: ${dna.city}${dna.state ? `, ${dna.state}` : ""} (USE THIS LOCATION ONLY — never reference headquarters or other cities)
Content Goals: ${dna.goals || "brand awareness, customer acquisition"}
Website: ${dna.website || "N/A"}
${dna.strategyKeywords.length ? `Strategy Keywords: ${dna.strategyKeywords.join(", ")}` : ""}
${dna.usp.length ? `Unique Selling Points: ${dna.usp.join("; ")}` : ""}
Competitive Strategy: ${dna.diffStrategy}

═══ CREATIVE DIRECTION ═══
Visual Style: ${dna.brandProfile.visualStyle}
Pacing: ${dna.brandProfile.pacing}
Color Mood: ${dna.brandProfile.colorMood}
Music Vibe: ${dna.brandProfile.musicVibe}

═══ MANDATORY CREATIVE ANGLE ═══
${chosenAngle}
Use this angle as your narrative backbone. Do NOT default to a generic "welcome to our business" structure.

═══ CINEMATIC PROMPTING RULES ═══
For each scene's visual_description, use professional cinematography language:
- Specify camera movement (dolly, steadicam, crane, handheld, locked-off, tracking)
- Specify shot size (ECU, CU, MCU, MS, MWS, WS, EWS)
- Specify lighting style (Rembrandt, butterfly, split, practical, available, golden hour)
- Specify depth of field (shallow/deep) and focus behavior (rack focus, pull focus)

═══ NEGATIVE PROMPTING (what to AVOID) ═══
- NO generic stock footage aesthetic
- NO robotic or unnatural movement
- NO oversaturated "Instagram filter" look
- NO cheesy text animations or star wipes
- NO corporate jargon ("synergy", "leveraging", "solutions")
- NO identical framing in consecutive shots (vary shot sizes!)

═══ EMOTIONAL ARC ═══
Beat 1 (0-${Math.round(preset.targetSeconds * 0.15)}s): INTRIGUE — Hook with curiosity or surprise
Beat 2 (${Math.round(preset.targetSeconds * 0.15)}-${Math.round(preset.targetSeconds * 0.4)}s): DISCOVERY — Reveal what makes this place special
Beat 3 (${Math.round(preset.targetSeconds * 0.4)}-${Math.round(preset.targetSeconds * 0.7)}s): CONNECTION — Show the human element, community, experience
Beat 4 (${Math.round(preset.targetSeconds * 0.7)}-${Math.round(preset.targetSeconds * 0.9)}s): DESIRE — Create wanting, FOMO, aspiration
Beat 5 (${Math.round(preset.targetSeconds * 0.9)}-${preset.targetSeconds}s): ACTION — Clear, compelling CTA

Return JSON:
{
  "title": "creative video title (not generic)",
  "description": "one-line creative concept summary",
  "creative_angle": "which narrative angle you chose and why",
  "voiceover_script": "complete narration, ${preset.targetSeconds >= 60 ? "100-150" : "50-80"} words, written in the brand's voice — NOT a generic announcer tone",
  "scenes": [${Array.from({ length: preset.sceneCount }, (_, i) =>
    `{"scene_number":${i + 1},"duration_seconds":${preset.clipDuration},"visual_description":"DETAILED cinematic prompt: shot size + camera move + lighting + subject + action + environment + mood","text_overlay":"2-5 word overlay","camera_direction":"specific camera direction","voiceover_line":"narration for this beat","shotType":"food|people|environment","emotional_beat":"what the viewer should FEEL","negative_prompt":"what to AVOID in this shot"}`
  ).join(",")}],
  "scene_captions": ["line1","line2",...],
  "caption": "platform-optimized social caption",
  "hashtags": ["relevant","specific","tags"],
  "target_platform": "instagram",
  "cta": "specific action tied to the business",
  "visual_style_notes": "overall look/feel summary",
  "color_palette": "3-4 specific colors that match the brand"
}

Generate exactly ${preset.sceneCount} scenes of ${preset.clipDuration}s each. EVERY scene must have a unique shot size and camera movement — no two consecutive scenes should look the same.`;
}

// ═══════════════════════════════════════════════════════════════════════
// AI PROMPT FIXER — self-correction loop for quality enforcement
// ═══════════════════════════════════════════════════════════════════════
const MAX_SELF_CORRECT_ATTEMPTS = 3;

interface PromptFixerIssue {
  type: "short_duration" | "missing_scenes" | "duplicate_scenes" | "missing_voiceover" | "missing_visuals" | "wrong_location" | "generic_script" | "bad_format" | "missing_storyboard" | "outdated_info";
  severity: "critical" | "warning";
  detail: string;
  fix: string;
}

function diagnoseScript(script: any, preset: PipelinePreset, biz: any, loc: any): PromptFixerIssue[] {
  const issues: PromptFixerIssue[] = [];
  const scenes = script?.scenes || [];
  const bizCity = loc?.city || "";
  const bizState = loc?.state || "";
  const bizName = biz?.business_name || "";

  // 1. Duration check — scenes must add up to minimum
  const totalDuration = scenes.reduce((sum: number, s: any) => sum + (s.duration_seconds || preset.clipDuration), 0);
  if (totalDuration < preset.targetSeconds) {
    issues.push({ type: "short_duration", severity: "critical", detail: `Total duration ${totalDuration}s < required ${preset.targetSeconds}s (${scenes.length} scenes)`, fix: `Add more scenes. Need ${Math.ceil((preset.targetSeconds - totalDuration) / preset.clipDuration)} more scenes of ${preset.clipDuration}s each.` });
  }

  // 2. Scene count check
  if (scenes.length < preset.sceneCount) {
    issues.push({ type: "missing_scenes", severity: "critical", detail: `Only ${scenes.length} scenes, need ${preset.sceneCount}`, fix: `Generate ${preset.sceneCount - scenes.length} additional scenes with unique visuals and voiceover lines.` });
  }

  // 3. Duplicate scene detection
  const voiceLines = scenes.map((s: any) => (s.voiceover_line || "").toLowerCase().trim()).filter(Boolean);
  const uniqueVoice = new Set(voiceLines);
  if (voiceLines.length > 0 && uniqueVoice.size < voiceLines.length * 0.7) {
    issues.push({ type: "duplicate_scenes", severity: "critical", detail: `${voiceLines.length - uniqueVoice.size} duplicate voiceover lines detected`, fix: "Rewrite duplicate scenes with completely new content. Each scene must have unique dialogue and visual direction." });
  }

  const visuals = scenes.map((s: any) => (s.visual_description || "").toLowerCase().trim()).filter(Boolean);
  const uniqueVisuals = new Set(visuals);
  if (visuals.length > 0 && uniqueVisuals.size < visuals.length * 0.7) {
    issues.push({ type: "duplicate_scenes", severity: "warning", detail: `${visuals.length - uniqueVisuals.size} similar visual descriptions`, fix: "Vary shot types, camera movements, and subjects across scenes." });
  }

  // 4. Missing voiceover
  const emptyVO = scenes.filter((s: any) => !s.voiceover_line?.trim()).length;
  if (emptyVO > 0) {
    issues.push({ type: "missing_voiceover", severity: "warning", detail: `${emptyVO} scenes missing voiceover lines`, fix: "Add narration for every scene tied to the business story." });
  }

  // 5. Missing visual descriptions
  const emptyVisual = scenes.filter((s: any) => !s.visual_description?.trim() && !s.visual?.trim()).length;
  if (emptyVisual > 0) {
    issues.push({ type: "missing_visuals", severity: "warning", detail: `${emptyVisual} scenes missing visual descriptions`, fix: "Add detailed cinematic visual prompts for each scene." });
  }

  // 6. Wrong location / generic defaults
  const voText = (script.voiceover_script || "").toLowerCase();
  const wrongLocations = ["ohio", "columbus", "new york", "los angeles", "san francisco", "chicago"].filter(
    loc => voText.includes(loc) && bizCity.toLowerCase() !== loc && bizState.toLowerCase() !== loc
  );
  if (wrongLocations.length > 0) {
    issues.push({ type: "wrong_location", severity: "critical", detail: `Script references wrong location(s): ${wrongLocations.join(", ")}. Business is in ${bizCity}, ${bizState}`, fix: `Replace ALL location references with ${bizCity}${bizState ? `, ${bizState}` : ""}. Never reference headquarters or other cities.` });
  }

  // 7. Generic script detection
  const genericPhrases = ["welcome to our business", "we are proud to", "our team is dedicated", "we strive to provide", "contact us today for more information"];
  const foundGeneric = genericPhrases.filter(p => voText.includes(p));
  if (foundGeneric.length >= 2) {
    issues.push({ type: "generic_script", severity: "warning", detail: `Script uses ${foundGeneric.length} generic phrases: "${foundGeneric.join('", "')}"`, fix: "Rewrite using the brand's actual voice and specific details about their services, not corporate clichés." });
  }

  // 8. Business name check — make sure it's referenced
  if (bizName && !voText.includes(bizName.toLowerCase())) {
    issues.push({ type: "outdated_info", severity: "warning", detail: `Business name "${bizName}" not mentioned in script`, fix: `Include the business name "${bizName}" naturally in the voiceover.` });
  }

  // 9. Missing storyboard elements
  const missingCamera = scenes.filter((s: any) => !s.camera_direction?.trim()).length;
  const missingOverlay = scenes.filter((s: any) => !s.text_overlay?.trim()).length;
  if (missingCamera > scenes.length * 0.5) {
    issues.push({ type: "missing_storyboard", severity: "warning", detail: `${missingCamera}/${scenes.length} scenes missing camera direction`, fix: "Add specific camera movements (dolly, steadicam, crane, etc.) for each scene." });
  }
  if (missingOverlay > scenes.length * 0.5) {
    issues.push({ type: "missing_storyboard", severity: "warning", detail: `${missingOverlay}/${scenes.length} scenes missing text overlays`, fix: "Add 2-5 word text overlays for each scene." });
  }

  return issues;
}

function applyScriptFixes(script: any, issues: PromptFixerIssue[], preset: PipelinePreset, biz: any, loc: any, strategyData: any): any {
  const fixed = JSON.parse(JSON.stringify(script)); // deep clone
  const city = loc?.city || "your area";
  const state = loc?.state || "";
  const name = biz?.business_name || "Our Business";

  for (const issue of issues) {
    switch (issue.type) {
      case "short_duration":
      case "missing_scenes": {
        // Pad with new unique scenes from buildScriptFromProfile
        while ((fixed.scenes?.length || 0) < preset.sceneCount) {
          const extra = buildScriptFromProfile(biz, loc, strategyData, preset.sceneCount, preset.clipDuration);
          const needed = preset.sceneCount - (fixed.scenes?.length || 0);
          // Only add scenes that aren't duplicates
          for (const newScene of extra.scenes) {
            if ((fixed.scenes?.length || 0) >= preset.sceneCount) break;
            const isDupe = fixed.scenes?.some((s: any) => s.voiceover_line === newScene.voiceover_line);
            if (!isDupe) {
              newScene.scene_number = (fixed.scenes?.length || 0) + 1;
              fixed.scenes = [...(fixed.scenes || []), newScene];
            }
          }
          if ((fixed.scenes?.length || 0) < preset.sceneCount) {
            // Force-add remaining
            const remaining = preset.sceneCount - (fixed.scenes?.length || 0);
            const filler = buildScriptFromProfile(biz, loc, strategyData, remaining + 2, preset.clipDuration);
            fixed.scenes = [...(fixed.scenes || []), ...filler.scenes.slice(0, remaining)];
          }
        }
        break;
      }
      case "duplicate_scenes": {
        // Replace duplicates with fresh scenes
        const seen = new Set<string>();
        const freshPool = buildScriptFromProfile(biz, loc, strategyData, preset.sceneCount * 2, preset.clipDuration);
        let freshIdx = 0;
        fixed.scenes = fixed.scenes.map((s: any) => {
          const key = (s.voiceover_line || "").toLowerCase().trim();
          if (seen.has(key) && freshIdx < freshPool.scenes.length) {
            const replacement = freshPool.scenes[freshIdx++];
            replacement.scene_number = s.scene_number;
            return replacement;
          }
          seen.add(key);
          return s;
        });
        break;
      }
      case "wrong_location": {
        // Fix all location references
        const wrongLocs = ["ohio", "columbus", "new york", "los angeles", "san francisco", "chicago"];
        const correctLoc = `${city}${state ? `, ${state}` : ""}`;
        fixed.scenes = fixed.scenes.map((s: any) => {
          let vo = s.voiceover_line || "";
          let vis = s.visual_description || "";
          for (const wrong of wrongLocs) {
            const regex = new RegExp(wrong, "gi");
            vo = vo.replace(regex, city);
            vis = vis.replace(regex, city);
          }
          return { ...s, voiceover_line: vo, visual_description: vis };
        });
        if (fixed.voiceover_script) {
          for (const wrong of wrongLocs) {
            fixed.voiceover_script = fixed.voiceover_script.replace(new RegExp(wrong, "gi"), city);
          }
        }
        break;
      }
      case "missing_voiceover": {
        fixed.scenes = fixed.scenes.map((s: any, i: number) => {
          if (!s.voiceover_line?.trim()) {
            const fallbacks = [
              `Discover what makes ${name} special.`,
              `Quality you can see and taste at ${name}.`,
              `${name} — ${city}'s favorite.`,
              `Experience the difference at ${name}.`,
              `Come see for yourself at ${name}.`,
            ];
            return { ...s, voiceover_line: fallbacks[i % fallbacks.length] };
          }
          return s;
        });
        break;
      }
      case "missing_visuals": {
        const shotTypes = ["environment", "food", "people"];
        fixed.scenes = fixed.scenes.map((s: any, i: number) => {
          if (!s.visual_description?.trim() && !s.visual?.trim()) {
            const type = s.shotType || shotTypes[i % shotTypes.length];
            const visuals: Record<string, string> = {
              environment: `Wide cinematic shot of ${name} storefront in ${city}. Golden hour lighting, warm glow.`,
              food: `Close-up of ${name}'s signature offering. Dramatic rim lighting, vibrant colors, steam rising.`,
              people: `Happy customers at ${name}. Candid smiles, warm atmosphere, natural light.`,
            };
            return { ...s, visual_description: visuals[type] || visuals.environment };
          }
          return s;
        });
        break;
      }
      case "missing_storyboard": {
        const camMoves = ["slow push-in", "lateral tracking", "steadicam follow", "overhead orbit", "pull-back reveal", "gentle pan"];
        fixed.scenes = fixed.scenes.map((s: any, i: number) => {
          if (!s.camera_direction?.trim()) s.camera_direction = camMoves[i % camMoves.length];
          if (!s.text_overlay?.trim()) s.text_overlay = (s.voiceover_line || "").split(" ").slice(0, 3).join(" ") || `Scene ${i + 1}`;
          return s;
        });
        break;
      }
    }
  }

  // Renumber scenes and rebuild derived fields
  fixed.scenes = (fixed.scenes || []).slice(0, preset.sceneCount).map((s: any, i: number) => ({
    ...s,
    scene_number: i + 1,
    duration_seconds: s.duration_seconds || preset.clipDuration,
  }));
  fixed.voiceover_script = fixed.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
  fixed.scene_captions = fixed.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");

  return fixed;
}

function logPromptFixer(attempt: number, issues: PromptFixerIssue[], action: string) {
  const critical = issues.filter(i => i.severity === "critical").length;
  const warnings = issues.filter(i => i.severity === "warning").length;
  console.log(`[PromptFixer] Attempt ${attempt}: ${critical} critical, ${warnings} warnings — ${action}`);
  for (const i of issues) {
    console.log(`[PromptFixer]   [${i.severity}] ${i.type}: ${i.detail}`);
  }
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

async function findAllExistingImages(supabase: any, userId: string, jobId: string): Promise<string[]> {
  // ONLY look in the CURRENT job's folder — never reuse images from other businesses/jobs
  const urls: string[] = [];
  const { data: images } = await supabase.storage.from("media").list(`scenes/${userId}/${jobId}`, { limit: 20 });
  if (!images?.length) return urls;
  for (const img of images) {
    if (img.name?.includes("placeholder")) continue;
    if (/\.(png|jpg|jpeg)$/i.test(img.name || "")) {
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(`scenes/${userId}/${jobId}/${img.name}`);
      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    }
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
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── BYOLLM enforcement: platform keys are admin-only ──
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: userKeys } = await supabase
    .from("user_api_keys")
    .select("provider, api_key_encrypted")
    .eq("user_id", userId)
    .eq("is_valid", true);
  const keyMap: Record<string, string> = {};
  userKeys?.forEach(k => { keyMap[k.provider] = k.api_key_encrypted; });

  // Resolve AI key (for script generation + image generation)
  let lovableKey = "";
  if (keyMap["openai"]) {
    // User has OpenAI key — for image gen we still need platform key or skip
    lovableKey = isAdmin ? (Deno.env.get("LOVABLE_API_KEY") || "") : "";
  } else if (isAdmin) {
    lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  }
  // If no lovableKey and not admin, script/image gen will use fallback templates

  // Runway removed — Manus AI is the video generator via Make.com
  // Resolve ElevenLabs key — user's own key or admin-only platform key
  // Resolve ElevenLabs key — user's own key or admin-only platform key
  const elevenlabsKey = keyMap["elevenlabs"] || (isAdmin ? (Deno.env.get("ELEVENLABS_API_KEY") || "") : "");

  const updateJob = (fields: Record<string, any>) =>
    supabase.from("video_generation_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    // ── Load business + location ──
    const { data: business } = await supabase.from("businesses").select("*").eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");
    const { data: locations } = await supabase.from("locations").select("*").eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];
    const businessContext = { ...business, locations: location ? [location] : [] };

    // ── Load saved strategy data (for script enrichment) ──
    const { data: strategyRows } = await supabase.from("strategy_outputs").select("output_data").eq("business_id", businessId).eq("user_id", userId).order("step_number", { ascending: true }).limit(10);
    const strategyData = strategyRows?.reduce((acc: any, row: any) => ({ ...acc, ...(row.output_data || {}) }), {}) || {};

    const preset = buildPreset(lengthMode, orientation);
    console.log(`[pipeline] ═══ Starting job ${jobId} ═══`);
    console.log(`[pipeline] Preset: ${preset.label}, orientation=${preset.orientation}, ratio=${preset.ratio}, scenes=${preset.sceneCount}, clipDur=${preset.clipDuration}s`);
    console.log(`[pipeline] ElevenLabs: ${elevenlabsKey ? "YES" : "NO"}, Admin: ${isAdmin ? "YES" : "NO"}`);

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
        const prompt = buildAIPrompt(business, location, preset, strategyData);
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

    // ═══ AI PROMPT FIXER — SELF-CORRECTION LOOP ═══
    for (let fixAttempt = 1; fixAttempt <= MAX_SELF_CORRECT_ATTEMPTS; fixAttempt++) {
      const issues = diagnoseScript(script, preset, business, location);
      const criticalIssues = issues.filter(i => i.severity === "critical");

      if (issues.length === 0) {
        console.log(`[PromptFixer] ✅ Script passed all quality checks (attempt ${fixAttempt})`);
        break;
      }

      logPromptFixer(fixAttempt, issues, criticalIssues.length > 0 ? "APPLYING FIXES" : "APPLYING POLISH");

      await updateJob({
        result_payload: {
          ...script, pipeline_step: "prompt_fixer",
          message: `🔧 AI Prompt Fixer: correcting ${issues.length} issue(s) (attempt ${fixAttempt}/${MAX_SELF_CORRECT_ATTEMPTS})...`,
        },
      });

      script = applyScriptFixes(script, issues, preset, business, location, strategyData);

      // Re-diagnose after fix
      const remaining = diagnoseScript(script, preset, business, location);
      const remainingCritical = remaining.filter(i => i.severity === "critical");
      if (remainingCritical.length === 0) {
        console.log(`[PromptFixer] ✅ All critical issues resolved after attempt ${fixAttempt}. ${remaining.length} minor warnings remain.`);
        break;
      }

      if (fixAttempt === MAX_SELF_CORRECT_ATTEMPTS && remainingCritical.length > 0) {
        console.warn(`[PromptFixer] ⚠️ ${remainingCritical.length} critical issues remain after ${MAX_SELF_CORRECT_ATTEMPTS} attempts. Proceeding with best-effort script.`);
        // Final forced fix — ensure minimum scene count by brute force
        while ((script.scenes?.length || 0) < preset.sceneCount) {
          const emergency = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
          script.scenes = [...(script.scenes || []), ...emergency.scenes.slice(0, preset.sceneCount - (script.scenes?.length || 0))];
        }
        script.scenes = script.scenes.slice(0, preset.sceneCount);
        script.voiceover_script = script.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
        script.scene_captions = script.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");
      }
    }

    // ═══ BUILD MANUS VISUAL SCRIPT (cinematic shot list) ═══
    const manusVisualScript = buildManusVisualScript(script, businessContext, preset, jobId);
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

    const existingRealImages = await findAllExistingImages(supabase, userId, jobId);
    console.log(`[pipeline] Found ${existingRealImages.length} existing real photos for this job`);

    const sceneImageUrls: string[] = [];
    const sceneImageInputs: (string | null)[] = [];
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
        sceneImageInputs.push(null);
        sceneImageIsReal.push(false);
        sceneMotionPrompts.push("");
        console.log(`[pipeline] Scene ${i + 1}: using uploaded video clip (${videoMatch.file_name})`);
      } else {
        try {
          const result = await getSceneImage(supabase, userId, jobId, i, scene, business, lovableKey, imageCreditsExhausted, existingRealImages, businessImages, usedMediaIds);
          sceneImageUrls.push(result.url);
          sceneImageInputs.push(result.url);
          sceneImageIsReal.push(result.isReal);
          sceneMotionPrompts.push(result.motionPrompt);
        } catch (e: any) {
          if (e.message === "CREDITS_EXHAUSTED") imageCreditsExhausted = true;
          const motionPrompt = getMotionPrompt(shotType, i);
          if (existingRealImages.length > 0) {
            const fallbackUrl = existingRealImages[i % existingRealImages.length];
            sceneImageUrls.push(fallbackUrl);
            sceneImageInputs.push(fallbackUrl);
            sceneImageIsReal.push(true);
            sceneMotionPrompts.push(motionPrompt);
          } else {
            const png = create128Png(i);
            const fn = `scenes/${userId}/${jobId}/scene-${i + 1}-placeholder.png`;
            await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
            const { data: u } = supabase.storage.from("media").getPublicUrl(fn);
            sceneImageUrls.push(u.publicUrl);
            sceneImageInputs.push(u.publicUrl);
            sceneImageIsReal.push(false);
            sceneMotionPrompts.push(motionPrompt);
          }
        }
      }

      await updateJob({
        result_payload: { ...script, scene_images: sceneImageUrls, video_clips: sceneVideoClipUrls, pipeline_step: "images", message: `🎨 Assets prepared: ${i + 1}/${script.scenes.length}` },
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
    // CHECK USER'S PREFERRED VIDEO GENERATOR
    // ════════════════════════════════════════════════════════════════════
    const { data: videoGenDefault } = await supabase
      .from("user_tool_defaults")
      .select("default_provider")
      .eq("user_id", userId)
      .eq("tool_type", "video_generator")
      .maybeSingle();
    const preferredVideoGen = videoGenDefault?.default_provider || "manus";
    console.log(`[pipeline] Preferred video generator: ${preferredVideoGen}`);

    // ════════════════════════════════════════════════════════════════════
    // STEP 4a: MANUS AI SHIM (if user chose Manus)
    // ════════════════════════════════════════════════════════════════════
    let manusPromptPreview: string | null = null;
    if (preferredVideoGen === "manus") {
      // Extract Manus model/tier from job request payload
      const reqPayload = (jobRow?.request_payload as any) || {};
      const selectedManusModel = reqPayload.manusModel || "default";
      const selectedManusTier = reqPayload.manusTier || "free";

      console.log(`[pipeline] 🤖 Manus AI selected — model=${selectedManusModel}, tier=${selectedManusTier}`);
      await updateJob({
        status: "rendering_video",
        result_payload: {
          ...script,
          scene_images: sceneImageUrls,
          voiceover_url: voiceoverUrl,
          video_clips: sceneVideoClipUrls,
          pipeline_step: "manus",
          message: `🤖 Preparing Manus AI video prompt (${selectedManusModel === "veo3" ? "Veo 3 Cinematic" : "Standard"})...`,
        },
      });

      // Build tier-gated Manus prompt
      const basePrompt = manusVisualScript.manus_prompt;

      if (selectedManusTier === "free") {
        // Free: default model, 16:9 or 9:16 only, ≤15s
        manusPromptPreview = `${basePrompt}\n\nGenerate this video using the standard default video model. Format: ${preset.orientation === "vertical" ? "9:16" : "16:9"}. Keep total video length under 15 seconds to stay within credit limits.`;
      } else if (selectedManusTier === "agency" && selectedManusModel === "veo3") {
        // Agency + Veo 3: cinematic quality, 16:9 only, full duration
        manusPromptPreview = `${basePrompt}\n\nGenerate this video using the Veo 3 model for maximum cinematic quality. Format: 16:9 only. Video length: ${preset.targetSeconds} seconds.`;
      } else {
        // Pro / Business: default model, user-selected format, full duration
        manusPromptPreview = `${basePrompt}\n\nGenerate this video using the standard default video model. Format: ${preset.orientation === "vertical" ? "9:16" : "16:9"}. Video length: ${preset.targetSeconds} seconds.`;
      }

      console.log(`[pipeline] Manus prompt preview (${manusPromptPreview.length} chars, tier=${selectedManusTier}, model=${selectedManusModel}):`);
      console.log(manusPromptPreview.substring(0, 500) + "...");

      // ── DISPATCH TO MAKE.COM WEBHOOK ──
      const { data: webhookRow } = await supabase
        .from("webhook_config")
        .select("webhook_url")
        .eq("scenario_type", "manus_production")
        .eq("is_active", true)
        .maybeSingle();

      if (webhookRow?.webhook_url) {
        console.log(`[pipeline] 🚀 Dispatching to Make.com webhook: ${webhookRow.webhook_url.substring(0, 60)}...`);
        const perScenePrompts = buildPerScenePrompts(script, businessContext, manusVisualScript.shots, preset.ratio);

        const webhookPayload = {
          job_id: jobId,
          user_id: userId,
          business_id: businessId,
          business_name: business.business_name,
          manus_prompt: manusPromptPreview,
          scene_prompts: perScenePrompts.map((prompt, i) => ({
            scene_index: i + 1,
            prompt,
            duration_seconds: script.scenes[i]?.duration_seconds || preset.clipDuration,
            image_url: sceneImageInputs[i] || null,
            voiceover_line: script.scenes[i]?.voiceover_line || "",
          })),
          total_scenes: perScenePrompts.length,
          manus_visual_script: manusVisualScript,
          scene_images: sceneImageUrls,
          voiceover_url: voiceoverUrl,
          tier: selectedManusTier,
          model: selectedManusModel,
          aspect_ratio: preset.ratio,
          target_duration_seconds: preset.targetSeconds,
          use_subtasks: true,
          callback_url: `${supabaseUrl}/functions/v1/video-callback`,
        };
        try {
          const webhookRes = await fetch(webhookRow.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          });
          if (webhookRes.ok) {
            console.log(`[pipeline] ✅ Make.com webhook accepted (${webhookRes.status})`);
          } else {
            const errText = await webhookRes.text();
            console.error(`[pipeline] ⚠️ Make.com webhook returned ${webhookRes.status}: ${errText}`);
          }
        } catch (webhookErr: any) {
          console.error(`[pipeline] ⚠️ Make.com webhook dispatch failed:`, webhookErr.message);
        }
      } else {
        console.log(`[pipeline] ⚠️ No active manus_production webhook configured — prompt stored but not dispatched`);
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // STEP 4b: SLIDESHOW FALLBACK (if Manus not selected or no webhook)
    // ════════════════════════════════════════════════════════════════════
    const videoClips: string[] = [...sceneVideoClipUrls]; // start with pre-existing library clips

    if (preferredVideoGen === "manus") {
      console.log("[pipeline] Manus AI selected — video will be delivered via Make.com webhook callback");
    } else {
      console.log("[pipeline] Slideshow mode — no external video generator");
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

    if (preferredVideoGen === "manus" && manusPromptPreview) {
      statusMessage = `🤖 Manus AI prompt ready! Your video will be delivered via Make.com when processing completes.`;
      finalStatus = "processing";
    } else if (hasClips) {
      statusMessage = `🎬 ${videoClips.length} video clips ready (${totalDuration}s)!`;
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

    const finalReadyVideoUrl = finalStatus === "processing" ? null : (videoClips[0] || null);
    const postMediaUrl = finalStatus === "processing"
      ? (sceneImageUrls[0] || null)
      : (finalReadyVideoUrl || sceneImageUrls[0] || null);
    const postMediaType = finalStatus === "processing"
      ? (sceneImageUrls.length > 0 ? "image" : null)
      : (finalReadyVideoUrl || hasClips ? "video" : "image");

    const resultPayload = {
      ...script,
      scene_images: sceneImageUrls,
      voiceover_url: voiceoverUrl,
      video_clips: videoClips,
      video_url: finalReadyVideoUrl,
      total_duration_seconds: totalDuration,
      is_fallback: isFallback,
      usedFallbackScript,
      used_ai_script: !usedFallbackScript,
      real_image_count: realImageCount,
      length_mode: lengthMode,
      orientation,
      preferred_video_generator: preferredVideoGen,
      manus_prompt_preview: manusPromptPreview,
      manus_config: {
        ratio: preset.ratio,
        clipDuration: preset.clipDuration,
        orientation: preset.orientation,
      },
      pipeline_steps: {
        script: "completed",
        images: hasClips || realImageCount > 0 ? "completed" : hasImages ? "placeholders_only" : "failed",
        voiceover: voiceoverUrl ? "completed" : useElevenLabs ? "elevenlabs_failed" : "captions_only",
        manus: preferredVideoGen === "manus" ? (finalStatus === "processing" ? "processing" : manusPromptPreview ? "completed" : "not_configured") : "not_selected",
      },
      message: statusMessage,
    };

    await updateJob({
      status: finalStatus,
      result_payload: resultPayload,
      video_url: finalReadyVideoUrl,
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
        media_url: postMediaUrl,
        media_type: postMediaType,
        platform: script.target_platform || "instagram",
        video_script: script.voiceover_script,
        voiceover_script: script.voiceover_script,
        shot_list: script.scenes,
        cta: script.cta,
        status: finalStatus === "processing" ? "processing" : "media_ready",
        production_tool: preferredVideoGen === "manus" ? "manus_ai" : "rickyai_slideshow",
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

    const { businessId, videoType, lengthMode, orientation, mode, approvedScript, manusModel, manusTier } = await req.json();

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
        // Always use randomized buildScriptFromProfile for fresh scripts each time
        script = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
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

      // ═══ AI PROMPT FIXER — script_only mode ═══
      for (let fixAttempt = 1; fixAttempt <= MAX_SELF_CORRECT_ATTEMPTS; fixAttempt++) {
        const issues = diagnoseScript(script, preset, business, location);
        if (issues.length === 0 || issues.filter(i => i.severity === "critical").length === 0) {
          if (issues.length > 0) console.log(`[PromptFixer:script_only] ${issues.length} minor warnings, proceeding`);
          break;
        }
        logPromptFixer(fixAttempt, issues, "FIXING (script_only)");
        script = applyScriptFixes(script, issues, preset, business, location, strategyData);
        script.voiceover_script = script.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
        script.scene_captions = script.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");
      }

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
        provider: "manus_ai",
        status: "queued",
        request_payload: { businessId, videoType, lengthMode, orientation: orientation || "landscape", approvedScript: approvedScript || null, manusModel: manusModel || "default", manusTier: manusTier || "free" },
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
