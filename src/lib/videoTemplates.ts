/**
 * Video Production Templates — Ricky.AI
 *
 * Reusable, structured templates that every video must follow.
 * These are business-agnostic: plug in any business profile to generate
 * a marketing script, visual scene plan, and audio brief.
 *
 * ── Configuration ──────────────────────────────────────────────────────
 */

// ── Runtime & cost controls ──
export const VIDEO_CONFIG = {
  /** Minimum allowed video length in seconds */
  MIN_DURATION_SECONDS: 45,
  /** Default target video length in seconds */
  DEFAULT_DURATION_SECONDS: 90,
  /** Maximum scenes per video (controls Runway API call count) */
  MAX_SCENES: 10,
  /** Runway model identifier */
  RUNWAY_MODEL: "gen4_turbo",
  /** Runway aspect ratios */
  RUNWAY_RATIO_LANDSCAPE: "1280:720",
  RUNWAY_RATIO_VERTICAL: "720:1280",
  /** Clip duration sent to Runway (5 or 10 seconds) */
  RUNWAY_CLIP_DURATION: 10 as 5 | 10,
  /** TTS provider — "elevenlabs" when key is present, "browser" as fallback */
  TTS_PROVIDER: "elevenlabs" as "elevenlabs" | "browser",
  /** Default TTS voice style */
  TTS_VOICE_STYLE: "friendly local owner" as "friendly local owner" | "polished announcer",
  /** ElevenLabs voice ID — "George" warm male voice */
  ELEVENLABS_VOICE_ID: "JBFqnCBsd6RMkjVDRZzb",
  /** ElevenLabs model */
  ELEVENLABS_MODEL: "eleven_multilingual_v2",
} as const;

// ── Production mode presets ──
export interface ProductionPreset {
  /** Minimum video length in seconds */
  minDuration: number;
  /** Number of scenes (= number of Runway API calls) */
  sceneCount: number;
  /** Duration per Runway clip (5 or 10 seconds) */
  clipDuration: 5 | 10;
  /** Runway aspect ratio string */
  ratio: string;
}

export const PRODUCTION_PRESETS: Record<string, ProductionPreset> = {
  quick:    { minDuration: 45, sceneCount: 5, clipDuration: 10, ratio: "720:1280" },
  standard: { minDuration: 60, sceneCount: 6, clipDuration: 10, ratio: "1280:720" },
  longform: { minDuration: 90, sceneCount: 9, clipDuration: 10, ratio: "1280:720" },
};

/**
 * ── (a) Marketing Script Template ──────────────────────────────────────
 *
 * Six-beat structure every promotional script must follow.
 * AI or template builder must produce content for each beat.
 */
export interface ScriptBeat {
  /** Unique beat identifier */
  beatId: "hook" | "problem" | "positioning" | "proof" | "offer" | "signoff";
  /** Human label */
  label: string;
  /** How long this beat should last on screen (seconds) */
  targetSeconds: number;
  /** Guideline for the copywriter (AI or human) */
  guideline: string;
}

