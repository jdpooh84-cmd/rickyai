import { useEffect, useState } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import { Copy, Check, ExternalLink, Film, Sparkles, Smartphone, Palette, Wand2, Video, Bot, Scissors, Monitor, Mic, Gpu } from "lucide-react";
import { toast } from "sonner";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type TabType = "free" | "capcut" | "heygen" | "invideo" | "canva" | "pixelbin" | "easemate" | "virbo" | "detail" | "elevenlabs" | "nvidia";

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(8);
  const [activeTab, setActiveTab] = useState<TabType>("free");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copyToClipboard(text, id)}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
    >
      {copiedId === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copiedId === id ? "Copied!" : "Copy Prompt"}
    </button>
  );

  const tabs: { key: TabType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: "free", label: "Free Tools", icon: <Smartphone className="w-4 h-4" />, desc: "Phone + Free" },
    { key: "capcut", label: "CapCut", icon: <Scissors className="w-4 h-4" />, desc: "Free Editor" },
    { key: "canva", label: "Canva", icon: <Palette className="w-4 h-4" />, desc: "Video Editor" },
    { key: "invideo", label: "InVideo", icon: <Film className="w-4 h-4" />, desc: "AI Video" },
    { key: "heygen", label: "HeyGen", icon: <Sparkles className="w-4 h-4" />, desc: "AI Avatars" },
    { key: "detail", label: "Detail", icon: <Monitor className="w-4 h-4" />, desc: "Screen Rec" },
    { key: "elevenlabs", label: "ElevenLabs", icon: <Mic className="w-4 h-4" />, desc: "AI Voice" },
    { key: "nvidia", label: "Nvidia", icon: <Gpu className="w-4 h-4" />, desc: "Broadcast" },
    { key: "pixelbin", label: "PixelBin", icon: <Wand2 className="w-4 h-4" />, desc: "API Pipeline" },
    { key: "easemate", label: "EaseMate", icon: <Video className="w-4 h-4" />, desc: "AI Generator" },
    { key: "virbo", label: "Virbo", icon: <Bot className="w-4 h-4" />, desc: "Talking Head" },
  ];

  const getPromptForTab = (video: any, tab: TabType): string | null => {
    const map: Record<string, string> = {
      heygen: "heygen_prompt", invideo: "invideo_prompt", canva: "canva_prompt",
      pixelbin: "pixelbin_prompt", easemate: "easemate_prompt", virbo: "virbo_prompt",
      capcut: "capcut_prompt", detail: "detail_prompt", elevenlabs: "elevenlabs_prompt",
      nvidia: "nvidia_prompt",
    };
    return video[map[tab]] || null;
  };

  const getTabLabel = (tab: TabType): string => tabs.find(t => t.key === tab)?.label || tab;

  const getTabIcon = (tab: TabType): string => {
    const icons: Record<TabType, string> = {
      free: "📱", heygen: "✨", invideo: "🎬", canva: "🎨", pixelbin: "⚡",
      easemate: "🤖", virbo: "🗣️", capcut: "✂️", detail: "🖥️", elevenlabs: "🎙️", nvidia: "🎮"
    };
    return icons[tab];
  };

  const renderToolGuide = (data: any) => {
    const toolKey = activeTab as string;
    const toolData = activeTab === "free" ? null : data.ai_tool_comparison?.[toolKey];
    
    if (activeTab === "free" && data.ai_tool_comparison?.free_alternatives) {
      return (
        <div className="flex flex-wrap gap-3">
          {data.ai_tool_comparison.free_alternatives.map((tool: any, i: number) => (
            <a key={i} href={tool.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
              <span className="text-sm font-medium text-foreground">{tool.name}</span>
              <span className="text-[10px] text-muted-foreground">{tool.best_for}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          ))}
        </div>
      );
    }

    if (!toolData) return null;

    return (
      <div className="space-y-2">
        <p className="text-sm text-secondary-foreground"><strong>Best for:</strong> {toolData.best_for}</p>
        <p className="text-sm text-secondary-foreground"><strong>Cost:</strong> {toolData.cost}</p>
        <p className="text-xs text-muted-foreground">{toolData.workflow_tip}</p>
        {toolData.signup_url && (
          <a href={toolData.signup_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Open {getTabLabel(activeTab)} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  };

  return (
    <StepLayout title="Video Studio" description="Your video production plan with ready-to-use prompts for 11 tools — from free options to professional AI platforms."
      icon="🎬" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.video_strategy && (
            <div className="glass rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-foreground mb-2">📺 Video Strategy</h4>
              <p className="text-sm text-secondary-foreground">{data.video_strategy}</p>
            </div>
          )}

          {/* Tool Selection Tabs */}
          <div className="flex gap-1.5 p-1 bg-secondary/50 rounded-xl overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {tab.icon}
                <div className="text-left">
                  <div className="text-xs font-semibold">{tab.label}</div>
                  <div className="text-[9px] opacity-75">{tab.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Tool Guide */}
          {data.ai_tool_comparison && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🔧 Tool Guide</h4>
              {renderToolGuide(data)}
            </div>
          )}

          {/* Video Ideas with tab-specific prompts */}
          {data.video_ideas?.map((v: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{v.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.difficulty === "easy" ? "bg-primary/10 text-primary" : v.difficulty === "medium" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{v.difficulty}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{v.type} • Est. views: {v.estimated_views}</p>
              <p className="text-sm text-secondary-foreground">{v.script_outline}</p>

              {/* Free Tools Tab */}
              {activeTab === "free" && v.free_production_guide && (
                <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-primary">📱 Free: {v.free_production_guide.tool}</h5>
                    {v.free_production_guide.prompt_for_tool && (
                      <CopyButton text={v.free_production_guide.prompt_for_tool} id={`free-${i}`} />
                    )}
                  </div>
                  {v.free_production_guide.step_by_step?.map((step: string, j: number) => (
                    <p key={j} className="text-xs text-secondary-foreground">{step}</p>
                  ))}
                  {v.free_production_guide.tips && (
                    <p className="text-[10px] text-muted-foreground italic mt-1">💡 {v.free_production_guide.tips}</p>
                  )}
                </div>
              )}

              {/* All other platform tabs */}
              {activeTab !== "free" && (() => {
                const prompt = getPromptForTab(v, activeTab);
                if (!prompt) return null;
                return (
                  <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-semibold text-accent">{getTabIcon(activeTab)} {getTabLabel(activeTab)} Prompt</h5>
                      <CopyButton text={prompt} id={`${activeTab}-${i}`} />
                    </div>
                    <p className="text-xs text-secondary-foreground whitespace-pre-wrap">{prompt}</p>
                  </div>
                );
              })()}

              {v.equipment && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.equipment.map((e: string, j: number) => <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{e}</span>)}
                </div>
              )}
            </div>
          ))}

          {data.equipment_recommendations && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🎥 Equipment</h4>
              {data.equipment_recommendations.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between mb-2 p-2 rounded-lg bg-secondary/30">
                  <div>
                    <span className="text-sm text-foreground">{e.item}</span>
                    <span className="text-xs text-muted-foreground ml-2">{e.price_range}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.priority === "essential" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{e.priority}</span>
                </div>
              ))}
            </div>
          )}

          {data.filming_tips && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">💡 Filming Tips</h4>
              {data.filming_tips.map((t: string, i: number) => <p key={i} className="text-xs text-secondary-foreground mb-1">• {t}</p>)}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default VideoStudioStep;
