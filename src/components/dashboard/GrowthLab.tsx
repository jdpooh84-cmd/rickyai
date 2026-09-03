import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Plus, TrendingUp } from "lucide-react";

interface Experiment {
  id: string; name: string; hypothesis: string | null; status: string; experiment_family: string | null;
  control_description: string | null; treatment_description: string | null;
  minimum_sample: number; winner: string | null; started_at: string | null; created_at: string;
}

interface Finding {
  id: string; finding_text: string; effect_estimate: number | null; confidence_level: string; created_at: string;
}

interface Props { businessId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500/10 text-green-400",
  paused: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-blue-500/10 text-blue-400",
  abandoned: "bg-destructive/10 text-destructive",
};

const FAMILIES = [
  "follow-up timing", "email subject line", "sms call-to-action", "offer type",
  "greeting message", "follow-up frequency", "booking reminder timing",
];

export default function GrowthLab({ businessId }: Props) {
  const { toast } = useToast();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "", hypothesis: "", experiment_family: "follow-up timing",
    control_description: "", treatment_description: "", minimum_sample: 100,
  });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const [{ data: exps }, { data: finds }] = await Promise.all([
      supabase.from("growth_experiments").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("growth_findings").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10),
    ]);
    setExperiments(exps || []);
    setFindings(finds || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const createExperiment = async () => {
    if (!businessId || !form.name) return;
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("growth-lab", {
      body: {
        action: "create_experiment",
        businessId,
        ...form,
        minimumSample: form.minimum_sample,
        experimentFamily: form.experiment_family,
        controlDescription: form.control_description,
        treatmentDescription: form.treatment_description,
      },
    });
    setCreating(false);
    if (res.error) { toast({ title: "Error", description: String(res.error), variant: "destructive" }); return; }
    toast({ title: "Experiment started", description: "Ricky will now route subjects to control and treatment groups" });
    setShowNew(false);
    setForm({ name: "", hypothesis: "", experiment_family: "follow-up timing", control_description: "", treatment_description: "", minimum_sample: 100 });
    load();
  };

  const running = experiments.filter(e => e.status === "running");
  const completed = experiments.filter(e => e.status === "completed");

  const CONFIDENCE_COLORS: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    moderate: "bg-yellow-500/10 text-yellow-400",
    high: "bg-green-500/10 text-green-400",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Growth Lab</h1>
          <p className="text-muted-foreground text-sm mt-1">Run controlled experiments to find what works best for your business</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="w-4 h-4" />New Experiment</Button>
      </div>

      {/* Summary */}
      <Card className="glass border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm text-foreground">
            Ricky is running <strong>{running.length}</strong> experiment{running.length !== 1 ? "s" : ""} and measuring which approach works better.
            {completed.length > 0 && ` ${completed.length} completed experiment${completed.length !== 1 ? "s" : ""} have produced findings.`}
          </p>
        </CardContent>
      </Card>

      {/* Running experiments */}
      {running.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Running</h2>
          <div className="space-y-3">
            {running.map(e => (
              <Card key={e.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-foreground">{e.name}</p>
                      {e.hypothesis && <p className="text-xs text-muted-foreground mt-0.5">{e.hypothesis}</p>}
                    </div>
                    <Badge className={STATUS_COLORS[e.status]}>{e.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="p-2 rounded-lg bg-secondary/20">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Control</p>
                      <p className="text-xs text-foreground">{e.control_description || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs font-semibold text-primary mb-1">Treatment</p>
                      <p className="text-xs text-foreground">{e.treatment_description || "—"}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Needs {e.minimum_sample} exposures · Started {e.started_at ? new Date(e.started_at).toLocaleDateString() : "—"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Findings</h2>
          <div className="space-y-2">
            {findings.map(f => (
              <Card key={f.id} className="glass">
                <CardContent className="p-3 flex items-start justify-between gap-3">
                  <p className="text-sm text-foreground flex-1">{f.finding_text}</p>
                  <div className="flex gap-2 flex-shrink-0">
                    {f.effect_estimate !== null && (
                      <span className="text-xs text-primary font-mono">{f.effect_estimate > 0 ? "+" : ""}{(f.effect_estimate * 100).toFixed(1)}%</span>
                    )}
                    <Badge className={CONFIDENCE_COLORS[f.confidence_level]}>{f.confidence_level}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {experiments.length === 0 && findings.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No experiments yet. Start one to discover what messaging works best for your business.</p>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Experiment</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Experiment name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <div>
              <label className="text-xs text-muted-foreground">Hypothesis</label>
              <Textarea value={form.hypothesis} onChange={e => setForm(p => ({ ...p, hypothesis: e.target.value }))} rows={2} placeholder="We believe that... will result in..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Experiment Family</label>
              <Select value={form.experiment_family} onValueChange={v => setForm(p => ({ ...p, experiment_family: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FAMILIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Control (what you do now)</label>
                <Textarea value={form.control_description} onChange={e => setForm(p => ({ ...p, control_description: e.target.value }))} rows={2} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Treatment (what to test)</label>
                <Textarea value={form.treatment_description} onChange={e => setForm(p => ({ ...p, treatment_description: e.target.value }))} rows={2} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Minimum sample size</label>
              <Input type="number" value={form.minimum_sample} onChange={e => setForm(p => ({ ...p, minimum_sample: +e.target.value }))} />
            </div>
            <Button className="w-full" onClick={createExperiment} disabled={creating}>
              {creating ? "Starting..." : "Start Experiment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
