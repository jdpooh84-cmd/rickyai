import { Button } from "@/components/ui/button";
import { Check, AlertCircle } from "lucide-react";

const providers = [
  {
    id: "claude",
    name: "Claude (Anthropic)",
    desc: "Advanced reasoning and content generation",
    color: "hsl(25 90% 55%)",
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    desc: "Multimodal AI with broad knowledge",
    color: "hsl(210 80% 55%)",
  },
  {
    id: "openai",
    name: "ChatGPT / OpenAI",
    desc: "Versatile AI for content and strategy",
    color: "hsl(160 60% 45%)",
  },
];

const ConnectStep = () => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">
          Connect Your AI Provider
        </h1>
        <p className="text-muted-foreground">
          PulseCore uses your own AI credentials. Your data stays private, and usage costs are yours to control.
          Choose at least one provider below.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {providers.map((p) => (
          <div key={p.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                  <span className="text-lg font-bold" style={{ color: p.color }}>
                    {p.name[0]}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* HeyGen optional */}
      <div className="p-5 rounded-xl border border-border bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <span className="text-lg font-bold text-accent">H</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">HeyGen</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Optional</span>
              </div>
              <p className="text-sm text-muted-foreground">AI avatar video creation & export</p>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Connect
          </Button>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
        <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Your API keys are encrypted and stored securely. They are never shared across users or exposed in the frontend.
          You can disconnect, replace, or update keys anytime from Settings.
        </p>
      </div>
    </div>
  );
};

export default ConnectStep;
