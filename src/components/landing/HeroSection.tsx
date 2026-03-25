import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, TrendingUp } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />

      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Community Intelligence Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-gradient-hero">PulseCore</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-display mb-4">
            The marketing department for the business owner who does it all.
          </p>

          {/* Value Statement */}
          <p className="text-base md:text-lg text-secondary-foreground/70 max-w-2xl mx-auto mb-12 leading-relaxed">
            Stop guessing and start leading. PulseCore takes the $2,000-a-month work of a marketing agency 
            and puts it into a 10-minute path. Know your community, dominate your competition, and find 
            the funding to grow—all while keeping your voice authentic.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button variant="hero" size="xl">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="xl" className="border-border hover:border-primary/40">
              See How It Works
            </Button>
          </div>

          {/* Ricky Greeting */}
          <div className="max-w-2xl mx-auto glass rounded-2xl p-6 text-left">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center flex-shrink-0 animate-pulse-glow">
                <span className="text-lg font-bold text-primary-foreground">R</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-primary mb-1">Meet Ricky — Your AI Growth Guide</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "Hi, I'm Ricky. I'm your proactive growth guide. I'm built into every screen of this app 
                  to make sure you never feel alone in this process. Whether we're grading your competition 
                  or finding you a grant, I'll tell you exactly what to do next."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: TrendingUp, title: "12-Step Growth System", desc: "A guided path from visibility audit to funding discovery" },
            { icon: Shield, title: "Bring Your Own AI", desc: "Your API keys, your costs, your data—100% private" },
            { icon: Zap, title: "Ricky AI Guide", desc: "Live floating strategist on every screen, powered by your AI" },
          ].map((feature) => (
            <div key={feature.title} className="group p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 shadow-card">
              <feature.icon className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="font-display font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
