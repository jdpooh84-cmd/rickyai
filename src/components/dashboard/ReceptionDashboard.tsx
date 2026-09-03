import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, PhoneIncoming, PhoneMissed, Calendar } from "lucide-react";

interface Call {
  id: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  duration_seconds: number;
  outcome: string | null;
  summary: string | null;
  transcript: string | null;
  started_at: string | null;
  created_at: string;
}

interface PhoneSettings {
  phone_mode: string;
  ai_number: string | null;
  fallback_number: string | null;
}

interface Props { businessId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/10 text-green-400",
  missed: "bg-destructive/10 text-destructive",
  in_progress: "bg-yellow-500/10 text-yellow-400",
  ringing: "bg-blue-500/10 text-blue-400",
  failed: "bg-muted text-muted-foreground",
};

const OUTCOME_ICONS: Record<string, string> = {
  appointment_booked: "📅",
  callback_requested: "📞",
  info_provided: "ℹ️",
  escalated: "⚠️",
  spam: "🚫",
  no_action: "—",
};

export default function ReceptionDashboard({ businessId }: Props) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [settings, setSettings] = useState<PhoneSettings | null>(null);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const load = async () => {
    if (!businessId) return;
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("phone_calls").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50),
      supabase.from("phone_settings").select("*").eq("business_id", businessId).maybeSingle(),
    ]);
    setCalls(c || []);
    setSettings(s);
  };

  useEffect(() => { load(); }, [businessId]);

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const recentCalls = calls.filter(c => new Date(c.created_at) >= weekAgo);
  const stats = {
    total: recentCalls.length,
    ai: recentCalls.filter(c => c.status === "completed").length,
    missed: recentCalls.filter(c => c.status === "missed").length,
    booked: recentCalls.filter(c => c.outcome === "appointment_booked").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Ricky Reception</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered phone answering</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={settings?.phone_mode === "always_ai" ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}>
            {settings?.phone_mode || "disabled"}
          </Badge>
          {settings?.ai_number && <span className="text-sm text-muted-foreground">{settings.ai_number}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Calls This Week", value: stats.total, icon: Phone },
          { label: "Answered by AI", value: stats.ai, icon: PhoneIncoming },
          { label: "Missed", value: stats.missed, icon: PhoneMissed },
          { label: "Appointments Booked", value: stats.booked, icon: Calendar },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call list */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Recent Calls</h2>
          {calls.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No calls yet. Set up your phone number in Reception Setup to start receiving calls.</p>}
          {calls.map(call => (
            <Card key={call.id} className={`glass cursor-pointer ${selectedCall?.id === call.id ? "border-primary" : ""}`} onClick={() => setSelectedCall(call)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{call.from_number || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{call.started_at ? new Date(call.started_at).toLocaleString() : "—"} · {call.duration_seconds}s</p>
                </div>
                <div className="flex gap-2 items-center">
                  {call.outcome && <span className="text-base">{OUTCOME_ICONS[call.outcome] || "?"}</span>}
                  <Badge className={`text-xs ${STATUS_COLORS[call.status] || "bg-muted text-muted-foreground"}`}>{call.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transcript viewer */}
        {selectedCall && (
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground text-base">Call Transcript</CardTitle>
              <p className="text-xs text-muted-foreground">{selectedCall.from_number} · {selectedCall.started_at ? new Date(selectedCall.started_at).toLocaleString() : "—"}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedCall.summary && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs font-semibold text-primary mb-1">Summary</p>
                  <p className="text-sm text-foreground">{selectedCall.summary}</p>
                </div>
              )}
              {selectedCall.outcome && (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{OUTCOME_ICONS[selectedCall.outcome]}</span>
                  <Badge className="capitalize">{selectedCall.outcome.replace(/_/g, " ")}</Badge>
                </div>
              )}
              {selectedCall.transcript ? (
                <div className="rounded-lg bg-secondary/20 p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs text-foreground whitespace-pre-wrap">{selectedCall.transcript}</pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No transcript available for this call.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
