import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/landing/HeroSection";
import StepsOverview from "@/components/landing/StepsOverview";
import PricingSection from "@/components/landing/PricingSection";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">P</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">PulseCore</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Log In</Button>
            <Button variant="hero" size="sm" onClick={() => navigate("/signup")}>Get Started</Button>
          </div>
        </div>
      </nav>

      <HeroSection />
      <div id="features">
        <StepsOverview />
      </div>
      <div id="pricing">
        <PricingSection />
      </div>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © 2026 PulseCore. Informed Authentic Connection.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
