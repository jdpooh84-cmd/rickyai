import { useEffect, useMemo, useState } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import VideoStudioGuide from "./VideoStudioGuide";
import ExternalAppConnections from "./ExternalAppConnections";
import { Copy, Check, ExternalLink, Film, Sparkles, Smartphone, Palette, Wand2, Video, Bot, Scissors, Monitor, Mic, MonitorSpeaker, Zap, Clock, Calendar, BarChart3, Play, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import sampleVideoAsset from "@/assets/sample-promo-video.mp4.asset.json";
import demoVideoAsset from "@/assets/demo-business-promo.mp4.asset.json";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/persistence";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type TabType = "free" | "capcut" | "heygen" | "invideo" | "canva" | "pixelbin" | "easemate" | "virbo" | "detail" | "elevenlabs" | "nvidia";
type ProductionMode = "quick" | "standard" | "longform";
type WorkflowMode = "diy" | "auto" | "pipeline";
type PostFrequency = "1x" | "2x" | "3x";
type PostSchedule = "daily" | "weekly" | "monthly" | "yearly";

interface VideoStudioPersistedState {
  businessId: string | null;
  locationId: string | null;
  productionMode: ProductionMode | null;
  workflowMode: WorkflowMode | null;
  postFrequency: PostFrequency;
  postSchedule: PostSchedule;
  pipelineKeyword: string;
  pipelineResult: any;
  generatedVideoScript: any;
  insightReport: any;
}

const VIDEO_STUDIO_STATE_KEY = "rickyai-video-studio-state";

const defaultPersistedState: VideoStudioPersistedState = {
  businessId: null,
  locationId: null,
  productionMode: null,
  workflowMode: null,
  postFrequency: "1x",
  postSchedule: "daily",
  pipelineKeyword: "",
  pipelineResult: null,
  generatedVideoScript: null,
  insightReport: null,
};

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting, setData } = useStrategyStep(8);
  const persistedState = useMemo(() => readLocalStorage(VIDEO_STUDIO_STATE_KEY, defaultPersistedState), []);
  const [activeTab, setActiveTab] = useState<TabType>("free");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // New state for production modes
  const [productionMode, setProductionMode] = useState<ProductionMode | null>(persistedState.productionMode);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode | null>(persistedState.workflowMode);
  const [postFrequency, setPostFrequency] = useState<PostFrequency>(persistedState.postFrequency);
  const [postSchedule, setPostSchedule] = useState<PostSchedule>(persistedState.postSchedule);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [renderedVideos, setRenderedVideos] = useState<any[]>([]);
  const [insightReport, setInsightReport] = useState<any>(persistedState.insightReport);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [generatedVideoScript, setGeneratedVideoScript] = useState<any>(persistedState.generatedVideoScript);
  const [pipelineKeyword, setPipelineKeyword] = useState(persistedState.pipelineKeyword);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(persistedState.pipelineResult);

  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);

  useEffect(() => {
    writeLocalStorage(VIDEO_STUDIO_STATE_KEY, {
      businessId,
      locationId,
      productionMode,
      workflowMode,
      postFrequency,
      postSchedule,
      pipelineKeyword,
      pipelineResult,
      generatedVideoScript,
      insightReport,
    });
  }, [businessId, generatedVideoScript, insightReport, locationId, pipelineKeyword, pipelineResult, postFrequency, postSchedule, productionMode, workflowMode]);

  useEffect(() => {
    if (!businessId || persistedState.businessId !== businessId || persistedState.locationId !== locationId) return;

    if (persistedState.workflowMode) {
      setWorkflowMode((current) => current ?? persistedState.workflowMode);
    }

    if (persistedState.productionMode) {
      setProductionMode((current) => current ?? persistedState.productionMode);
    }
  }, [businessId, locationId, persistedState.businessId, persistedState.locationId, persistedState.productionMode, persistedState.workflowMode]);

  const handleGenerate = async () => {
    if (!businessId) return;
    const r = await generate(businessId, locationId);
    if (r) {
      onComplete?.();
    }
  };

  const resetVideoStudioFlow = () => {
    setProductionMode(null);
    setWorkflowMode(null);
    setPostFrequency("1x");
    setPostSchedule("daily");
    setPipelineKeyword("");
    setPipelineResult(null);
    setGeneratedVideoScript(null);
    setInsightReport(null);
    setRenderedVideos([]);
    setData(null);
    removeLocalStorage(VIDEO_STUDIO_STATE_KEY);
  };

  const handleAutoGenerate = async () => {
    if (!businessId) {
      console.error("[VideoStudio] handleAutoGenerate: No businessId");
      toast.error("Please set up your business profile first.");
      return;
    }
    console.log("[VideoStudio] handleAutoGenerate START", { businessId, locationId, productionMode, workflowMode, postFrequency, postSchedule });
    setRenderingVideo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("[VideoStudio] handleAutoGenerate: No active session");
        throw new Error("Not authenticated — please log in again");
      }
      console.log("[VideoStudio] handleAutoGenerate: Calling ai-strategy step 8...");

      const response = await supabase.functions.invoke("ai-strategy", {
        body: { 
          step: 8, 
          businessId, 
          locationId,
          productionMode,
          workflowMode: "auto",
          postFrequency,
          postSchedule,
        },
      });

      console.log("[VideoStudio] handleAutoGenerate: Response received", { error: response.error, hasData: !!response.data });

      if (response.error) {
        console.error("[VideoStudio] handleAutoGenerate: Function error", response.error);
        throw new Error(response.error.message);
      }
      setData(response.data);
      
      if (response.data?.rendered_videos) {
        setRenderedVideos(response.data.rendered_videos);
      }
      
      toast.success("Full video production plan generated!");
      onComplete?.();
    } catch (err: any) {
      console.error("[VideoStudio] handleAutoGenerate FAILED:", err);
      toast.error(err.message || "Failed to generate. Try again.");
    } finally {
      setRenderingVideo(false);
    }
  };

  const handleGenerateInsights = async () => {
    if (!businessId) return;
    setLoadingInsights(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("ai-strategy", {
        body: { step: 8, businessId, locationId, insightReport: true },
      });

      if (response.error) throw new Error(response.error.message);
      setInsightReport(response.data);
      toast.success("Insight report generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate insights.");
    } finally {
      setLoadingInsights(false);
    }
  };
  const handleGenerateVideo = async (videoType: string = "promotional") => {
    if (!businessId) {
      console.error("[VideoStudio] handleGenerateVideo: No businessId");
      return;
    }
    console.log("[VideoStudio] handleGenerateVideo START", { businessId, videoType, productionMode });
    setGeneratingVideo(true);
    try {
      const response = await supabase.functions.invoke("generate-video", {
        body: { businessId, videoType, productionMode },
      });
      console.log("[VideoStudio] handleGenerateVideo: Response", { error: response.error, hasData: !!response.data, data: response.data });
      if (response.error) {
        console.error("[VideoStudio] handleGenerateVideo: Function error", response.error);
        throw new Error(response.error.message);
      }
      setGeneratedVideoScript(response.data);
      if (response.data?.video_url) {
        toast.success("Video generated successfully!");
      } else {
        toast.success(response.data?.message || "Video brief generated — use it with CapCut, Canva, or any video tool.");
      }
    } catch (err: any) {
      console.error("[VideoStudio] handleGenerateVideo FAILED:", err);
      toast.error(err.message || "Failed to generate video");
    } finally {
      setGeneratingVideo(false);
    }
  };


  const handlePipelineRun = async () => {
    if (!businessId) {
      console.error("[VideoStudio] handlePipelineRun: No businessId");
      return;
    }
    console.log("[VideoStudio] handlePipelineRun START", { businessId, pipelineKeyword, productionMode });
    setPipelineRunning(true);
    setPipelineResult(null);
    try {
      const response = await supabase.functions.invoke("webhook-proxy", {
        body: {
          scenario: "video_production",
          businessId,
          keyword: pipelineKeyword || undefined,
          videoType: "promotional",
          productionMode: productionMode || "standard",
        },
      });
      console.log("[VideoStudio] handlePipelineRun: Response", { error: response.error, hasData: !!response.data, data: response.data });
      if (response.error) {
        console.error("[VideoStudio] handlePipelineRun: Function error", response.error);
        throw new Error(response.error.message);
      }
      if (response.data?.error) {
        if (response.data.upgrade_required || response.data.code === "USAGE_LIMIT_REACHED") {
          toast.error(response.data.error || "Monthly video limit reached.");
        } else {
          throw new Error(response.data.error);
        }
        return;
      }
      setPipelineResult(response.data);
      toast.success(response.data?.message || "Pipeline triggered!");
      onComplete?.();
    } catch (err: any) {
      console.error("[VideoStudio] handlePipelineRun FAILED:", err);
      toast.error(err.message || "Pipeline failed");
    } finally {
      setPipelineRunning(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyToClipboard(text, id)}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
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
    { key: "nvidia", label: "Nvidia", icon: <MonitorSpeaker className="w-4 h-4" />, desc: "Broadcast" },
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

  const handleDownloadGuide = () => {
    const link = document.createElement('a');
    link.href = '/RickyAI-Video-Studio-Guide.pdf';
    link.download = 'RickyAI-Video-Studio-Guide.pdf';
    link.click();
  };

  // Step 1: Choose production mode
  if (!productionMode) {
    return (
      <StepLayout title="Video Studio" description="Choose your video production style"
        icon="🎬" loading={false} hasData={false} onGenerate={() => {}} needsProfile={!businessId}
        hideGenerateButton>
        <VideoStudioGuide onDownloadGuide={handleDownloadGuide} />
        
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-foreground text-center">How do you want to produce your videos?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => setProductionMode("quick")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Zap className="w-5 h-5 text-primary" /></div>
                <h4 className="font-bold text-foreground">⚡ Quick</h4>
              </div>
              <p className="text-sm text-muted-foreground">15-30 second clips. Social-first. Fast turnaround. Perfect for daily posts on TikTok, Reels, Shorts.</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {["TikTok", "Reels", "Shorts"].map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p}</span>
                ))}
              </div>
            </button>

            <button onClick={() => setProductionMode("standard")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all group ring-2 ring-primary/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Film className="w-5 h-5 text-primary" /></div>
                <h4 className="font-bold text-foreground">🎬 Standard</h4>
              </div>
              <p className="text-sm text-muted-foreground">1-3 minute videos. Balanced quality. Great for tutorials, testimonials, and product showcases.</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {["YouTube", "Facebook", "LinkedIn"].map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p}</span>
                ))}
              </div>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Recommended</span>
            </button>

            <button onClick={() => setProductionMode("longform")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10"><Video className="w-5 h-5 text-primary" /></div>
                <h4 className="font-bold text-foreground">📹 Long-Form</h4>
              </div>
              <p className="text-sm text-muted-foreground">5-15 minute deep dives. Webinars, interviews, training, and brand documentaries.</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {["YouTube", "Webinar", "Course"].map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p}</span>
                ))}
              </div>
            </button>
          </div>

          {/* Sample Generated Video */}
          <div className="glass rounded-2xl p-6 mt-6">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Sample AI-Generated Video
            </h4>
            <p className="text-xs text-muted-foreground mb-3">This is what RickyAI can produce for your business — a professional promo video generated from your business profile.</p>
            <video controls className="w-full rounded-xl max-h-[300px] bg-black" poster="">
              <source src={demoVideoAsset.url} type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>

          {/* External App Connections */}
          <ExternalAppConnections />
        </div>
      </StepLayout>
    );
  }

  // Step 2: Choose workflow mode (DIY or Full-Auto)
  if (!workflowMode) {
    return (
      <StepLayout title="Video Studio" description="Choose your workflow"
        icon="🎬" loading={false} hasData={false} onGenerate={() => {}} needsProfile={!businessId}
        hideGenerateButton>
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setProductionMode(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <span className="text-xs text-muted-foreground">Mode: {productionMode === "quick" ? "⚡ Quick" : productionMode === "standard" ? "🎬 Standard" : "📹 Long-Form"}</span>
          </div>
          <h3 className="text-lg font-bold text-foreground text-center">How hands-on do you want to be?</h3>
          <p className="text-center text-xs text-muted-foreground -mt-2">Start free — no API keys or paid tools required for DIY and AI-Assisted modes</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => setWorkflowMode("diy")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all relative">
              <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold border border-green-500/20">FREE</span>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-accent/10"><Scissors className="w-6 h-6 text-accent-foreground" /></div>
                <div>
                  <h4 className="font-bold text-foreground">🛠 DIY</h4>
                  <span className="text-xs text-muted-foreground">Build it yourself</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">AI generates scripts & prompts. You produce the video in your tool of choice. No API keys needed.</p>
              <ul className="space-y-1">
                {["AI scripts & prompts", "Full creative control", "Use any platform", "No extra cost"].map(item => (
                  <li key={item} className="text-[10px] text-secondary-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </button>

            <button onClick={() => setWorkflowMode("auto")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all ring-2 ring-primary/30 relative">
              <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold border border-green-500/20">FREE</span>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-primary/10"><Sparkles className="w-6 h-6 text-primary" /></div>
                <div>
                  <h4 className="font-bold text-foreground">🚀 AI-Assisted</h4>
                  <span className="text-xs text-muted-foreground">We handle the heavy lifting</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Complete research, scripting, production plan & scheduling. Built-in AI — no API keys needed.</p>
              <ul className="space-y-1">
                {["Complete production plan", "Automated scheduling", "Insight reports", "No API keys required"].map(item => (
                  <li key={item} className="text-[10px] text-secondary-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Most Popular</span>
            </button>

            <button onClick={() => setWorkflowMode("pipeline")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all relative">
              <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/20">PREMIUM</span>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-primary/10"><Zap className="w-6 h-6 text-primary" /></div>
                <div>
                  <h4 className="font-bold text-foreground">⚡ Automated Pipeline</h4>
                  <span className="text-xs text-muted-foreground">Fully hands-off</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Keyword → Research → Script → Voice → Video → Post. Uses Runway AI for real video rendering.</p>
              <ul className="space-y-1">
                {["Runway AI video rendering", "ElevenLabs voiceover (optional)", "Auto YouTube posting", "Real MP4 videos in-app"].map(item => (
                  <li key={item} className="text-[10px] text-secondary-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">Requires API Keys</span>
            </button>
          </div>
        </div>
      </StepLayout>
    );
  }

  // Step 3: If auto mode, configure posting schedule
  if (workflowMode === "auto" && !data) {
    return (
      <StepLayout title="Video Studio" description="Set your posting schedule"
        icon="🎬" loading={renderingVideo} hasData={false} onGenerate={handleAutoGenerate} needsProfile={!businessId}
        generateLabel="🚀 Generate Full Video Plan">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setWorkflowMode(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <span className="text-xs text-muted-foreground">
              {productionMode === "quick" ? "⚡ Quick" : productionMode === "standard" ? "🎬 Standard" : "📹 Long-Form"} • 🚀 Full Auto
            </span>
          </div>

          {/* Posting Frequency */}
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> How many times per day?
            </h4>
            <div className="flex gap-3">
              {([["1x", "1 post/day"], ["2x", "2 posts/day"], ["3x", "3 posts/day"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setPostFrequency(val)}
                  className={`flex-1 rounded-xl p-4 text-center transition-all ${
                    postFrequency === val ? "bg-primary text-primary-foreground ring-2 ring-primary" : "glass hover:ring-2 hover:ring-primary/50"
                  }`}>
                  <div className="text-2xl font-bold">{val.replace("x", "")}</div>
                  <div className="text-xs mt-1">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Posting Schedule */}
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> How long should this plan run?
            </h4>
            <div className="flex gap-2 flex-wrap">
              {([["daily", "📅 Daily Plan"], ["weekly", "📆 Weekly Plan"], ["monthly", "🗓 Monthly Plan"], ["yearly", "📊 Yearly Plan"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setPostSchedule(val)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    postSchedule === val ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {postSchedule === "daily" && `${postFrequency.replace("x", "")} video(s) produced daily with morning insight reports.`}
              {postSchedule === "weekly" && `${parseInt(postFrequency) * 7} videos per week with daily + weekly insight reports.`}
              {postSchedule === "monthly" && `${parseInt(postFrequency) * 30} videos per month. Complete hands-off content calendar.`}
              {postSchedule === "yearly" && `${parseInt(postFrequency) * 365} videos planned for the year with quarterly strategy reviews.`}
            </p>
          </div>

          {/* Insight Reports */}
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Insight Reports (Always Included)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3 bg-primary/5 border border-primary/10">
                <div className="text-xs font-semibold text-primary">📊 Daily Report</div>
                <p className="text-[10px] text-muted-foreground mt-1">Performance metrics, engagement rates, best posting times, and trend alerts.</p>
              </div>
              <div className="rounded-xl p-3 bg-accent/5 border border-accent/10">
                <div className="text-xs font-semibold text-accent-foreground">📈 Weekly Report</div>
                <p className="text-[10px] text-muted-foreground mt-1">Growth summary, top-performing content, audience insights, and next-week recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      </StepLayout>
    );
  }

  // DIY mode - go straight to generation with standard step
  if (workflowMode === "diy" && !data) {
    return (
      <StepLayout title="Video Studio" description="Generate your video plan with ready-to-use prompts"
        icon="🎬" loading={loading} hasData={false} onGenerate={handleGenerate} needsProfile={!businessId}
        generateLabel="🎬 Generate Video Plan">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setWorkflowMode(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
          <span className="text-xs text-muted-foreground">
            {productionMode === "quick" ? "⚡ Quick" : productionMode === "standard" ? "🎬 Standard" : "📹 Long-Form"} • 🛠 DIY
          </span>
        </div>
        <VideoStudioGuide onDownloadGuide={handleDownloadGuide} />
      </StepLayout>
    );
  }

  // Pipeline mode - automated Make.com workflow
  if (workflowMode === "pipeline") {
    return (
      <StepLayout title="Video Studio" description="Automated video pipeline powered by your Make.com workflows"
        icon="🎬" loading={pipelineRunning} hasData={!!pipelineResult} onGenerate={handlePipelineRun} needsProfile={!businessId}
        generateLabel="⚡ Run Pipeline">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setWorkflowMode(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <span className="text-xs text-muted-foreground">
              {productionMode === "quick" ? "⚡ Quick" : productionMode === "standard" ? "🎬 Standard" : "📹 Long-Form"} • ⚡ Pipeline
            </span>
          </div>

          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-2">How it works</h4>
            <div className="grid grid-cols-5 gap-2">
              {[
                { step: "1", label: "Keyword", emoji: "🔍" },
                { step: "2", label: "Research", emoji: "📊" },
                { step: "3", label: "Script + Voice", emoji: "🎙️" },
                { step: "4", label: "Video Render", emoji: "🎬" },
                { step: "5", label: "Post", emoji: "📱" },
              ].map(s => (
                <div key={s.step} className="text-center p-2 rounded-lg bg-primary/5">
                  <div className="text-lg">{s.emoji}</div>
                  <div className="text-[10px] font-medium text-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Enter a keyword and the pipeline will research, write a script, generate voiceover with ElevenLabs, 
              render a video with HeyGen (30+ seconds with captions), and optionally post to YouTube — all automatically.
            </p>
          </div>

          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-3">Start a video run</h4>
            <input
              type="text"
              value={pipelineKeyword}
              onChange={e => setPipelineKeyword(e.target.value)}
              placeholder="Enter a keyword (e.g., 'pizza delivery near me')"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
            />
            <p className="text-[10px] text-muted-foreground">
              Your HeyGen and ElevenLabs API keys from the Connect step will be used. Make sure they're connected before running.
            </p>
          </div>

          {pipelineResult && (
            <div className="glass rounded-2xl p-6">
              <h4 className="text-sm font-bold text-primary mb-2">✅ Pipeline {pipelineResult.source === "make_webhook" ? "Triggered" : "Complete"}</h4>
              <p className="text-sm text-secondary-foreground">{pipelineResult.message}</p>
              {pipelineResult.usage && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Usage: {pipelineResult.usage.render_jobs_used}/{pipelineResult.usage.limit} renders this month
                </p>
              )}
              {pipelineResult.script && (
                <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <h5 className="text-xs font-semibold text-primary mb-1">{pipelineResult.script.title}</h5>
                  <p className="text-xs text-secondary-foreground">{pipelineResult.script.description}</p>
                  {pipelineResult.script.script && (
                    <div className="mt-2 p-2 rounded-lg bg-secondary/30">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Script:</p>
                      <p className="text-xs text-secondary-foreground whitespace-pre-wrap">{pipelineResult.script.script}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <ExternalAppConnections />
        </div>
      </StepLayout>
    );
  }

  // Results view (both DIY and Auto)
  return (
    <StepLayout title="Video Studio" description={
      workflowMode === "auto" 
        ? "Your complete video production plan is ready. Videos are being produced based on your schedule."
        : "Your video production plan with ready-to-use prompts for 11 tools."
    }
      icon="🎬" loading={loading || renderingVideo} hasData={!!data} onGenerate={workflowMode === "auto" ? handleAutoGenerate : handleGenerate} 
      onRegenerate={workflowMode === "auto" ? handleAutoGenerate : handleGenerate} needsProfile={!businessId}>

      {/* Mode badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={resetVideoStudioFlow}
          className="text-xs text-muted-foreground hover:text-foreground">← Change Mode</button>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
          {productionMode === "quick" ? "⚡ Quick" : productionMode === "standard" ? "🎬 Standard" : "📹 Long-Form"}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground font-semibold">
          {workflowMode === "auto" ? "🚀 Full Auto" : "🛠 DIY"}
        </span>
        {workflowMode === "auto" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {postFrequency.replace("x", "")}x {postSchedule}
          </span>
        )}
      </div>

      {/* Auto Mode: Posting Schedule Summary */}
      {workflowMode === "auto" && data?.posting_schedule && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Your Posting Schedule
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-xl bg-primary/5">
              <div className="text-2xl font-bold text-primary">{data.posting_schedule.daily_posts || postFrequency.replace("x", "")}</div>
              <div className="text-[10px] text-muted-foreground">Posts/Day</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/5">
              <div className="text-2xl font-bold text-primary">{data.posting_schedule.weekly_total || parseInt(postFrequency) * 7}</div>
              <div className="text-[10px] text-muted-foreground">Posts/Week</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/5">
              <div className="text-2xl font-bold text-primary">{data.posting_schedule.best_times?.[0] || "9:00 AM"}</div>
              <div className="text-[10px] text-muted-foreground">Best Time</div>
            </div>
            <div className="text-center p-3 rounded-xl bg-primary/5">
              <div className="text-2xl font-bold text-primary">{data.posting_schedule.platforms_count || "3+"}</div>
              <div className="text-[10px] text-muted-foreground">Platforms</div>
            </div>
          </div>
          {data.posting_schedule.schedule_details && (
            <div className="mt-4 space-y-2">
              {data.posting_schedule.schedule_details.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.day || `Day ${i + 1}`}</span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary-foreground">{item.content_type}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{item.platform}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auto Mode: Rendered Videos */}
      {workflowMode === "auto" && data?.produced_videos && (
        <div className="glass rounded-2xl p-6 mb-6">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" /> Produced Videos
          </h4>
          <div className="space-y-3">
            {data.produced_videos.map((video: any, i: number) => (
              <div key={i} className="rounded-xl p-4 bg-secondary/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-foreground">{video.title}</h5>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{video.duration}</span>
                </div>
                <p className="text-xs text-muted-foreground">{video.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Platform: {video.platform}</span>
                  <span className="text-[10px] text-muted-foreground">• Format: {video.format}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">📋 Full script, storyboard, and production prompts ready</p>
                  </div>
                </div>
                {video.production_prompts && (
                  <div className="space-y-1">
                    {Object.entries(video.production_prompts).map(([tool, prompt]: [string, any]) => (
                      <div key={tool} className="flex items-center justify-between p-2 rounded-lg bg-accent/5">
                        <span className="text-xs font-medium text-foreground capitalize">{tool.replace("_prompt", "")}</span>
                        <CopyButton text={String(prompt)} id={`produced-${i}-${tool}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insight Reports Button */}
      {/* Generate Video Button */}
      {workflowMode === "auto" && (
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" /> Produce a Video Now
              </h4>
              <p className="text-[10px] text-muted-foreground">Generate an AI video based on your business profile</p>
            </div>
            <button onClick={() => handleGenerateVideo("promotional")} disabled={generatingVideo}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
              {generatingVideo ? "Producing..." : "🎬 Produce Video"}
            </button>
          </div>
          {generatedVideoScript && (
            <div className="space-y-3">
              {/* Pipeline Status */}
              {generatedVideoScript.pipeline_steps && (
                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <h5 className="text-xs font-semibold text-foreground mb-2">🔄 Pipeline Status</h5>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(generatedVideoScript.pipeline_steps).map(([step, status]: [string, any]) => (
                      <div key={step} className={`text-center p-2 rounded-lg ${
                        status === "completed" ? "bg-green-500/10 text-green-400" : 
                        status === "processing" ? "bg-amber-500/10 text-amber-400" :
                        status?.toString().startsWith("skipped") ? "bg-muted text-muted-foreground" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        <div className="text-sm font-bold">{status === "completed" ? "✅" : status === "processing" ? "⏳" : status?.toString().startsWith("skipped") ? "⏭️" : "❌"}</div>
                        <div className="text-[10px] font-medium capitalize">{step}</div>
                      </div>
                    ))}
                  </div>
                  {!generatedVideoScript.video_url && generatedVideoScript.next_steps?.length > 0 && (
                    <div className="mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <p className="text-[10px] font-semibold text-amber-400 mb-1">To get a finished video:</p>
                      {generatedVideoScript.next_steps.map((step: string, i: number) => (
                        <p key={i} className="text-[10px] text-muted-foreground">• {step}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Script Info */}
              {generatedVideoScript.script && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <h5 className="text-xs font-semibold text-primary mb-1">{generatedVideoScript.script.title}</h5>
                  <p className="text-xs text-secondary-foreground">{generatedVideoScript.script.description}</p>
                  {generatedVideoScript.script.voiceover_script && (
                    <div className="mt-2 p-2 rounded-lg bg-secondary/30">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Voiceover Script:</p>
                      <p className="text-xs text-secondary-foreground whitespace-pre-wrap">{generatedVideoScript.script.voiceover_script}</p>
                      <CopyButton text={generatedVideoScript.script.voiceover_script} id="voiceover-script" />
                    </div>
                  )}
                  {generatedVideoScript.script.caption && (
                    <div className="mt-2 p-2 rounded-lg bg-secondary/30">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Caption:</p>
                      <p className="text-xs text-secondary-foreground">{generatedVideoScript.script.caption}</p>
                      <CopyButton text={generatedVideoScript.script.caption} id="caption-copy" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {generatedVideoScript.script.hashtags?.map((h: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">#{h.replace('#','')}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Voiceover Audio */}
              {generatedVideoScript.voiceover_url && (
                <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                  <h5 className="text-xs font-semibold text-accent-foreground mb-2">🎙️ AI Voiceover (ElevenLabs)</h5>
                  <audio controls className="w-full">
                    <source src={generatedVideoScript.voiceover_url} type="audio/mpeg" />
                  </audio>
                  <a href={generatedVideoScript.voiceover_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                    <Download className="w-3 h-3" /> Download voiceover
                  </a>
                </div>
              )}

              {/* Scene Images (FREE - no API keys needed) */}
              {generatedVideoScript.scene_images?.length > 0 && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <h5 className="text-xs font-semibold text-primary mb-2">🖼️ AI-Generated Scene Images ({generatedVideoScript.scene_images.length} scenes)</h5>
                  <p className="text-[10px] text-muted-foreground mb-3">Professional images generated from your business profile — import into CapCut or Canva to create your video.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {generatedVideoScript.scene_images.map((url: string, i: number) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Scene ${i + 1}`} className="w-full rounded-lg object-cover aspect-video" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <a href={url} download className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">
                            <Download className="w-3 h-3" />
                          </a>
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded bg-secondary text-foreground">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white">Scene {i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <a href={generatedVideoScript.scene_images[0]} download
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                      <Download className="w-3 h-3" /> Download All Scenes
                    </a>
                  </div>
                </div>
              )}

              {/* Rendered Video */}
              {generatedVideoScript.video_url && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <h5 className="text-xs font-semibold text-primary mb-2">🎬 Your Finished Video</h5>
                  <video controls className="w-full rounded-xl max-h-[300px] bg-black">
                    <source src={generatedVideoScript.video_url} type="video/mp4" />
                  </video>
                  <div className="flex gap-2 mt-2">
                    <a href={generatedVideoScript.video_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                      <Download className="w-3 h-3" /> Download Video
                    </a>
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="p-3 rounded-xl bg-secondary/30">
                <p className="text-xs text-secondary-foreground">{generatedVideoScript.message}</p>
              </div>
            </div>
          )}
          {/* Sample video preview */}
          <div className="mt-4">
            <p className="text-[10px] text-muted-foreground mb-2">Sample AI-generated video preview:</p>
            <video controls className="w-full rounded-xl max-h-[200px] bg-black">
              <source src={sampleVideoAsset.url} type="video/mp4" />
            </video>
          </div>
        </div>
      )}

      {/* Insight Reports */}
      {workflowMode === "auto" && (
        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Insight Reports
              </h4>
              <p className="text-[10px] text-muted-foreground">Daily performance + weekly growth analysis</p>
            </div>
            <button onClick={handleGenerateInsights} disabled={loadingInsights}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
              {loadingInsights ? "Generating..." : "📊 Generate Report"}
            </button>
          </div>
          {insightReport && (
            <div className="mt-4 space-y-3">
              {insightReport.daily_insights && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <h5 className="text-xs font-semibold text-primary mb-2">📊 Daily Insights</h5>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {insightReport.daily_insights.metrics?.map((m: any, i: number) => (
                      <div key={i} className="text-center p-2 rounded-lg bg-background/50">
                        <div className="text-sm font-bold text-foreground">{m.value}</div>
                        <div className="text-[10px] text-muted-foreground">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-secondary-foreground">{insightReport.daily_insights.summary}</p>
                </div>
              )}
              {insightReport.weekly_insights && (
                <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                  <h5 className="text-xs font-semibold text-accent-foreground mb-2">📈 Weekly Insights</h5>
                  <p className="text-xs text-secondary-foreground">{insightReport.weekly_insights.summary}</p>
                  {insightReport.weekly_insights.recommendations && (
                    <ul className="mt-2 space-y-1">
                      {insightReport.weekly_insights.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-[10px] text-muted-foreground">• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* How-to guide (DIY mode) */}
      {workflowMode === "diy" && <VideoStudioGuide onDownloadGuide={handleDownloadGuide} />}

      {data && (
        <div className="space-y-6">
          {data.video_strategy && (
            <div className="glass rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-foreground mb-2">📺 Video Strategy</h4>
              <p className="text-sm text-secondary-foreground">{data.video_strategy}</p>
            </div>
          )}

          {/* Tool Selection Tabs (DIY mode shows all, Auto mode shows produced) */}
          {workflowMode === "diy" && (
            <>
              <div className="flex gap-1.5 p-1 bg-secondary/50 rounded-xl overflow-x-auto">
                {tabs.map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>
                    {tab.icon}
                    <div className="text-left">
                      <div className="text-xs font-semibold">{tab.label}</div>
                      <div className="text-[9px] opacity-75">{tab.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {data.ai_tool_comparison && (
                <div className="glass rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">🔧 Tool Guide</h4>
                  {renderToolGuide(data)}
                </div>
              )}
            </>
          )}

          {/* Video Ideas */}
          {data.video_ideas?.map((v: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{v.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.difficulty === "easy" ? "bg-primary/10 text-primary" : v.difficulty === "medium" ? "bg-accent/10 text-accent-foreground" : "bg-destructive/10 text-destructive"}`}>{v.difficulty}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{v.type} • Est. views: {v.estimated_views}</p>
              <p className="text-sm text-secondary-foreground">{v.script_outline}</p>

              {workflowMode === "diy" && (
                <>
                  {activeTab === "free" && v.free_production_guide && (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-primary">📱 Free: {v.free_production_guide.tool}</h5>
                        {v.free_production_guide.prompt_for_tool && <CopyButton text={v.free_production_guide.prompt_for_tool} id={`free-${i}`} />}
                      </div>
                      {v.free_production_guide.step_by_step?.map((step: string, j: number) => (
                        <p key={j} className="text-xs text-secondary-foreground">{step}</p>
                      ))}
                      {v.free_production_guide.tips && (
                        <p className="text-[10px] text-muted-foreground italic mt-1">💡 {v.free_production_guide.tips}</p>
                      )}
                    </div>
                  )}

                  {activeTab !== "free" && (() => {
                    const prompt = getPromptForTab(v, activeTab);
                    if (!prompt) return null;
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-accent/5 border border-accent/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-accent-foreground">{getTabIcon(activeTab)} {getTabLabel(activeTab)} Prompt</h5>
                          <CopyButton text={prompt} id={`${activeTab}-${i}`} />
                        </div>
                        <p className="text-xs text-secondary-foreground whitespace-pre-wrap">{prompt}</p>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Auto mode: show all prompts inline */}
              {workflowMode === "auto" && (
                <div className="mt-3 space-y-2">
                  {["heygen", "invideo", "capcut", "canva"].map(tool => {
                    const prompt = getPromptForTab(v, tool as TabType);
                    if (!prompt) return null;
                    return (
                      <div key={tool} className="flex items-center justify-between p-2 rounded-lg bg-accent/5">
                        <span className="text-xs font-medium text-foreground capitalize">{tool}</span>
                        <CopyButton text={prompt} id={`auto-${tool}-${i}`} />
                      </div>
                    );
                  })}
                </div>
              )}

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
