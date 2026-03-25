import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus, ArrowLeft, Star, TrendingUp, Globe, Tag } from "lucide-react";
import { toast } from "sonner";
import { awardPoints, checkAndAwardBadge } from "@/lib/gamification";

const MARKET_CATEGORIES = [
  { id: "social_media", name: "Social Media", icon: "📱" },
  { id: "local_seo", name: "Local SEO", icon: "📍" },
  { id: "content", name: "Content Marketing", icon: "📝" },
  { id: "video", name: "Video Strategy", icon: "🎬" },
  { id: "referral", name: "Referral & Leads", icon: "🤝" },
  { id: "advertising", name: "Paid Ads", icon: "💳" },
  { id: "email", name: "Email Marketing", icon: "📧" },
  { id: "community", name: "Community Building", icon: "👥" },
];

const StrategyMarketplace = () => {
  const { user } = useAuth();
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [filter, setFilter] = useState("all");
  const [purchases, setPurchases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Publish form state
  const [pubTitle, setPubTitle] = useState("");
  const [pubDesc, setPubDesc] = useState("");
  const [pubCategory, setPubCategory] = useState("social_media");
  const [pubIndustry, setPubIndustry] = useState("");
  const [pubResults, setPubResults] = useState("");
  const [pubPlatform, setPubPlatform] = useState("");
  const [pubIsFree, setPubIsFree] = useState(true);

  const loadStrategies = async () => {
    let query = supabase.from("winning_strategies").select("*").order("upvotes", { ascending: false });
    if (filter !== "all") query = query.eq("category", filter);
    const { data } = await query;
    if (data) setStrategies(data);

    if (user) {
      const { data: purch } = await supabase.from("strategy_purchases").select("strategy_id").eq("buyer_user_id", user.id);
      if (purch) setPurchases(purch.map(p => p.strategy_id));
    }
    setLoading(false);
  };

  useEffect(() => { loadStrategies(); }, [filter, user]);

  const handlePublish = async () => {
    if (!user || !pubTitle.trim() || !pubDesc.trim() || !pubResults.trim() || !pubIndustry.trim()) {
      toast.error("Fill in all required fields");
      return;
    }
    const { error } = await supabase.from("winning_strategies").insert({
      seller_user_id: user.id,
      title: pubTitle.trim(),
      description: pubDesc.trim(),
      category: pubCategory,
      industry: pubIndustry.trim(),
      results_summary: pubResults.trim(),
      platform: pubPlatform.trim() || null,
      is_free: pubIsFree,
      price_cents: 0,
      strategy_data: {},
    });
    if (error) { toast.error("Failed to publish"); return; }
    await awardPoints(user.id, "strategy_published", "Published a winning strategy");
    await checkAndAwardBadge(user.id, "marketplace_seller");
    toast.success("Strategy published! +50 XP 🎉");
    setShowPublish(false);
    setPubTitle(""); setPubDesc(""); setPubResults(""); setPubIndustry(""); setPubPlatform("");
    loadStrategies();
  };

  const handleGetStrategy = async (strategy: any) => {
    if (!user) return;
    if (purchases.includes(strategy.id)) {
      toast.info("You already have this strategy");
      return;
    }
    const { error } = await supabase.from("strategy_purchases").insert({
      buyer_user_id: user.id, strategy_id: strategy.id,
    });
    if (error) { toast.error("Failed to get strategy"); return; }
    await supabase.from("winning_strategies").update({ purchase_count: strategy.purchase_count + 1 }).eq("id", strategy.id);
    await awardPoints(user.id, "strategy_purchased", `Got strategy: ${strategy.title}`);
    setPurchases(prev => [...prev, strategy.id]);
    toast.success("Strategy added to your collection! +25 XP");
  };

  // Detail view
  if (selected) {
    const owned = purchases.includes(selected.id) || selected.seller_user_id === user?.id;
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {MARKET_CATEGORIES.find(c => c.id === selected.category)?.icon} {selected.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{selected.industry}</span>
            {selected.platform && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{selected.platform}</span>}
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-3">{selected.title}</h2>
          <p className="text-sm text-secondary-foreground mb-4">{selected.description}</p>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4">
            <p className="text-xs text-primary font-semibold mb-1">📊 Results</p>
            <p className="text-sm text-foreground">{selected.results_summary}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
            <span>👍 {selected.upvotes} upvotes</span>
            <span>📥 {selected.purchase_count} downloads</span>
            <span>{selected.is_free ? "🆓 Free" : `💰 $${(selected.price_cents / 100).toFixed(2)}`}</span>
          </div>

          {!owned ? (
            <Button variant="hero" className="w-full" onClick={() => handleGetStrategy(selected)}>
              {selected.is_free ? "Get This Strategy (Free)" : `Buy Strategy — $${(selected.price_cents / 100).toFixed(2)}`}
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-sm text-primary font-medium">✅ You have this strategy</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Publish form
  if (showPublish) {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <button onClick={() => setShowPublish(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </button>
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">Share a Winning Strategy</h1>
        <p className="text-sm text-muted-foreground mb-6">Help other business owners by sharing what worked for you. Earn XP and build your reputation!</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {MARKET_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setPubCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${pubCategory === c.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
          <InputField label="Title *" value={pubTitle} onChange={setPubTitle} placeholder="E.g. 3x Instagram growth with carousel posts" />
          <InputField label="Industry *" value={pubIndustry} onChange={setPubIndustry} placeholder="Restaurant, Salon, Real Estate..." />
          <InputField label="Platform" value={pubPlatform} onChange={setPubPlatform} placeholder="Instagram, TikTok, Google..." />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description *</label>
            <textarea value={pubDesc} onChange={e => setPubDesc(e.target.value)} placeholder="Describe the strategy in detail..."
              rows={4} className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Results Summary *</label>
            <textarea value={pubResults} onChange={e => setPubResults(e.target.value)} placeholder="What results did this produce? Be specific with numbers if possible..."
              rows={3} className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <Button variant="hero" onClick={handlePublish} className="w-full">Publish Strategy (+50 XP)</Button>
        </div>
      </div>
    );
  }

  // Marketplace browse
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground mb-1">🏪 Strategy Marketplace</h1>
          <p className="text-sm text-muted-foreground">Discover winning strategies from businesses worldwide.</p>
        </div>
        <Button variant="hero" size="sm" onClick={() => setShowPublish(true)}><Plus className="w-4 h-4" /> Share Yours</Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
          All
        </button>
        {MARKET_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === c.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map(s => (
          <div key={s.id} className="glass rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer border border-transparent" onClick={() => setSelected(s)}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {MARKET_CATEGORIES.find(c => c.id === s.category)?.icon} {s.category}
              </span>
              {s.is_free && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">Free</span>}
            </div>
            <h3 className="font-semibold text-foreground mb-1 line-clamp-2">{s.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {s.upvotes}</span>
              <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {s.industry}</span>
              <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {s.purchase_count}</span>
            </div>
          </div>
        ))}
        {strategies.length === 0 && !loading && (
          <div className="col-span-2 text-center py-12">
            <p className="text-lg mb-2">🏪</p>
            <p className="text-sm text-muted-foreground">No strategies yet. Be the first to share what's working!</p>
          </div>
        )}
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
  </div>
);

export default StrategyMarketplace;
