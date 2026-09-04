import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Approval {
  id: string;
  workflow_id: string;
  task_id: string | null;
  action_type: string;
  risk_level: string;
  human_summary: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
  resolved_at: string | null;
  requested_payload: Record<string, unknown> | null;
}

interface WorkforceApprovalsProps {
  businessId: string;
  onApprovalResolved?: () => void;
}

async function callWorkforceFunction(
  fnName: string,
  path: string,
  options: { method?: string; params?: Record<string, string>; body?: unknown } = {}
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}/${path}`;
  const url = new URL(base);
  if (options.params) {
    Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const RISK_ICON: Record<string, JSX.Element> = {
  low: <Shield className="w-4 h-4" />,
  medium: <AlertTriangle className="w-4 h-4" />,
  high: <AlertTriangle className="w-4 h-4" />,
  critical: <AlertTriangle className="w-4 h-4" />,
};

function formatExpiry(expiresAt: string | null): { label: string; expired: boolean } {
  if (!expiresAt) return { label: "No expiry", expired: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff < 0) return { label: "Expired", expired: true };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { label: `Expires in ${mins}m`, expired: false };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `Expires in ${hrs}h`, expired: false };
  return { label: `Expires in ${Math.floor(hrs / 24)}d`, expired: false };
}

function ApprovalCard({
  approval,
  onDecide,
  deciding,
}: {
  approval: Approval;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
  deciding: string | null;
}) {
  const [showPayload, setShowPayload] = useState(false);
  const expiry = formatExpiry(approval.expires_at);
  const isDeciding = deciding === approval.id;

  return (
    <Card className="border border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLORS[approval.risk_level] ?? RISK_COLORS.medium}`}>
              {RISK_ICON[approval.risk_level] ?? RISK_ICON.medium}
              {approval.risk_level.toUpperCase()} RISK
            </span>
            <Badge variant="outline" className="text-xs capitalize">
              {approval.action_type.replace(/_/g, " ")}
            </Badge>
          </div>
          <span className={`text-xs flex items-center gap-1 ${expiry.expired ? "text-red-500" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3" />
            {expiry.label}
          </span>
        </div>
        <CardTitle className="text-sm font-medium mt-2">
          {approval.human_summary ?? approval.action_type.replace(/_/g, " ")}
        </CardTitle>
        <CardDescription className="text-xs">
          Requested {new Date(approval.created_at).toLocaleString()}
          {approval.workflow_id && (
            <span className="ml-2 font-mono opacity-60">
              WF: {approval.workflow_id.slice(0, 8)}…
            </span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {approval.requested_payload && Object.keys(approval.requested_payload).length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowPayload(!showPayload)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {showPayload ? "Hide" : "Show"} action details
            </button>
            {showPayload && (
              <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto max-h-40 font-mono">
                {JSON.stringify(approval.requested_payload, null, 2)}
              </pre>
            )}
          </div>
        )}

        {expiry.expired ? (
          <p className="text-xs text-red-500 italic">
            This approval request has expired. The agent action was not taken.
          </p>
        ) : (
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={isDeciding}
              onClick={() => onDecide(approval.id, "approved")}
            >
              {isDeciding ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <CheckCircle className="w-3 h-3 mr-1" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              disabled={isDeciding}
              onClick={() => onDecide(approval.id, "rejected")}
            >
              {isDeciding ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <XCircle className="w-3 h-3 mr-1" />
              )}
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResolvedApprovalRow({ approval }: { approval: Approval }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      {approval.status === "approved" ? (
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      ) : approval.status === "rejected" ? (
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">
          {approval.human_summary ?? approval.action_type.replace(/_/g, " ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}{" "}
          {approval.resolved_at ? `· ${new Date(approval.resolved_at).toLocaleString()}` : ""}
        </p>
      </div>
      <Badge
        variant="outline"
        className={`text-xs capitalize shrink-0 ${
          approval.status === "approved"
            ? "border-green-500/50 text-green-600"
            : approval.status === "rejected"
            ? "border-red-500/50 text-red-600"
            : "border-border/50 text-muted-foreground"
        }`}
      >
        {approval.status}
      </Badge>
    </div>
  );
}

export default function WorkforceApprovals({ businessId, onApprovalResolved }: WorkforceApprovalsProps) {
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [resolvedApprovals, setResolvedApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string;
    decision: "approved" | "rejected";
    summary: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setError(null);
    try {
      const [pendingRes, resolvedRes] = await Promise.all([
        callWorkforceFunction("workforce-approvals", "list", {
          params: { businessId, status: "pending" },
        }),
        callWorkforceFunction("workforce-approvals", "list", {
          params: { businessId, status: "approved" },
        }).catch(() => ({ approvals: [] })),
      ]);
      setPendingApprovals(pendingRes.approvals ?? []);
      setResolvedApprovals(resolvedRes.approvals ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function requestDecision(id: string, decision: "approved" | "rejected") {
    const approval = pendingApprovals.find((a) => a.id === id);
    if (!approval) return;
    setConfirmDialog({
      id,
      decision,
      summary: approval.human_summary ?? approval.action_type.replace(/_/g, " "),
    });
  }

  async function confirmDecision() {
    if (!confirmDialog) return;
    const { id, decision } = confirmDialog;
    setConfirmDialog(null);
    setDeciding(id);
    try {
      await callWorkforceFunction("workforce-approvals", "decide", {
        method: "POST",
        body: { approvalId: id, decision },
      });
      await load();
      onApprovalResolved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Decision failed");
    } finally {
      setDeciding(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={load} className="ml-2">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending approvals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Pending Approvals
            {pendingApprovals.length > 0 && (
              <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingApprovals.length}
              </span>
            )}
          </h3>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
            <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No pending approvals</p>
            <p className="text-xs mt-1">Agent actions that require your sign-off will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onDecide={requestDecision}
                deciding={deciding}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent resolved */}
      {resolvedApprovals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Recent Decisions</h3>
          <Card>
            <CardContent className="p-3">
              {resolvedApprovals.slice(0, 10).map((approval) => (
                <ResolvedApprovalRow key={approval.id} approval={approval} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.decision === "approved" ? "Approve Action?" : "Reject Action?"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.decision === "approved" ? (
                <>
                  Approving will allow the agent to proceed with:{" "}
                  <strong className="text-foreground">{confirmDialog?.summary}</strong>
                  <br />
                  <span className="text-xs mt-1 block">This decision is permanent and cannot be undone.</span>
                </>
              ) : (
                <>
                  Rejecting will block the agent action:{" "}
                  <strong className="text-foreground">{confirmDialog?.summary}</strong>
                  <br />
                  <span className="text-xs mt-1 block">This decision is permanent and cannot be undone.</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            {confirmDialog?.decision === "approved" ? (
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={confirmDecision}>
                <CheckCircle className="w-4 h-4 mr-1" /> Confirm Approve
              </Button>
            ) : (
              <Button variant="destructive" onClick={confirmDecision}>
                <XCircle className="w-4 h-4 mr-1" /> Confirm Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
