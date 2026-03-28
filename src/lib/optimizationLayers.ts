/**
 * Maps each growth step to the 12-pillar Omni Search & Conversion Optimizer framework.
 * Tiered: SMB users see simplified labels; premium users get full enterprise detail.
 */

export type OptLayer =
  | "SEO"   // Search Engine Optimization
  | "GEO"   // Generative Engine Optimization
  | "AEO"   // Answer Engine Optimization
  | "SGE"   // Search Generative Experience / AI Overviews
  | "LLMO"  // Large Language Model Optimization
  | "LMO"   // Local Market Optimization
  | "RMO"   // Reputation Management Optimization
  | "CRO"   // Conversion Rate Optimization
  | "DMO"   // Digital Marketing Orchestration
  | "CAO"   // Content Asset Optimization
  | "PAO"   // Platform Amplification Optimization
  | "MGV";  // Measurement, Governance & Forecasting

export const LAYER_META: Record<OptLayer, { label: string; color: string; description: string }> = {
  SEO:  { label: "SEO",  color: "bg-blue-500/15 text-blue-400",    description: "Search Engine Optimization" },
  GEO:  { label: "GEO",  color: "bg-violet-500/15 text-violet-400", description: "Generative Engine Optimization" },
  AEO:  { label: "AEO",  color: "bg-indigo-500/15 text-indigo-400", description: "Answer Engine Optimization" },
  SGE:  { label: "SGE",  color: "bg-purple-500/15 text-purple-400", description: "AI Overview Visibility" },
  LLMO: { label: "LLMO", color: "bg-fuchsia-500/15 text-fuchsia-400", description: "LLM Optimization" },
  LMO:  { label: "LMO",  color: "bg-emerald-500/15 text-emerald-400", description: "Local Market Optimization" },
  RMO:  { label: "RMO",  color: "bg-amber-500/15 text-amber-400",   description: "Reputation Management" },
  CRO:  { label: "CRO",  color: "bg-rose-500/15 text-rose-400",     description: "Conversion Rate Optimization" },
  DMO:  { label: "DMO",  color: "bg-cyan-500/15 text-cyan-400",     description: "Digital Marketing Orchestration" },
  CAO:  { label: "CAO",  color: "bg-orange-500/15 text-orange-400", description: "Content Asset Optimization" },
  PAO:  { label: "PAO",  color: "bg-pink-500/15 text-pink-400",     description: "Platform Amplification" },
  MGV:  { label: "MGV",  color: "bg-teal-500/15 text-teal-400",     description: "Measurement & Governance" },
};

export interface StepOptMapping {
  stepNum: number;
  layers: OptLayer[];
}

/** Which optimization layers each step powers */
export const STEP_LAYERS: StepOptMapping[] = [
  { stepNum: 1,  layers: [] },                                    // Connect (setup)
  { stepNum: 2,  layers: ["LMO", "LLMO"] },                       // Profile → local identity + entity map
  { stepNum: 3,  layers: ["SEO", "GEO", "AEO", "SGE"] },          // Compete → visibility grade
  { stepNum: 4,  layers: ["LMO", "CAO", "AEO"] },                 // Scout → local conversations + content
  { stepNum: 5,  layers: ["RMO", "SEO", "CRO", "CAO"] },          // Audit → reputation + content gaps
  { stepNum: 6,  layers: ["PAO", "CRO", "DMO"] },                 // Platform → where to post + orchestration
  { stepNum: 7,  layers: ["CRO", "PAO", "AEO"] },                 // Script → conversion copy + answer hooks
  { stepNum: 8,  layers: ["PAO", "CRO", "CAO"] },                 // Video Studio → amplify + content assets
  { stepNum: 9,  layers: ["PAO", "CAO"] },                        // Storyboard → visual plan + content
  { stepNum: 10, layers: ["PAO", "DMO"] },                        // Export → distribute + orchestrate
  { stepNum: 11, layers: ["CAO", "LMO", "RMO"] },                 // Lead Scout → community + reputation
  { stepNum: 12, layers: ["DMO"] },                                // Grant Search → funding data
  { stepNum: 13, layers: ["SEO", "GEO", "AEO", "SGE", "LLMO"] },  // Search Visibility → all search pillars
  { stepNum: 14, layers: ["CRO", "DMO", "PAO", "MGV"] },          // Campaign Blueprint → full funnel + measurement
  { stepNum: 15, layers: ["SEO", "GEO", "AEO", "SGE", "LLMO", "LMO", "RMO", "CRO", "DMO", "CAO", "PAO", "MGV"] }, // Omni Optimize → all pillars
];

export function getLayersForStep(stepNum: number): OptLayer[] {
  return STEP_LAYERS.find(s => s.stepNum === stepNum)?.layers ?? [];
}

/** Aggregate score: % of layers that have at least one completed step */
export function computeLayerCoverage(completedSteps: number[]): { covered: number; total: number; layers: Record<OptLayer, boolean> } {
  const allLayers = Object.keys(LAYER_META) as OptLayer[];
  const layerStatus = {} as Record<OptLayer, boolean>;

  for (const layer of allLayers) {
    layerStatus[layer] = STEP_LAYERS.some(
      s => s.layers.includes(layer) && completedSteps.includes(s.stepNum)
    );
  }

  const covered = allLayers.filter(l => layerStatus[l]).length;
  return { covered, total: allLayers.length, layers: layerStatus };
}

/** Auto-detect industry mode from business_category */
export type IndustryMode = "finance" | "healthcare" | "software" | "ecommerce" | "media" | "manufacturing" | "general";

const INDUSTRY_KEYWORDS: Record<IndustryMode, string[]> = {
  finance: ["bank", "fintech", "investment", "insurance", "accounting", "financial", "tax", "wealth", "fund", "etf", "advisor", "credit union", "mortgage"],
  healthcare: ["health", "medical", "dental", "pharma", "hospital", "clinic", "therapy", "wellness", "doctor", "patient", "veterinar", "chiropractic", "mental health"],
  software: ["saas", "software", "tech", "api", "cloud", "app", "digital", "it ", "cyber", "ai ", "data", "platform"],
  ecommerce: ["shop", "store", "retail", "ecommerce", "e-commerce", "marketplace", "cart", "sku", "fashion", "clothing", "jewelry", "boutique"],
  media: ["media", "streaming", "entertainment", "podcast", "video", "music", "film", "production", "broadcast", "content creator"],
  manufacturing: ["manufactur", "industrial", "factory", "oem", "plant", "wholesale", "supply chain", "logistics", "construction", "contractor"],
  general: [],
};

export function detectIndustryMode(businessCategory?: string | null, niche?: string | null, services?: string | null): IndustryMode {
  const text = `${businessCategory || ""} ${niche || ""} ${services || ""}`.toLowerCase();
  for (const [mode, keywords] of Object.entries(INDUSTRY_KEYWORDS) as [IndustryMode, string[]][]) {
    if (keywords.some(k => text.includes(k))) return mode;
  }
  return "general";
}

export const INDUSTRY_LABELS: Record<IndustryMode, string> = {
  finance: "Finance & Fintech",
  healthcare: "Healthcare & Wellness",
  software: "Software & SaaS",
  ecommerce: "Retail & Ecommerce",
  media: "Media & Entertainment",
  manufacturing: "Manufacturing & Industrial",
  general: "Local Business",
};
