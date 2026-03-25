import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Check, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Payout {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  payout_method: string | null;
  created_at: string;
  paid_at: string | null;
  notes: string | null;
}

interface Referrer {
  user_id: string;
  code: string;
  conversions: number;
  commission_rate_percent: number;
}

const AffiliatePayoutManagement = () => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use admin-users function to get payouts (service role access)
      const { data: payoutData } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_payouts" },
      });
      setPayouts(payoutData?.payouts || []);

      const { data: refData } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_referrers" },
      });
      setReferrers(refData?.referrers || []);
    } catch (err) {
      console.error("Failed to fetch affiliate data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdatePayout = async (payoutId: string, newStatus: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "update_payout", payout_id: payoutId, status: newStatus },
      });
      if (error) throw error;
      toast.success(`Payout marked as ${newStatus}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payout");
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "paid": return <Check className="w-4 h-4 text-green-400" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" /> Top Affiliates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {referrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No affiliates yet.</p>
          ) : (
            <div className="space-y-2">
              {referrers.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 border border-border rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-foreground">Code: {r.code}</span>
                    <p className="text-xs text-muted-foreground">{r.commission_rate_percent}% commission</p>
                  </div>
                  <span className="text-sm font-bold text-primary">{r.conversions} conversions</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Affiliate Payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading payouts...</p>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts yet. Payouts appear when affiliates earn commissions.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 px-4 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    {statusIcon(p.status)}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        ${(p.amount_cents / 100).toFixed(2)} · {p.payout_method || "stripe"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.user_id.slice(0, 8)}... · {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {p.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleUpdatePayout(p.id, "paid")} className="h-7 text-xs">
                          <Check className="w-3 h-3 mr-1" /> Mark Paid
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleUpdatePayout(p.id, "rejected")} className="h-7 text-xs">
                          Reject
                        </Button>
                      </>
                    )}
                    {p.status !== "pending" && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        p.status === "paid" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {p.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliatePayoutManagement;
