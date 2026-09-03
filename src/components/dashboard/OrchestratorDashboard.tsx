import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Zap, Shield, Clock, Check, X, AlertTriangle, Activity,
  Target, ChevronDown, ChevronUp, RefreshCw, Play,
} from "lucide-react";

interface Props {
  businessId: string | null;
}

interface AgentManifestRow {
  id: string;
  agent_key: string;
  display_name: string;
  description: string | null;
  authority_ceiling: number;
  kpi_metric: string | null;
  active: boolean;
}

interface OrchestratorTask {
  id: string;
  project_id: string;
  agent_key: string;
  title: string;
  description: string | null;
  authority_level: number;
  status: string;
  approval_id: string | null;
  created_at: string;
}

interface OrchestratorProject {
  id: string;
  title: string;
  goal: string;
  status: string;
  priority: number;
  executive_summary: string | null;
  created_at: string;
  tasks: OrchestratorTask[];
}

interface DiagnosisOpportunity {
  title: string;
  current_state: string;
  automated_state: string;
  implementation_effort: string;
  time_to_value_days: number;
  estimated_hours_saved_per_month: number;
  estimated_revenue_impact: string;
  authority_level_required: number;
  ricky_feature: string;
  priority_score: number;
}

interface DiagnosisReport {
  executive_summary: string;
  maturity_score: number;
  opportunities: DiagnosisOpportunity[];
  recommended_first_action: string;
  missing_setup: string[];
}

