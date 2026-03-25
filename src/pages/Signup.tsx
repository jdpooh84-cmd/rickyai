import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Eye, EyeOff, Check, Mail, Loader2 } from "lucide-react";
import { PLANS, PlanKey } from "@/lib/stripe";

const Signup = () => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [checkingTrial, setCheckingTrial] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(true);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const checkTrialEligibility = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return;
    setCheckingTrial(true);
    try {
      const { data } = await supabase.rpc("check_trial_used", { check_email: emailToCheck });
      setTrialUsed(!!data);
    } catch (err) {
      console.warn("Trial check failed, defaulting to eligible:", err);
      setTrialUsed(false);
    }
    setCheckingTrial(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (trialUsed && !selectedPlan) {
      setError("Please select a plan to continue");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, displayName);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a confirmation link to <span className="text-foreground font-medium">{email}</span>.
              Click it to activate your account{!trialUsed ? " and start your 7-day free trial" : ""}.
            </p>
            {emailMarketingOptIn && (
              <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1">
                <Mail className="w-3 h-3" /> You'll also receive tips & updates. Unsubscribe anytime.
              </p>
            )}
            <Button variant="outline" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">P</span>
          </div>
          <span className="font-display font-bold text-2xl text-foreground">PulseCore</span>
        </div>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold font-display text-foreground text-center mb-2">
            {trialUsed ? "Choose Your Plan" : "Start your free trial"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {trialUsed
              ? "Your free trial has been used. Select a plan to continue."
              : "7 days free. No credit card required."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => checkTrialEligibility(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {checkingTrial && (
                <p className="text-xs text-muted-foreground mt-1">Checking eligibility...</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {trialUsed && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Select Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("monthly")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedPlan === "monthly"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="text-sm font-bold text-foreground">{PLANS.monthly.price}{PLANS.monthly.period}</p>
                    <p className="text-xs text-muted-foreground">Monthly</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("annual")}
                    className={`p-3 rounded-lg border text-left transition-all relative ${
                      selectedPlan === "annual"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="absolute -top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                      Save 25%
                    </span>
                    <p className="text-sm font-bold text-foreground">{PLANS.annual.price}{PLANS.annual.period}</p>
                    <p className="text-xs text-muted-foreground">Billed annually</p>
                  </button>
                </div>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={emailMarketingOptIn}
                onChange={(e) => setEmailMarketingOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                Send me growth tips, strategy insights, and product updates. You can unsubscribe at any time.
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
            )}

            <Button variant="hero" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : trialUsed ? (
                <>Continue with {selectedPlan === "annual" ? "Annual" : "Monthly"} Plan <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Start 7-Day Free Trial <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          {!trialUsed && (
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {["13-Step System", "Ricky AI Guide", "Lead Scout", "Grant Search"].map((f) => (
                <span key={f} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {f}
                </span>
              ))}
            </div>
          )}

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
