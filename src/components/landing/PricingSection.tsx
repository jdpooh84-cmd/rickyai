import { Button } from "@/components/ui/button";
import { Check, Building2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PLANS } from "@/lib/stripe";

const planFeatures = [
  "Unlimited Businesses & Locations",
  "Full 14-Step Growth System",
  "AI Video Production (Free + BYOLLM)",
  "Ricky AI Guide",
  "50 Video Renders/Month",
  "500K AI Tokens/Month",
  "Lead Scout & Grant Search",
  "Search Visibility Engine",
  "Community & Marketplace",
  "HeyGen / ElevenLabs / InVideo Integration",
  "Automated Posting Pipeline",
  "Daily & Weekly Insight Reports",
];

const annualExtras = [
  "Everything in Monthly",
  "Priority Support",
  "Early Access Features",
  "Extended Usage Allowances",
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Simple, Transparent <span className="text-gradient-accent">Pricing</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start with a 7-day free trial. No credit card required. Bring your own AI keys for premium features — free tools included.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Monthly */}
          <div className="relative p-8 rounded-2xl border bg-card border-border hover:border-primary/20 transition-all duration-300">
            <h3 className="font-display font-bold text-xl text-foreground mb-1">{PLANS.monthly.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{PLANS.monthly.desc}</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-foreground">{PLANS.monthly.price}</span>
              <span className="text-muted-foreground">{PLANS.monthly.period}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">+ applicable sales tax</p>
            <Button variant="outline" className="w-full mb-6" onClick={() => navigate("/signup")}>
              Start Free Trial
            </Button>
            <ul className="space-y-3">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-secondary-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Annual */}
          <div className="relative p-8 rounded-2xl border bg-card border-primary/40 shadow-glow scale-[1.02] transition-all duration-300">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-hero text-xs font-bold text-primary-foreground">
              Save 25%
            </div>
            <h3 className="font-display font-bold text-xl text-foreground mb-1">{PLANS.annual.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{PLANS.annual.desc}</p>
            <div className="mb-1">
              <span className="text-4xl font-bold text-foreground">{PLANS.annual.price}</span>
              <span className="text-muted-foreground">{PLANS.annual.period}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-6">+ applicable sales tax</p>
            <Button variant="hero" className="w-full mb-6" onClick={() => navigate("/signup")}>
              Start Free Trial
            </Button>
            <ul className="space-y-3">
              {annualExtras.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-secondary-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Enterprise */}
        <div className="mt-6 max-w-3xl mx-auto">
          <div className="relative p-8 rounded-2xl border border-primary/20 bg-card/80 transition-all hover:border-primary/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-foreground mb-1">Enterprise</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Custom seat bundles, negotiated usage limits, SSO, dedicated infrastructure, and priority support. BYOLLM — connect your own AI providers.
                  </p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                    {["Committed Seat Bundles", "Custom Usage Limits", "SSO & Security", "Priority Support", "Dedicated Infrastructure", "BYOLLM Model"].map(f => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-secondary-foreground">
                        <Check className="w-3 h-3 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <span className="text-2xl font-bold text-foreground">Custom</span>
                <span className="text-xs text-muted-foreground">pricing per account</span>
                <Button variant="outline" className="mt-1" onClick={() => window.open("mailto:sales@rickyai.com?subject=Enterprise%20Inquiry", "_blank")}>
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Affiliate */}
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-6 md:p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-bold text-lg text-foreground mb-2">
              Grow With Us — Become an Affiliate or Community Teacher
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-3">
              As you master the system, unlock opportunities to earn. Share your expertise by teaching
              in our community or become an affiliate and earn commissions by referring other business owners.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {["Earn Commissions", "Teach & Lead", "Build Your Brand", "Grow Together"].map((tag) => (
                <span key={tag} className="text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8 max-w-lg mx-auto">
          All prices shown exclude applicable sales tax, which is calculated at checkout based on your location.
          No setup fees. No hidden charges. Cancel anytime. Premium AI features require your own API keys (BYOLLM).
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
