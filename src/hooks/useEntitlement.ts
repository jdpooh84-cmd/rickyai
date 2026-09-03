import { useAuth } from "@/contexts/AuthContext";
import { canAccessStep, canAccessAddon, EntitlementResult } from "@/lib/entitlements";
import { PlanKey } from "@/lib/stripe";

/**
 * Hook that reads the current subscription from AuthContext and returns
 * entitlement helpers bound to the authenticated user's plan.
 */
export function useEntitlement() {
  const { subscription } = useAuth();

  const plan = subscription.plan as PlanKey | null;
  const trialActive = subscription.trialActive ?? false;
  const addOns: string[] = (subscription as any).addOns ?? [];

  return {
    /** Check whether the user may access a numbered dashboard step. */
    checkStep: (stepNum: number): EntitlementResult =>
      canAccessStep(stepNum, plan, trialActive, addOns),

    /** Check whether the user has an active add-on. */
    checkAddon: (addonKey: "federal_contracting" | "grant_intel"): EntitlementResult =>
      canAccessAddon(addonKey, plan, addOns, trialActive),

    /** True if the user has any active subscription or trial. */
    hasAccess: subscription.subscribed || trialActive,

    plan,
    trialActive,
  };
}
