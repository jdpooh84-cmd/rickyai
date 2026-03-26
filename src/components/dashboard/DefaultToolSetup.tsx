import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Settings2, Check, ChevronDown } from "lucide-react";

const TOOL_TYPES = [
  {
    type: "llm",
    label: "Writing & Strategy AI",
    question: "Which AI should RickyAI use for writing?",
    options: [
      { id: "chatgpt", name: "ChatGPT", desc: "Most versatile, great default" },
      { id: "claude", name: "Claude", desc: "Strong reasoning & content" },
      { id: "gemini", name: "Gemini", desc: "Multimodal with broad knowledge" },
    ],
    defaultProvider: "chatgpt",
  },
  {
    type: "video_editor",
    label: "Video Editing",
    question: "Default tool for assembling videos?",
    options: [
      { id: "capcut", name: "CapCut", desc: "Free, powerful templates" },
      { id: "invideo", name: "InVideo", desc: "AI video production" },
      { id: "canva", name: "Canva", desc: "Simple drag-and-drop" },
    ],
    defaultProvider: "capcut",
  },
  {
    type: "thumbnail",
    label: "Thumbnails & Graphics",
    question: "Default tool for thumbnails?",
    options: [
      { id: "canva", name: "Canva", desc: "Easy templates & brand kits" },
      { id: "adobe_express", name: "Adobe Express", desc: "Professional design" },
    ],
    defaultProvider: "canva",
  },
  {
    type: "voice",
    label: "Voiceover (Optional)",
    question: "Default voice tool?",
    options: [
      { id: "none", name: "None", desc: "Skip voiceover" },
      { id: "elevenlabs", name: "ElevenLabs", desc: "AI voice cloning" },
    ],
    defaultProvider: "none",
  },
  {
    type: "social_pack",
    label: "Social Platforms",
    question: "Default posting platforms?",
    options: [
      { id: "tiktok_ig_youtube", name: "TikTok + Instagram + YouTube", desc: "Recommended starter pack" },
      { id: "all_platforms", name: "All Platforms", desc: "Include LinkedIn, Facebook, X" },
    ],
    defaultProvider: "tiktok_ig_youtube",
  },
];

interface DefaultToolSetupProps {
  compact?: boolean;
  onComplete?: () => void;
}

const DefaultToolSetup = ({ compact = false, onComplete }: DefaultToolSetupProps) => {
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("user_tool_defaults" as any)
        .select("tool_type, default_provider")
        .eq("user_id", user.id);
      if (data && (data as any[]).length > 0) {
        const map: Record<string, string> = {};
        (data as any[]).forEach((d: any) => { map[d.tool_type] = d.default_provider; });
        setDefaults(map);
      } else {
        // Set defaults
        const map: Record<string, string> = {};
        TOOL_TYPES.forEach(t => { map[t.type] = t.defaultProvider; });
        setDefaults(map);
      }
      setLoaded(true);
    };
    load();
  }, [user]);

  const handleSelect = (type: string, provider: string) => {
    setDefaults(prev => ({ ...prev, [type]: provider }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const [type, provider] of Object.entries(defaults)) {
        await (supabase.from("user_tool_defaults" as any) as any).upsert(
          { user_id: user.id, tool_type: type, default_provider: provider },
          { onConflict: "user_id,tool_type" }
        );
      }
      toast.success("Default tools saved!");
      onComplete?.();
    } catch {
      toast.error("Failed to save defaults");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="glass rounded-2xl p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Default Tool Stack</h3>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {!expanded && (
        <p className="text-[10px] text-muted-foreground mt-1">
          RickyAI uses: {defaults.llm === "chatgpt" ? "ChatGPT" : defaults.llm} → {defaults.video_editor === "capcut" ? "CapCut" : defaults.video_editor} → {defaults.thumbnail === "canva" ? "Canva" : defaults.thumbnail}
        </p>
      )}

      {expanded && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            RickyAI uses these as the default lane for all production. Everything else is an optional override.
          </p>

          {TOOL_TYPES.map(tool => (
            <div key={tool.type}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{tool.question}</label>
              <div className="flex gap-2 flex-wrap">
                {tool.options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(tool.type, opt.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      defaults[tool.type] === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {defaults[tool.type] === opt.id && <Check className="w-3 h-3" />}
                    {opt.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[10px] text-muted-foreground">
              <strong>Default lane:</strong> {defaults.llm === "chatgpt" ? "ChatGPT" : defaults.llm} → Script → Storyboard → {defaults.video_editor === "capcut" ? "CapCut" : defaults.video_editor} → {defaults.thumbnail === "canva" ? "Canva" : defaults.thumbnail} thumbnail → Export → {defaults.social_pack === "tiktok_ig_youtube" ? "TikTok/IG/YouTube" : "All platforms"}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Defaults"}
          </button>
        </div>
      )}
    </div>
  );
};

export default DefaultToolSetup;
