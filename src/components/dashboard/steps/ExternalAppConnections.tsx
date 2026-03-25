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
  { id: "heygen", name: "HeyGen", description: "AI avatar talking-head videos", url: "https://app.heygen.com/settings?tab=API", cost: "$24/mo+", icon: "✨" },
  { id: "invideo", name: "InVideo", description: "Full AI video production", url: "https://ai.invideo.io/workspace", cost: "$25/mo+", icon: "🎬" },
  { id: "elevenlabs", name: "ElevenLabs", description: "AI voiceovers & dubbing", url: "https://elevenlabs.io/app/settings/api-keys", cost: "Free tier / $5/mo+", icon: "🎙️" },
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

      // Check if key exists
      const { data: existing } = await supabase.from("user_api_keys")
        .select("id").eq("provider", provider).eq("user_id", user.id).maybeSingle();

      if (existing) {
        await supabase.from("user_api_keys").update({
          api_key_encrypted: apiKeyInput.trim(),
          is_valid: true,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("user_api_keys").insert({
          user_id: user.id,
          provider,
          api_key_encrypted: apiKeyInput.trim(),
          is_valid: true,
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

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Connect Your Video Apps</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Connect your external accounts to enable direct video production through RickyAI. Your API keys are stored securely and only used for video generation.
      </p>

      <div className="space-y-3">
        {SUPPORTED_APPS.map(app => {
          const connected = connectedApps[app.id];
          return (
            <div key={app.id} className={`rounded-xl p-4 border transition-all ${
              connected?.is_valid ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{app.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{app.name}</div>
                    <div className="text-[10px] text-muted-foreground">{app.description} • {app.cost}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {connected?.is_valid ? (
                    <>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                      <button onClick={() => handleDisconnect(app.id)}
                        className="text-[10px] px-2 py-1 rounded text-destructive hover:bg-destructive/10">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setShowKeyInput(showKeyInput === app.id ? null : app.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1">
                      <Key className="w-3 h-3" /> Connect
                    </button>
                  )}
                </div>
              </div>

              {showKeyInput === app.id && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <a href={app.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-1">
                      Get your API key from {app.name} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
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
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    🔒 Your key is stored securely and only used to generate videos on your behalf.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExternalAppConnections;
