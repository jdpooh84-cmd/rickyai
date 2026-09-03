import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp } from "lucide-react";

interface Opportunity {
  id: string; type: string; value_cents: number; status: string;
  notes: string | null; sent_at: string | null; viewed_at: string | null;
  created_at: string;
  contacts: { first_name: string | null; last_name: string | null } | null;
}

interface Props { businessId: string | null; }

const COLUMNS = ["draft", "sent", "viewed", "accepted", "declined", "expired"];
const COL_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-400",
  viewed: "bg-yellow-500/10 text-yellow-400",
  accepted: "bg-green-500/10 text-green-400",
  declined: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export default function OpportunitiesPipeline({ businessId }: Props) {
  const { toast } = useToast();
  const [opps, setOpps] = useState<Opportunity[]>([]);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("opportunities")
      .select("*, contacts(first_name, last_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    setOpps(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const followUp = async (id: string) => {
    toast({ title: "Follow-up scheduled", description: "Ricky will send a follow-up message" });
    await supabase.from("opportunities").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const byStatus = COLUMNS.reduce((acc, s) => { acc[s] = opps.filter(o => o.status === s); return acc; }, {} as Record<string, Opportunity[]>);

  const totalPipeline = opps.filter(o => !["declined", "expired"].includes(o.status)).reduce((s, o) => s + o.value_cents, 0);
  const won = opps.filter(o => o.status === "accepted");
  const winRate = opps.length > 0 ? Math.round((won.length / opps.length) * 100) : 0;

  const daysSince = (date: string) => Math.round((Date.now() - new Date(date).getTime()) / 86400000);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Opportunities Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Track estimates, quotes, and proposals</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pipeline Value", value: `$${(totalPipeline / 100).toLocaleString()}` },
          { label: "Win Rate", value: `${winRate}%` },
          { label: "Open", value: opps.filter(o => ["sent", "viewed"].includes(o.status)).length },
          { label: "Won This Month", value: won.length },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-x-auto">
        {["draft", "sent", "viewed", "accepted"].map(status => (
          <div key={status} className="space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground capitalize">{status}</h3>
              <Badge className={COL_COLORS[status]}>{byStatus[status]?.length || 0}</Badge>
            </div>
            {(byStatus[status] || []).map(o => (
              <Card key={o.id} className="glass">
                <CardContent className="p-3">
                  <p className="font-medium text-sm text-foreground">{o.contacts?.first_name} {o.contacts?.last_name}</p>
                  <p className="text-primary font-semibold text-sm">${(o.value_cents / 100).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground capitalize">{o.type}</p>
                  {o.sent_at && <p className="text-xs text-muted-foreground">{daysSince(o.sent_at)}d ago</p>}
                  {["sent", "viewed"].includes(o.status) && (
                    <Button size="sm" variant="outline" className="w-full mt-2 text-xs" onClick={() => followUp(o.id)}>Follow Up</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>

      {opps.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No opportunities yet. They'll appear here when leads request estimates or quotes.</p>
        </div>
      )}
    </div>
  );
}
