import { useEffect, useState } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import VideoStudioGuide from "./VideoStudioGuide";
import { Copy, Check, ExternalLink, Film, Sparkles, Smartphone, Palette, Wand2, Video, Bot, Scissors, Monitor, Mic, MonitorSpeaker, Zap, Clock, Calendar, BarChart3, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type TabType = "free" | "capcut" | "heygen" | "invideo" | "canva" | "pixelbin" | "easemate" | "virbo" | "detail" | "elevenlabs" | "nvidia";
type ProductionMode = "quick" | "standard" | "longform";
type WorkflowMode = "diy" | "auto";
type PostFrequency = "1x" | "2x" | "3x";
type PostSchedule = "daily" | "weekly" | "monthly" | "yearly";

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting, setData } = useStrategyStep(8);
  const [activeTab, setActiveTab] = useState<TabType>("free");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // New state for production modes
  const [productionMode, setProductionMode] = useState<ProductionMode | null>(null);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode | null>(null);
  const [postFrequency, setPostFrequency] = useState<PostFrequency>("1x");
  const [postSchedule, setPostSchedule] = useState<PostSchedule>("daily");
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [renderedVideos, setRenderedVideos] = useState<any[]>([]);
  const [insightReport, setInsightReport] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);

  const handleGenerate = async () => {
    if (!businessId) return;
    const r = await generate(businessId, locationId);
    if (r) onComplete?.();
  };

  const handleAutoGenerate = async () => {
    if (!businessId) return;
    setRenderingVideo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

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

      if (response.error) throw new Error(response.error.message);
      setData(response.data);
      
      if (response.data?.rendered_videos) {
        setRenderedVideos(response.data.rendered_videos);
      }
      
      toast.success("Full video production plan generated!");
      onComplete?.();
    } catch (err: any) {
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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setWorkflowMode("diy")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-accent/10"><Scissors className="w-6 h-6 text-accent-foreground" /></div>
                <div>
                  <h4 className="font-bold text-foreground text-lg">🛠 I'll Build It Myself</h4>
                  <span className="text-xs text-muted-foreground">DIY with AI research</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">The app does all the research, scripting, and prompt generation. You take those assets and produce the video using your tool of choice.</p>
              <ul className="space-y-1">
                {["AI-generated scripts & prompts", "Copy-paste into any tool", "Full creative control", "Use free or paid platforms"].map(item => (
                  <li key={item} className="text-xs text-secondary-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </button>

            <button onClick={() => setWorkflowMode("auto")}
              className="glass rounded-2xl p-6 text-left hover:ring-2 hover:ring-primary transition-all ring-2 ring-primary/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 rounded-xl bg-primary/10"><Sparkles className="w-6 h-6 text-primary" /></div>
                <div>
                  <h4 className="font-bold text-foreground text-lg">🚀 Do It All For Me</h4>
                  <span className="text-xs text-muted-foreground">Full automation</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">The app researches, scripts, produces, and delivers complete video content ready to post. Complete hands-off experience.</p>
              <ul className="space-y-1">
                {["Complete video production", "Ready-to-post content", "Automated posting schedule", "Daily & weekly insight reports"].map(item => (
                  <li key={item} className="text-xs text-secondary-foreground flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-primary" /> {item}
                  </li>
                ))}
              </ul>
              <span className="inline-block mt-3 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Most Popular</span>
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
        <button onClick={() => { setProductionMode(null); setWorkflowMode(null); setData(null); }}
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
