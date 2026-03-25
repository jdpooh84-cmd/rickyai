import {
  Link, UserCircle, BarChart3, Search, ClipboardCheck, Monitor,
  FileText, Video, LayoutGrid, Upload, Users, DollarSign
} from "lucide-react";

const steps = [
  { num: 1, icon: Link, title: "Connect", desc: "Link your AI provider" },
  { num: 2, icon: UserCircle, title: "Profile", desc: "Enter your business info" },
  { num: 3, icon: BarChart3, title: "Compete", desc: "Get your visibility grade" },
  { num: 4, icon: Search, title: "Scout", desc: "Find local conversations" },
  { num: 5, icon: ClipboardCheck, title: "Audit", desc: "Spot competitor gaps" },
  { num: 6, icon: Monitor, title: "Platform", desc: "Know where to post" },
  { num: 7, icon: FileText, title: "Script", desc: "Generate your content" },
  { num: 8, icon: Video, title: "Video Studio", desc: "Choose your vibe" },
  { num: 9, icon: LayoutGrid, title: "Storyboard", desc: "Visualize each scene" },
  { num: 10, icon: Upload, title: "Export", desc: "Package for production" },
  { num: 11, icon: Users, title: "Lead Scout", desc: "Find referral partners" },
  { num: 12, icon: DollarSign, title: "Grant Search", desc: "Discover funding" },
];

const StepsOverview = () => {
  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            <span className="text-gradient-hero">12 Steps</span> to Local Dominance
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            A guided system that builds your complete growth strategy—one step at a time.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {steps.map((step) => (
            <div
              key={step.num}
              className="group relative p-5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300 cursor-default"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold text-primary/60 font-display">
                  {String(step.num).padStart(2, "0")}
                </span>
                <step.icon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="font-display font-semibold text-foreground text-sm mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StepsOverview;