const AUTHORITY_META: Record<number, { label: string; color: string; description: string }> = {
  0: { label: "L0", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", description: "Analyze only" },
  1: { label: "L1", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", description: "Prepare" },
  2: { label: "L2", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", description: "Execute internal" },
  3: { label: "L3", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", description: "Approval required" },
  4: { label: "L4", color: "bg-destructive/10 text-destructive border-destructive/20", description: "Human only" },
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500/10 text-slate-400",
  running: "bg-blue-500/10 text-blue-400",
  completed: "bg-green-500/10 text-green-400",
  awaiting_approval: "bg-yellow-500/10 text-yellow-400",
  blocked: "bg-orange-500/10 text-orange-400",
  failed: "bg-destructive/10 text-destructive",
};

const EFFORT_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-400 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function OrchestratorDashboard({ businessId }: Props) {
  const { toast } = useToast();

  const [goal, setGoal] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [projects, setProjects] = useState<OrchestratorProject[]>([]);
  const [agents, setAgents] = useState<AgentManifestRow[]>([]);
  const [pendingTasks, setPendingTasks] = useState<OrchestratorTask[]>([]);
  const [diagnosisReport, setDiagnosisReport] = useState<DiagnosisReport | null>(null);
  const [runningDiagnosis, setRunningDiagnosis] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    if (!businessId) return;
    const { data: projectRows } = await supabase
      .from("orchestrator_projects")
      .select("id, title, goal, status, priority, executive_summary, created_at")
      .eq("business_id", businessId)
      .eq("status", "active")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (!projectRows) return;

    const projectIds = projectRows.map((p: { id: string }) => p.id);
    let taskRows: (OrchestratorTask & { project_id: string })[] = [];
    if (projectIds.length > 0) {
      const { data: tasks } = await supabase
        .from("orchestrator_tasks")
        .select("id, project_id, agent_key, title, description, authority_level, status, approval_id, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true });
      taskRows = (tasks || []) as (OrchestratorTask & { project_id: string })[];
    }

    const enriched: OrchestratorProject[] = projectRows.map((p: Omit<OrchestratorProject, "tasks">) => ({
      ...p,
      tasks: taskRows.filter((t) => t.project_id === p.id),
    }));

    setProjects(enriched);
    setPendingTasks(taskRows.filter((t) => t.status === "awaiting_approval"));
  }, [businessId]);

  const loadAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agent_manifest")
      .select("id, agent_key, display_name, description, authority_ceiling, kpi_metric, active")
      .order("authority_ceiling", { ascending: true });
    setAgents(data || []);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    Promise.all([loadProjects(), loadAgents()]).finally(() => setLoading(false));
  }, [businessId, loadProjects, loadAgents]);

  const handleDeploy = async () => {
    if (!businessId || !goal.trim()) return;
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke("ricky-orchestrator", {
        body: { businessId, goal: goal.trim() },
      });
      if (error) throw new Error(error.message);
      toast({
        title: "Project created",
        description: `"${data.title}" — ${data.tasksCreated} task${data.tasksCreated !== 1 ? "s" : ""} queued${data.approvalsRequired > 0 ? `, ${data.approvalsRequired} need approval` : ""}.`,
      });
      setGoal("");
      await loadProjects();
    } catch (err) {
      toast({
        title: "Deploy failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeploying(false);
    }
  };

  const handleApproveTask = async (task: OrchestratorTask) => {
    if (!task.approval_id) return;
    const { error } = await supabase
      .from("approvals")
      .update({ status: "approved", resolved_at: new Date().toISOString() })
      .eq("id", task.approval_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("orchestrator_tasks")
      .update({ status: "pending" })
      .eq("id", task.id);
    await supabase.from("agent_jobs").insert({
      business_id: businessId,
      job_type: task.agent_key,
      status: "queued",
      input_json: { orchestrator_task_id: task.id },
    });
    toast({ title: "Task approved", description: "Ricky will execute this now." });
    await loadProjects();
  };

  const handleRejectTask = async (task: OrchestratorTask) => {
    if (!task.approval_id) return;
    const { error } = await supabase
      .from("approvals")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", task.approval_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("orchestrator_tasks").update({ status: "failed" }).eq("id", task.id);
    toast({ title: "Task rejected" });
    await loadProjects();
  };

  const handleRunDiagnosis = async () => {
    if (!businessId) return;
    setRunningDiagnosis(true);
    try {
      const { data, error } = await supabase.functions.invoke("workflow-diagnosis", {
        body: { businessId },
      });
      if (error) throw new Error(error.message);
      setDiagnosisReport(data as DiagnosisReport);
    } catch (err) {
      toast({
        title: "Diagnosis failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRunningDiagnosis(false);
    }
  };

  const toggleProjectExpanded = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const taskProgress = (project: OrchestratorProject) => {
    const total = project.tasks.length;
    const done = project.tasks.filter((t) => t.status === "completed").length;
    return { done, total };
  };

  if (!businessId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a business to use the AI Command Center.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">AI Command Center</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Tell Ricky COO what you want to achieve. It will decompose your goal into a team of specialist agents.
        </p>
      </div>

      {/* Goal Input */}
      <Card className="glass">
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Tell Ricky what you want to achieve... e.g. 'Get 20 more reviews this month' or 'Fill my schedule for next week'"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleDeploy}
              disabled={deploying || !goal.trim()}
              className="gap-2"
            >
              {deploying ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Ricky is thinking...</>
              ) : (
                <><Zap className="w-4 h-4" />Deploy Ricky</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Active Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="decisions">
            Decision Queue
            {pendingTasks.length > 0 && (
              <span className="ml-1 bg-yellow-500/20 text-yellow-400 text-xs px-1.5 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
        </TabsList>

        {/* Active Projects */}
        <TabsContent value="projects" className="mt-4 space-y-3">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading projects...</p>
            </div>
          )}
          {!loading && projects.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No active projects. Tell Ricky what you want to achieve above.</p>
            </div>
          )}
          {projects.map((project) => {
            const { done, total } = taskProgress(project);
            const isExpanded = expandedProjects.has(project.id);
            const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={project.id} className="glass">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-semibold">{project.title}</CardTitle>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          P{project.priority}
                        </Badge>
                      </div>
                      {project.executive_summary && (
                        <p className="text-sm text-muted-foreground mt-1">{project.executive_summary}</p>
                      )}
                    </div>
                    <button
                      onClick={() => toggleProjectExpanded(project.id)}
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{done}/{total} tasks</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="px-4 pb-4 space-y-2">
                    {project.tasks.map((task) => {
                      const auth = AUTHORITY_META[task.authority_level] || AUTHORITY_META[0];
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30 text-sm"
                        >
                          <Badge className={`${auth.color} flex-shrink-0 text-xs border`}>
                            {auth.label}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground leading-tight">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.agent_key.replace(/_/g, " ")}</p>
                          </div>
                          <Badge className={`${TASK_STATUS_COLORS[task.status] || ""} flex-shrink-0 text-xs`}>
                            {task.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Decision Queue */}
        <TabsContent value="decisions" className="mt-4 space-y-3">
          {pendingTasks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No decisions pending. Ricky is operating within approved parameters.</p>
            </div>
          )}
          {pendingTasks.map((task) => (
            <Card key={task.id} className="glass border border-yellow-500/20">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.agent_key.replace(/_/g, " ")} · L{task.authority_level} action
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApproveTask(task)}
                      className="gap-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20"
                    >
                      <Check className="w-3 h-3" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRejectTask(task)}
                      className="gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <X className="w-3 h-3" />Reject
                    </Button>
                  </div>
                </div>
                {task.description && (
                  <p className="text-sm text-foreground bg-secondary/30 rounded p-2">{task.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Requested {new Date(task.created_at).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Agent Status */}
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => {
              const auth = AUTHORITY_META[agent.authority_ceiling] || AUTHORITY_META[0];
              return (
                <Card key={agent.id} className="glass">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-semibold text-sm text-foreground">{agent.display_name}</p>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${agent.active ? "bg-green-400" : "bg-muted-foreground"}`} />
                        <Badge className={`${auth.color} text-xs border`}>{auth.label}</Badge>
                      </div>
                    </div>
                    {agent.description && (
                      <p className="text-xs text-muted-foreground mb-2">{agent.description}</p>
                    )}
                    {agent.kpi_metric && (
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <Activity className="w-3 h-3" />{agent.kpi_metric}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Workflow Diagnosis */}
        <TabsContent value="diagnosis" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Workflow Diagnosis</h3>
              <p className="text-sm text-muted-foreground">
                Ricky will analyze your current usage and surface automation opportunities.
              </p>
            </div>
            <Button
              onClick={handleRunDiagnosis}
              disabled={runningDiagnosis}
              variant="outline"
              className="gap-2"
            >
              {runningDiagnosis ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing...</>
              ) : (
                <><Play className="w-4 h-4" />Run Diagnosis</>
              )}
            </Button>
          </div>

          {diagnosisReport && (
            <div className="space-y-4">
              {/* Summary */}
              <Card className="glass">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">Executive Summary</h4>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      Maturity {diagnosisReport.maturity_score}/10
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{diagnosisReport.executive_summary}</p>
                  {diagnosisReport.recommended_first_action && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-medium text-primary mb-1">Recommended this week</p>
                      <p className="text-sm text-foreground">{diagnosisReport.recommended_first_action}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Missing setup */}
              {diagnosisReport.missing_setup && diagnosisReport.missing_setup.length > 0 && (
                <Card className="glass border border-orange-500/20">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />Not yet configured
                    </p>
                    <ul className="space-y-1">
                      {diagnosisReport.missing_setup.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400/50 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Opportunities */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">
                  Top Opportunities ({diagnosisReport.opportunities?.length || 0})
                </h4>
                {(diagnosisReport.opportunities || []).map((opp, i) => (
                  <Card key={i} className="glass">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-sm text-foreground">{opp.title}</p>
                            <Badge className={`${EFFORT_COLORS[opp.implementation_effort] || ""} text-xs border`}>
                              {opp.implementation_effort} effort
                            </Badge>
                            <Badge className={`${AUTHORITY_META[opp.authority_level_required]?.color || ""} text-xs border`}>
                              {AUTHORITY_META[opp.authority_level_required]?.label || "L0"}
                            </Badge>
                          </div>
                          <p className="text-xs text-primary">{opp.ricky_feature}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-primary">{opp.priority_score}</p>
                          <p className="text-xs text-muted-foreground">priority</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-2 rounded bg-secondary/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Currently</p>
                          <p className="text-sm text-foreground">{opp.current_state}</p>
                        </div>
                        <div className="p-2 rounded bg-primary/5 border border-primary/10">
                          <p className="text-xs font-medium text-primary mb-1">With Ricky</p>
                          <p className="text-sm text-foreground">{opp.automated_state}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {opp.time_to_value_days}d to value
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {opp.estimated_hours_saved_per_month}h/mo saved
                        </span>
                        {opp.estimated_revenue_impact && (
                          <span>{opp.estimated_revenue_impact}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!diagnosisReport && !runningDiagnosis && (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Run a diagnosis to see personalized automation opportunities.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
