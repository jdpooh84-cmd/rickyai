import { PLANS, ADD_ONS, PlanKey } from "@/lib/stripe";

export interface EntitlementResult {
  canAccess: boolean;
  reason: "granted" | "trial" | "no_plan" | "plan_limit" | "addon_required";
  requiredPlan?: PlanKey;
}

/** Steps accessible during a free trial (before any paid plan). */
const TRIAL_STEPS = [1, 2, 6, 7, 8, 9, 10, 13] as const;

/**
 * Determine whether a given subscription state may access a dashboard step.
 * Pure function — no React, no side effects.
 */
export function canAccessStep(
  stepNum: number,
  plan: PlanKey | null,
  trialActive: boolean,
  addOns: string[] = [],
): EntitlementResult {
  // Trial access — same as Creator plan steps
  if (!plan && trialActive) {
    const allowed = (TRIAL_STEPS as readonly number[]).includes(stepNum);
    return allowed
      ? { canAccess: true, reason: "trial" }
      : { canAccess: false, reason: "plan_limit", requiredPlan: "business" };
  }

  if (!plan) {
    return { canAccess: false, reason: "no_plan" };
  }

  const planConfig = PLANS[plan];
  if (!planConfig) {
    return { canAccess: false, reason: "no_plan" };
  }

  const allowed = planConfig.steps_available.includes(stepNum);
  if (allowed) {
    return { canAccess: true, reason: "granted" };
  }

  // Find the lowest plan that includes this step
  const planOrder: PlanKey[] = ["creator", "business", "growth", "agency"];
  const requiredPlan = planOrder.find((pk) => PLANS[pk]?.steps_available.includes(stepNum));

  return { canAccess: false, reason: "plan_limit", requiredPlan };
}

/**
 * Determine whether a given subscription state has access to an add-on.
 */
export function canAccessAddon(
  addonKey: "federal_contracting" | "grant_intel",
  plan: PlanKey | null,
  addOns: string[],
  trialActive: boolean,
): EntitlementResult {
  if (!plan && !trialActive) {
    return { canAccess: false, reason: "no_plan" };
  }

  const addonConfig = ADD_ONS[addonKey];
  const hasAddon = addOns.includes(addonConfig.product_id);

  if (hasAddon) {
    return { canAccess: true, reason: "granted" };
  }

  return { canAccess: false, reason: "addon_required" };
}

/**
 * Human-readable name for a plan, used in upgrade prompt copy.
 */
export function planDisplayName(plan: PlanKey): string {
  const names: Record<PlanKey, string> = {
    creator: "Creator ($59/mo)",
    business: "Business Starter ($169/mo)",
    growth: "Growth ($249/mo)",
    agency: "Agency ($799/mo)",
  };
  return names[plan] ?? plan;
}
