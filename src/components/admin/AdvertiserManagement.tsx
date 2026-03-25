import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Megaphone, Plus, Eye, DollarSign, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Advertiser {
  id: string;
  company_name: string;
  contact_email: string;
  contact_name: string | null;
  industry: string;
  status: string;
  balance_cents: number;
  total_spent_cents: number;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget_cents: number;
  spent_cents: number;
  advertiser_id: string;
}

const AdvertiserManagement = () => {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAdv, setNewAdv] = useState({ company_name: "", contact_email: "", industry: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("admin-users", {
        body: { action: "list_advertisers" },
      });
      setAdvertisers(data?.advertisers || []);
      setCampaigns(data?.campaigns || []);
    } catch (err) {
      console.error("Failed to fetch advertiser data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateAdvertiser = async () => {
    if (!newAdv.company_name || !newAdv.contact_email || !newAdv.industry) {
      toast.error("All fields required");
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "create_advertiser", ...newAdv },
      });
      if (error) throw error;
      toast.success("Advertiser created!");
      setShowAddForm(false);
      setNewAdv({ company_name: "", contact_email: "", industry: "" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create advertiser");
    }
  };

  const handleUpdateStatus = async (advertiserId: string, status: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-users", {
        body: { action: "update_advertiser_status", advertiser_id: advertiserId, status },
      });
      if (error) throw error;
      toast.success(`Advertiser ${status}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-400";
      case "pending": return "bg-yellow-500/20 text-yellow-400";
      case "suspended": return "bg-red-500/20 text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Advertiser Accounts
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" /> Add Advertiser
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="p-4 border border-border rounded-lg space-y-3 bg-muted/20">
              <Input placeholder="Company name" value={newAdv.company_name} onChange={e => setNewAdv(p => ({ ...p, company_name: e.target.value }))} />
              <Input placeholder="Contact email" value={newAdv.contact_email} onChange={e => setNewAdv(p => ({ ...p, contact_email: e.target.value }))} />
              <Input placeholder="Industry" value={newAdv.industry} onChange={e => setNewAdv(p => ({ ...p, industry: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateAdvertiser}>Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading advertisers...</p>
          ) : advertisers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advertisers yet. Click "Add Advertiser" to create one.</p>
          ) : (
            <div className="space-y-3">
              {advertisers.map((adv) => (
                <div key={adv.id} className="p-4 border border-border rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{adv.company_name}</p>
                      <p className="text-xs text-muted-foreground">{adv.contact_email} · {adv.industry}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(adv.status)}`}>
                      {adv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Balance: ${(adv.balance_cents / 100).toFixed(2)}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Spent: ${(adv.total_spent_cents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {adv.status === "pending" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateStatus(adv.id, "active")}>Approve</Button>
                    )}
                    {adv.status === "active" && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleUpdateStatus(adv.id, "suspended")}>Suspend</Button>
                    )}
                    {adv.status === "suspended" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleUpdateStatus(adv.id, "active")}>Reactivate</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-accent" /> Ad Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns yet. Campaigns are created by advertisers.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 border border-border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Budget: ${(c.budget_cents / 100).toFixed(2)} · Spent: ${(c.spent_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvertiserManagement;
