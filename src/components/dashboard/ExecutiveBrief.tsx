import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Calendar, Users, Clock, RefreshCw, ArrowRight, Loader2 } from "lucide-react";

interface Brief {
  id: string; period_start: string; period_end: string;
  revenue_attributed_cents: number; appointments_booked: number; leads_recovered: number;
  hours_saved_estimate: number; pending_approvals: number; current_experiment: string | null;
  next_recommended_action: string | null; generated_at: string;
}

interface Props { businessId: string | null; onNavigate?: (section: string) => void; }

export default function ExecutiveBrief({ businessId, onNavigate }: Props) {
  const { toast } = useToast();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("executive_briefs")
      .select("*").eq("business_id", businessId).order("generated_at", { ascending: false }).limit(1).maybeSingle();
    setBrief(data);
  };

  useEffect(() => { load(); }, [businessId]);

  const generate = async () => {
    if (!businessId) return;
    setGenerating(true);
    const res = await supabase.functions.invoke("generate-brief", { body: { businessId } });
    setGenerating(false);
    if (res.error) { toast({ title: "Error", description: String(res.error), variant: "destructive" }); return; }
    toast({ title: "Brief refreshed" });
    load();
  };

  const stats = brief ? [
    { label: "Revenue Attributed", value: `$${(brief.revenue_attributed_cents / 100).toLocaleString()}`, icon: DollarSign, color: "text-green-400" },
    { label: "Appointments Booked", value: brief.appointments_booked, icon: Calendar, color: "text-primary" },
    { label: "Leads Recovered", value: brief.leads_recovered, icon: Users, color: "text-blue-400" },
    { label: "Hours Returned", value: `${brief.hours_saved_estimate.toFixed(1)}h`, icon: Clock, color: "text-yellow-400" },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Executive Brief</h1>
          <p className="text-muted-foreground text-sm mt-1">What Ricky accomplished and what's next</p>
        </div>
        <Button variant="outline" onClick={generate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Brief
        </Button>
      </div>

      {!brief && !generating && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">No brief generated yet.</p>
          <Button onClick={generate}>Generate My First Brief</Button>
        </div>
      )}

      {generating && (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Generating your executive brief...</p>
        </div>
      )}

      {brief && !generating && (
        <>
          <p className="text-xs text-muted-foreground">
            Period: {new Date(brief.period_start).toLocaleDateString()} – {new Date(brief.period_end).toLocaleDateString()} · Generated {new Date(brief.generated_at).toLocaleString()}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map(s => (
              <Card key={s.label} className="glass">
                <CardContent className="p-4 text-center">
                  <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* What Ricky handled */}
          <Card className="glass">
            <CardHeader><CardTitle className="text-foreground text-base">What Ricky Handled This Week</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                brief.appointments_booked > 0 && `Booked ${brief.appointments_booked} appointments without you lifting a finger`,
                brief.leads_recovered > 0 && `Recovered ${brief.leads_recovered} leads through automated follow-up`,
                brief.hours_saved_estimate > 0 && `Saved you ${brief.hours_saved_estimate.toFixed(1)} hours of admin work`,
                brief.current_experiment && `Running experiment: "${brief.current_experiment}"`,
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <p className="text-sm text-foreground">{item as string}</p>
                </div>
              ))}
              {brief.appointments_booked === 0 && brief.leads_recovered === 0 && (
                <p className="text-sm text-muted-foreground">Ricky is ready to work — set up contacts and automations to see results here.</p>
              )}
            </CardContent>
          </Card>

          {/* Pending decisions */}
          {brief.pending_approvals > 0 && (
            <Card className="glass border-yellow-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{brief.pending_approvals} decision{brief.pending_approvals !== 1 ? "s" : ""} waiting for you</p>
                  <p className="text-xs text-muted-foreground">Ricky is paused on these tasks until you review</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onNavigate?.("approvals")} className="gap-1">
                  Review <ArrowRight className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Next action */}
          {brief.next_recommended_action && (
            <Card className="glass border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">NEXT RECOMMENDED ACTION</p>
                <p className="text-sm font-medium text-foreground">{brief.next_recommended_action}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
