import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Users, Zap, Shield, Clock, Check, X, AlertTriangle,
  Activity, ChevronRight, RefreshCw, Play, Bell, BarChart3,
  Building2, Target, FileText, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import WorkforceApprovals from "./WorkforceApprovals";

interface Props {
  businessId: string | null;
}

interface Workflow {
  id: string;
  title: string;
  goal: string;
  status: string;
  priority: number;
  initiating_agent_slug: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface WorkflowDetail extends Workflow {
  tasks: Task[];
  events: ExecutionEvent[];
  escalations: Escalation[];
  approvals: WorkflowApproval[];
}

interface Task {
  id: string;
  title: string;
  task_category: string | null;
  assigned_agent_slug: string | null;
  status: string;
  retry_count: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ExecutionEvent {
  id: string;
  agent_slug: string | null;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown>;
}

interface Escalation {
  id: string;
  originating_slug: string | null;
  trigger_type: string;
  severity: string;
  status: string;
  created_at: string;
}

interface WorkflowApproval {
  id: string;
  action_type: string;
  risk_level: string;
  human_summary: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

interface Department {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
}

interface AgentDef {
  slug: string;
  display_name: string;
  description: string | null;
  department_id: string | null;
  parent_slug: string | null;
  role_type: string;
  required_plan: string | null;
  required_addon: string | null;
}

interface PerformanceSummary {
  workflowStatusCounts: Record<string, number>;
  pendingApprovals: number;
  openEscalations: number;
  recentRollups: Array<{
    agent_slug: string;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    escalation_count: number;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft:                  "bg-slate-500/10 text-slate-400 border-slate-500/20",
  queued:                 "bg-blue-500/10 text-blue-400 border-blue-500/20",
  running:                "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  awaiting_customer_input:"bg-orange-500/10 text-orange-400 border-orange-500/20",
  awaiting_approval:      "bg-purple-500/10 text-purple-400 border-purple-500/20",
  blocked:                "bg-red-500/10 text-red-400 border-red-500/20",
  completed:              "bg-green-500/10 text-green-400 border-green-500/20",
  failed:                 "bg-destructive/10 text-destructive border-destructive/20",
  cancelled:              "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  low:      "bg-blue-500/10 text-blue-400",
  medium:   "bg-yellow-500/10 text-yellow-500",
  high:     "bg-orange-500/10 text-orange-400",
  critical: "bg-destructive/10 text-destructive",
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callWorkforceFunction(fnName: string, path: string, method: "GET" | "POST", body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const url = `${SUPABASE_URL}/functions/v1/${fnName}/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

export default function WorkforceDashboard({ businessId }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<AgentDef[]>([]);
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadWorkflows = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await callWorkforceFunction("workforce-workflow", "list", "GET",
        undefined).catch(() => null);
      // Fallback: direct Supabase query
      const { data: wf } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("agent_workflows" as any)
        .select("id, title, goal, status, priority, initiating_agent_slug, created_at, updated_at, started_at, completed_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(25);
      setWorkflows((wf as Workflow[]) ?? []);
    } catch {
      // silent — table may not exist in dev
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadDepartments = useCallback(async () => {
    try {
      const data = await callWorkforceFunction("workforce-tasks", "departments", "GET");
      setDepartments(data.departments ?? []);
      setAgents(data.agents ?? []);
    } catch {
      // silent — table may not exist yet
    }
  }, []);

  const loadPerformance = useCallback(async () => {
    if (!businessId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/workforce-performance/summary?businessId=${businessId}`,
        { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } },
      );
      if (res.ok) {
        const data = await res.json();
        setPerformance(data);
      }
    } catch {
      // silent
    }
  }, [businessId]);

