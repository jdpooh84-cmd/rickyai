/**
 * Video Production Templates — Ricky.AI
 *
 * Reusable, structured templates that every video must follow.
 * Business-agnostic: plug in any business profile to generate
 * a marketing script, visual scene plan, and audio brief.
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────
 *
 * (a) Marketing Script Template — six-beat structure every promo follows
 * (b) Visual Scene Template    — per-scene Manus AI request structure
 * (c) Audio / VO Template      — TTS alignment with timestamps
 *
 * All templates are reusable across any business, not hardcoded for one client.
 */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION — change these to tune cost, quality, and runtime
// ═══════════════════════════════════════════════════════════════════════
export const VIDEO_CONFIG = {
  /** Minimum allowed video length in seconds */
  MIN_DURATION_SECONDS: 45,
  /** Default target video length in seconds */
  DEFAULT_DURATION_SECONDS: 90,
  /** Maximum scenes per video */
  MAX_SCENES: 10,

  // ── Manus AI ──
  MANUS_RATIO_LANDSCAPE: "16:9",
  MANUS_RATIO_VERTICAL: "9:16",
  /** Clip duration per scene (seconds) */
  CLIP_DURATION: 10 as 5 | 10,
  /** Estimated Manus credits per 10s clip (default model: 30 credits/sec) */
  MANUS_CREDITS_PER_10S_CLIP: 300,

  // ── TTS / Voiceover ──
  TTS_PROVIDER: "elevenlabs" as "elevenlabs" | "browser",
  TTS_VOICE_STYLE: "friendly local owner" as "friendly local owner" | "polished announcer",
  /** ElevenLabs voice ID — "George" warm male voice */
  ELEVENLABS_VOICE_ID: "JBFqnCBsd6RMkjVDRZzb",
  ELEVENLABS_MODEL: "eleven_multilingual_v2",

  /** Minimum image file size in bytes to be considered "real" (not placeholder) */
  MIN_REAL_IMAGE_BYTES: 5000,
} as const;

// ═══════════════════════════════════════════════════════════════════════
// PRODUCTION PRESETS — controls video generation
// ═══════════════════════════════════════════════════════════════════════
export interface ProductionPreset {
  minDuration: number;
  sceneCount: number;
  clipDuration: 5 | 10;
  ratio: string;
  /** Estimated Manus credits this preset will use */
  estimatedCredits: number;
}

export const PRODUCTION_PRESETS: Record<string, ProductionPreset> = {
  quick:    { minDuration: 45, sceneCount: 5, clipDuration: 10, ratio: "720:1280",  estimatedCredits: 250 },
  standard: { minDuration: 60, sceneCount: 6, clipDuration: 10, ratio: "1280:720",  estimatedCredits: 300 },
  longform: { minDuration: 90, sceneCount: 9, clipDuration: 10, ratio: "1280:720",  estimatedCredits: 450 },
};

// ═══════════════════════════════════════════════════════════════════════
// (a) MARKETING SCRIPT TEMPLATE — six-beat structure
// ═══════════════════════════════════════════════════════════════════════
export interface ScriptBeat {
  beatId: "hook" | "problem" | "positioning" | "proof" | "offer" | "signoff";
  label: string;
  targetSeconds: number;
  guideline: string;
}

export const MARKETING_SCRIPT_BEATS: ScriptBeat[] = [
  {
    beatId: "hook",
    label: "Intro Hook",
    targetSeconds: 8,
    guideline: "1–2 punchy sentences that grab attention. Ask a question or make a bold claim.",
  },
  {
    beatId: "problem",
    label: "Problem / Desire",
    targetSeconds: 10,
    guideline: "1–2 sentences identifying the viewer's pain point or desire that this business solves.",
  },
  {
    beatId: "positioning",
    label: "Brand Positioning",
    targetSeconds: 15,
    guideline: "Who we are, why trust us. Establish credibility with a warm, confident tone.",
  },
  {
    beatId: "proof",
    label: "Proof / Specifics",
    targetSeconds: 25,
    guideline: "Show specifics — menu items, features, social proof, numbers, awards. Multiple quick scenes.",
  },
  {
    beatId: "offer",
    label: "Offer + Call to Action",
    targetSeconds: 15,
    guideline: "Clear CTA — visit, order, call. Include any current promotion or offer.",
  },
  {
    beatId: "signoff",
    label: "Tagline / Sign-off",
    targetSeconds: 10,
    guideline: "Memorable tagline, logo, and business info. Leave a lasting impression.",
  },
];

