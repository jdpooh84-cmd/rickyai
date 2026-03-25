import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Search, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface UserResult {
  id: string;
  email: string;
  bans: { id: string; offense_number: number; reason: string; banned_at: string; ban_expires_at: string | null; is_permanent: boolean }[];
}

const BAN_DURATIONS = [
  { value: "24h", label: "24 hours (1st offense)" },
  { value: "30d", label: "30 days (2nd offense)" },
  { value: "permanent", label: "Permanent (3rd offense)" },
];

const BanManagement = () => {
  const { user } = useAuth();
  const [searchEmail, setSearchEmail] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [banDuration, setBanDuration] = useState("24h");
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState<string | null>(null);

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "search", email: searchEmail },
      });
      if (error) throw error;

      const users = data.users || [];
      const enriched: UserResult[] = [];

      for (const u of users) {
        const { data: bans } = await supabase
          .from("user_bans")
          .select("id, offense_number, reason, banned_at, ban_expires_at, is_permanent")
          .eq("user_id", u.id)
          .order("banned_at", { ascending: false });
        enriched.push({ ...u, bans: bans || [] });
      }
      setResults(enriched);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string) => {
    if (!banReason.trim()) { toast.error("Please enter a reason"); return; }
    setBanning(userId);

    const existingBans = results.find(u => u.id === userId)?.bans || [];
    const offenseNumber = existingBans.length + 1;

    let banExpiresAt: string | null = null;
    let isPermanent = false;

    if (banDuration === "24h") {
      banExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (banDuration === "30d") {
      banExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      isPermanent = true;
    }

    const { error } = await supabase.from("user_bans").insert({
      user_id: userId,
      offense_number: offenseNumber,
      reason: banReason,
      ban_expires_at: banExpiresAt,
      is_permanent: isPermanent,
      issued_by: user?.id,
    });

    if (error) {
      toast.error("Failed to issue ban");
    } else {
      toast.success(`User banned (offense #${offenseNumber})`);
      setBanReason("");
      searchUsers();
    }
    setBanning(null);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" /> Content Moderation & Bans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search user by email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            className="flex-1"
          />
          <Button onClick={searchUsers} disabled={loading} size="sm">
            <Search className="w-4 h-4 mr-1" /> {loading ? "..." : "Search"}
          </Button>
        </div>

        {results.map((u) => (
          <div key={u.id} className="p-4 border border-border rounded-lg space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {u.bans.length} prior offense{u.bans.length !== 1 ? "s" : ""}
              </p>
            </div>

            {u.bans.length > 0 && (
              <div className="space-y-1">
                {u.bans.slice(0, 3).map((b) => (
                  <div key={b.id} className="text-xs p-2 rounded bg-secondary/50 flex items-center justify-between">
                    <span className="text-muted-foreground">
                      #{b.offense_number}: {b.reason}
                    </span>
                    <span className={`text-xs font-medium ${b.is_permanent ? "text-destructive" : b.ban_expires_at && new Date(b.ban_expires_at) > new Date() ? "text-yellow-400" : "text-muted-foreground"}`}>
                      {b.is_permanent ? "PERMANENT" : b.ban_expires_at && new Date(b.ban_expires_at) > new Date() ? "ACTIVE" : "Expired"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Input
                placeholder="Reason for ban..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAN_DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleBan(u.id)}
                  disabled={banning === u.id}
                  className="h-8"
                >
                  {banning === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3 mr-1" />}
                  Issue Ban
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BanManagement;
