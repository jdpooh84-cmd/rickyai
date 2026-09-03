import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Play, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, Zap, ChevronRight } from "lucide-react";

interface AgentRow { id: string; agent_key: string; display_name: string; description: string | null; authority_ceiling: number; kpi_metric: string | null; active: boolean; }
interface Project { id: string; title: string; goal: string; status: string; priority: number; executive_summary: string | null; created_at: string; }
interface OrcTask { id: string; project_id: string; agent_key: string; title: string; description: string | null; authority_level: number; status: string; approval_id: string | null; }
interface Approval { id: string; action_type: string; risk_level: string; human_summary: string | null; status: string; requested_at: string; }
interface DiagnosisResult { opportunities?: Array<{ title: string; description: string; authority_level_required: number; roi_estimate: string; priority_score: number }>; }

interface Props { businessId: string | null; }

const AUTH_LABELS: Record<number, string> = { 0: "L0 Analyze", 1: "L1 Draft", 2: "L2 Execute", 3: "L3 External", 4: "L4 Human" };
const AUTH_COLORS: Record<number, string> = { 0: "bg-blue-500/10 text-blue-400", 1: "bg-teal-500/10 text-teal-400", 2: "bg-green-500/10 text-green-400", 3: "bg-yellow-500/10 text-yellow-400", 4: "bg-destructive/10 text-destructive" };
const TASK_STATUS_COLORS: Record<string, string> = { pending: "text-muted-foreground", running: "text-blue-400", completed: "text-green-400", failed: "text-destructive", blocked: "text-yellow-400", awaiting_approval: "text-yellow-400" };
const TASK_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />, running: <RefreshCw className="w-3 h-3 animate-spin" />,
  completed: <CheckCircle className="w-3 h-3" />, failed: <XCircle className="w-3 h-3" />,
  blocked: <AlertTriangle className="w-3 h-3" />, awaiting_approval: <AlertTriangle className="w-3 h-3" />,
};

