import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface BanCheckProps {
  children: React.ReactNode;
}

const BanCheck = ({ children }: BanCheckProps) => {
  const { user, signOut } = useAuth();
  const [ban, setBan] = useState<{
    reason: string;
    ban_expires_at: string | null;
    is_permanent: boolean;
    offense_number: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const check = async () => {
      const { data } = await supabase
        .from("user_bans")
        .select("reason, ban_expires_at, is_permanent, offense_number")
        .eq("user_id", user.id)
        .order("banned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        if (data.is_permanent) {
          setBan(data);
        } else if (data.ban_expires_at && new Date(data.ban_expires_at) > new Date()) {
          setBan(data);
        }
      }
      setLoading(false);
    };
    check();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (ban) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <div className="absolute inset-0 bg-gradient-dark" />
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">
              Account {ban.is_permanent ? "Permanently Banned" : "Suspended"}
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Reason:</strong> {ban.reason}
            </p>
            {!ban.is_permanent && ban.ban_expires_at && (
              <p className="text-sm text-muted-foreground mb-4">
                <strong>Suspension ends:</strong> {format(new Date(ban.ban_expires_at), "PPpp")}
              </p>
            )}
            <div className="text-xs text-muted-foreground mb-6 p-3 bg-card rounded-lg border border-border">
              {ban.offense_number === 1 && "This is your first offense (24-hour suspension)."}
              {ban.offense_number === 2 && "This is your second offense (up to 30-day suspension)."}
              {ban.offense_number >= 3 && "This is your third offense. Your account has been permanently banned per our Terms of Service."}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              If you believe this is an error, contact <span className="text-primary">support@rickyai.com</span>.
            </p>
            <Button variant="outline" onClick={async () => { await signOut(); }}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default BanCheck;
