import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, Check, Wifi, WifiOff } from "lucide-react";

interface Alert {
  id: string; type: string; severity: string; title: string; message: string | null;
  acknowledged: boolean; created_at: string;
}

interface Props { businessId: string | null; }

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/5 border-destructive/20",
  warning: "bg-yellow-500/5 border-yellow-500/20",
  info: "bg-blue-500/5 border-blue-500/20",
};

const INTEGRATIONS = [
  { name: "Supabase DB", connected: true },
  { name: "Stripe Billing", connected: true },
  { name: "Twilio (Phone)", connected: false },
  { name: "ElevenLabs (Voice)", connected: false },
  { name: "Creatomate (Video)", connected: true },
];

export default function HealthMonitor({ businessId }: Props) {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("health_alerts")
      .select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(30);
    setAlerts(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const acknowledge = async (id: string) => {
    await supabase.from("health_alerts").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const active = alerts.filter(a => !a.acknowledged);
  const acknowledged = alerts.filter(a => a.acknowledged);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Health Monitor</h1>
        <p className="text-muted-foreground text-sm mt-1">System alerts and integration status</p>
      </div>

      {/* Integration Status */}
      <Card className="glass">
        <CardHeader><CardTitle className="text-foreground text-base">Integration Status</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {INTEGRATIONS.map(i => (
            <div key={i.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {i.connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm text-foreground">{i.name}</span>
              </div>
              <Badge className={i.connected ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"}>
                {i.connected ? "Connected" : "Not configured"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Active Alerts ({active.length})</h2>
        {active.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-sm">All clear — no active alerts</p>
          </div>
        )}
        <div className="space-y-3">
          {active.map(alert => (
            <Card key={alert.id} className={`glass border ${SEVERITY_COLORS[alert.severity]}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    {SEVERITY_ICONS[alert.severity]}
                    <div>
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      {alert.message && <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => acknowledge(alert.id)} className="text-xs">Acknowledge</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Acknowledged */}
      {acknowledged.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Acknowledged ({acknowledged.length})</h2>
          <div className="space-y-2 opacity-60">
            {acknowledged.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg">
                <Check className="w-3 h-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{alert.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