export default function OrchestratorDashboard({ businessId }: Props) {
  const { toast } = useToast();
  const [goal, setGoal] = useState("");
  const [launching, setLaunching] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<OrcTask[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const load = async () => {
    if (!businessId) return;
    const [{ data: proj }, { data: tsk }, { data: appr }, { data: ag }] = await Promise.all([
      supabase.from("orchestrator_projects").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
      supabase.from("orchestrator_tasks").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(100),
      supabase.from("approvals").select("*").eq("business_id", businessId).eq("status", "pending").order("requested_at", { ascending: false }),
      supabase.from("agent_manifest").select("*").eq("active", true).order("authority_ceiling"),
    ]);
    setProjects(proj || []);
    setTasks(tsk || []);
    setPendingApprovals(appr || []);
    setAgents(ag || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const deployGoal = async () => {
    if (!goal.trim() || !businessId) return;
    setLaunching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ricky-orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ businessId, goal: goal.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Orchestrator failed");
      toast({ title: "Ricky is on it", description: `Project "${json.project?.title || "New project"}" created with ${json.tasks_created || 0} tasks` });
      setGoal("");
      load();
    } catch (err) {
      toast({ title: "Deploy failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  const runDiagnosis = async () => {
    if (!businessId) return;
    setDiagnosing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workflow-diagnosis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ businessId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Diagnosis failed");
      setDiagnosis(json);
    } catch (err) {
      toast({ title: "Diagnosis failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setDiagnosing(false);
    }
  };

  const resolveApproval = async (id: string, status: "approved" | "rejected") => {
    await supabase.from("approvals").update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
    toast({ title: status === "approved" ? "Approved" : "Rejected" });
    load();
  };

  const projectTasks = (projectId: string) => tasks.filter(t => t.project_id === projectId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-7 h-7 text-purple-400" />
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">AI Command Center</h1>
          <p className="text-muted-foreground text-sm">Ricky's AI COO — orchestrates specialist agents across your business</p>
        </div>
      </div>

      {/* Deploy Goal */}
      <Card className="glass border border-purple-500/20">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-purple-400" />Deploy a Goal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="e.g. Grow monthly revenue by 20% through upsells and reactivating lost customers"
            className="min-h-[80px] resize-none"
          />
          <div className="flex gap-2">
            <Button onClick={deployGoal} disabled={!goal.trim() || launching || !businessId} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Play className="w-4 h-4" />{launching ? "Deploying…" : "Deploy Ricky"}
            </Button>
            <Button variant="outline" onClick={runDiagnosis} disabled={diagnosing || !businessId} className="gap-2">
              <Brain className="w-4 h-4" />{diagnosing ? "Diagnosing…" : "Run Diagnosis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="queue">Decision Queue ({pendingApprovals.length})</TabsTrigger>
          <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
          {diagnosis && <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>}
        </TabsList>

        {/* Projects */}
        <TabsContent value="projects" className="mt-4 space-y-3">
          {projects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No projects yet. Deploy a goal above to get started.</p>
            </div>
          )}
          {projects.map(p => {
            const ptasks = projectTasks(p.id);
            const isExpanded = expandedProject === p.id;
            return (
              <Card key={p.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedProject(isExpanded ? null : p.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground truncate">{p.title}</p>
                        <Badge className={p.status === "active" ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}>{p.status}</Badge>
                        <Badge variant="outline" className="text-xs">P{p.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{p.goal}</p>
                      {p.executive_summary && <p className="text-xs text-muted-foreground mt-1 italic">{p.executive_summary}</p>}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground ml-2 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                  {isExpanded && ptasks.length > 0 && (
                    <div className="mt-3 border-t border-border pt-3 space-y-2">
                      {ptasks.map(t => (
                        <div key={t.id} className="flex items-start justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`flex items-center gap-1 ${TASK_STATUS_COLORS[t.status] || "text-muted-foreground"}`}>
                              {TASK_STATUS_ICONS[t.status]}
                            </span>
                            <span className="text-foreground truncate">{t.title}</span>
                            <span className="text-xs text-muted-foreground">{t.agent_key.replace(/_/g, " ")}</span>
                          </div>
                          <Badge className={`text-xs flex-shrink-0 ml-2 ${AUTH_COLORS[t.authority_level] || ""}`}>{AUTH_LABELS[t.authority_level]}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{ptasks.length} tasks</span>
                    <span>{ptasks.filter(t => t.status === "completed").length} done</span>
                    {ptasks.some(t => t.status === "awaiting_approval") && <span className="text-yellow-400">• needs approval</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Decision Queue */}
        <TabsContent value="queue" className="mt-4 space-y-3">
          {pendingApprovals.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No pending approvals — Ricky is operating within its approved parameters.</p>
            </div>
          )}
          {pendingApprovals.map(a => (
            <Card key={a.id} className="glass border border-yellow-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{a.action_type.replace(/_/g, " ")}</p>
                    {a.human_summary && <p className="text-sm text-muted-foreground mt-1">{a.human_summary}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(a.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button size="sm" onClick={() => resolveApproval(a.id, "approved")} className="gap-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20">
                      <CheckCircle className="w-3 h-3" />Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolveApproval(a.id, "rejected")} className="gap-1 text-destructive hover:bg-destructive/10">
                      <XCircle className="w-3 h-3" />Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Agents */}
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(a => (
              <Card key={a.id} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-foreground text-sm">{a.display_name}</p>
                    <Badge className={`text-xs ${AUTH_COLORS[a.authority_ceiling] || ""}`}>{AUTH_LABELS[a.authority_ceiling]}</Badge>
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mb-2">{a.description}</p>}
                  {a.kpi_metric && <p className="text-xs text-muted-foreground italic">KPI: {a.kpi_metric}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Authority Level Legend */}
          <Card className="glass mt-4">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Authority Levels</p>
              <div className="space-y-2">
                {([0, 1, 2, 3, 4] as const).map(level => (
                  <div key={level} className="flex items-center gap-3">
                    <Badge className={`text-xs w-20 justify-center ${AUTH_COLORS[level]}`}>{AUTH_LABELS[level]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {level === 0 && "Research, summarize, classify — fully automated, no side effects"}
                      {level === 1 && "Draft, generate, plan in sandbox — automated, human reviews before release"}
                      {level === 2 && "Update internal records, tag leads, run approved tests — automated with audit logs"}
                      {level === 3 && "Send SMS/email, publish content, change live automations — requires your approval"}
                      {level === 4 && "Financial, legal, delete data — human-only, never automated"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnosis */}
        {diagnosis && (
          <TabsContent value="diagnosis" className="mt-4 space-y-3">
            {(diagnosis.opportunities || []).sort((a, b) => b.priority_score - a.priority_score).map((opp, i) => (
              <Card key={i} className="glass">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-foreground">{opp.title}</p>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <Badge className={`text-xs ${AUTH_COLORS[opp.authority_level_required] || ""}`}>{AUTH_LABELS[opp.authority_level_required]}</Badge>
                      <Badge variant="outline" className="text-xs">Score {opp.priority_score}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{opp.description}</p>
                  {opp.roi_estimate && <p className="text-xs text-green-400 mt-2">ROI: {opp.roi_estimate}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
