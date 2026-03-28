import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ADD_ONS, AddOnKey } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Sparkles } from "lucide-react";

interface AddOnPaywallProps {
  addOnKey: AddOnKey;
  children: React.ReactNode;
}

const AddOnPaywall = ({ addOnKey, children }: AddOnPaywallProps) => {
  const { subscription, hasAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addon = ADD_ONS[addOnKey];
  const hasAddOn = subscription.activeAddOns.includes(addOnKey);

  if (hasAddOn) return <>{children}</>;

  const handlePurchase = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: addon.price_id },
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
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold font-display text-foreground">
          {addon.name}
        </h2>
        <p className="text-sm text-muted-foreground">{addon.desc}</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-primary">{addon.price}</span>
          <span className="text-muted-foreground">{addon.period}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Available as an add-on to any subscription tier
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          variant="hero"
          size="lg"
          className="w-full"
          onClick={handlePurchase}
          disabled={loading || !hasAccess}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Subscribe — {addon.price}/mo</>
          )}
        </Button>
        {!hasAccess && (
          <p className="text-xs text-muted-foreground">
            You need an active subscription or trial to purchase add-ons.
          </p>
        )}
      </div>
    </div>
  );
};

export default AddOnPaywall;