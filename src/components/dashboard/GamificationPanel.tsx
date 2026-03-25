import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel, BADGE_DEFINITIONS } from "@/lib/gamification";
import { Trophy, Flame, Star, Medal, TrendingUp } from "lucide-react";

const GamificationPanel = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState<any>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tab, setTab] = useState<"stats" | "badges" | "leaderboard">("stats");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: pts } = await supabase.from("user_points").select("*").eq("user_id", user.id).maybeSingle();
      if (pts) setPoints(pts);
      else setPoints({ points: 0, total_points_earned: 0, level: 1, streak_days: 0 });

      const { data: bdg } = await supabase.from("user_badges").select("badge_id").eq("user_id", user.id);
      if (bdg) setBadges(bdg.map(b => b.badge_id));

      const { data: lb } = await supabase.from("user_points").select("user_id, total_points_earned, level, streak_days").order("total_points_earned", { ascending: false }).limit(10);
      if (lb) setLeaderboard(lb);
    };
    load();
  }, [user]);

  if (!points) return null;

  const level = getLevel(points.total_points_earned);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">🎮 Your Growth Score</h1>
        <p className="text-muted-foreground">Level up by completing steps, engaging with the community, and sharing strategies.</p>
      </div>

      {/* Level & Stats */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Level {level.level}</p>
            <h2 className="text-2xl font-bold font-display text-foreground">{level.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary">{points.total_points_earned.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total XP</p>
          </div>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 mb-2">
          <div className="bg-gradient-hero h-3 rounded-full transition-all duration-700" style={{ width: `${level.progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {level.nextLevel ? `${level.nextLevel.minPoints - points.total_points_earned} XP to ${level.nextLevel.name}` : "Max level reached!"}
        </p>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <Flame className="w-5 h-5 text-accent mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{points.streak_days}</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <Medal className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{badges.length}</p>
            <p className="text-[10px] text-muted-foreground">Badges</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <TrendingUp className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{points.points}</p>
            <p className="text-[10px] text-muted-foreground">Available XP</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["stats", "badges", "leaderboard"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {t === "stats" ? "📈 History" : t === "badges" ? "🏅 Badges" : "🏆 Leaderboard"}
          </button>
        ))}
      </div>

      {tab === "badges" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BADGE_DEFINITIONS.map(b => {
            const earned = badges.includes(b.id);
            return (
              <div key={b.id} className={`p-4 rounded-xl border transition-all ${earned ? "glass border-primary/30" : "bg-secondary/20 border-border opacity-50"}`}>
                <div className="text-3xl mb-2">{b.icon}</div>
                <h4 className="text-sm font-semibold text-foreground">{b.name}</h4>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
                <p className="text-xs text-primary mt-1">+{b.points} XP</p>
                {earned && <p className="text-[10px] text-primary mt-1">✅ Earned</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="glass rounded-xl p-4">
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.user_id} className={`flex items-center justify-between p-3 rounded-lg ${entry.user_id === user?.id ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${i === 0 ? "text-accent" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-orange-400" : "text-muted-foreground/50"}`}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {entry.user_id === user?.id ? "You" : `Grower #${i + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Level {entry.level} • {entry.streak_days}🔥</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary">{entry.total_points_earned.toLocaleString()} XP</span>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No entries yet. Complete steps to join the leaderboard!</p>
            )}
          </div>
        </div>
      )}

      {tab === "stats" && (
        <PointHistory userId={user?.id || ""} />
      )}
    </div>
  );
};

const PointHistory = ({ userId }: { userId: string }) => {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("point_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (data) setHistory(data);
    };
    load();
  }, [userId]);

  return (
    <div className="glass rounded-xl p-4">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No activity yet. Complete steps to earn XP!</p>
      ) : (
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
              <div>
                <p className="text-sm text-foreground">{h.description || h.action}</p>
                <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</p>
              </div>
              <span className="text-sm font-bold text-primary">+{h.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GamificationPanel;
