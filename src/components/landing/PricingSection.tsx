import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PLANS } from "@/lib/stripe";

const planList = [
  {
    key: "monthly" as const,
    ...PLANS.monthly,
    savings: null,
    features: [
      "Unlimited Businesses & Locations",
      "Full 13-Step Growth System",
      "Ricky AI Guide",
      "Lead Scout & Grant Search",
      "Search Visibility Engine",
      "Community & Marketplace",
      "HeyGen Video Export",
    ],
  },
  {
    key: "annual" as const,
    ...PLANS.annual,
    savings: "Save 25%",
    features: [
      "Everything in Monthly",
      "Priority Ricky AI",
      "Early Access Features",
      "Dedicated Support",
    ],
  },
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
            Start with a 7-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {planList.map((plan) => (
            <div
              key={plan.key}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.savings
                  ? "bg-card border-primary/40 shadow-glow scale-[1.02]"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              {plan.savings && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-hero text-xs font-bold text-primary-foreground">
                  {plan.savings}
                </div>
              )}
              <h3 className="font-display font-bold text-xl text-foreground mb-1">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <Button
                variant={plan.savings ? "hero" : "outline"}
                className="w-full mb-6"
                onClick={() => navigate("/signup")}
              >
                Start Free Trial
              </Button>
              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-secondary-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
