import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanKey } from "@/lib/stripe";
import { planDisplayName } from "@/lib/entitlements";

interface LockedStepProps {
  stepName: string;
  requiredPlan?: PlanKey;
  reason: "trial" | "no_plan" | "plan_limit" | "addon_required";
  onUpgrade?: () => void;
}

export function LockedStep({ stepName, requiredPlan, reason, onUpgrade }: LockedStepProps) {
  const getHeadline = () => {
    if (reason === "no_plan") return "Subscription required";
    if (reason === "trial") return "Upgrade to unlock";
    if (reason === "addon_required") return "Add-on required";
    return "Upgrade to unlock";
  };

  const getBody = () => {
    if (reason === "no_plan") {
      return "Choose a plan to get started with this feature.";
    }
    if (reason === "addon_required") {
      return `${stepName} requires a paid add-on. Upgrade your plan to enable it.`;
    }
    if (requiredPlan) {
      return `${stepName} is available on the ${planDisplayName(requiredPlan)} plan and above.`;
    }
    return `${stepName} requires a higher plan tier.`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 p-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>

      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">{getHeadline()}</h2>
        <p className="text-muted-foreground">{getBody()}</p>
      </div>

      <Button onClick={onUpgrade ?? (() => window.location.href = "/app?section=ready")}>
        View Plans
      </Button>
    </div>
  );
}