// ═══════════════════════════════════════════════════════════════════════
// (b) VISUAL SCENE TEMPLATE — each scene for Manus AI
// ═══════════════════════════════════════════════════════════════════════
export interface VisualScene {
  /** Sequential scene ID */
  sceneId: number;
  /** When this scene starts in the final video (seconds) */
  startTime: number;
  /** When this scene ends in the final video (seconds) */
  endTime: number;
  /** Vivid description for Manus AI: setting, people, camera movement, mood, lighting */
  visualPrompt: string;
  /** Camera style directive (e.g., slow push-in, lateral tracking, overhead, handheld) */
  cameraStyle: string;
  /** Short phrase shown on screen during this scene */
  textOverlay: string;
  /** Exact voiceover line spoken during this scene */
  voiceLine: string;
  /** Which beat of the marketing script this scene belongs to */
  beatId: string;
  /** Priority shot type for visual variety */
  priorityShot: "product_closeup" | "people" | "environment" | "action" | "branding";
}

// ═══════════════════════════════════════════════════════════════════════
// (c) AUDIO / VOICEOVER TEMPLATE — TTS alignment with timestamps
// ═══════════════════════════════════════════════════════════════════════
export interface VoiceoverSegment {
  sceneId: number;
  startTime: number;
  endTime: number;
  text: string;
  speakerStyle: "friendly local owner" | "polished announcer";
}

export function buildVoiceoverSegments(scenes: VisualScene[]): VoiceoverSegment[] {
  return scenes.map((s) => ({
    sceneId: s.sceneId,
    startTime: s.startTime,
    endTime: s.endTime,
    text: s.voiceLine,
    speakerStyle: VIDEO_CONFIG.TTS_VOICE_STYLE,
  }));
}

