import { supabase } from "@/integrations/supabase/client";

const BADGE_DEFINITIONS = [
  { id: "first_step", name: "First Step", icon: "🎯", desc: "Complete your first step", points: 50 },
  { id: "profile_complete", name: "Profile Pro", icon: "📝", desc: "Complete your business profile", points: 100 },
  { id: "strategist", name: "Strategist", icon: "📊", desc: "Complete the Compete report", points: 150 },
  { id: "script_writer", name: "Script Writer", icon: "✍️", desc: "Generate your first script", points: 150 },
  { id: "half_way", name: "Halfway Hero", icon: "🏆", desc: "Complete 6 of 12 steps", points: 300 },
  { id: "full_strategy", name: "Full Strategy", icon: "🌟", desc: "Complete all 12 steps", points: 1000 },
  { id: "community_first", name: "Community Voice", icon: "💬", desc: "Post in the community forum", points: 75 },
  { id: "helper", name: "Helping Hand", icon: "🤝", desc: "Reply to 5 forum posts", points: 200 },
  { id: "streak_7", name: "Weekly Warrior", icon: "🔥", desc: "7-day login streak", points: 250 },
  { id: "streak_30", name: "Monthly Master", icon: "⚡", desc: "30-day login streak", points: 500 },
  { id: "marketplace_seller", name: "Strategy Seller", icon: "💰", desc: "Publish your first winning strategy", points: 200 },
];

const POINT_VALUES = {
  complete_step: 100,
  daily_login: 10,
  forum_post: 25,
  forum_reply: 15,
  forum_upvote_received: 5,
  strategy_published: 50,
  strategy_purchased: 25,
};

const LEVELS = [
  { level: 1, name: "Starter", minPoints: 0 },
  { level: 2, name: "Explorer", minPoints: 200 },
  { level: 3, name: "Builder", minPoints: 500 },
  { level: 4, name: "Strategist", minPoints: 1000 },
  { level: 5, name: "Growth Pro", minPoints: 2000 },
  { level: 6, name: "Market Leader", minPoints: 3500 },
  { level: 7, name: "Industry Expert", minPoints: 5000 },
  { level: 8, name: "Visionary", minPoints: 7500 },
  { level: 9, name: "Legend", minPoints: 10000 },
  { level: 10, name: "PulseCore Elite", minPoints: 15000 },
];

export const getLevel = (totalPoints: number) => {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalPoints >= l.minPoints) current = l;
  }
  const nextLevel = LEVELS.find(l => l.minPoints > totalPoints);
  const progress = nextLevel
    ? ((totalPoints - current.minPoints) / (nextLevel.minPoints - current.minPoints)) * 100
    : 100;
  return { ...current, nextLevel, progress };
};

export const awardPoints = async (userId: string, action: string, description: string) => {
  const points = POINT_VALUES[action as keyof typeof POINT_VALUES] || 0;
  if (points === 0) return;

  // Get or create user points
  const { data: existing } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const today = new Date().toISOString().split("T")[0];

  if (existing) {
    const lastDate = existing.last_activity_date;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const newStreak = lastDate === yesterday ? existing.streak_days + 1 : lastDate === today ? existing.streak_days : 1;
    const newLevel = getLevel(existing.total_points_earned + points).level;

    await supabase
      .from("user_points")
      .update({
        points: existing.points + points,
        total_points_earned: existing.total_points_earned + points,
        streak_days: newStreak,
        last_activity_date: today,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    await supabase.from("user_points").insert({
      user_id: userId,
      points,
      total_points_earned: points,
      level: 1,
      streak_days: 1,
      last_activity_date: today,
    });
  }

  // Log history
  await supabase.from("point_history").insert({
    user_id: userId,
    points,
    action,
    description,
  });
};

export const checkAndAwardBadge = async (userId: string, badgeId: string) => {
  const { data: existing } = await supabase
    .from("user_badges")
    .select("id")
    .eq("user_id", userId)
    .eq("badge_id", badgeId)
    .maybeSingle();

  if (existing) return false;

  const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
  if (!badge) return false;

  await supabase.from("user_badges").insert({ user_id: userId, badge_id: badgeId });
  if (badge.points > 0) {
    await awardPoints(userId, "badge_earned", `Earned badge: ${badge.name}`);
  }
  return true;
};

export { BADGE_DEFINITIONS, POINT_VALUES, LEVELS };