export const MARKETING_SCRIPT_BEATS: ScriptBeat[] = [
  {
    beatId: "hook",
    label: "Intro Hook",
    targetSeconds: 8,
    guideline: "1–2 punchy sentences that grab attention. Ask a question or make a bold claim. 3–5 seconds of screen time.",
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

/**
 * ── (b) Visual Scene Template ──────────────────────────────────────────
 *
 * Each scene sent to Runway follows this structure.
 */
export interface VisualScene {
  /** Sequential scene ID */
  sceneId: number;
  /** When this scene starts in the final video (seconds) */
  startTime: number;
  /** When this scene ends in the final video (seconds) */
  endTime: number;
  /** Vivid description for Runway: setting, people, camera movement, mood, lighting */
  visualPrompt: string;
  /** Camera style directive */
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

/**
 * ── (c) Audio / Voiceover Template ─────────────────────────────────────
 *
 * Derived from the scene list — maps voiceLine + timestamps for TTS alignment.
 */
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

/**
 * ── Business-agnostic scene builder ────────────────────────────────────
 *
 * Takes any business profile and returns a complete scene plan
 * following the marketing script beats.
 */
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

/**
 * Camera style options to cycle through for visual variety.
 */
const CAMERA_STYLES = [
  "slow push-in",
  "lateral tracking shot",
  "overhead crane shot",
  "handheld natural movement",
  "slow pull-back reveal",
  "dolly-in close-up",
  "steadicam walk-through",
  "rack focus transition",
  "slow pan right",
  "static wide establishing",
];

/**
 * Priority shot types to cycle through for visual variety.
 */
const PRIORITY_SHOTS: VisualScene["priorityShot"][] = [
  "environment",
  "people",
  "product_closeup",
  "action",
  "product_closeup",
  "people",
  "environment",
  "people",
  "action",
  "branding",
];

/**
 * Builds a complete scene plan from a business profile.
 * Returns exactly `sceneCount` scenes totaling `clipDuration * sceneCount` seconds.
 */
export function buildScenePlan(
  business: BusinessProfile,
  sceneCount: number,
  clipDuration: number,
): VisualScene[] {
  const name = business.businessName || "Our Business";
  const cat = business.category || "business";
  const svc = business.services || "premium services";
  const audience = business.targetAudience || "customers";
  const city = business.city || "";
  const tone = business.brandTone || "professional";
  const cityLabel = city || "your area";

  // Template scenes mapped to marketing beats
  const allScenes: Omit<VisualScene, "sceneId" | "startTime" | "endTime">[] = [
    // HOOK (1-2 scenes)
    {
      visualPrompt: `Stunning golden-hour exterior of ${name} storefront, warm amber lighting glowing through windows, ${city} street life in background, inviting signage`,
      cameraStyle: "slow push-in",
      textOverlay: name,
      voiceLine: `Looking for the best ${cat} in ${cityLabel}? Look no further.`,
      beatId: "hook",
      priorityShot: "environment",
    },
    // PROBLEM / DESIRE
    {
      visualPrompt: `Close-up of a person looking delighted as they discover ${name}, genuine smile, shallow depth of field, natural warm light`,
      cameraStyle: "handheld natural movement",
      textOverlay: `The ${cat} You Deserve`,
      voiceLine: `You deserve a ${cat} experience that actually delivers — quality you can see, taste, and feel.`,
      beatId: "problem",
      priorityShot: "people",
    },
    // POSITIONING (1-2 scenes)
    {
      visualPrompt: `Owner or team member at ${name} greeting customers with confidence, ${tone} atmosphere, warm interior lighting, authentic candid moment`,
      cameraStyle: "steadicam walk-through",
      textOverlay: `Welcome to ${name}`,
      voiceLine: `Welcome to ${name}. We've been proudly serving ${cityLabel} with passion and dedication.`,
      beatId: "positioning",
      priorityShot: "people",
    },
    {
      visualPrompt: `Behind-the-scenes craftsmanship at ${name}, hands working with care, detail-oriented process shot, cinematic shallow focus`,
      cameraStyle: "dolly-in close-up",
      textOverlay: "Crafted with Care",
      voiceLine: `Every detail is crafted with care, because your experience matters most to us.`,
      beatId: "positioning",
      priorityShot: "action",
    },
    // PROOF / SPECIFICS (2-3 scenes)
    {
      visualPrompt: `Hero product shot of ${name}'s signature ${svc.split(",")[0]?.trim() || "offering"}, dramatic lighting, vibrant colors, magazine-quality close-up`,
      cameraStyle: "slow pan right",
      textOverlay: svc.split(",")[0]?.trim() || "Our Best",
      voiceLine: `From ${svc}, we bring you only the best.`,
      beatId: "proof",
      priorityShot: "product_closeup",
    },
    {
      visualPrompt: `Happy ${audience} enjoying their experience at ${name}, group of friends or family, laughter, natural candid photography style`,
      cameraStyle: "lateral tracking shot",
      textOverlay: "Happy Customers",
      voiceLine: `Our ${audience} love what we do — and their smiles say it all.`,
      beatId: "proof",
      priorityShot: "people",
    },
    {
      visualPrompt: `Montage-style detail shots of ${name}'s various offerings, quick-cut between ${svc}, vibrant saturated colors, dynamic angles`,
      cameraStyle: "rack focus transition",
      textOverlay: "Something for Everyone",
      voiceLine: `Whether it's ${svc.split(",").slice(0, 2).join(" or ").trim()}, there's something for everyone.`,
      beatId: "proof",
      priorityShot: "product_closeup",
    },
    // OFFER + CTA
    {
      visualPrompt: `Inviting wide shot of ${name}'s interior or service area, ${tone} atmosphere, warm lighting, seats or counter ready for customers`,
      cameraStyle: "overhead crane shot",
      textOverlay: "Visit Us Today!",
      voiceLine: `Come visit ${name} today and experience the difference for yourself.`,
      beatId: "offer",
      priorityShot: "environment",
    },
    // SIGN-OFF (1-2 scenes)
    {
      visualPrompt: `${name} logo or storefront signage with beautiful bokeh background, elegant branding moment, golden hour, ${city}`,
      cameraStyle: "slow pull-back reveal",
      textOverlay: `${name} — ${cityLabel}`,
      voiceLine: `${name}. Your go-to ${cat} in ${cityLabel}. See you soon!`,
      beatId: "signoff",
      priorityShot: "branding",
    },
    {
      visualPrompt: `Final beauty shot — exterior of ${name} at twilight, lights glowing warmly, the street alive with energy, cinematic wide lens`,
      cameraStyle: "slow pull-back reveal",
      textOverlay: name,
      voiceLine: `${name} — where every visit is worth it.`,
      beatId: "signoff",
      priorityShot: "environment",
    },
  ];

  // Take exactly sceneCount scenes, cycling if needed
  const selected = allScenes.slice(0, sceneCount);
  while (selected.length < sceneCount) {
    selected.push(allScenes[selected.length % allScenes.length]);
  }

  // Assign IDs and timestamps
  return selected.map((s, i) => ({
    ...s,
    sceneId: i + 1,
    startTime: i * clipDuration,
    endTime: (i + 1) * clipDuration,
    cameraStyle: s.cameraStyle || CAMERA_STYLES[i % CAMERA_STYLES.length],
    priorityShot: s.priorityShot || PRIORITY_SHOTS[i % PRIORITY_SHOTS.length],
  }));
}

/**
 * Builds the AI prompt for script generation, enforcing the marketing beats.
 */
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
      "visual_description": "vivid scene description with setting, people, camera movement, mood, lighting",
      "text_overlay": "short phrase for on-screen text",
      "camera_direction": "camera style e.g. slow push-in, lateral tracking",
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
