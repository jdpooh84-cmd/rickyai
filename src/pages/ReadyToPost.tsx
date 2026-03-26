import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessData } from "@/hooks/useBusinessData";
import { toast } from "sonner";
import { Copy, Download, Edit3, RefreshCw, Calendar, Eye, Send, Check, Clock, Sparkles, Filter, Plus } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  idea: { label: "Idea Generated", color: "bg-muted text-muted-foreground", icon: "💡" },
  caption_ready: { label: "Caption Ready", color: "bg-blue-500/15 text-blue-400", icon: "✍️" },
  media_ready: { label: "Media Ready", color: "bg-amber-500/15 text-amber-400", icon: "🎬" },
  approved: { label: "Approved", color: "bg-green-500/15 text-green-400", icon: "✅" },
  scheduled: { label: "Scheduled", color: "bg-purple-500/15 text-purple-400", icon: "📅" },
  posted: { label: "Posted", color: "bg-primary/15 text-primary", icon: "🚀" },
  exported: { label: "Exported", color: "bg-secondary text-muted-foreground", icon: "📦" },
};

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "🎵", instagram: "📸", youtube: "▶️", facebook: "📘",
  linkedin: "💼", twitter: "🐦", pinterest: "📌",
};

interface ContentPost {
  id: string;
  title: string;
  caption: string | null;
  hashtags: string[] | null;
  cta: string | null;
  video_script: string | null;
  platform: string;
  media_url: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  production_tool: string | null;
  created_at: string;
}

