import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, FileText, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const CURRENT_TOS_VERSION = "1.0";

interface TermsAcceptanceGateProps {
  children: React.ReactNode;
}

const TermsAcceptanceGate = ({ children }: TermsAcceptanceGateProps) => {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("tos_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("tos_version", CURRENT_TOS_VERSION)
        .maybeSingle();
      setAccepted(!!data);
    };
    check();
  }, [user]);

  const handleAccept = async () => {
    if (!user || !checked) return;
    setSubmitting(true);
    const { error } = await supabase.from("tos_acceptances").insert({
      user_id: user.id,
      tos_version: CURRENT_TOS_VERSION,
      user_agent: navigator.userAgent,
    });
    if (error) {
      toast.error("Failed to record acceptance");
      setSubmitting(false);
      return;
    }
    setAccepted(true);
    toast.success("Terms accepted — welcome to RickyAI!");
  };

  if (accepted === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (accepted) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="glass rounded-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">R</span>
            </div>
            <span className="font-display font-bold text-2xl text-foreground">RickyAI</span>
          </div>

          <h1 className="text-xl font-bold font-display text-foreground text-center mb-2">
            User Agreement Required
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Please review and accept our Terms of Service before continuing.
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
              <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Terms of Service</p>
                <p className="text-xs text-muted-foreground">
                  Covers platform usage, content policies, and your responsibilities.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
              <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">API Key Protection & Liability</p>
                <p className="text-xs text-muted-foreground">
                  You are solely responsible for protecting your API keys. The Company is not liable for any loss or misuse.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
              <AlertTriangle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Results & Location Disclaimer</p>
                <p className="text-xs text-muted-foreground">
                  Results are not guaranteed and may vary by location, niche, and audience. Posting times differ by market.
                  This is not professional advice.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Content Policy & Enforcement</p>
                <p className="text-xs text-muted-foreground">
                  Illegal or inappropriate content results in progressive bans: 24hr → 30 days → permanent.
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/terms"
            target="_blank"
            className="text-sm text-primary hover:underline block text-center mb-4"
          >
            Read Full Terms of Service →
          </Link>

          <label className="flex items-start gap-3 cursor-pointer mb-4 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
            />
            <span className="text-xs text-muted-foreground leading-snug">
              I have read and agree to the <strong className="text-foreground">Terms of Service</strong>,
              including the API Key Responsibility clause, Results Disclaimer (results may vary by location,
              niche, and audience), Content Policy, No Professional Advice disclaimer, Dispute Resolution
              (Binding Arbitration & Class Action Waiver), and Limitation of Liability provisions.
            </span>
          </label>

          <Button
            variant="hero"
            className="w-full"
            size="lg"
            disabled={!checked || submitting}
            onClick={handleAccept}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
              <><Check className="w-4 h-4" /> Accept & Continue</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TermsAcceptanceGate;