  const loadWorkflowDetail = useCallback(async (workflowId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/workforce-workflow/detail?workflowId=${workflowId}`,
        { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY } },
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedWorkflow({ ...data.workflow, tasks: data.tasks, events: data.events, escalations: data.escalations, approvals: data.approvals });
      }
    } catch {
      toast({ title: "Could not load workflow detail", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (businessId) {
      loadWorkflows();
      loadDepartments();
      loadPerformance();
    }
  }, [businessId, loadWorkflows, loadDepartments, loadPerformance]);

  const handleCreateWorkflow = async () => {
    if (!businessId || !goalInput.trim()) return;
    setSubmitting(true);
    try {
      const data = await callWorkforceFunction("workforce-workflow", "create", "POST", {
        businessId,
        goal: goalInput.trim(),
        title: goalInput.trim().substring(0, 100),
        source: "ui",
      });
      toast({ title: "Workflow created", description: `ID: ${data.workflowId}` });
      setGoalInput("");
      await loadWorkflows();
    } catch (err) {
      toast({ title: "Failed to create workflow", description: String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!businessId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a business to view the Agent Workforce
      </div>
    );
  }

  const agentsByDept = departments.map((dept) => ({
    dept,
    members: agents.filter((a) => a.department_id === dept.id),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">AI Workforce</h2>
            <p className="text-sm text-muted-foreground">Orchestrated agent teams working toward your business goals</p>
          </div>
        </div>
        {performance && (
          <div className="flex items-center gap-4 text-sm">
            {(performance.pendingApprovals ?? 0) > 0 && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 gap-1">
                <Bell className="w-3 h-3" />
                {performance.pendingApprovals} pending approval{performance.pendingApprovals !== 1 ? "s" : ""}
              </Badge>
            )}
            {(performance.openEscalations ?? 0) > 0 && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1">
                <AlertTriangle className="w-3 h-3" />
                {performance.openEscalations} escalation{performance.openEscalations !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Current Work
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> Approvals
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* New workflow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> Start a New Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Describe your goal, e.g. 'Create a 30-second video promoting our summer sale and prepare it for Instagram'"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleCreateWorkflow}
                  disabled={submitting || !goalInput.trim()}
                  className="gap-2"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {submitting ? "Starting..." : "Start Workflow"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Workflow list */}
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Recent Workflows</h3>
            <Button variant="ghost" size="sm" onClick={loadWorkflows} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>

          {selectedWorkflow ? (
            <WorkflowDetailPanel
              detail={selectedWorkflow}
              onBack={() => setSelectedWorkflow(null)}
              onRefresh={() => loadWorkflowDetail(selectedWorkflow.id)}
            />
          ) : workflows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Brain className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">No workflows yet. Start one above to put your agent team to work.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {workflows.map((wf) => (
                <Card
                  key={wf.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => loadWorkflowDetail(wf.id).then(() => setSelectedWorkflow(null))}
                >
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{wf.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{wf.goal}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[wf.status])}>
                        {wf.status.replace(/_/g, " ")}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DEPARTMENTS TAB */}
        <TabsContent value="departments" className="mt-4">
          {agentsByDept.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Agent directory loading...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {agentsByDept.map(({ dept, members }) => (
                <Card key={dept.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      {dept.display_name}
                    </CardTitle>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground">{dept.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {members.map((agent) => (
                        <div key={agent.slug} className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              agent.role_type === "orchestrator" ? "bg-primary" :
                              agent.role_type === "manager" ? "bg-blue-400" : "bg-green-400",
                            )} />
                            <span className={agent.role_type === "manager" ? "font-medium" : "text-muted-foreground"}>
                              {agent.display_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {agent.required_plan && (
                              <Badge variant="outline" className="text-xs py-0">
                                {agent.required_plan}
                              </Badge>
                            )}
                            {agent.required_addon && (
                              <Badge variant="outline" className="text-xs py-0 bg-orange-500/10 text-orange-400 border-orange-500/20">
                                add-on
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {members.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No agents in this department</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* APPROVALS TAB */}
        <TabsContent value="approvals" className="mt-4">
          <WorkforceApprovals businessId={businessId} onApprovalResolved={loadPerformance} />
        </TabsContent>

        {/* PERFORMANCE TAB */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          {!performance ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Performance data loading...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(performance.workflowStatusCounts).map(([status, count]) => (
                  <Card key={status}>
                    <CardContent className="py-4 text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">{status.replace(/_/g, " ")}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {performance.recentRollups.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Agent Performance (Last 24h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {performance.recentRollups.map((r) => {
                        const rate = r.total_tasks > 0 ? Math.round((r.completed_tasks / r.total_tasks) * 100) : 0;
                        return (
                          <div key={r.agent_slug} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate max-w-[200px]">{r.agent_slug}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <span>{r.total_tasks} tasks</span>
                              <span className="text-green-400">{r.completed_tasks} ok</span>
                              {r.failed_tasks > 0 && <span className="text-destructive">{r.failed_tasks} failed</span>}
                              <span className="font-medium">{rate}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workflow Detail Panel
// ---------------------------------------------------------------------------
function WorkflowDetailPanel({
  detail, onBack, onRefresh,
}: {
  detail: WorkflowDetail;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{detail.title}</CardTitle>
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[detail.status])}>
              {detail.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{detail.goal}</p>
        </CardHeader>
      </Card>

      {/* Tasks */}
      {detail.tasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" /> Tasks ({detail.tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <p className="truncate">{task.title}</p>
                  {task.assigned_agent_slug && (
                    <p className="text-xs text-muted-foreground">{task.assigned_agent_slug}</p>
                  )}
                </div>
                <Badge variant="outline" className={cn("text-xs ml-2 shrink-0", STATUS_COLORS[task.status])}>
                  {task.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Escalations */}
      {detail.escalations.filter((e) => e.status === "open").length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-4 h-4" /> Open Escalations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.escalations.filter((e) => e.status === "open").map((esc) => (
              <div key={esc.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{esc.trigger_type.replace(/_/g, " ")}</p>
                  {esc.originating_slug && (
                    <p className="text-xs text-muted-foreground">from {esc.originating_slug}</p>
                  )}
                </div>
                <Badge className={cn("text-xs", SEVERITY_COLORS[esc.severity])}>
                  {esc.severity}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {detail.events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detail.events.slice(-20).reverse().map((evt) => (
                <div key={evt.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 mt-0.5">{new Date(evt.created_at).toLocaleTimeString()}</span>
                  <span className="text-foreground font-medium">{evt.event_type.replace(/_/g, " ")}</span>
                  {evt.agent_slug && <span>· {evt.agent_slug}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
