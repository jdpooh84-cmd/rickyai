import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Network, Shield, AlertTriangle } from "lucide-react";

interface GenomeSettings {
  id?: string; participation_status: string; use_network_insights: boolean; contribute_anonymized: boolean;
}

interface AggregateFinding {
  id: string; experiment_family: string | null; similar_businesses: number; effect_estimate: number | null; evidence_level: string; updated_at: string;
}

interface Props { businessId: string | null; }

const EVIDENCE_COLORS: Record<string, string> = {
  anecdotal: "bg-muted text-muted-foreground",
  weak: "bg-yellow-500/10 text-yellow-400",
  moderate: "bg-blue-500/10 text-blue-400",
  strong: "bg-green-500/10 text-green-400",
};

export default function GrowthGenome({ businessId }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GenomeSettings>({ participation_status: "disabled", use_network_insights: false, contribute_anonymized: false });
  const [networkFindings, setNetworkFindings] = useState<AggregateFinding[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const [{ data: s }, { data: f }] = await Promise.all([
      supabase.from("growth_genome_settings").select("*").eq("business_id", businessId).maybeSingle(),
      supabase.from("genome_aggregate_findings").select("*").order("similar_businesses", { ascending: false }).limit(10),
    ]);
    if (s) setSettings(s);
    setNetworkFindings(f || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    const payload = { ...settings, business_id: businessId, updated_at: new Date().toISOString() };
    const { error } = settings.id
      ? await supabase.from("growth_genome_settings").update(payload).eq("id", settings.id)
      : await supabase.from("growth_genome_settings").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Settings saved" });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Growth Genome</h1>
        <p className="text-muted-foreground text-sm mt-1">Learn from the network of similar businesses while keeping your data private</p>
      </div>

      {/* Plain language explanation */}
      <Card className="glass border-primary/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Network className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium mb-1">How Growth Genome works</p>
              <p className="text-sm text-muted-foreground">Ricky learns from what works for similar businesses while keeping their private information private. When you opt in, only anonymized experiment results (not customer names or data) are shared. Network evidence suggests a direction — your own experiments validate it.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy settings */}
      <Card className="glass">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Privacy Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Use Network Insights</p>
              <p className="text-xs text-muted-foreground">See anonymized findings from similar businesses to guide your experiments</p>
            </div>
            <Switch checked={settings.use_network_insights} onCheckedChange={v => setSettings(p => ({ ...p, use_network_insights: v, participation_status: v ? "read_only" : "disabled" }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Contribute Anonymized Data</p>
              <p className="text-xs text-muted-foreground">Share your experiment results (no customer data) to improve the network for everyone</p>
            </div>
            <Switch
              checked={settings.contribute_anonymized}
              disabled={!settings.use_network_insights}
              onCheckedChange={v => setSettings(p => ({ ...p, contribute_anonymized: v, participation_status: v ? "contribute" : "read_only" }))}
            />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Settings"}</Button>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="glass border-yellow-500/20">
        <CardContent className="p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-yellow-400">Remember:</strong> Network evidence suggests a direction. Your own experiment validates it for your specific business and market. Never skip your own test just because the network says something works.
          </p>
        </CardContent>
      </Card>

      {/* Network findings */}
      {settings.use_network_insights && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Network Evidence</h2>
          {networkFindings.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No network findings available yet. The network grows as more businesses contribute experiments.</p>
          )}
          <div className="space-y-2">
            {networkFindings.map(f => (
              <Card key={f.id} className="glass">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground capitalize">{f.experiment_family?.replace(/-/g, " ") || "General finding"}</p>
                    <div className="flex gap-2">
                      <Badge className={EVIDENCE_COLORS[f.evidence_level]}>{f.evidence_level}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xs text-muted-foreground">NETWORK EVIDENCE ({f.similar_businesses} similar businesses)</p>
                    {f.effect_estimate !== null && (
                      <p className={`text-xs font-mono font-bold ${f.effect_estimate > 0 ? "text-green-400" : "text-destructive"}`}>
                        {f.effect_estimate > 0 ? "+" : ""}{(f.effect_estimate * 100).toFixed(1)}% lift
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
