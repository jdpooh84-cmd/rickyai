import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Key, Check, X, Eye, EyeOff, Shield } from "lucide-react";

interface ConnectedApp {
  provider: string;
  is_valid: boolean;
  updated_at: string;
}

const SUPPORTED_APPS = [
  // Video Production
  { id: "heygen", name: "HeyGen", description: "AI avatar talking-head videos", url: "https://app.heygen.com/settings?tab=API", cost: "$24/mo+", icon: "✨", category: "Video" },
  { id: "elevenlabs", name: "ElevenLabs", description: "AI voiceovers & dubbing", url: "https://elevenlabs.io/app/settings/api-keys", cost: "Free tier / $5/mo+", icon: "🎙️", category: "Voice" },
  { id: "invideo", name: "InVideo AI", description: "Text-to-video AI production", url: "https://ai.invideo.io/workspace", cost: "$25/mo+", icon: "🎬", category: "Video" },
  // Automation
  { id: "make", name: "Make.com", description: "Workflow automation (webhook URL)", url: "https://www.make.com/en/apikey", cost: "Free tier / $9/mo+", icon: "⚡", category: "Automation" },
  // Social Platforms (for future direct posting)
  { id: "meta", name: "Meta Business Suite", description: "Facebook + Instagram posting", url: "https://developers.facebook.com/apps/", cost: "Free", icon: "📘", category: "Social" },
  { id: "youtube", name: "YouTube", description: "Video uploads & analytics", url: "https://console.developers.google.com/", cost: "Free", icon: "▶️", category: "Social" },
  { id: "tiktok", name: "TikTok", description: "Short-form video posting", url: "https://developers.tiktok.com/", cost: "Free", icon: "🎵", category: "Social" },
  { id: "linkedin", name: "LinkedIn", description: "Professional content posting", url: "https://www.linkedin.com/developers/apps", cost: "Free", icon: "💼", category: "Social" },
];

const ExternalAppConnections = () => {
  const [connectedApps, setConnectedApps] = useState<Record<string, ConnectedApp>>({});
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    const { data } = await supabase.from("user_api_keys").select("provider, is_valid, updated_at");
    if (data) {
      const map: Record<string, ConnectedApp> = {};
      data.forEach(d => { map[d.provider] = { provider: d.provider, is_valid: d.is_valid ?? true, updated_at: d.updated_at }; });
      setConnectedApps(map);
    }
  };

  const handleSaveKey = async (provider: string) => {
    if (!apiKeyInput.trim()) { toast.error("Please enter an API key"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase.from("user_api_keys")
        .select("id").eq("provider", provider).eq("user_id", user.id).maybeSingle();

      if (existing) {
        await supabase.from("user_api_keys").update({
          api_key_encrypted: apiKeyInput.trim(), is_valid: true, updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("user_api_keys").insert({
          user_id: user.id, provider, api_key_encrypted: apiKeyInput.trim(), is_valid: true,
        });
      }

      toast.success(`${provider} API key saved!`);
      setShowKeyInput(null);
      setApiKeyInput("");
      loadConnections();
    } catch (err: any) {
      toast.error(err.message || "Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_api_keys").delete().eq("provider", provider).eq("user_id", user.id);
    toast.success(`${provider} disconnected`);
    loadConnections();
  };

  const categories = [...new Set(SUPPORTED_APPS.map(a => a.category))];
  const connectedCount = Object.values(connectedApps).filter(a => a.is_valid).length;

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Connect Your Tools</h3>
        </div>
        {connectedCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {connectedCount} connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Connect external accounts to unlock direct video production, voiceovers, and social posting. 
        <strong className="text-foreground"> No keys needed for basic AI video production</strong> — it's free and built in.
      </p>

      {categories.map(category => (
        <div key={category}>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h4>
          <div className="space-y-2">
            {SUPPORTED_APPS.filter(a => a.category === category).map(app => {
              const connected = connectedApps[app.id];
              return (
                <div key={app.id} className={`rounded-xl p-3 border transition-all ${
                  connected?.is_valid ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{app.icon}</span>
                      <div>
                        <div className="text-xs font-semibold text-foreground">{app.name}</div>
                        <div className="text-[10px] text-muted-foreground">{app.description} • {app.cost}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {connected?.is_valid ? (
                        <>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                            <Check className="w-3 h-3" /> Connected
                          </span>
                          <button onClick={() => handleDisconnect(app.id)} className="text-[10px] px-1 py-1 rounded text-destructive hover:bg-destructive/10">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setShowKeyInput(showKeyInput === app.id ? null : app.id)}
                          className="text-[10px] px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                          <Key className="w-3 h-3" /> Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {showKeyInput === app.id && (
                    <div className="mt-2 space-y-2">
                      <a href={app.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1">
                        Get your API key from {app.name} <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showKey ? "text" : "password"}
                            value={apiKeyInput}
                            onChange={e => setApiKeyInput(e.target.value)}
                            placeholder={`Paste your ${app.name} API key`}
                            className="w-full px-3 py-2 pr-8 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <button onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button onClick={() => handleSaveKey(app.id)} disabled={saving}
                          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                          {saving ? "..." : "Save"}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">🔒 Stored securely. Only used to generate content on your behalf.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ExternalAppConnections;
