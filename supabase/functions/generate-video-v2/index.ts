import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";
// ═══════════════════════════════════════════════════════════════════════
// VIDEO CONFIG — Creatomate is the video renderer
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

  // ── INDUSTRY DETECTION — drives language choices ──
  const catLower = cat.toLowerCase();
  const isFood = /restaurant|food|pizza|cafe|bakery|bar|grill|diner|catering|bistro|taco|sushi|bbq|coffee/i.test(catLower);
  const isBeauty = /salon|spa|beauty|hair|nail|barber|skincare|wellness|massage/i.test(catLower);
  const isPhoto = /photo|video|film|media|production|creative|studio/i.test(catLower);
  const isFitness = /gym|fitness|yoga|personal train|crossfit|martial|sport|athletic/i.test(catLower);
  const isRetail = /retail|shop|store|boutique|clothing|fashion|jewelry/i.test(catLower);
  const isHealth = /doctor|dentist|clinic|medical|health|chiropractic|therapy|veterinar|optom/i.test(catLower);
  const isHome = /construction|plumb|electric|hvac|roofing|landscap|clean|moving|handyman|remodel|contractor/i.test(catLower);
  const isAuto = /auto|car|mechanic|detailing|body shop|tire|dealer/i.test(catLower);
  const isTech = /tech|software|it |web |app |digital|saas|consult/i.test(catLower);
  const isLegal = /law|legal|attorney|accountant|financial|insurance|tax/i.test(catLower);
  const isEdu = /school|tutor|education|training|academy|music lesson|dance/i.test(catLower);
  const isEvent = /event|wedding|catering|party|dj|entertain|plan/i.test(catLower);
  const isPet = /pet|dog|grooming|kennel|animal|vet/i.test(catLower);
  const isReal = /real estate|property|mortgage|realtor|broker/i.test(catLower);

  // ── INDUSTRY-ADAPTIVE LANGUAGE ──
  const productWord = isFood ? "dish" : isBeauty ? "treatment" : isPhoto ? "session" : isFitness ? "workout" : isRetail ? "product" : isHealth ? "care" : isHome ? "project" : isAuto ? "service" : isTech ? "solution" : isLegal ? "consultation" : isEdu ? "program" : isEvent ? "experience" : isPet ? "service" : isReal ? "listing" : "offering";
  const enjoyVerb = isFood ? "taste" : isBeauty ? "experience" : isPhoto ? "capture" : isFitness ? "feel" : isRetail ? "find" : isHealth ? "trust" : isHome ? "see" : "experience";
  const resultNoun = isFood ? "flavor" : isBeauty ? "transformation" : isPhoto ? "memories" : isFitness ? "results" : isRetail ? "style" : isHealth ? "wellness" : isHome ? "quality" : isAuto ? "performance" : isTech ? "growth" : "excellence";

  // ── LARGE HOOK POOL (industry-adaptive) ──
  const hooks = [
    { voiceLine: `Looking for the best ${cat} in ${city}? You just found it.`, textOverlay: name },
    { voiceLine: `${city}, meet your new favorite ${cat} — ${name}.`, textOverlay: `Discover ${name}` },
    { voiceLine: `Want something amazing? ${name} in ${city}${state ? `, ${state}` : ""} has you covered.`, textOverlay: `${name} — ${city}` },
    { voiceLine: `What makes ${name} the talk of ${city}? Let us show you.`, textOverlay: `Why ${name}?` },
    { voiceLine: `Stop scrolling. ${name} is about to change your ${cat} game.`, textOverlay: name },
    { voiceLine: `${city}'s best-kept secret? It's called ${name}.`, textOverlay: `Secret's Out` },
    { voiceLine: `Three words: ${name}, ${city}. Need we say more?`, textOverlay: `${name} ✦ ${city}` },
    { voiceLine: `Picture this: the perfect ${cat} experience. That's ${name}.`, textOverlay: `Picture This` },
    { voiceLine: `Forget everything you thought you knew about ${cat}. ${name} rewrites the rules.`, textOverlay: `New Standard` },
    { voiceLine: `One visit. That's all it takes to fall in love with ${name}.`, textOverlay: `Fall in Love` },
    { voiceLine: `${name} didn't come to play — we came to set the standard in ${city}.`, textOverlay: `The Standard` },
    { voiceLine: `There's ${cat}… and then there's ${name}. The difference is everything.`, textOverlay: `The Difference` },
    { voiceLine: `Ask anyone in ${city} where to go for ${cat}. They'll say ${name}.`, textOverlay: `Ask Around` },
    { voiceLine: `Welcome to the place ${city} can't stop talking about.`, textOverlay: `Welcome` },
    { voiceLine: `If you haven't tried ${name} yet, this is your sign.`, textOverlay: `Your Sign` },
    { voiceLine: `Let's take you inside ${city}'s most talked-about ${cat}.`, textOverlay: `Step Inside` },
    { voiceLine: `Every great neighborhood deserves a great ${cat}. ${city} has ${name}.`, textOverlay: `Neighborhood Gem` },
    { voiceLine: `What happens when passion meets ${cat}? You get ${name}.`, textOverlay: `Passion Meets ${cat}` },
  ];

  // ── LARGE CLOSING POOL ──
  const closings = [
    { voiceLine: `${name} — your go-to ${cat} in ${city}${state ? `, ${state}` : ""}. See you soon!`, textOverlay: `${name} — ${city}` },
    { voiceLine: `Come visit ${name} today. We can't wait to work with you!`, textOverlay: `Visit Us Today!` },
    { voiceLine: `Follow ${name} for more. Link in bio!`, textOverlay: `Follow ${name}` },
    { voiceLine: `Ready for the ${name} experience? Reach out today.`, textOverlay: `Get Started` },
    { voiceLine: `${name} — where every visit feels right. See you there!`, textOverlay: `Welcome` },
    { voiceLine: `Don't just take our word for it — come see for yourself. ${name}, ${city}.`, textOverlay: `See for Yourself` },
    { voiceLine: `Your next great ${cat} experience starts at ${name}. Let's go!`, textOverlay: `Let's Go!` },
    { voiceLine: `Tag someone who needs to know about ${name}!`, textOverlay: `Tag a Friend` },
    { voiceLine: `${name}. ${city}. Every single time.`, textOverlay: `Every Time` },
    { voiceLine: `Life's too short for average ${cat}. Choose ${name}.`, textOverlay: `Choose ${name}` },
    { voiceLine: `Save this. Share this. Visit ${name}.`, textOverlay: `Save & Share` },
    { voiceLine: `The doors are open. The team is ready. ${name} is waiting for you.`, textOverlay: `We're Waiting` },
  ];

  // ── INDUSTRY-ADAPTIVE MIDDLE SCENES ──
  const middleScenes = [
    // Universal scenes (work for any business)
    { shotType: "people", visual: `Owner or team at ${name} smiling warmly, greeting ${aud}. ${tone} atmosphere.`, camera: "steadicam walk-through", voiceLine: `Welcome to ${name}${city ? ` in ${city}${state ? `, ${state}` : ""}` : ""}. Serving our community with pride.`, textOverlay: `Welcome to ${name}` },
    { shotType: "product", visual: `Hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, vibrant colors, professional presentation.`, camera: "slow pan across subject", voiceLine: `From ${primarySvc} to ${secondarySvc} — every detail crafted with care.${uniqueSelling ? ` ${uniqueSelling}` : ""}`, textOverlay: primarySvc },
    { shotType: "product", visual: `Close-up showcase of ${name}'s ${productWord}s. Dynamic composition, vibrant colors, attention to detail.`, camera: "rack focus transitions", voiceLine: `Only the best — ${resultNoun} you can ${enjoyVerb} immediately.`, textOverlay: "Something for Everyone" },
    { shotType: "people", visual: `Happy ${aud} enjoying their experience at ${name}. Genuine reactions, natural interaction.`, camera: "lateral tracking dolly", voiceLine: `Our ${aud} keep coming back.${strategyInsights ? ` Known for ${strategyInsights}.` : ""}`, textOverlay: "Loved by Locals" },
    { shotType: "people", visual: `Behind-the-scenes at ${name}. Skilled professionals at work, attention to detail and craft.`, camera: "dolly-in extreme close-up", voiceLine: `Behind every great experience is a team that truly cares.`, textOverlay: "Crafted with Care" },
    { shotType: "environment", visual: `Inviting wide shot of ${name}'s space. ${tone} atmosphere, warm lighting, professional setup.`, camera: "overhead crane shot", voiceLine: `Come see the difference for yourself.`, textOverlay: "Step Inside" },
    { shotType: "product", visual: `Detailed view of ${name}'s ${primarySvc} being prepared or delivered. Professional quality, meticulous attention.`, camera: "slow overhead reveal", voiceLine: `Quality and precision in everything we do.`, textOverlay: "Always Quality" },
    { shotType: "people", visual: `A group enjoying their time at ${name}. Warm smiles, golden light, genuine connection.`, camera: "medium shot, gentle push-in", voiceLine: `${name} isn't just ${cat} — it's where great experiences happen.`, textOverlay: "Great Moments" },
    { shotType: "environment", visual: `${name} team preparing for the day. Organized, energetic, morning light.`, camera: "tracking shot through space", voiceLine: `Every day starts with one goal: make your experience unforgettable.`, textOverlay: "Ready for You" },
    { shotType: "product", visual: `Action shot of ${primarySvc} in progress. Hands in motion, energy and precision, professional execution.`, camera: "dynamic handheld close-up", voiceLine: `Real craft, real passion, real ${resultNoun}.`, textOverlay: "Made with Passion" },
    { shotType: "people", visual: `Satisfied ${aud} sharing positive reactions, natural testimonial moment.`, camera: "medium close-up, natural light", voiceLine: `Our ${aud} speak for themselves.`, textOverlay: "★★★★★" },
    { shotType: "environment", visual: `${name} exterior with warm glow, inviting entrance, professional signage.`, camera: "slow dolly approaching entrance", voiceLine: `Whenever you need ${cat} — ${name} is here.`, textOverlay: "Open for You" },
    { shotType: "product", visual: `Extreme close-up of details — textures, materials, precision work in ${name}'s ${primarySvc}.`, camera: "macro lens slow pull-out", voiceLine: `The details tell the story. Every element — intentional.`, textOverlay: "Every Detail" },
    { shotType: "people", visual: `Team member going the extra mile for a ${aud.split(",")[0]?.trim() || "customer"}.`, camera: "over-the-shoulder medium shot", voiceLine: `Whether in-person or on the go, the ${name} touch goes with you.`, textOverlay: "The Extra Mile" },
    { shotType: "environment", visual: `Wide shot of ${city} with ${name}'s location highlighted by warm light.`, camera: "ascending drone reveal", voiceLine: `Right here in the heart of ${city}${state ? `, ${state}` : ""} — a ${cat} worth the trip.`, textOverlay: `Heart of ${city}` },
    { shotType: "people", visual: `A first-time ${aud.split(",")[0]?.trim() || "customer"} arriving, impressed by the atmosphere.`, camera: "following steadicam from behind", voiceLine: `First timers become regulars. That's the ${name} effect.`, textOverlay: "The Effect" },
    { shotType: "product", visual: `The process from start to finish: raw materials transforming into a finished ${productWord}.`, camera: "timelapse-style sequence", voiceLine: `From start to finish — we put the work in so you ${enjoyVerb} the difference.`, textOverlay: "Start to Finish" },
    { shotType: "environment", visual: `A cozy area of ${name} — clients relaxing, ambient atmosphere.`, camera: "soft focus medium wide", voiceLine: `It's not just about the ${cat}. It's about the feeling.`, textOverlay: "The Feeling" },
    { shotType: "people", visual: `Group celebrating a milestone at ${name}. Energy, smiles, connection.`, camera: "wide shot with energy", voiceLine: `Milestones, celebrations, everyday moments — ${name} makes them all special.`, textOverlay: "Celebrate Here" },
    { shotType: "product", visual: `${name}'s newest or featured ${productWord}, presented with dramatic flair.`, camera: "rotating pedestal shot", voiceLine: `Always evolving, always surprising. Ask about what's new.`, textOverlay: "What's New" },
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
    `Stunning exterior of ${name} at golden hour. Warm inviting glow, signage prominent, ${city} street life.`,
    `Sweeping shot descending toward ${name}'s entrance. ${city} visible, dramatic reveal.`,
    `Quick-cut montage: team in action, a smile, the ${name} sign — all in 3 seconds. High energy.`,
    `Slow-motion shot of the ${name} door opening, warm light spilling out, a ${aud.split(",")[0]?.trim() || "visitor"} stepping inside.`,
    `Time-lapse of ${city} transitioning from morning to evening, ending with ${name} lit up at night.`,
  ];

  // Closing visual variants
  const closingVisuals = [
    `${name} logo or signage at twilight. Beautiful bokeh, elegant branding moment.`,
    `Happy ${aud} leaving ${name}, satisfied, waving goodbye. Warm sunset.`,
    `Animated text reveal of ${name}'s details and social handles over a blurred background.`,
    `Wide shot of ${name}'s space in full swing — activity, energy, community.`,
  ];

  if (structure === "reverse") {
    scenes.push({ shotType: "environment", visual: pick(closingVisuals), camera: "slow pull-back reveal", voiceLine: chosenClosing.voiceLine, textOverlay: chosenClosing.textOverlay });
    for (let i = 0; i < neededMiddles && i < shuffledMiddles.length; i++) scenes.push(shuffledMiddles[i]);
    scenes.push({ shotType: "environment", visual: pick(hookVisuals), camera: "slow push-in towards entrance", voiceLine: chosenHook.voiceLine, textOverlay: chosenHook.textOverlay });
  } else if (structure === "middle_heavy") {
    scenes.push({ shotType: "environment", visual: pick(hookVisuals), camera: "quick whip pan", voiceLine: chosenHook.voiceLine, textOverlay: chosenHook.textOverlay });
    for (let i = 0; i < neededMiddles + 1 && i < shuffledMiddles.length && scenes.length < sceneCount - 1; i++) scenes.push(shuffledMiddles[i]);
    scenes.push({ shotType: "environment", visual: pick(closingVisuals), camera: "snap zoom to logo", voiceLine: chosenClosing.voiceLine, textOverlay: chosenClosing.textOverlay });
  } else {
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
  const titlePrefixes = ["Your Local", "Discover", "Experience", "Meet", "Welcome to", "Introducing", "Inside", "The Story of", "Why People Love", "Behind the Scenes at"];

  return {
    title: `${name} — ${pick(titlePrefixes)} ${cat}`,
    description: `Discover what makes ${name} the go-to ${cat} in ${city}.`,
    voiceover_script: formattedScenes.map(s => s.voiceover_line).join(" "),
    scene_captions: formattedScenes.map(s => s.voiceover_line),
    scenes: formattedScenes,
    caption: `${pick(["✨", "🔥", "💯", "🎬", "⭐"])} ${pick(["Discover", "Experience", "Meet", "Check out"])} ${name} in ${city}! ${svc} ${pick(["🔥", "💪", "✨", "🎯"])} #${name.replace(/\s+/g, "")} #${cat.replace(/\s+/g, "")}`,
    hashtags: [name.replace(/\s+/g, ""), cat.replace(/\s+/g, ""), city.replace(/\s+/g, ""), "smallbusiness", pick(["localbusiness", "supportlocal", "shoplocal", "communitylove"])],
    target_platform: pick(["instagram", "tiktok", "facebook"]),
    cta: chosenClosing.voiceLine,
    usedFallbackScript: true,
    _generationId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    _structure: structure,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// VISUAL SCRIPT BUILDER — cinematic shot-by-shot descriptions
// ═══════════════════════════════════════════════════════════════════════
const CAMERA_MOVEMENTS: Record<string, string[]> = {
  product: ["slow push-in", "overhead orbit clockwise", "lateral dolly left-to-right", "rack focus foreground-to-background", "slow tilt down reveal"],
  food: ["slow push-in", "overhead orbit clockwise", "lateral dolly left-to-right", "rack focus foreground-to-background", "slow tilt down reveal"],
  people: ["steadicam walk-through", "lateral tracking right-to-left", "gentle push-in", "handheld follow", "dolly around subject"],
  environment: ["slow push-in towards entrance", "overhead crane descending", "pull-back reveal", "slow pan left-to-right", "ascending drone-style reveal"],
};
const LIGHTING_MOODS: Record<string, string[]> = {
  product: ["warm golden rim light, vibrant colors", "soft diffused overhead, clean highlights", "dramatic side light, rich shadows", "bright natural light, fresh feel"],
  food: ["warm golden rim light, vibrant colors", "soft diffused overhead, steam catching light", "dramatic side light, rich shadows", "bright natural window light, fresh feel"],
  people: ["warm ambient light, natural skin tones", "soft backlight with lens flare", "golden hour window light, warm contrast", "bright cheerful daylight, upbeat energy"],
  environment: ["golden hour exterior, warm glow from inside", "twilight blue hour with warm interior contrast", "bright midday, clean shadows", "moody atmospheric with accent lighting"],
};
const SHOT_SIZES: Record<string, string[]> = { product: ["extreme close-up", "close-up", "medium close-up", "overhead flat-lay"], food: ["extreme close-up", "close-up", "medium close-up", "overhead flat-lay"], people: ["medium shot", "medium close-up", "wide shot", "over-the-shoulder"], environment: ["wide establishing shot", "medium wide shot", "low-angle wide shot", "aerial wide shot"] };
const TRANSITIONS_IN = ["fade in from black", "soft crossfade", "whip pan from previous", "match cut", "smooth morph transition"];
const TRANSITIONS_OUT = ["soft crossfade to next", "quick cut", "slow fade", "motion blur transition", "match dissolve"];

function buildVisualScript(script: any, biz: any, preset: PipelinePreset, videoId: string) {
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

    // Build the full cinematic prompt text for the video renderer
    const promptText = `${shotSize} of ${subject}, ${scene.camera_direction || cameraMovement}, ${lighting}, ${envDetails}. Style: cinematic, crisp, high-detail, natural motion, photorealistic. DO NOT: generic stock footage, robotic movement, flat lighting.`;

    // Derive emotional beat from scene position
    const emotionalBeats = ["intrigue", "discovery", "connection", "desire", "action"];
    const beatIndex = Math.min(Math.floor(i / Math.max(1, scenes.length / emotionalBeats.length)), emotionalBeats.length - 1);

    // Negative prompts per shot type
    const negativePrompts: Record<string, string> = {
      product: "no flat lighting, no artificial-looking subjects, no cluttered backgrounds",
      food: "no flat overhead lighting, no plastic-looking food, no cluttered backgrounds",
      people: "no stiff posed shots, no fake smiles, no empty space feel",
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
      camera_angle: shotType === "product" || shotType === "food" ? "eye-level" : shotType === "environment" ? "low angle" : "eye-level",
      camera_movement: scene.camera_direction || cameraMovement,
      composition: scene.visual_description || "",
      lighting,
      color_grade: shotType === "product" || shotType === "food" ? "rich warm tones, slightly desaturated background" : "natural warm tones, balanced contrast",
      visual_style: "cinematic, crisp, realistic",
      environment_details: envDetails,
      action: scene.visual_description?.match(/\b(walking|smiling|greeting|serving|working|presenting|demonstrating|creating|laughing)\b/i)?.[0] || "subtle natural movement",
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
    video_prompt: buildVisualPromptText(script, biz, shots, aspectRatio),
  };
}

function buildVisualPromptText(script: any, biz: any, shots: any[], aspectRatio: string): string {
  // SLIMMED PROMPT — reduced context load for video renderer
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

RULES: Unique bespoke video. No templates. No generic stock footage look. Vary shot sizes. Natural motion. ${city} location ONLY. This is a ${cat} business — ALL visuals must match this industry. Do NOT show food/restaurant scenes unless this IS a food business. Total duration: exactly ${totalDur}s.

VOICEOVER DIRECTION: Use a professional ${tone === "feminine" ? "feminine" : "masculine"} voice. Do NOT ask which voice type to use — just use the one specified. Narrate confidently without seeking confirmation.

VOICEOVER: "${script.voiceover_script}"

SHOT LIST (render each scene individually):
${shots.map((s: any) => `S${s.index} (${s.estimated_duration_seconds}s): ${s.shot_type} — ${s.subject}. Camera: ${s.camera_movement}. Light: ${s.lighting}. Text: "${s.on_screen_text}". VO: "${s.voice_lines}". Avoid: ${s.negative_prompt || "generic look"}`).join("\n")}

Emotional arc: Intrigue → Discovery → Connection → Desire → Action. Each shot transitions seamlessly. Color grade consistent throughout.`;
}

// Build per-scene prompts for sub-task architecture (each scene = 1 render task)
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

═══ CRITICAL: INDUSTRY CONSISTENCY ═══
This business is a "${dna.cat}". ALL visual descriptions, voiceover lines, and shot lists MUST be consistent with this industry.
- Do NOT describe food, restaurant, or dining scenes unless the business IS a restaurant/food business.
- Do NOT describe photography/studio scenes unless the business IS a photography/media business.
- Every scene must visually represent what THIS specific business actually does: ${dna.svc || dna.cat}.
- The shot list total duration MUST equal exactly ${preset.targetSeconds} seconds (${preset.sceneCount} scenes × ${preset.clipDuration}s each).

═══ VOICEOVER DIRECTION ═══
Voice Type: Professional masculine voice (default). Do NOT ask the user to choose between masculine or feminine — always use the voice specified here. Proceed directly with narration generation without seeking confirmation.

═══ NEGATIVE PROMPTING (what to AVOID) ═══
- NO generic stock footage aesthetic
- NO robotic or unnatural movement
- NO scenes from a DIFFERENT industry than "${dna.cat}"
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
    `{"scene_number":${i + 1},"duration_seconds":${preset.clipDuration},"visual_description":"DETAILED cinematic prompt: shot size + camera move + lighting + subject + action + environment + mood","text_overlay":"2-5 word overlay","camera_direction":"specific camera direction","voiceover_line":"narration for this beat","shotType":"product|people|environment","emotional_beat":"what the viewer should FEEL","negative_prompt":"what to AVOID in this shot"}`
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
        const shotTypes = ["environment", "product", "people"];
        fixed.scenes = fixed.scenes.map((s: any, i: number) => {
          if (!s.visual_description?.trim() && !s.visual?.trim()) {
            const type = s.shotType || shotTypes[i % shotTypes.length];
            const visuals: Record<string, string> = {
              environment: `Wide cinematic shot of ${name} in ${city}. Golden hour lighting, warm glow.`,
              product: `Close-up of ${name}'s signature offering. Dramatic rim lighting, vibrant colors, professional presentation.`,
              food: `Close-up of ${name}'s signature offering. Dramatic rim lighting, vibrant colors.`,
              people: `Happy ${biz?.target_audience || "customers"} at ${name}. Candid smiles, warm atmosphere, natural light.`,
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

// ═══════════════════════════════════════════════════════════════════════
// FINAL VIDEO PLAN — single source of truth for the entire pipeline
// ═══════════════════════════════════════════════════════════════════════
interface ScriptScene {
  index: number;
  overlayText: string;
  voiceoverText: string;
  captionText: string;
  shotType: string;
  durationSeconds: number;
}

interface MediaScene {
  index: number;
  url: string;
  mediaType: 'image' | 'video';
  sourceType: 'upload' | 'legacy' | 'pexels' | 'placeholder';
}

interface FinalVideoPlan {
  jobId: string;
  business: {
    id: string;
    name: string;
    niche: string;
    city: string;
    tone: string;
    cta: string;
  };
  script: {
    title: string;
    hookText: string;
    scenes: ScriptScene[];
    ctaText: string;
    ctaSubtext: string;
    voiceoverScript: string;
    usedFallback: boolean;
  };
  media: {
    scenes: MediaScene[];
  };
  voiceover: {
    provider: 'google-chirp3-hd' | 'elevenlabs' | 'none';
    audioUrl: string | null;
    status: 'ready' | 'failed' | 'skipped';
    failureReason?: string;
  };
  avatar: {
    provider: 'heygen' | 'none';
    videoUrl: string | null;
    status: 'ready' | 'failed' | 'skipped';
    failureReason?: string;
  };
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

// Fetch a landscape photo from Pexels — tries each query in order, returns first hit
async function fetchPexelsImage(queries: string[], apiKey: string): Promise<string | null> {
  for (const query of queries) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&size=large`;
      const res = await fetch(url, { headers: { Authorization: apiKey } });
      if (!res.ok) continue;
      const data = await res.json();
      const photos: any[] = data?.photos || [];
      if (!photos.length) continue;
      const pick = photos[Math.floor(Math.random() * photos.length)];
      const imgUrl = pick?.src?.large2x || pick?.src?.large || pick?.src?.original || null;
      if (imgUrl) return imgUrl;
    } catch {
      continue;
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

async function getSceneImage(
  supabase: any, userId: string, jobId: string, sceneIndex: number, scene: any, biz: any,
  anthropicKey: string, creditsExhausted: boolean, existingImages: string[],
  businessMedia: BusinessMediaRow[], usedMediaIds: Set<string>,
): Promise<{ url: string; isReal: boolean; motionPrompt: string }> {
  const shotType = scene?.shotType || "environment";
  const motionPrompt = getMotionPrompt(shotType, sceneIndex);

  // Priority 0: Business media library (user-uploaded assets)
  const libraryMatch = pickMediaForScene(businessMedia.filter(m => m.file_type === "image" || m.file_type?.startsWith("image/")), shotType, usedMediaIds);
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

  // Priority 2: AI image generation - skipped, using Pexels stock photos instead
  if (false && !creditsExhausted) {
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 100, messages: [{ role: "user", content: "placeholder" }] }),
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
// RENDER SCRIPT BUILDER — reads ONLY from FinalVideoPlan
// ═══════════════════════════════════════════════════════════════════════
function buildRenderScript(plan: FinalVideoPlan): Record<string, any> {
  const { business, script, media, voiceover, avatar } = plan;

  const textFade = [
    { time: 0, type: "fade", duration: 0.3 },
    { time: "end", type: "fade", duration: 0.3, reversed: true },
  ];
  const slowFade = [
    { time: 0, type: "fade", duration: 0.5 },
    { time: "end", type: "fade", duration: 0.5, reversed: true },
  ];

  const darkOverlay = {
    type: "shape", track: 2, time: 0,
    x: "50%", y: "50%", x_anchor: "50%", y_anchor: "50%",
    width: "100%", height: "100%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "rgba(0,0,0,0.35)",
  };

  const captionBar = {
    type: "shape", track: 4, time: 0,
    x: "50%", y: "100%", x_anchor: "50%", y_anchor: "100%",
    width: "100%", height: "15%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "rgba(0,0,0,0.65)",
    animations: textFade,
  };

  const solidBg = {
    type: "shape", track: 1, time: 0,
    x: "50%", y: "50%", x_anchor: "50%", y_anchor: "50%",
    width: "100%", height: "100%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "#1a1a2e",
  };

  // Build a background element from a MediaScene — handles image, video, or missing
  const buildBgElement = (ms: MediaScene | null | undefined, track = 1): Record<string, any> => {
    if (!ms?.url) return solidBg;
    if (ms.mediaType === 'video') {
      return {
        type: "video", track, time: 0, source: ms.url, fit: "cover",
        x: "50%", y: "50%", x_anchor: "50%", y_anchor: "50%",
        width: "100%", height: "100%", volume: 0,
      };
    }
    return {
      type: "image", track, time: 0, source: ms.url, fit: "cover",
      x: "50%", y: "50%", x_anchor: "50%", y_anchor: "50%",
      width: "100%", height: "100%",
      animations: [
        { time: 0, easing: "linear", type: "scale", scope: "element", end_scale: "108%" },
      ],
    };
  };

  // Build a named scene background element (same as above but with a name property)
  const buildNamedBgElement = (ms: MediaScene | null | undefined, name: string, track = 1): Record<string, any> => {
    const base = buildBgElement(ms, track);
    return { ...base, name, dynamic: true };
  };

  // Build one scene composition from plan data
  const buildSceneComposition = (sceneIdx: number, startTime: number, duration = 8) => {
    const ss = script.scenes[sceneIdx];
    const ms = media.scenes[sceneIdx] ?? null;

    const elements: any[] = [
      buildNamedBgElement(ms, `Scene-${sceneIdx + 1}-Image`),
      darkOverlay,
    ];

    if (ss?.overlayText) {
      elements.push({
        name: `Scene-${sceneIdx + 1}-Text`, type: "text", track: 3, time: 0,
        text: ss.overlayText, dynamic: true,
        x: "50%", y: "45%", x_anchor: "50%", y_anchor: "50%",
        width: "80%", height: "35%",
        fill_color: "#ffffff", font_family: "Montserrat", font_weight: "700",
        font_size: 72, x_alignment: "50%", y_alignment: "50%", line_height: "110%",
        animations: textFade,
      });
    }

    if (ss?.captionText) {
      elements.push(captionBar);
      elements.push({
        name: `Scene-${sceneIdx + 1}-Caption`, type: "text", track: 5, time: 0,
        text: ss.captionText, dynamic: true,
        x: "50%", y: "98%", x_anchor: "50%", y_anchor: "100%",
        width: "85%", height: "13%",
        fill_color: "#ffffff", font_family: "Montserrat", font_weight: "400",
        font_size: 36, x_alignment: "50%", y_alignment: "50%",
        animations: textFade,
      });
    }

    return {
      type: "composition", track: 3, time: startTime, duration,
      animations: [
        { time: 0, type: "fade", duration: 0.5 },
        { time: "end", type: "fade", duration: 0.5, reversed: true },
      ],
      elements,
    };
  };

  const sceneCount = script.scenes.length;
  const sceneCompositions: any[] = [];
  for (let i = 0; i < sceneCount; i++) {
    sceneCompositions.push(buildSceneComposition(i, 5 + i * 8));
  }

  const totalDuration = 5 + sceneCount * 8 + 7;
  const introMs = media.scenes[0] ?? null;
  const ctaMs = media.scenes[sceneCount - 1] ?? null;

  return {
    output_format: "mp4",
    width: 1920,
    height: 1080,
    frame_rate: 30,
    duration: totalDuration,
    snapshot_time: 15,
    elements: [
      ...(voiceover.audioUrl ? [{
        name: "Voiceover-Audio", type: "audio", track: 2, time: 0,
        source: voiceover.audioUrl, audio_fade_in: 0.3, audio_fade_out: 0.3,
      }] : []),

      // Avatar PIP — bottom-right corner, portrait 9:16 clip, spans full video
      ...(avatar?.videoUrl ? [{
        name: "Avatar-PIP",
        type: "video", track: 10, time: 0, duration: totalDuration,
        source: avatar.videoUrl, volume: 0, fit: "cover",
        x: "89%", y: "100%", x_anchor: "50%", y_anchor: "100%",
        width: 300, height: 530,
        border_radius: 16,
        shadow_color: "rgba(0,0,0,0.45)", shadow_blur: 14,
        animations: [
          { time: 0, type: "fade", duration: 0.4 },
          { time: "end", type: "fade", duration: 0.4, reversed: true },
        ],
      }] : []),

      // Intro (0–5s)
      {
        type: "composition", track: 3, time: 0, duration: 5,
        animations: [{ time: "end", type: "fade", duration: 0.5, reversed: true }],
        elements: [
          buildBgElement(introMs),
          darkOverlay,
          {
            name: "Hook-Text", type: "text", track: 3, time: 0,
            text: script.hookText, dynamic: true,
            x: "50%", y: "38%", x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "35%",
            fill_color: "#ffffff", font_family: "Montserrat", font_weight: "800",
            font_size: 80, x_alignment: "50%", y_alignment: "50%", line_height: "110%",
            animations: slowFade,
          },
          {
            name: "Business-Name", type: "text", track: 4, time: 0.5,
            text: business.name, dynamic: true,
            x: "50%", y: "64%", x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "18%",
            fill_color: "#ffffff", font_family: "Montserrat", font_weight: "700",
            font_size: 56, x_alignment: "50%", y_alignment: "50%",
            animations: slowFade,
          },
        ],
      },

      ...sceneCompositions,

      // CTA-Outro (last 7s)
      {
        type: "composition", track: 3, time: 5 + sceneCount * 8, duration: 7,
        animations: slowFade,
        elements: [
          buildBgElement(ctaMs),
          darkOverlay,
          {
            name: "CTA-Text", type: "text", track: 3, time: 0,
            text: script.ctaText, dynamic: true,
            x: "50%", y: "36%", x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "28%",
            fill_color: "#ffffff", font_family: "Montserrat", font_weight: "700",
            font_size: 64, x_alignment: "50%", y_alignment: "50%", line_height: "110%",
            animations: slowFade,
          },
          {
            name: "CTA-Subtext", type: "text", track: 4, time: 0.5,
            text: script.ctaSubtext, dynamic: true,
            x: "50%", y: "60%", x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "16%",
            fill_color: "#cccccc", font_family: "Montserrat", font_weight: "400",
            font_size: 36, x_alignment: "50%", y_alignment: "50%",
            animations: slowFade,
          },
          {
            name: "Business-Name", type: "text", track: 5, time: 1,
            text: business.name, dynamic: true,
            x: "50%", y: "78%", x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "14%",
            fill_color: "#ffffff", font_family: "Montserrat", font_weight: "700",
            font_size: 48, x_alignment: "50%", y_alignment: "50%",
            animations: slowFade,
          },
        ],
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PIPELINE — FinalVideoPlan-driven
// ═══════════════════════════════════════════════════════════════════════
async function processVideoJob(
  jobId: string,
  userId: string,
  businessId: string,
  videoType: string,
  lengthMode: string,
  orientation: Orientation = "landscape",
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const googleTtsKey = Deno.env.get("GOOGLE_TTS_API_KEY") || "";
  const creatomateKey = Deno.env.get("CREATOMATE_API_KEY") || "";
  const creatomateWebhookUrl = Deno.env.get("CREATOMATE_WEBHOOK_URL") || "";

  const pipelineLogs: string[] = [];
  const log = (msg: string) => {
    pipelineLogs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[pipeline] ${msg}`);
  };
  const updateJob = async (fields: Record<string, any>) => {
    await supabase.from("video_generation_jobs").update({
      ...fields,
      result_payload: {
        ...(fields.result_payload || {}),
        pipeline_logs: pipelineLogs,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  };

  try {
    // ── Load business + location ──────────────────────────────────────────
    const { data: business } = await supabase.from("businesses").select("*")
      .eq("id", businessId).eq("user_id", userId).single();
    if (!business) throw new Error("Business not found");
    log(`Business: id=${business.id}, name=${business.business_name || business.name || "unknown"}`);

    const { data: locations } = await supabase.from("locations").select("*")
      .eq("business_id", businessId).eq("user_id", userId).limit(1);
    const location = locations?.[0];

    const { data: strategyRows } = await supabase.from("strategy_outputs")
      .select("output_data").eq("business_id", businessId).eq("user_id", userId)
      .order("step_number", { ascending: true }).limit(10);
    const strategyData = strategyRows?.reduce((acc: any, row: any) => ({
      ...acc, ...(row.output_data || {}),
    }), {}) || {};

    // Resolve ElevenLabs key — user stored key takes priority
    const { data: userKeys } = await supabase.from("user_api_keys")
      .select("provider, api_key_encrypted").eq("user_id", userId).eq("is_valid", true);
    const keyMap: Record<string, string> = {};
    userKeys?.forEach((k: any) => { keyMap[k.provider] = k.api_key_encrypted; });
    const elevenlabsKey = keyMap["elevenlabs"] || Deno.env.get("ELEVENLABS_API_KEY") || "";
    const heygenKey = Deno.env.get("HEYGEN_API_KEY") || "";
    const pexelsKey = Deno.env.get("PEXELS_API_KEY") || "";

    const preset = buildPreset(lengthMode, orientation);
    log(`═══ Job ${jobId} START ═══`);
    log(`Preset: ${preset.label}, scenes=${preset.sceneCount}, clipDur=${preset.clipDuration}s`);
    log(`Keys: ElevenLabs=${!!elevenlabsKey}, GoogleTTS=${!!googleTtsKey}, Creatomate=${!!creatomateKey}, HeyGen=${!!heygenKey}`);

    // ────────────────────────────────────────────────────────────────────
    // PHASE 1: SCRIPT
    // ────────────────────────────────────────────────────────────────────
    await updateJob({ status: "generating_script", result_payload: { message: "✍️ Loading script..." } });

    let rawScript: any;
    let usedFallback = false;

    const { data: jobRow } = await supabase.from("video_generation_jobs")
      .select("request_payload").eq("id", jobId).single();
    const passedScript = (jobRow?.request_payload as any)?.approvedScript;

    if (passedScript?.scenes?.length > 0) {
      log(`Using pre-approved script: "${passedScript.title}"`);
      rawScript = passedScript;
      usedFallback = !!passedScript.usedFallbackScript;
    } else {
      log("No approved script — generating from AI");
      try {
        const prompt = buildAIPrompt(business, location, preset, strategyData);
        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: "You are a video production expert. Return valid JSON only.",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
        const data = await res.json();
        const cleaned = data.content[0].text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
        rawScript = JSON.parse(cleaned);
        rawScript.usedFallbackScript = false;
        log(`AI script: "${rawScript.title}"`);
      } catch (e: any) {
        log(`AI script failed (${e.message}) — using profile-based script`);
        rawScript = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
        rawScript.usedFallbackScript = true;
        usedFallback = true;
      }
    }

    // Normalize to exactly preset.sceneCount scenes
    if (!rawScript.scenes?.length) {
      rawScript = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
      usedFallback = true;
    }
    while (rawScript.scenes.length < preset.sceneCount) {
      const extra = buildScriptFromProfile(business, location, strategyData, preset.sceneCount, preset.clipDuration);
      rawScript.scenes.push(...extra.scenes.slice(0, preset.sceneCount - rawScript.scenes.length));
    }
    rawScript.scenes = rawScript.scenes.slice(0, preset.sceneCount);

    // Self-correction loop
    for (let attempt = 1; attempt <= MAX_SELF_CORRECT_ATTEMPTS; attempt++) {
      const issues = diagnoseScript(rawScript, preset, business, location);
      const critical = issues.filter((i: any) => i.severity === "critical");
      if (critical.length === 0) { log(`PromptFixer: passed attempt ${attempt}`); break; }
      logPromptFixer(attempt, issues, "FIXING");
      rawScript = applyScriptFixes(rawScript, issues, preset, business, location, strategyData);
      rawScript.scenes = rawScript.scenes.slice(0, preset.sceneCount);
    }

    // Rebuild derived fields from finalized scenes
    rawScript.voiceover_script = rawScript.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
    rawScript.scene_captions = rawScript.scenes.map((s: any) => s.voiceover_line || s.text_overlay || "");

    // Build the canonical FinalVideoPlan.script
    const planScript: FinalVideoPlan["script"] = {
      title: rawScript.title || "Business Promo Video",
      hookText: rawScript.scenes[0]?.text_overlay
        || rawScript.scenes[0]?.voiceover_line?.split(" ").slice(0, 6).join(" ")
        || business.business_name || "Welcome",
      scenes: rawScript.scenes.map((s: any, i: number): ScriptScene => ({
        index: i + 1,
        overlayText: s.text_overlay || s.voiceover_line?.split(" ").slice(0, 6).join(" ") || "",
        voiceoverText: s.voiceover_line || "",
        captionText: s.voiceover_line || "",
        shotType: s.shotType || "environment",
        durationSeconds: s.duration_seconds || preset.clipDuration,
      })),
      ctaText: rawScript.cta
        || rawScript.scenes[rawScript.scenes.length - 1]?.text_overlay
        || "Contact Us Today",
      ctaSubtext: business.services?.split(",")[0]?.trim() || "Call or visit us today",
      voiceoverScript: rawScript.voiceover_script,
      usedFallback,
    };

    log(`Script ready: ${planScript.scenes.length} scenes, "${planScript.title}", fallback=${usedFallback}`);

    // ────────────────────────────────────────────────────────────────────
    // PHASE 2: MEDIA ASSIGNMENT (uploads-first, no mixing of media types)
    // ────────────────────────────────────────────────────────────────────
    await updateJob({
      status: "generating_images",
      result_payload: { message: "🎨 Assigning scene photos...", pipeline_logs: pipelineLogs },
    });

    try { await supabase.storage.createBucket("media", { public: true }); } catch (_) {}

    const businessMedia = await fetchBusinessMedia(supabase, businessId);
    const businessImages = businessMedia.filter((m: BusinessMediaRow) =>
      m.file_type === "image" || m.file_type?.startsWith("image/")
    );
    const businessVideos = businessMedia.filter((m: BusinessMediaRow) =>
      m.file_type === "video" || m.file_type?.startsWith("video/")
    );
    log(`Business media: ${businessImages.length} images, ${businessVideos.length} videos`);

    const existingRealImages = await findAllExistingImages(supabase, userId);
    log(`Legacy storage: ${existingRealImages.length} images`);

    const usedMediaIds = new Set<string>();
    const mediaScenes: MediaScene[] = [];

    for (let i = 0; i < planScript.scenes.length; i++) {
      const scene = planScript.scenes[i];

      // Priority 1: uploaded video clips (not stale CDN urls)
      const videoMatch = pickMediaForScene(businessVideos, scene.shotType, usedMediaIds);
      if (videoMatch
        && !videoMatch.public_url.includes("cdn.creatomate.com")
        && !videoMatch.public_url.includes("test-video")) {
        mediaScenes.push({ index: i + 1, url: videoMatch.public_url, mediaType: 'video', sourceType: 'upload' });
        log(`Scene ${i + 1}: uploaded video (${videoMatch.file_name})`);
        continue;
      }

      // Priority 2: uploaded images
      const imageMatch = pickMediaForScene(businessImages, scene.shotType, usedMediaIds);
      if (imageMatch) {
        const real = await isRealImage(imageMatch.public_url);
        if (real) {
          mediaScenes.push({ index: i + 1, url: imageMatch.public_url, mediaType: 'image', sourceType: 'upload' });
          log(`Scene ${i + 1}: uploaded image (${imageMatch.file_name})`);
          continue;
        }
      }

      // Priority 3: legacy storage images
      if (existingRealImages.length > 0) {
        const legacyUrl = existingRealImages[i % existingRealImages.length];
        const real = await isRealImage(legacyUrl);
        if (real) {
          mediaScenes.push({ index: i + 1, url: legacyUrl, mediaType: 'image', sourceType: 'legacy' });
          log(`Scene ${i + 1}: legacy storage image`);
          continue;
        }
      }

      // Priority 4: Pexels stock photo — niche-aware query with niche-only retry
      if (pexelsKey) {
        const sceneTemplates: Record<string, string> = {
          product: "technician working",
          people: "customer home service",
          environment: "equipment installation",
        };
        const niche = business.business_category || "local business";
        const primaryQuery = `${niche} ${sceneTemplates[scene.shotType] || scene.shotType}`;
        const pexelsUrl = await fetchPexelsImage([primaryQuery, niche], pexelsKey);
        if (pexelsUrl) {
          mediaScenes.push({ index: i + 1, url: pexelsUrl, mediaType: 'image', sourceType: 'pexels' });
          log(`Scene ${i + 1}: Pexels stock ("${primaryQuery}")`);
          continue;
        }
      }

      // Final fallback: dark placeholder
      const png = create128Png(i);
      const fn = `scenes/${userId}/${jobId}/scene-${i + 1}-placeholder.png`;
      await supabase.storage.from("media").upload(fn, png, { contentType: "image/png", upsert: true });
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(fn);
      mediaScenes.push({ index: i + 1, url: urlData.publicUrl, mediaType: 'image', sourceType: 'placeholder' });
      log(`Scene ${i + 1}: dark placeholder (no uploaded media found)`);
    }

    const planMedia: FinalVideoPlan["media"] = { scenes: mediaScenes };
    const uploadCount = mediaScenes.filter(m => m.sourceType === 'upload').length;
    const pexelsCount = mediaScenes.filter(m => m.sourceType === 'pexels').length;
    const placeholderCount = mediaScenes.filter(m => m.sourceType === 'placeholder').length;
    log(`Media assigned: ${uploadCount} uploads, ${mediaScenes.filter(m => m.sourceType === 'legacy').length} legacy, ${pexelsCount} pexels, ${placeholderCount} placeholders`);

    // ────────────────────────────────────────────────────────────────────
    // PHASE 3: VOICEOVER (always from planScript.voiceoverScript)
    // ────────────────────────────────────────────────────────────────────
    let planVoiceover: FinalVideoPlan["voiceover"] = { provider: 'none', audioUrl: null, status: 'skipped' };
    const voiceoverText = planScript.voiceoverScript;

    if (voiceoverText) {
      const { data: voToolDefault } = await supabase.from("user_tool_defaults")
        .select("default_provider").eq("user_id", userId).eq("tool_type", "voice").maybeSingle();
      const useElevenLabs = voToolDefault?.default_provider === "elevenlabs";

      if (useElevenLabs && elevenlabsKey) {
        await updateJob({
          status: "generating_voiceover",
          result_payload: { message: "🎙️ Generating voiceover with ElevenLabs...", pipeline_logs: pipelineLogs },
        });
        try {
          const { data: voiceDefault } = await supabase.from("user_tool_defaults")
            .select("default_provider").eq("user_id", userId).eq("tool_type", "elevenlabs_voice_id").maybeSingle();
          const voiceId = voiceDefault?.default_provider || "JBFqnCBsd6RMkjVDRZzb";
          log(`ElevenLabs TTS, voice=${voiceId}`);

          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
            method: "POST",
            headers: { "xi-api-key": elevenlabsKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: voiceoverText,
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
              planVoiceover = { provider: 'elevenlabs', audioUrl: urlData.publicUrl, status: 'ready' };
              log("ElevenLabs voiceover ready");
            } else {
              planVoiceover = { provider: 'elevenlabs', audioUrl: null, status: 'failed', failureReason: 'Storage upload failed' };
            }
          } else {
            const errBody = await ttsRes.text();
            log(`ElevenLabs failed [${ttsRes.status}]: ${errBody}`);
            planVoiceover = { provider: 'elevenlabs', audioUrl: null, status: 'failed', failureReason: `HTTP ${ttsRes.status}` };
          }
        } catch (e: any) {
          log(`ElevenLabs error: ${e.message}`);
          planVoiceover = { provider: 'elevenlabs', audioUrl: null, status: 'failed', failureReason: e.message };
        }
      } else if (!useElevenLabs && googleTtsKey) {
        await updateJob({
          status: "generating_voiceover",
          result_payload: { message: "🎙️ Generating voiceover with Google TTS...", pipeline_logs: pipelineLogs },
        });
        try {
          log("Google TTS Chirp 3 HD");
          const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTtsKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text: voiceoverText },
              voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede" },
              audioConfig: { audioEncoding: "MP3" },
            }),
          });
          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            const audioBase64: string = ttsData.audioContent;
            if (audioBase64) {
              const binaryStr = atob(audioBase64);
              const audioBytes = new Uint8Array(binaryStr.length);
              for (let k = 0; k < binaryStr.length; k++) audioBytes[k] = binaryStr.charCodeAt(k);
              const audioFn = `voiceovers/${userId}/${jobId}.mp3`;
              const { error } = await supabase.storage.from("media").upload(audioFn, audioBytes, { contentType: "audio/mpeg", upsert: true });
              if (!error) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(audioFn);
                planVoiceover = { provider: 'google-chirp3-hd', audioUrl: urlData.publicUrl, status: 'ready' };
                log("Google TTS voiceover ready");
              } else {
                planVoiceover = { provider: 'google-chirp3-hd', audioUrl: null, status: 'failed', failureReason: 'Storage upload failed' };
              }
            }
          } else {
            const errBody = await ttsRes.text();
            log(`Google TTS failed [${ttsRes.status}]: ${errBody}`);
            planVoiceover = { provider: 'google-chirp3-hd', audioUrl: null, status: 'failed', failureReason: `HTTP ${ttsRes.status}` };
          }
        } catch (e: any) {
          log(`Google TTS error: ${e.message}`);
          planVoiceover = { provider: 'google-chirp3-hd', audioUrl: null, status: 'failed', failureReason: e.message };
        }
      } else {
        log("Voiceover: no provider configured — captions only");
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // PHASE 3.5: HEYGEN AVATAR (lip-syncs to voiceover — PIP overlay)
    // ────────────────────────────────────────────────────────────────────
    let planAvatar: FinalVideoPlan["avatar"] = { provider: 'none', videoUrl: null, status: 'skipped' };

    if (heygenKey && planVoiceover.audioUrl) {
      await updateJob({
        status: "rendering_video",
        result_payload: { message: "🎭 Generating HeyGen avatar...", pipeline_logs: pipelineLogs },
      });
      try {
        const { data: avatarDefault } = await supabase.from("user_tool_defaults")
          .select("default_provider").eq("user_id", userId).eq("tool_type", "heygen_avatar_id").maybeSingle();
        const avatarId = avatarDefault?.default_provider || "8fc6f2b5cac946408f506a1ffb9824de";
        log(`HeyGen: avatar=${avatarId}, audio=${planVoiceover.audioUrl.substring(0, 60)}`);

        const genRes = await fetch("https://api.heygen.com/v2/video/generate", {
          method: "POST",
          headers: { "X-Api-Key": heygenKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            video_inputs: [{
              character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
              voice: { type: "audio", audio_url: planVoiceover.audioUrl },
            }],
            aspect_ratio: "9:16",
            test: false,
          }),
        });

        if (!genRes.ok) {
          const errBody = await genRes.text();
          throw new Error(`HeyGen generate [${genRes.status}]: ${errBody}`);
        }

        const genData = await genRes.json();
        const heygenVideoId: string = genData?.data?.video_id;
        if (!heygenVideoId) throw new Error("HeyGen returned no video_id");
        log(`HeyGen video_id=${heygenVideoId}, polling (max 250s)...`);

        // Poll every 10s — max 25 attempts = 250s, safely under the 400s function limit
        let avatarRawUrl: string | null = null;
        for (let attempt = 0; attempt < 25; attempt++) {
          await new Promise(r => setTimeout(r, 10000));
          const statusRes = await fetch(
            `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
            { headers: { "X-Api-Key": heygenKey } },
          );
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          const hs = statusData?.data?.status;
          log(`HeyGen poll ${attempt + 1}/25: ${hs}`);
          if (hs === "completed") { avatarRawUrl = statusData?.data?.video_url || null; break; }
          if (hs === "failed") throw new Error(`HeyGen video failed: ${statusData?.data?.error || "unknown"}`);
        }

        if (!avatarRawUrl) throw new Error("HeyGen timed out after 250s");

        // Re-host in Supabase storage so the URL is durable
        const dlRes = await fetch(avatarRawUrl, { redirect: "follow", headers: { "User-Agent": "RickyAI-Pipeline/1.0" } });
        if (!dlRes.ok) throw new Error(`Cannot download HeyGen video (${dlRes.status})`);
        const dlBlob = await dlRes.arrayBuffer();
        if (dlBlob.byteLength < 10240) throw new Error("HeyGen video too small — likely corrupt");

        const avatarPath = `videos/${userId}/${jobId}/avatar.mp4`;
        const { error: avatarUploadErr } = await supabase.storage.from("media")
          .upload(avatarPath, dlBlob, { contentType: "video/mp4", upsert: true });
        if (avatarUploadErr) throw new Error(`Avatar upload failed: ${avatarUploadErr.message}`);

        const { data: avatarUrlData } = supabase.storage.from("media").getPublicUrl(avatarPath);
        planAvatar = { provider: 'heygen', videoUrl: avatarUrlData.publicUrl, status: 'ready' };
        log(`HeyGen avatar ready: ${avatarUrlData.publicUrl.substring(0, 80)}`);
      } catch (e: any) {
        log(`HeyGen error: ${e.message}`);
        planAvatar = { provider: 'heygen', videoUrl: null, status: 'failed', failureReason: e.message };
      }
    } else if (!heygenKey) {
      log("HeyGen: no HEYGEN_API_KEY — avatar skipped");
    } else {
      log("HeyGen: no voiceover audio — avatar skipped (lip-sync requires audio)");
    }

    // ────────────────────────────────────────────────────────────────────
    // ASSEMBLE COMPLETE PLAN
    // ────────────────────────────────────────────────────────────────────
    const plan: FinalVideoPlan = {
      jobId,
      business: {
        id: business.id,
        name: business.business_name || "Your Business",
        niche: business.business_category || "local business",
        city: location?.city || "",
        tone: business.brand_tone || "friendly",
        cta: business.cta || "",
      },
      script: planScript,
      media: planMedia,
      voiceover: planVoiceover,
      avatar: planAvatar,
    };

    // ────────────────────────────────────────────────────────────────────
    // OBSERVABILITY: Log full plan before dispatch
    // ────────────────────────────────────────────────────────────────────
    console.log("[plan] FinalVideoPlan:", JSON.stringify({
      jobId: plan.jobId,
      business: { name: plan.business.name, niche: plan.business.niche, city: plan.business.city },
      script: {
        title: plan.script.title,
        hookText: plan.script.hookText,
        ctaText: plan.script.ctaText,
        scenes: plan.script.scenes.map(s => ({
          idx: s.index,
          overlay: s.overlayText,
          vo: s.voiceoverText.substring(0, 60),
        })),
        voiceoverWords: plan.script.voiceoverScript.split(" ").length,
        usedFallback: plan.script.usedFallback,
      },
      media: {
        scenes: plan.media.scenes.map(m => ({
          idx: m.index,
          url: m.url.substring(0, 80),
          type: m.mediaType,
          source: m.sourceType,
        })),
      },
      voiceover: {
        provider: plan.voiceover.provider,
        status: plan.voiceover.status,
        hasAudio: !!plan.voiceover.audioUrl,
      },
      avatar: {
        provider: plan.avatar.provider,
        status: plan.avatar.status,
        hasVideo: !!plan.avatar.videoUrl,
      },
    }));

    // ────────────────────────────────────────────────────────────────────
    // PHASE 4: BUILD RENDER SCRIPT (only after complete plan)
    // ────────────────────────────────────────────────────────────────────
    if (!creatomateKey) {
      log("No CREATOMATE_API_KEY — completing without render");
      await updateJob({
        status: "completed",
        result_payload: {
          title: plan.script.title,
          voiceover_script: plan.script.voiceoverScript,
          scenes: rawScript.scenes,
          scene_images: plan.media.scenes.map(m => m.url),
          voiceover_url: plan.voiceover.audioUrl,
          video_clips: [],
          usedFallbackScript: plan.script.usedFallback,
          message: "Script and voiceover ready. No Creatomate key configured.",
          pipeline_steps: { script: "completed", voiceover: plan.voiceover.status, render: "not_configured" },
          pipeline_logs: pipelineLogs,
        },
        video_url: null,
      });
      return;
    }

    await updateJob({
      status: "rendering_video",
      result_payload: { message: "🎬 Building RenderScript and dispatching to Creatomate...", pipeline_logs: pipelineLogs },
    });

    const renderScript = buildRenderScript(plan);

    // ────────────────────────────────────────────────────────────────────
    // PHASE 5: DISPATCH TO CREATOMATE
    // ────────────────────────────────────────────────────────────────────
    const renderPayload: any = { source: renderScript, metadata: jobId };
    if (creatomateWebhookUrl) renderPayload.webhook_url = creatomateWebhookUrl;

    log(`Dispatching: scenes=${plan.media.scenes.length}, voiceover=${plan.voiceover.status}, webhook=${!!creatomateWebhookUrl}`);

    let creatomateRenderId: string | null = null;

    try {
      const renderRes = await fetch("https://api.creatomate.com/v1/renders", {
        method: "POST",
        headers: { "Authorization": `Bearer ${creatomateKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(renderPayload),
      });
      log(`Creatomate response: ${renderRes.status}`);

      if (renderRes.ok) {
        const renderData = await renderRes.json();
        const renders = Array.isArray(renderData) ? renderData : [renderData];
        creatomateRenderId = renders[0]?.id || null;
        log(`Creatomate render ID: ${creatomateRenderId}`);
        if (creatomateRenderId) {
          await supabase.from("video_generation_jobs")
            .update({ creatomate_render_id: creatomateRenderId }).eq("id", jobId);
        }
      } else {
        const errText = await renderRes.text();
        log(`Creatomate error [${renderRes.status}]: ${errText}`);
      }
    } catch (e: any) {
      log(`Creatomate dispatch exception: ${e.message}`);
    }

    // ────────────────────────────────────────────────────────────────────
    // PHASE 6: FINAL JOB STATUS
    // ────────────────────────────────────────────────────────────────────
    const sceneImageUrls = plan.media.scenes.map(m => m.url);
    const realCount = plan.media.scenes.filter(m => m.sourceType !== 'placeholder').length;
    const totalDuration = 5 + plan.script.scenes.length * 8 + 7;

    const resultPayload = {
      title: plan.script.title,
      voiceover_script: plan.script.voiceoverScript,
      scenes: rawScript.scenes,
      scene_captions: plan.script.scenes.map(s => s.voiceoverText),
      caption: rawScript.caption,
      hashtags: rawScript.hashtags,
      cta: plan.script.ctaText,
      target_platform: rawScript.target_platform,
      usedFallbackScript: plan.script.usedFallback,
      scene_images: sceneImageUrls,
      voiceover_url: plan.voiceover.audioUrl,
      video_clips: [],
      total_duration_seconds: totalDuration,
      real_image_count: realCount,
      is_fallback: placeholderCount === planScript.scenes.length,
      length_mode: lengthMode,
      orientation,
      creatomate_render_id: creatomateRenderId,
      pipeline_steps: {
        script: "completed",
        images: realCount > 0 ? "completed" : "placeholders_only",
        voiceover: plan.voiceover.status,
        creatomate: creatomateRenderId ? "rendering" : "dispatch_failed",
      },
      message: creatomateRenderId
        ? "🎬 Pipeline complete — waiting for Creatomate render!"
        : "⚠️ Creatomate dispatch failed — check logs.",
      pipeline_logs: pipelineLogs,
    };

    await updateJob({
      status: creatomateRenderId ? "processing" : "failed",
      result_payload: resultPayload,
      video_url: null,
      ...(creatomateRenderId ? {} : { error_message: "Creatomate dispatch failed" }),
    });

    // Save content post on success
    if (plan.script.title && creatomateRenderId) {
      await supabase.from("content_posts").insert({
        user_id: userId,
        business_id: businessId,
        location_id: location?.id ?? null,
        title: plan.script.title,
        caption: rawScript.caption || rawScript.description,
        hashtags: rawScript.hashtags || [],
        media_url: sceneImageUrls[0] || null,
        media_type: "video",
        platform: rawScript.target_platform || "instagram",
        video_script: plan.script.voiceoverScript,
        voiceover_script: plan.script.voiceoverScript,
        shot_list: rawScript.scenes,
        cta: plan.script.ctaText,
        status: "media_ready",
        production_tool: "creatomate",
        thumbnail_url: sceneImageUrls[0] || null,
      }).then(({ error }: any) => { if (error) console.error("[pipeline] content_posts error:", error); });
    }

    log(`═══ Job ${jobId} ${creatomateRenderId ? "PROCESSING" : "FAILED"} ═══`);
    log(`  Scenes: ${plan.media.scenes.length} (${realCount} real, ${placeholderCount} placeholder), Duration: ${totalDuration}s`);
  } catch (error: any) {
    console.error(`[pipeline] ═══ Job ${jobId} FATAL ═══`, error);
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
        const res = await fetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: "You are a video production expert. Return valid JSON only.",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!res.ok) {
          throw new Error(`AI error: ${res.status}`);
        }
        const data = await res.json();
        const rawText = data.content[0].text;
        const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
        script = JSON.parse(cleaned);
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
      const visualScript = buildVisualScript(script, business, preset, "preview");
      script.visual_script = visualScript;

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
        provider: "rickyai_ffmpeg",
        status: "queued",
        request_payload: { businessId, videoType, lengthMode, orientation: orientation || "landscape", approvedScript: approvedScript || null },
      })
      .select("id")
      .single();

    if (jobErr) throw new Error(`Failed to create job: ${jobErr.message}`);

    await processVideoJob(job.id, user.id, businessId, videoType || "promotional", lengthMode || "standard", orientation || "landscape");

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: "started",
      message: "🎬 Pipeline complete — waiting for Creatomate render!",
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
