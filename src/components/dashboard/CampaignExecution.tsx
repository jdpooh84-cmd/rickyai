import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Plus, TrendingUp, DollarSign } from "lucide-react";

interface CampaignExecution {
  id: string; status: string; budget_cents: number; spend_cents: number;
  impressions: number; clicks: number; leads_generated: number; appointments_booked: number;
  revenue_attributed_cents: number; created_at: string;
}

interface Props { businessId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  review: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-blue-500/10 text-blue-400",
  live: "bg-green-500/10 text-green-400",
  completed: "bg-primary/10 text-primary",
  paused: "bg-orange-500/10 text-orange-400",
};

export default function CampaignExecution({ businessId }: Props) {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<CampaignExecution[]>([]);
  const [showLaunch, setShowLaunch] = useState(false);
  const [budget, setBudget] = useState("500");
  const [launching, setLaunching] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("campaign_executions")
      .select("*").eq("business_id", businessId).order("created_at", { ascending: false });
    setCampaigns(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const launchCampaign = async () => {
    if (!businessId) return;
    setLaunching(true);

    // Create approval first (high-risk spend action)
    await supabase.from("approvals").insert({
      business_id: businessId,
      action_type: "launch_campaign",
      risk_level: "high",
      human_summary: `Launch ad campaign with $${budget}/month budget. Ricky will manage targeting and creative.`,
      expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
    });

    const { error } = await supabase.from("campaign_executions").insert({
      business_id: businessId,
      status: "review",
      budget_cents: Math.round(+budget * 100),
    });

    setLaunching(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Campaign submitted for review", description: "Check Approval Center to approve the spend" });
    setShowLaunch(false);
    load();
  };

  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue_attributed_cents, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_generated, 0);
  const liveCampaigns = campaigns.filter(c => c.status === "live").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Campaign Execution</h1>
          <p className="text-muted-foreground text-sm mt-1">Launch and track your ad campaigns</p>
        </div>
        <Button onClick={() => setShowLaunch(true)} className="gap-2"><Plus className="w-4 h-4" />Launch Campaign</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Live Campaigns", value: liveCampaigns },
          { label: "Total Leads", value: totalLeads },
          { label: "Revenue Attributed", value: `$${(totalRevenue / 100).toLocaleString()}` },
          { label: "Total Campaigns", value: campaigns.length },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaigns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No campaigns yet. Launch your first campaign to start generating leads.</p>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map(c => (
          <Card key={c.id} className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-medium text-foreground">Budget: ${(c.budget_cents / 100).toLocaleString()}/mo</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Spend", value: `$${(c.spend_cents / 100).toLocaleString()}` },
                  { label: "Leads", value: c.leads_generated },
                  { label: "Booked", value: c.appointments_booked },
                  { label: "Revenue", value: `$${(c.revenue_attributed_cents / 100).toLocaleString()}` },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-base font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showLaunch} onOpenChange={setShowLaunch}>
        <DialogContent>
          <DialogHeader><DialogTitle>Launch Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Set your monthly ad budget. Ricky will handle targeting, creative, and optimization. A high-risk approval will be required before any spend begins.</p>
            <div>
              <label className="text-xs text-muted-foreground">Monthly Budget ($)</label>
              <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="500" />
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <p className="text-xs text-yellow-400">This will create a high-risk approval in the Approval Center. No money will be spent until you approve it there.</p>
            </div>
            <Button className="w-full" onClick={launchCampaign} disabled={launching}>
              {launching ? "Submitting..." : "Submit for Approval"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
