import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Clock, AlertTriangle, Shield, Brain, Zap, Eye, Activity } from "lucide-react";

interface Approval {
  id: string; action_type: string; risk_level: string; human_summary: string | null;
  status: string; expires_at: string | null; requested_at: string; resolved_at: string | null;
}

interface Props { businessId: string | null; }

type ApprovalMode = "assist" | "operate" | "autonomous";

const MODES: Record<ApprovalMode, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  assist: {
    label: "Assist",
    icon: <Eye className="w-4 h-4" />,
    description: "You review everything. Ricky prepares; you decide.",
    color: "border-blue-500/40 bg-blue-500/5",
  },
  operate: {
    label: "Operate",
    icon: <Zap className="w-4 h-4" />,
    description: "L0–L1 run automatically. You review L2 and above.",
    color: "border-purple-500/40 bg-purple-500/5",
  },
  autonomous: {
    label: "Autonomous",
    icon: <Brain className="w-4 h-4" />,
    description: "L0–L2 run automatically. You review L3 external actions only.",
    color: "border-primary/40 bg-primary/5",
  },
};

const AUTHORITY_LEVELS = [
  { level: 0, label: "L0", name: "Analyze", description: "Research, summarize, classify, draft internally — no external action", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { level: 1, label: "L1", name: "Prepare", description: "Generate plans, proposals, reports in sandbox — human reviews before release", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { level: 2, label: "L2", name: "Execute internal", description: "Update internal records, tag leads, schedule tasks — automated with logs", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { level: 3, label: "L3", name: "External action", description: "Send SMS/email, publish content, change live automations — requires your approval", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { level: 4, label: "L4", name: "High-consequence", description: "Financial, legal, delete data — human-only, never automated", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

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

function getModeStorageKey(businessId: string | null): string {
  return `ricky-approval-mode-${businessId || "default"}`;
}

function loadMode(businessId: string | null): ApprovalMode {
  try {
    const stored = localStorage.getItem(getModeStorageKey(businessId));
    if (stored === "assist" || stored === "operate" || stored === "autonomous") return stored;
  } catch {
    // localStorage may be unavailable
  }
  return "assist";
}

function saveMode(businessId: string | null, mode: ApprovalMode): void {
  try {
    localStorage.setItem(getModeStorageKey(businessId), mode);
  } catch {
    // ignore
  }
}

export default function ApprovalCenter({ businessId }: Props) {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [mode, setMode] = useState<ApprovalMode>(() => loadMode(businessId));

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("approvals").select("*").eq("business_id", businessId).order("requested_at", { ascending: false }).limit(50);
    setApprovals(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  // Sync mode when businessId changes
  useEffect(() => {
    setMode(loadMode(businessId));
  }, [businessId]);

  const handleModeChange = (next: ApprovalMode) => {
    setMode(next);
    saveMode(businessId, next);
  };

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

  const activeMeta = MODES[mode];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Approval Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and approve actions Ricky wants to take on your behalf</p>
      </div>

      {/* Mode Selector */}
      <Card className={`glass border ${activeMeta.color}`}>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Automation Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(MODES) as [ApprovalMode, typeof MODES[ApprovalMode]][]).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  mode === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
        </CardContent>
      </Card>

      {/* Authority Level Legend */}
      <Card className="glass">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Authority Levels
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-2">
            {AUTHORITY_LEVELS.map((lvl) => (
              <div key={lvl.level} className="flex items-start gap-3">
                <Badge className={`${lvl.color} flex-shrink-0 text-xs border mt-0.5`}>{lvl.label}</Badge>
                <div>
                  <span className="text-sm font-medium text-foreground">{lvl.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{lvl.description}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