const ReadyToPost = () => {
  const { user } = useAuth();
  const { selectedBusiness } = useBusinessData();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [previewPost, setPreviewPost] = useState<ContentPost | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPosts();
  }, [user, selectedBusiness]);

  const loadPosts = async () => {
    if (!user) return;
    setLoading(true);
    let query = (supabase.from("content_posts" as any) as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (selectedBusiness) {
      query = query.eq("business_id", selectedBusiness);
    }

    const { data } = await query;
    if (data) setPosts(data as ContentPost[]);
    setLoading(false);
  };

  const updateStatus = async (postId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "posted") updates.posted_at = new Date().toISOString();

    await (supabase.from("content_posts" as any) as any)
      .update(updates)
      .eq("id", postId);

    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
    toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
  };

  const copyCaption = (post: ContentPost) => {
    const text = [
      post.caption,
      post.hashtags?.map(h => `#${h}`).join(" "),
      post.cta,
    ].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Caption copied to clipboard!");
  };

  const exportPackage = (post: ContentPost) => {
    const pkg = {
      title: post.title,
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
      cta: post.cta,
      video_script: post.video_script,
      media_url: post.media_url,
      scheduled_at: post.scheduled_at,
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${post.title.replace(/\s+/g, "-").toLowerCase()}-${post.platform}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateStatus(post.id, "exported");
  };

  const createFromStrategy = async () => {
    if (!user || !selectedBusiness) {
      toast.error("Select a business first");
      return;
    }
    // Pull latest strategy data and create content posts
    const { data: outputs } = await supabase
      .from("strategy_outputs")
      .select("output_data, step_name")
      .eq("business_id", selectedBusiness)
      .eq("user_id", user.id)
      .in("step_number", [7, 8, 10]);

    if (!outputs || outputs.length === 0) {
      toast.error("Complete Script or Video Studio steps first to generate content");
      return;
    }

    let created = 0;
    for (const output of outputs) {
      const data = output.output_data as any;
      const videos = data?.videos || data?.video_strategy || [];
      
      if (Array.isArray(videos)) {
        for (const v of videos.slice(0, 5)) {
          await (supabase.from("content_posts" as any) as any).insert({
            user_id: user.id,
            business_id: selectedBusiness,
            title: v.title || v.video_title || `Content from ${output.step_name}`,
            caption: v.caption || v.description || v.hook || null,
            hashtags: v.hashtags || null,
            cta: v.cta || null,
            video_script: v.script || v.voiceover_script || null,
            platform: v.platform || "tiktok",
            status: v.script ? "caption_ready" : "idea",
            production_tool: v.recommended_tool || null,
          });
          created++;
        }
      }
    }

    if (created > 0) {
      toast.success(`${created} content items created from your strategy!`);
      loadPosts();
    } else {
      toast.info("No content items found in strategy outputs. Generate a Video Plan or Script first.");
    }
  };

  const filtered = filterStatus === "all" ? posts : posts.filter(p => p.status === filterStatus);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">Ready to Post</h1>
        <p className="text-muted-foreground">
          Your content pipeline — from idea to published. Each item shows exactly where it is in production.
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterStatus === "all" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            All ({posts.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = posts.filter(p => p.status === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === key ? "bg-primary text-primary-foreground" : cfg.color
                }`}
              >
                {cfg.icon} {cfg.label} ({count})
              </button>
            );
          })}
        </div>
        <button
          onClick={createFromStrategy}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" /> Generate from Strategy
        </button>
      </div>

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-bold text-foreground mb-2">No content yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Complete the Script or Video Studio steps, then click "Generate from Strategy" to create your first content posts.
          </p>
          <button
            onClick={createFromStrategy}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Generate Content from Strategy
          </button>
        </div>
      )}

      {/* Content cards */}
      <div className="space-y-4">
        {filtered.map(post => {
          const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.idea;
          return (
            <div key={post.id} className="glass rounded-2xl p-5 hover:ring-1 hover:ring-primary/20 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-lg">{PLATFORM_ICONS[post.platform] || "📱"}</span>
                    <h3 className="font-semibold text-foreground truncate">{post.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.color}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  {post.caption && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{post.caption}</p>
                  )}

                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {post.hashtags.slice(0, 5).map((h, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">#{h}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="capitalize">{post.platform}</span>
                    {post.production_tool && <span>• Tool: {post.production_tool}</span>}
                    {post.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(post.scheduled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => setPreviewPost(post)} title="Preview"
                    className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => copyCaption(post)} title="Copy Caption"
                    className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => exportPackage(post)} title="Export Package"
                    className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status progression */}
              <div className="mt-3 pt-3 border-t border-border flex gap-1.5 flex-wrap">
                {["idea", "caption_ready", "media_ready", "approved", "scheduled", "posted"].map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const isCurrent = post.status === s;
                  const isPast = Object.keys(STATUS_CONFIG).indexOf(post.status) > Object.keys(STATUS_CONFIG).indexOf(s);
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus(post.id, s)}
                      className={`text-[10px] px-2 py-1 rounded-full font-medium transition-all ${
                        isCurrent ? "bg-primary text-primary-foreground" :
                        isPast ? "bg-primary/10 text-primary" :
                        "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {isPast && <Check className="w-2.5 h-2.5 inline mr-0.5" />}
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal */}
      {previewPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewPost(null)}>
          <div className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{previewPost.title}</h3>
              <button onClick={() => setPreviewPost(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Platform</label>
                <p className="text-sm text-foreground capitalize">{PLATFORM_ICONS[previewPost.platform]} {previewPost.platform}</p>
              </div>

              {previewPost.caption && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Caption</label>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{previewPost.caption}</p>
                </div>
              )}

              {previewPost.hashtags && previewPost.hashtags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Hashtags</label>
                  <p className="text-sm text-primary">{previewPost.hashtags.map(h => `#${h}`).join(" ")}</p>
                </div>
              )}

              {previewPost.cta && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Call to Action</label>
                  <p className="text-sm text-foreground">{previewPost.cta}</p>
                </div>
              )}

              {previewPost.video_script && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Video Script</label>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3">{previewPost.video_script}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button onClick={() => { copyCaption(previewPost); }} className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5">
                  <Copy className="w-4 h-4" /> Copy Caption
                </button>
                <button onClick={() => { exportPackage(previewPost); setPreviewPost(null); }} className="flex-1 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium flex items-center justify-center gap-1.5">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>

              {!["posted", "exported"].includes(previewPost.status) && (
                <p className="text-[10px] text-center text-muted-foreground">
                  Direct publish not supported yet. Use Export Package to download your content.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadyToPost;
