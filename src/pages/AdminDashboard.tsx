import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft, Users, DollarSign, Megaphone, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminStatsCards from "@/components/admin/AdminStatsCards";
import TeamManagement from "@/components/admin/TeamManagement";
import AffiliatePayoutManagement from "@/components/admin/AffiliatePayoutManagement";
import AdvertiserManagement from "@/components/admin/AdvertiserManagement";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0, totalBusinesses: 0, totalReferrals: 0,
    pendingPayouts: 0, activeAds: 0, totalAdRevenue: 0,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { navigate("/login"); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) { navigate("/app"); return; }
      setIsAdmin(true);
      setLoading(false);
    };
    checkAdmin();
  }, [user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      const [profiles, businesses, referrals, payouts, ads, adCampaigns] = await Promise.all([
        supabase.from("profiles").select("user_id", { count: "exact" }),
        supabase.from("businesses").select("id", { count: "exact" }),
        supabase.from("referral_codes").select("id, conversions"),
        supabase.from("affiliate_payouts").select("amount_cents").eq("status", "pending"),
        supabase.from("ad_placements").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("ad_campaigns").select("spent_cents"),
      ]);

      setStats({
        totalUsers: profiles.count || 0,
        totalBusinesses: businesses.count || 0,
        totalReferrals: referrals.data?.reduce((sum, r) => sum + (r.conversions || 0), 0) || 0,
        pendingPayouts: payouts.data?.reduce((sum, p) => sum + p.amount_cents, 0) || 0,
        activeAds: ads.count || 0,
        totalAdRevenue: adCampaigns.data?.reduce((sum, c) => sum + c.spent_cents, 0) || 0,
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 flex items-center justify-between border-b border-border px-6 bg-card/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app")}><ArrowLeft className="w-4 h-4" /></Button>
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-display font-bold">Admin Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign Out</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <AdminStatsCards stats={stats} />

        <Tabs defaultValue="team" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Team
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Affiliates
            </TabsTrigger>
            <TabsTrigger value="advertisers" className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Advertisers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="mt-6">
            <TeamManagement currentUserId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="affiliates" className="mt-6">
            <AffiliatePayoutManagement />
          </TabsContent>

          <TabsContent value="advertisers" className="mt-6">
            <AdvertiserManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
