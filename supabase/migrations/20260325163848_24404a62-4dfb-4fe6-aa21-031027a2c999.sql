
-- GAMIFICATION TABLES
CREATE TABLE public.user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  last_activity_date date,
  total_points_earned integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own points" ON public.user_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own points" ON public.user_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own points" ON public.user_points FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id text NOT NULL,
  earned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.point_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own history" ON public.point_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own history" ON public.point_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow everyone to see leaderboard (public read)
CREATE POLICY "Anyone can view leaderboard" ON public.user_points FOR SELECT TO authenticated USING (true);

-- COMMUNITY FORUM TABLES
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  upvotes integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view posts" ON public.forum_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create posts" ON public.forum_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON public.forum_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON public.forum_posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  upvotes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view replies" ON public.forum_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create replies" ON public.forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own replies" ON public.forum_replies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own replies" ON public.forum_replies FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.forum_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, reply_id)
);

ALTER TABLE public.forum_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view upvotes" ON public.forum_upvotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create upvotes" ON public.forum_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own upvotes" ON public.forum_upvotes FOR DELETE USING (auth.uid() = user_id);

-- WINNING STRATEGIES MARKETPLACE
CREATE TABLE public.winning_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  industry text NOT NULL,
  location text,
  results_summary text NOT NULL,
  strategy_data jsonb NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  upvotes integer NOT NULL DEFAULT 0,
  purchase_count integer NOT NULL DEFAULT 0,
  platform text,
  metrics jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.winning_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can browse strategies" ON public.winning_strategies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create strategies" ON public.winning_strategies FOR INSERT WITH CHECK (auth.uid() = seller_user_id);
CREATE POLICY "Users can update their own strategies" ON public.winning_strategies FOR UPDATE USING (auth.uid() = seller_user_id);

CREATE TABLE public.strategy_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid NOT NULL,
  strategy_id uuid NOT NULL REFERENCES public.winning_strategies(id),
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(buyer_user_id, strategy_id)
);

ALTER TABLE public.strategy_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own purchases" ON public.strategy_purchases FOR SELECT USING (auth.uid() = buyer_user_id);
CREATE POLICY "Users can create purchases" ON public.strategy_purchases FOR INSERT WITH CHECK (auth.uid() = buyer_user_id);
