import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const providers = [
  { id: "claude", name: "Claude (Anthropic)", desc: "Advanced reasoning and content generation", color: "hsl(25 90% 55%)" },
  { id: "gemini", name: "Gemini (Google)", desc: "Multimodal AI with broad knowledge", color: "hsl(210 80% 55%)" },
  { id: "openai", name: "ChatGPT / OpenAI", desc: "Versatile AI for content and strategy", color: "hsl(160 60% 45%)" },
];

interface SavedKey {
  id: string;
  provider: string;
  is_valid: boolean;
}

interface ConnectStepProps {
  onComplete?: () => void;
}

const ConnectStep = ({ onComplete }: ConnectStepProps) => {
  const { user } = useAuth();
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_api_keys")
        .select("id, provider, is_valid")
        .eq("user_id", user.id);
      if (data) setSavedKeys(data);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (providerId: string) => {
    if (!user || !keyInput.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    setSaving(true);
    try {
      const existing = savedKeys.find(k => k.provider === providerId);
      if (existing) {
        await supabase
          .from("user_api_keys")
          .update({ api_key_encrypted: keyInput.trim(), is_valid: true, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("user_api_keys")
          .insert({ user_id: user.id, provider: providerId, api_key_encrypted: keyInput.trim() });
      }

      const { data } = await supabase
        .from("user_api_keys")
        .select("id, provider, is_valid")
        .eq("user_id", user.id);
      if (data) setSavedKeys(data);

      setEditingProvider(null);
      setKeyInput("");
      setShowKey(false);
      toast.success(`${providerId} key saved!`);

      if (data && data.length > 0) onComplete?.();
    } catch {
      toast.error("Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    const key = savedKeys.find(k => k.provider === providerId);
    if (!key) return;
    await supabase.from("user_api_keys").delete().eq("id", key.id);
    setSavedKeys(prev => prev.filter(k => k.provider !== providerId));
    toast.success("Key removed");
  };

  const connectedCount = savedKeys.length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">Connect Your AI Provider</h1>
        <p className="text-muted-foreground">
          PulseCore uses your own AI credentials for premium features. Your data stays private.
          Choose at least one provider below.
        </p>
        {connectedCount > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-primary">
            <Check className="w-4 h-4" />
            {connectedCount} provider{connectedCount > 1 ? "s" : ""} connected
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mb-6">
        <p className="text-sm text-foreground font-medium mb-1">✨ Good news — AI is already built in!</p>
        <p className="text-xs text-muted-foreground">
          PulseCore includes built-in AI for all core features. Adding your own keys is optional and unlocks higher-quality or specialized outputs.
          You can skip this step and come back later.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {providers.map((p) => {
          const saved = savedKeys.find(k => k.provider === p.id);
          const isEditing = editingProvider === p.id;

          return (
            <div key={p.id} className={`p-5 rounded-xl border transition-all ${saved ? "border-primary/40 bg-card" : "border-border bg-card hover:border-primary/30"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${p.color}20` }}>
                    <span className="text-lg font-bold" style={{ color: p.color }}>{p.name[0]}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      {saved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                          <Check className="w-3 h-3" /> Connected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {saved && !isEditing && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingProvider(p.id); setKeyInput(""); }}>
                      {saved ? "Update" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={`Enter your ${p.name.split(" ")[0]} API key...`}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(p.id)} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Key"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setEditingProvider(null); setKeyInput(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 p-4 rounded-lg bg-primary/5 border border-primary/10">
        <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Your API keys are stored securely. They are never shared across users or exposed in the frontend.
          You can disconnect, replace, or update keys anytime.
        </p>
      </div>
    </div>
  );
};

export default ConnectStep;
