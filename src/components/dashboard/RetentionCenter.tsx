import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, RefreshCw, Star } from "lucide-react";

interface Props { businessId: string | null; }

interface Segment { label: string; days: number; count: number; segment_type: string; }
interface ReviewStats { total: number; positive: number; negative: number; pending: number; }

export default function RetentionCenter({ businessId }: Props) {
  const { toast } = useToast();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; segment_type: string; status: string; contacts_targeted: number; contacts_responded: number; appointments_booked: number; created_at: string }>>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ total: 0, positive: 0, negative: 0, pending: 0 });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);

    const now = new Date();
    const cut90 = new Date(now); cut90.setDate(cut90.getDate() - 90);
    const cut180 = new Date(now); cut180.setDate(cut180.getDate() - 180);

    const [{ data: c90 }, { data: c180 }, { data: revs }, { data: cams }] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact" }).eq("business_id", businessId).eq("customer_status", "customer").lt("last_seen_at", cut90.toISOString()),
      supabase.from("contacts").select("id", { count: "exact" }).eq("business_id", businessId).eq("customer_status", "customer").lt("last_seen_at", cut180.toISOString()),
      supabase.from("review_requests").select("*").eq("business_id", businessId),
      supabase.from("reactivation_campaigns").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    ]);

    setSegments([
      { label: "Inactive 90+ days", days: 90, count: c90?.length || 0, segment_type: "inactive_90" },
      { label: "Inactive 180+ days", days: 180, count: c180?.length || 0, segment_type: "inactive_180" },
    ]);

    const rs: ReviewStats = {
      total: revs?.length || 0,
      positive: revs?.filter(r => r.response_sentiment === "positive").length || 0,
      negative: revs?.filter(r => r.response_sentiment === "negative").length || 0,
      pending: revs?.filter(r => r.status === "pending").length || 0,
    };
    setReviewStats(rs);
    setCampaigns(cams || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [businessId]);

  const startCampaign = async (segmentType: string) => {
    if (!businessId) return;
    const segment = segments.find(s => s.segment_type === segmentType);
    const { error } = await supabase.from("reactivation_campaigns").insert({
      business_id: businessId,
      segment_type: segmentType,
      status: "active",
      contacts_targeted: segment?.count || 0,
      started_at: new Date().toISOString(),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Campaign started", description: `Reactivation campaign started for ${segment?.label}` });
    load();
  };

  const CAMPAIGN_COLORS: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-green-500/10 text-green-400",
    completed: "bg-blue-500/10 text-blue-400",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Retention Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Win back inactive customers and monitor reviews</p>
      </div>

      {/* Segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {segments.map(seg => (
          <Card key={seg.segment_type} className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="font-medium text-foreground">{seg.label}</p>
                </div>
                <span className="text-2xl font-bold text-foreground">{seg.count}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Customers who haven't been seen in {seg.days}+ days</p>
              <Button
                size="sm"
                disabled={seg.count === 0}
                onClick={() => startCampaign(seg.segment_type)}
                className="w-full gap-2"
              >
                <RefreshCw className="w-3 h-3" />Start Reactivation Campaign
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Stats */}
      <Card className="glass">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400" />Review Requests</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Sent", value: reviewStats.total },
              { label: "Positive", value: reviewStats.positive },
              { label: "Negative", value: reviewStats.negative },
              { label: "Pending", value: reviewStats.pending },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active campaigns */}
      {campaigns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Reactivation Campaigns</h2>
          <div className="space-y-2">
            {campaigns.map(c => (
              <Card key={c.id} className="glass">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground capitalize">{c.segment_type.replace(/_/g, " ")}</p>
                      <Badge className={CAMPAIGN_COLORS[c.status]}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.contacts_targeted} targeted · {c.contacts_responded} responded · {c.appointments_booked} booked
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