export function buildFullVoiceoverScript(scenes: VisualScene[]): string {
  return scenes.map((s) => s.voiceLine).filter(Boolean).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════
// BUSINESS PROFILE — input for all template builders
// ═══════════════════════════════════════════════════════════════════════
export interface BusinessProfile {
  businessName: string;
  category?: string;
  services?: string;
  targetAudience?: string;
  brandTone?: string;
  city?: string;
  state?: string;
  competitors?: string;
  contentGoals?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// CAMERA STYLES & SHOT TYPES — cycled for visual variety
// ═══════════════════════════════════════════════════════════════════════
const CAMERA_STYLES = [
  "slow push-in towards subject, cinematic depth",
  "lateral tracking shot, smooth dolly movement left to right",
  "overhead crane shot looking down at 45-degree angle",
  "handheld natural movement, intimate documentary feel",
  "slow pull-back reveal, widening from detail to full scene",
  "dolly-in extreme close-up with shallow depth of field",
  "steadicam walk-through following a person",
  "rack focus transition from foreground to background",
  "slow pan right across the scene, golden hour lighting",
  "static wide establishing shot, symmetrical composition",
];

const PRIORITY_SHOTS: VisualScene["priorityShot"][] = [
  "environment", "people", "product_closeup", "action",
  "product_closeup", "people", "environment", "people",
  "action", "branding",
];

// ═══════════════════════════════════════════════════════════════════════
// SCENE PLAN BUILDER — works for ANY business
// ═══════════════════════════════════════════════════════════════════════
export function buildScenePlan(
  business: BusinessProfile,
  sceneCount: number,
  clipDuration: number,
): VisualScene[] {
  const name = business.businessName || "Our Business";
  const cat = business.category || "business";
  const svc = business.services || "premium services";
  const audience = business.targetAudience || "customers";
  const city = business.city || "your area";
  const tone = business.brandTone || "professional";
  const svcList = svc.split(",").map(s => s.trim()).filter(Boolean);
  const primarySvc = svcList[0] || "our signature offering";
  const secondarySvc = svcList.length > 1 ? svcList.slice(0, 2).join(" and ") : primarySvc;

  // 10 template scenes covering all 6 marketing beats
  const allScenes: Omit<VisualScene, "sceneId" | "startTime" | "endTime">[] = [
    // ── HOOK (1 scene) ──
    {
      visualPrompt: `Stunning golden-hour exterior of ${name} storefront. Warm amber light glows through clean windows, neon "OPEN" sign visible. ${city} street life bustling softly in background. Inviting signage prominent. Shot feels like discovering a hidden gem.`,
      cameraStyle: "slow push-in towards subject, cinematic depth",
      textOverlay: name,
      voiceLine: `Looking for the best ${cat} in ${city}? Look no further.`,
      beatId: "hook",
      priorityShot: "environment",
    },
    // ── PROBLEM / DESIRE (1 scene) ──
    {
      visualPrompt: `Close-up of a real person's face lighting up with delight as they experience ${name} for the first time. Genuine warm smile, shallow depth of field, natural soft window light. Authentic candid moment of discovery and satisfaction.`,
      cameraStyle: "handheld natural movement, intimate documentary feel",
      textOverlay: `The ${cat} You Deserve`,
      voiceLine: `You deserve a ${cat} experience that actually delivers — quality you can see, taste, and feel.`,
      beatId: "problem",
      priorityShot: "people",
    },
    // ── POSITIONING (2 scenes) ──
    {
      visualPrompt: `The owner or lead team member at ${name} warmly greeting customers at the entrance. ${tone} atmosphere, polished interior visible behind them. Authentic leadership moment, confident body language, warm interior lighting.`,
      cameraStyle: "steadicam walk-through following a person",
      textOverlay: `Welcome to ${name}`,
      voiceLine: `Welcome to ${name}. We've been proudly serving ${city} with passion and dedication.`,
      beatId: "positioning",
      priorityShot: "people",
    },
    {
      visualPrompt: `Behind-the-scenes craftsmanship at ${name}. Skilled hands working with care and precision. Detail-oriented process shot showing real expertise. Cinematic shallow focus with bokeh background. Steam, texture, or motion adding life.`,
      cameraStyle: "dolly-in extreme close-up with shallow depth of field",
      textOverlay: "Crafted with Care",
      voiceLine: `Every detail is crafted with care, because your experience matters most to us.`,
      beatId: "positioning",
      priorityShot: "action",
    },
    // ── PROOF / SPECIFICS (3 scenes) ──
    {
      visualPrompt: `Magazine-quality hero shot of ${name}'s signature ${primarySvc}. Dramatic rim lighting, rich vibrant colors, steam or sparkle adding texture. Product fills 70% of frame. Background softly blurred. Appetizing, aspirational, premium.`,
      cameraStyle: "slow pan right across the scene, golden hour lighting",
      textOverlay: primarySvc,
      voiceLine: `From ${svc}, we bring you only the best.`,
      beatId: "proof",
      priorityShot: "product_closeup",
    },
    {
      visualPrompt: `Group of happy ${audience} enjoying their experience at ${name}. Friends or family laughing together. Natural candid moment, warm ambient light. Diverse group, genuine expressions of joy. Lifestyle photography feel.`,
      cameraStyle: "lateral tracking shot, smooth dolly movement left to right",
      textOverlay: "Happy Customers",
      voiceLine: `Our ${audience} love what we do — and their smiles say it all.`,
      beatId: "proof",
      priorityShot: "people",
    },
    {
      visualPrompt: `Quick montage-style collage of ${name}'s various offerings. Multiple products/services shown in dynamic composition. Vibrant saturated colors, varied angles (top-down, 45-degree, side). Each item beautifully lit and styled.`,
      cameraStyle: "rack focus transition from foreground to background",
      textOverlay: "Something for Everyone",
      voiceLine: `Whether it's ${secondarySvc}, there's something for everyone.`,
      beatId: "proof",
      priorityShot: "product_closeup",
    },
    // ── OFFER + CTA (1 scene) ──
    {
      visualPrompt: `Inviting wide shot of ${name}'s interior or main service area. ${tone} atmosphere with warm pendant lighting. Clean, welcoming space ready for customers. Table settings or display areas perfectly arranged. A sense of anticipation.`,
      cameraStyle: "overhead crane shot looking down at 45-degree angle",
      textOverlay: "Visit Us Today!",
      voiceLine: `Come visit ${name} today and experience the difference for yourself.`,
      beatId: "offer",
      priorityShot: "environment",
    },
    // ── SIGNOFF (2 scenes) ──
    {
      visualPrompt: `${name} logo or storefront signage. Beautiful bokeh circles of warm light in background. Elegant branding moment at golden hour. Clean, recognizable, memorable. The sign glows with pride.`,
      cameraStyle: "slow pull-back reveal, widening from detail to full scene",
      textOverlay: `${name} — ${city}`,
      voiceLine: `${name}. Your go-to ${cat} in ${city}. See you soon!`,
      beatId: "signoff",
      priorityShot: "branding",
    },
    {
      visualPrompt: `Final beauty shot: exterior of ${name} at twilight. Warm lights glowing from within, the street alive with soft energy. Cinematic ultra-wide lens with slight lens flare. Feeling of a place you want to return to.`,
      cameraStyle: "slow pull-back reveal, widening from detail to full scene",
      textOverlay: name,
      voiceLine: `${name} — where every visit is worth it.`,
      beatId: "signoff",
      priorityShot: "environment",
    },
  ];

  // Select exactly sceneCount scenes
  const selected = allScenes.slice(0, sceneCount);
  while (selected.length < sceneCount) {
    selected.push(allScenes[selected.length % allScenes.length]);
  }

  return selected.map((s, i) => ({
    ...s,
    sceneId: i + 1,
    startTime: i * clipDuration,
    endTime: (i + 1) * clipDuration,
    cameraStyle: s.cameraStyle || CAMERA_STYLES[i % CAMERA_STYLES.length],
    priorityShot: s.priorityShot || PRIORITY_SHOTS[i % PRIORITY_SHOTS.length],
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// AI SCRIPT PROMPT BUILDER — enforces six-beat marketing structure
// ═══════════════════════════════════════════════════════════════════════
export function buildAIScriptPrompt(
  business: BusinessProfile,
  preset: ProductionPreset,
): string {
  const beatDescriptions = MARKETING_SCRIPT_BEATS.map(
    (b) => `- ${b.label} (~${b.targetSeconds}s): ${b.guideline}`
  ).join("\n");

  return `Create a ${preset.minDuration}-second promotional video script for:

Business: ${business.businessName}
Category: ${business.category || "General"}
Services: ${business.services || "Not specified"}
Target Audience: ${business.targetAudience || "General"}
Brand Tone: ${business.brandTone || "Professional"}
Location: ${business.city || ""}${business.state ? `, ${business.state}` : ""}

The script MUST follow this six-beat marketing structure:
${beatDescriptions}

Return JSON with:
{
  "title": "video title",
  "description": "short description",
  "voiceover_script": "complete narration, ${preset.minDuration >= 60 ? "100-150" : "60-80"} words, spoken by a ${VIDEO_CONFIG.TTS_VOICE_STYLE}",
  "scenes": [
    {
      "scene_number": 1,
      "duration_seconds": ${preset.clipDuration},
      "visual_description": "VERY vivid scene description: setting, people, camera movement, mood, lighting, textures, colors. Be specific enough that Runway can generate a compelling video clip.",
      "text_overlay": "short phrase for on-screen text (3-5 words max)",
      "camera_direction": "specific camera style e.g. slow push-in, lateral tracking, overhead crane",
      "voiceover_line": "exact narration line for this scene",
      "beat_id": "hook|problem|positioning|proof|offer|signoff",
      "priority_shot": "product_closeup|people|environment|action|branding"
    }
  ],
  "scene_captions": ["voiceover line 1", "voiceover line 2", ...],
  "caption": "social media caption with emojis and hashtags",
  "hashtags": ["relevant", "hashtags"],
  "target_platform": "instagram",
  "aspect_ratio": "${preset.ratio.includes("720:1280") ? "9:16" : "16:9"}",
  "music_mood": "upbeat",
  "cta": "call to action text"
}

Generate exactly ${preset.sceneCount} scenes. Each scene is ${preset.clipDuration} seconds.
Every scene MUST have a voiceover_line. The scene_captions array must match voiceover_line from each scene.`;
}

// ═══════════════════════════════════════════════════════════════════════
// PRE-FLIGHT COST ESTIMATE — show user before burning credits
// ═══════════════════════════════════════════════════════════════════════
export interface PreflightEstimate {
  presetName: string;
  sceneCount: number;
  clipDuration: number;
  totalDuration: number;
  estimatedRunwayCredits: number;
  hasRunwayKey: boolean;
  hasElevenLabsKey: boolean;
  scenes: VisualScene[];
  voiceoverScript: string;
}

export function buildPreflightEstimate(
  business: BusinessProfile,
  presetName: string,
  hasRunwayKey: boolean,
  hasElevenLabsKey: boolean,
): PreflightEstimate {
  const preset = PRODUCTION_PRESETS[presetName] || PRODUCTION_PRESETS.standard;
  const scenes = buildScenePlan(business, preset.sceneCount, preset.clipDuration);
  const voiceoverScript = buildFullVoiceoverScript(scenes);

  return {
    presetName,
    sceneCount: preset.sceneCount,
    clipDuration: preset.clipDuration,
    totalDuration: preset.sceneCount * preset.clipDuration,
    estimatedRunwayCredits: hasRunwayKey ? preset.estimatedCredits : 0,
    hasRunwayKey,
    hasElevenLabsKey,
    scenes,
    voiceoverScript,
  };
}
