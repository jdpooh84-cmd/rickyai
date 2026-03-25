import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageSquare, ThumbsUp, Plus, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { awardPoints, checkAndAwardBadge } from "@/lib/gamification";

const CATEGORIES = [
  { id: "general", name: "General", icon: "💬" },
  { id: "marketing", name: "Marketing Tips", icon: "📢" },
  { id: "social", name: "Social Media", icon: "📱" },
  { id: "seo", name: "SEO & Local", icon: "🔍" },
  { id: "video", name: "Video Content", icon: "🎬" },
  { id: "funding", name: "Grants & Funding", icon: "💰" },
  { id: "wins", name: "Wins & Milestones", icon: "🏆" },
];

const CommunityForum = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    let query = supabase.from("forum_posts").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
    if (filter !== "all") query = query.eq("category", filter);
    const { data } = await query;
    if (data) setPosts(data);
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, [filter]);

  const loadReplies = async (postId: string) => {
    const { data } = await supabase.from("forum_replies").select("*").eq("post_id", postId).order("created_at");
    if (data) setReplies(data);
  };

  const handleCreatePost = async () => {
    if (!user || !newTitle.trim() || !newBody.trim()) {
      toast.error("Title and body are required");
      return;
    }
    const { error } = await supabase.from("forum_posts").insert({
      user_id: user.id, title: newTitle.trim(), body: newBody.trim(), category: newCategory,
    });
    if (error) { toast.error("Failed to create post"); return; }
    await awardPoints(user.id, "forum_post", "Created a forum post");
    await checkAndAwardBadge(user.id, "community_first");
    toast.success("Post created! +25 XP");
    setShowNewPost(false);
    setNewTitle(""); setNewBody(""); setNewCategory("general");
    loadPosts();
  };

  const handleReply = async () => {
    if (!user || !replyText.trim() || !selectedPost) return;
    const { error } = await supabase.from("forum_replies").insert({
      post_id: selectedPost.id, user_id: user.id, body: replyText.trim(),
    });
    if (error) { toast.error("Failed to reply"); return; }
    // Update reply count
    await supabase.from("forum_posts").update({ reply_count: selectedPost.reply_count + 1 }).eq("id", selectedPost.id);
    await awardPoints(user.id, "forum_reply", "Replied to a forum post");
    toast.success("Reply posted! +15 XP");
    setReplyText("");
    setSelectedPost({ ...selectedPost, reply_count: selectedPost.reply_count + 1 });
    loadReplies(selectedPost.id);
  };

  const handleUpvote = async (postId: string) => {
    if (!user) return;
    const { error } = await supabase.from("forum_upvotes").insert({ user_id: user.id, post_id: postId });
    if (error) { toast.error("Already upvoted"); return; }
    const post = posts.find(p => p.id === postId);
    if (post) {
      await supabase.from("forum_posts").update({ upvotes: post.upvotes + 1 }).eq("id", postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p));
    }
  };

  // Post detail view
  if (selectedPost) {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <button onClick={() => setSelectedPost(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Forum
        </button>

        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {CATEGORIES.find(c => c.id === selectedPost.category)?.icon} {selectedPost.category}
            </span>
            {selectedPost.is_pinned && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">📌 Pinned</span>}
          </div>
          <h2 className="text-xl font-bold font-display text-foreground mb-3">{selectedPost.title}</h2>
          <p className="text-sm text-secondary-foreground whitespace-pre-line">{selectedPost.body}</p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span>👤 Member</span>
            <span>{new Date(selectedPost.created_at).toLocaleDateString()}</span>
            <span>👍 {selectedPost.upvotes}</span>
            <span>💬 {selectedPost.reply_count}</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-foreground mb-3">Replies ({replies.length})</h3>
        <div className="space-y-3 mb-6">
          {replies.map(r => (
            <div key={r.id} className="glass rounded-xl p-4">
              <p className="text-sm text-secondary-foreground">{r.body}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>👤 Member</span>
                <span>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {replies.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No replies yet. Be the first!</p>}
        </div>

        <div className="flex gap-2">
          <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReply()}
            placeholder="Write a reply..." className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <Button onClick={handleReply} disabled={!replyText.trim()}><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    );
  }

  // New post form
  if (showNewPost) {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <button onClick={() => setShowNewPost(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Forum
        </button>
        <h1 className="text-3xl font-bold font-display text-foreground mb-6">New Post</h1>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setNewCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${newCategory === c.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's on your mind?"
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Body</label>
            <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Share your tip, question, or win..."
              rows={6} className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <Button variant="hero" onClick={handleCreatePost} className="w-full">Post to Community</Button>
        </div>
      </div>
    );
  }

  // Forum list
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground mb-1">💬 Community</h1>
          <p className="text-sm text-muted-foreground">Share tips, celebrate wins, and connect with other business owners.</p>
        </div>
        <Button variant="hero" size="sm" onClick={() => setShowNewPost(true)}><Plus className="w-4 h-4" /> New Post</Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === c.id ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id} className="glass rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer border border-transparent"
            onClick={() => { setSelectedPost(post); loadReplies(post.id); }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {CATEGORIES.find(c => c.id === post.category)?.icon} {post.category}
              </span>
              {post.is_pinned && <span className="text-xs text-accent">📌</span>}
            </div>
            <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
            <div className="mt-3 flex items-center gap-4">
              <button onClick={e => { e.stopPropagation(); handleUpvote(post.id); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <ThumbsUp className="w-3 h-3" /> {post.upvotes}
              </button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="w-3 h-3" /> {post.reply_count}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {posts.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-lg mb-2">🌱</p>
            <p className="text-sm text-muted-foreground">No posts yet. Be the first to share!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityForum;
