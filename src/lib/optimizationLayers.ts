/**
 * Maps each of the 14 growth steps to one or more optimization layers.
 * These labels appear as badges in the sidebar & landing page to show
 * the full scope of the engine beyond basic visibility.
 */

export type OptLayer =
  | "SEO"   // Search Engine Optimization
  | "GEO"   // Generative Engine Optimization
  | "AEO"   // Answer Engine Optimization
  | "SGE"   // Search Generative Experience
  | "LMO"   // Local Market Optimization
  | "RMO"   // Reputation Management Optimization
  | "CRO"   // Conversion Rate Optimization
  | "DMO"   // Data Monetization Optimization
  | "CAO"   // Community Authority Optimization
  | "PAO";  // Platform Amplification Optimization

export const LAYER_META: Record<OptLayer, { label: string; color: string }> = {
  SEO: { label: "SEO", color: "bg-blue-500/15 text-blue-400" },
  GEO: { label: "GEO", color: "bg-violet-500/15 text-violet-400" },
  AEO: { label: "AEO", color: "bg-indigo-500/15 text-indigo-400" },
  SGE: { label: "SGE", color: "bg-purple-500/15 text-purple-400" },
  LMO: { label: "LMO", color: "bg-emerald-500/15 text-emerald-400" },
  RMO: { label: "RMO", color: "bg-amber-500/15 text-amber-400" },
  CRO: { label: "CRO", color: "bg-rose-500/15 text-rose-400" },
  DMO: { label: "DMO", color: "bg-cyan-500/15 text-cyan-400" },
  CAO: { label: "CAO", color: "bg-orange-500/15 text-orange-400" },
  PAO: { label: "PAO", color: "bg-pink-500/15 text-pink-400" },
};

export interface StepOptMapping {
  stepNum: number;
  layers: OptLayer[];
}

/** Which optimization layers each step powers */
export const STEP_LAYERS: StepOptMapping[] = [
  { stepNum: 1,  layers: [] },                             // Connect (setup)
  { stepNum: 2,  layers: ["LMO"] },                        // Profile → local identity
  { stepNum: 3,  layers: ["SEO", "GEO", "AEO", "SGE"] },  // Compete → visibility grade
  { stepNum: 4,  layers: ["LMO", "CAO"] },                 // Scout → local conversations
  { stepNum: 5,  layers: ["RMO", "SEO"] },                 // Audit → reputation gaps
  { stepNum: 6,  layers: ["PAO", "CRO"] },                 // Platform → where to post
  { stepNum: 7,  layers: ["CRO", "PAO"] },                 // Script → conversion copy
  { stepNum: 8,  layers: ["PAO", "CRO"] },                 // Video Studio → amplify
  { stepNum: 9,  layers: ["PAO"] },                        // Storyboard → visual plan
  { stepNum: 10, layers: ["PAO"] },                        // Export → distribute
  { stepNum: 11, layers: ["CAO", "LMO"] },                 // Lead Scout → community partners
  { stepNum: 12, layers: ["DMO"] },                        // Grant Search → funding data
  { stepNum: 13, layers: ["SEO", "GEO", "AEO", "SGE"] },  // Search Visibility
  { stepNum: 14, layers: ["CRO", "DMO", "PAO"] },         // Campaign Blueprint → full funnel
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
