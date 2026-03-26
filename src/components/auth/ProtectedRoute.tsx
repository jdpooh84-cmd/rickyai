import { ReactNode, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, PlanKey } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Crown } from "lucide-react";

const planOptions: { key: PlanKey; label: string; price: string }[] = [
  { key: "creator", label: "Creator", price: "$59/mo" },
  { key: "business", label: "Business Starter", price: "$169/mo" },
  { key: "growth", label: "Growth", price: "$249/mo" },
  { key: "agency", label: "Agency", price: "$799/mo" },
];

const SubscriptionPaywall = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("creator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signOut } = useAuth();

  const handleSubscribe = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: PLANS[selectedPlan].price_id },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      setError(err.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">Your Trial Has Ended</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a plan to continue using RickyAI. Your data is safe and waiting.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {planOptions.map(({ key, label, price }) => (
              <button
                key={key}
                onClick={() => setSelectedPlan(key)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedPlan === key
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="text-sm font-bold text-foreground">{price}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-destructive mb-4">{error}</p>}
          <Button variant="hero" className="w-full" size="lg" onClick={handleSubscribe} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <>Subscribe to {PLANS[selectedPlan].name} <ArrowRight className="w-4 h-4" /></>}
          </Button>
          <button onClick={signOut} className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, subscription, hasAccess } = useAuth();
  const hasRenderedOnce = useRef(false);

  // Only show spinner on initial load, not on subscription re-checks
  const isInitialLoad = loading || (!hasRenderedOnce.current && subscription.loading);

  if (isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-hero animate-pulse" />
          <span className="text-muted-foreground text-sm">Loading RickyAI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show paywall if trial expired and no active subscription
  if (!subscription.loading && !hasAccess) {
    return <SubscriptionPaywall />;
  }

  // Mark that we've rendered children at least once
  hasRenderedOnce.current = true;

  return <>{children}</>;
};

export default ProtectedRoute;