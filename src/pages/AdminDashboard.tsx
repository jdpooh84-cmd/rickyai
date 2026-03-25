import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, DollarSign, TrendingUp, Eye, ShieldCheck, ArrowLeft, UserPlus, Activity, CreditCard, Search, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalReferrals: number;
  pendingPayouts: number;
  activeAds: number;
  totalAdRevenue: number;
  recentSignups: Array<{ email: string; created_at: string }>;
  topReferrers: Array<{ user_id: string; conversions: number; code: string }>;
}

interface ManagedUser {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalBusinesses: 0, totalReferrals: 0,
    pendingPayouts: 0, activeAds: 0, totalAdRevenue: 0,
    recentSignups: [], topReferrers: [],
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
        supabase.from("profiles").select("user_id, created_at, display_name", { count: "exact" }),
        supabase.from("businesses").select("id", { count: "exact" }),
        supabase.from("referral_codes").select("id, code, user_id, conversions").order("conversions", { ascending: false }).limit(10),
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
        recentSignups: [],
        topReferrers: (referrals.data || []).map(r => ({ user_id: r.user_id, conversions: r.conversions, code: r.code })),
      });
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Loading...</div>;
  if (!isAdmin) return null;

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { title: "Businesses", value: stats.totalBusinesses, icon: TrendingUp, color: "text-accent" },
    { title: "Referral Conversions", value: stats.totalReferrals, icon: UserPlus, color: "text-green-400" },
    { title: "Pending Payouts", value: `$${(stats.pendingPayouts / 100).toFixed(2)}`, icon: CreditCard, color: "text-yellow-400" },
    { title: "Active Ads", value: stats.activeAds, icon: Eye, color: "text-blue-400" },
    { title: "Ad Revenue", value: `$${(stats.totalAdRevenue / 100).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
  ];

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((s) => (
            <Card key={s.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" /> Top Referrers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topReferrers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No referrals yet. Affiliate program is ready for launch.</p>
              ) : (
                <div className="space-y-3">
                  {stats.topReferrers.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <span className="text-sm font-medium text-foreground">Code: {r.code}</span>
                        <p className="text-xs text-muted-foreground">{r.user_id.slice(0, 8)}...</p>
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
                <Activity className="w-5 h-5 text-accent" /> System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Affiliate Program</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Ready</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ad Platform</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stripe Payments</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Community Forum</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">Active</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
