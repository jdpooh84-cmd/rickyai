import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, Film, Cpu, HardDrive } from "lucide-react";
import { SEAT_ALLOWANCES } from "@/lib/stripe";

const UsageDashboard = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("usage_tracking")
        .select("*")
        .eq("user_id", user.id)
        .gte("period_start", periodStart)
        .limit(1)
        .maybeSingle();
      setUsage(data);
    };
    load();
  }, [user]);

  const items = [
    {
      icon: Film, label: "Video Renders",
      used: usage?.render_jobs_used || 0,
      limit: SEAT_ALLOWANCES.render_jobs,
    },
    {
      icon: Cpu, label: "AI Tokens",
      used: usage?.llm_tokens_used || 0,
      limit: SEAT_ALLOWANCES.llm_tokens,
      format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
    },
    {
      icon: HardDrive, label: "Storage",
      used: usage?.storage_bytes_used ? Math.round(usage.storage_bytes_used / 1073741824 * 10) / 10 : 0,
      limit: SEAT_ALLOWANCES.storage_gb,
      suffix: "GB",
    },
  ];

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-semibold text-foreground">Usage This Month</span>
      </div>
      {items.map(item => {
        const pct = Math.min((item.used / item.limit) * 100, 100);
        const fmt = item.format || String;
        return (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">{item.label}</span>
              <span className="text-[9px] text-muted-foreground">
                {fmt(item.used)}{item.suffix || ""} / {fmt(item.limit)}{item.suffix || ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 90 ? "bg-destructive" : pct > 70 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UsageDashboard;
