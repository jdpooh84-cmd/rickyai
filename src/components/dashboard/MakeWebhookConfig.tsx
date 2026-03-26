import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Webhook, Check, Loader2 } from "lucide-react";

const SCENARIOS = [
  { type: "video_production", label: "Scenario 1 — Video Creation Engine", desc: "Research → Script → Voice → HeyGen Video → Captions" },
  { type: "social_posting", label: "Scenario 2 — The Posting Bot", desc: "Download video → Upload to YouTube → Update sheet" },
  { type: "research_pipeline", label: "Scenario 3 — YouTube Research Helper", desc: "Watch keywords → Research → Log results" },
];

const MakeWebhookConfig = () => {
  const [configs, setConfigs] = useState<Record<string, { id?: string; url: string; active: boolean }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadConfigs(); }, []);

  const loadConfigs = async () => {
    const { data } = await supabase.from("webhook_config").select("*");
    if (data) {
      const map: Record<string, any> = {};
      data.forEach(d => { map[d.scenario_type] = { id: d.id, url: d.webhook_url, active: d.is_active }; });
      setConfigs(map);
    }
  };

  const handleSave = async (scenarioType: string) => {
    const config = configs[scenarioType];
    if (!config?.url?.trim()) { toast.error("Enter a webhook URL"); return; }
    setSaving(scenarioType);
    try {
      if (config.id) {
        await supabase.from("webhook_config").update({ webhook_url: config.url.trim(), is_active: true }).eq("id", config.id);
      } else {
        await supabase.from("webhook_config").insert({ scenario_type: scenarioType, webhook_url: config.url.trim(), is_active: true });
      }
      toast.success("Webhook saved!");
      loadConfigs();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Webhook className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Make.com Automation Webhooks</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect your Make.com scenarios to enable fully automated video production, posting, and research pipelines.
        Import the provided JSON blueprints into Make.com, then paste each scenario's webhook URL below.
      </p>

      {SCENARIOS.map(s => {
        const config = configs[s.type] || { url: "", active: false };
        return (
          <div key={s.type} className={`rounded-xl p-4 border transition-all ${config.active ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-foreground">{s.label}</h4>
              {config.active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">{s.desc}</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://hook.us2.make.com/..."
                value={config.url}
                onChange={e => setConfigs(prev => ({ ...prev, [s.type]: { ...prev[s.type], url: e.target.value } }))}
                className="text-xs"
              />
              <Button size="sm" onClick={() => handleSave(s.type)} disabled={saving === s.type}>
                {saving === s.type ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MakeWebhookConfig;
