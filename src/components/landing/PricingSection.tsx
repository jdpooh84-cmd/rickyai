import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    desc: "For solo business owners getting started",
    features: ["1 Business", "1 Location", "3 Strategy Runs/mo", "Ricky AI Guide", "Script & Storyboard", "Self-Record Export"],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$79",
    period: "/mo",
    desc: "For growing businesses and multi-location owners",
    features: ["3 Businesses", "5 Locations", "Unlimited Runs", "Full Ricky AI", "Lead Scout", "Grant Search", "HeyGen Export"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$199",
    period: "/mo",
    desc: "For agencies and franchise operators",
    features: ["Unlimited Businesses", "Unlimited Locations", "Unlimited Runs", "Priority Ricky AI", "Full Lead Scout", "Full Grant Search", "HeyGen Export", "Team Seats"],
    cta: "Contact Sales",
    highlight: false,
  },
];

const PricingSection = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Pricing That <span className="text-gradient-accent">Replaces Your Agency</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            7-day free trial on all plans. Cancel anytime. Your AI keys, your costs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                tier.highlight
                  ? "bg-card border-primary/40 shadow-glow scale-[1.02]"
                  : "bg-card border-border hover:border-primary/20"
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-hero text-xs font-bold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <h3 className="font-display font-bold text-xl text-foreground mb-1">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{tier.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{tier.price}</span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>
              <Button variant={tier.highlight ? "hero" : "outline"} className="w-full mb-6">
                {tier.cta}
              </Button>
              <ul className="space-y-3">
                {tier.features.map((f) => (
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
