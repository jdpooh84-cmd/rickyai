import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, Eye, UserPlus, CreditCard } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalReferrals: number;
  pendingPayouts: number;
  activeAds: number;
  totalAdRevenue: number;
}

const AdminStatsCards = ({ stats }: { stats: AdminStats }) => {
  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { title: "Businesses", value: stats.totalBusinesses, icon: TrendingUp, color: "text-accent" },
    { title: "Referral Conversions", value: stats.totalReferrals, icon: UserPlus, color: "text-green-400" },
    { title: "Pending Payouts", value: `$${(stats.pendingPayouts / 100).toFixed(2)}`, icon: CreditCard, color: "text-yellow-400" },
    { title: "Active Ads", value: stats.activeAds, icon: Eye, color: "text-blue-400" },
    { title: "Ad Revenue", value: `$${(stats.totalAdRevenue / 100).toFixed(2)}`, icon: DollarSign, color: "text-primary" },
  ];

  return (
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
  );
};

export default AdminStatsCards;
