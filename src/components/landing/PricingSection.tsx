import { Button } from "@/components/ui/button";
import { Check, Building2, Users, Heart, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PLANS, ENTERPRISE_INFO, NONPROFIT_DISCOUNT_PERCENT } from "@/lib/stripe";

const creatorFeatures = [
  "8 Core Growth Steps",
  "1 Brand / 1 Location",
  "Basic Video Studio (Free Tools)",
  "Content Calendar & Export",
  "BYOLLM Support",
  "Search Visibility Dashboard",
  "Ricky AI Guide",
];

const businessFeatures = [
  "Full 14-Step Growth Engine",
  "1 Brand / 2 Locations",
  "All 10 Optimization Layers",
  "Lead Scout & Compete",
  "Campaign Blueprint",
  "Automation Pipelines",
  "Reporting Dashboards",
];

const growthFeatures = [
  "Everything in Business Starter",
  "5 Brands / 5 Locations Each",
  "Grant Search",
  "Marketplace: Buy & Sell Strategies",
  "AI-Assisted Video Studio",
  "Advanced Reporting",
  "Priority Support",
];

const agencyFeatures = [
  "Everything in Growth",
  "25+ Brands / Unlimited Locations",
  "Team Collaboration & Roles",
  "Cross-Brand Analytics",
  "Full Marketplace Access",
  "Priority Processing",
  "Dedicated Onboarding",
];

const enterpriseFeatures = [
  "SSO & Security",
  "Dedicated Infrastructure",
  "Unlimited Brands & Locations",
  "Custom Integrations & API Access",
  "Central HQ Templates",
  "Custom Onboarding & Success",
];

const PricingSection = () => {
  const navigate = useNavigate();

  const tiers = [
    { key: "creator" as const, features: creatorFeatures, popular: false },
    { key: "business" as const, features: businessFeatures, popular: true },
    { key: "growth" as const, features: growthFeatures, popular: false },
    { key: "agency" as const, features: agencyFeatures, popular: false },
  ];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Plans That <span className="text-gradient-accent">Grow With You</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start with a 7-day free trial. No credit card required. Bring your own AI keys for premium features — free tools always included.
          </p>
        </div>

        {/* 4-column grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {tiers.map(({ key, features, popular }) => {
            const plan = PLANS[key];
            return (
              <div
                key={key}
                className={`relative p-6 rounded-2xl border transition-all duration-300 ${
                  popular
                    ? "bg-card border-primary/40 shadow-glow scale-[1.02]"
                    : "bg-card border-border hover:border-primary/20"
                }`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-hero text-xs font-bold text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className="font-display font-bold text-lg text-foreground mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mb-3 min-h-[2.5rem]">{plan.desc}</p>
                <div className="mb-1">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-4">+ applicable sales tax</p>
                <Button
                  variant={popular ? "hero" : "outline"}
                  className="w-full mb-5"
                  size="sm"
                  onClick={() => navigate("/signup")}
                >
                  Start Free Trial
                </Button>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-secondary-foreground">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Enterprise */}
        <div className="mt-6 max-w-6xl mx-auto">
          <div className="relative p-6 rounded-2xl border border-primary/20 bg-card/80 transition-all hover:border-primary/40">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-foreground mb-1">{ENTERPRISE_INFO.name}</h3>
                  <p className="text-sm text-muted-foreground max-w-md">{ENTERPRISE_INFO.desc}</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                    {enterpriseFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-secondary-foreground">
                        <Check className="w-3 h-3 text-primary flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <span className="text-2xl font-bold text-foreground">{ENTERPRISE_INFO.price}</span>
                <span className="text-xs text-muted-foreground">${ENTERPRISE_INFO.min_price}–${ENTERPRISE_INFO.max_price}+/mo</span>
                <Button variant="outline" className="mt-1" onClick={() => window.open("mailto:sales@rickyai.com?subject=Enterprise%20Inquiry", "_blank")}>
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Nonprofit discount */}
        <div className="mt-6 max-w-6xl mx-auto">
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-display font-bold text-foreground mb-1">Nonprofit & Community Organizations</h3>
              <p className="text-sm text-muted-foreground">
                Registered 501(c)(3) nonprofits receive <strong className="text-foreground">{NONPROFIT_DISCOUNT_PERCENT}% off</strong> any tier.
                Contact us with your EIN to get your discount code.
              </p>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => window.open("mailto:nonprofit@rickyai.com?subject=Nonprofit%20Discount%20Request", "_blank")}>
              Request Discount
            </Button>
          </div>
        </div>

        {/* Affiliate */}
        <div className="mt-6 max-w-6xl mx-auto">
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-display font-bold text-foreground mb-1">
              Grow With Us — Become an Affiliate or Community Teacher
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-3">
              Master the system, then earn. Share your expertise by teaching in our community or earn commissions referring business owners.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["Earn Commissions", "Teach & Lead", "Build Your Brand", "Grow Together"].map((tag) => (
                <span key={tag} className="text-[11px] px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 max-w-lg mx-auto text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            All prices exclude applicable sales tax, calculated at checkout. No setup fees. No hidden charges. Premium AI features require your own API keys (BYOLLM).
          </p>
          <p className="text-xs text-muted-foreground font-medium border-t border-border pt-2">
            <strong className="text-foreground">No-Refund Policy:</strong> You may cancel anytime, but <strong className="text-foreground">no refunds</strong> are issued. Your access continues through the end of your paid cycle. Your billing date repeats on the same calendar day you first subscribed.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
