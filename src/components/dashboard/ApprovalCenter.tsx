import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Clock, AlertTriangle, Shield } from "lucide-react";

interface Approval {
  id: string; action_type: string; risk_level: string; human_summary: string | null;
  status: string; expires_at: string | null; requested_at: string; resolved_at: string | null;
}

interface Props { businessId: string | null; }

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-400 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const RISK_ICONS: Record<string, React.ReactNode> = {
  low: <Shield className="w-4 h-4 text-green-400" />,
  medium: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  high: <AlertTriangle className="w-4 h-4 text-destructive" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-green-500/10 text-green-400",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export default function ApprovalCenter({ businessId }: Props) {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("approvals").select("*").eq("business_id", businessId).order("requested_at", { ascending: false }).limit(50);
    setApprovals(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const resolve = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("approvals").update({
      status,
      resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: status === "approved" ? "Approved" : "Rejected", description: "Ricky has been notified" });
    load();
  };

  const pending = approvals.filter(a => a.status === "pending");
  const history = approvals.filter(a => a.status !== "pending");

  const isExpired = (a: Approval) => a.expires_at && new Date(a.expires_at) < new Date();
  const timeLeft = (a: Approval) => {
    if (!a.expires_at) return null;
    const diff = new Date(a.expires_at).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hrs = Math.floor(diff / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${min}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Approval Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and approve actions Ricky wants to take on your behalf</p>
      </div>

      {pending.length > 0 && (
        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-400" />
          <p className="text-sm text-yellow-400">{pending.length} action{pending.length !== 1 ? "s" : ""} waiting for your approval</p>
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Check className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No pending approvals. Ricky is operating within its approved parameters.</p>
            </div>
          )}
          {pending.map(a => (
            <Card key={a.id} className={`glass border ${RISK_COLORS[a.risk_level] || ""} ${isExpired(a) ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {RISK_ICONS[a.risk_level]}
                    <div>
                      <p className="font-medium text-foreground">{a.action_type.replace(/_/g, " ")}</p>
                      <div className="flex gap-2 mt-0.5">
                        <Badge className={RISK_COLORS[a.risk_level]}>{a.risk_level} risk</Badge>
                        {timeLeft(a) && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{timeLeft(a)}</span>}
                      </div>
                    </div>
                  </div>
                  {!isExpired(a) && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resolve(a.id, "approved")} className="gap-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20">
                        <Check className="w-3 h-3" />Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve(a.id, "rejected")} className="gap-1 text-destructive hover:bg-destructive/10">
                        <X className="w-3 h-3" />Reject
                      </Button>
                    </div>
                  )}
                </div>
                {a.human_summary && <p className="text-sm text-foreground">{a.human_summary}</p>}
                <p className="text-xs text-muted-foreground mt-2">Requested {new Date(a.requested_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-2">
          {history.map(a => (
            <Card key={a.id} className="glass">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.action_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.requested_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={RISK_COLORS[a.risk_level]}>{a.risk_level}</Badge>
                  <Badge className={STATUS_COLORS[a.status]}>{a.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
