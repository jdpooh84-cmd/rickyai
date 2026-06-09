import { useEffect, useRef, useState, useMemo } from "react";
import StepLayout from "./StepLayout";
import VideoStudioGuide from "./VideoStudioGuide";
import ExternalAppConnections from "./ExternalAppConnections";
import MediaLibrary from "../MediaLibrary";
import { Copy, Check, Film, Sparkles, Play, Download, Loader2, Clock, Image, FileText, RefreshCw, ThumbsUp, ThumbsDown, Link2, Lock, Zap, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import demoVideoAsset from "@/assets/demo-business-promo.mp4.asset.json";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/persistence";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type LengthMode = "short" | "standard" | "long" | "extended";
type SpeedTier = "instant" | "standard" | "cinematic";

const SPEED_TIERS: { key: SpeedTier; label: string; engine: string; speed: string; quality: string; emoji: string; desc: string }[] = [
  { key: "instant", label: "Instant", engine: "Creatomate", speed: "2-5 min", quality: "Good", emoji: "⚡", desc: "AI images + voiceover rendered by Creatomate. Fastest option." },
  { key: "standard", label: "Standard", engine: "Creatomate", speed: "3-7 min", quality: "Great", emoji: "🎬", desc: "Professional quality video with cinematic polish." },
  { key: "cinematic", label: "Cinematic", engine: "Creatomate", speed: "5-10 min", quality: "Best", emoji: "🎥", desc: "Full cinematic production — best quality, worth the wait." },
];

const MAX_REWRITES = 3;

const LENGTH_OPTIONS: { key: LengthMode; label: string; duration: string; emoji: string; desc: string }[] = [
  { key: "short", label: "Standard", duration: "~60s", emoji: "⚡", desc: "Quick social clips for TikTok, Reels, Shorts" },
  { key: "standard", label: "Standard+", duration: "~60s", emoji: "🎬", desc: "Full promo for Instagram, Facebook, YouTube" },
  { key: "long", label: "Long", duration: "~90s", emoji: "📹", desc: "Extended brand story or commercial" },
  { key: "extended", label: "Extended", duration: "~120s", emoji: "🎥", desc: "Full-length cinematic brand film or ad spot" },
];

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { subscription } = useAuth();

  // State key scoped to the current business — prevents script bleed between businesses
  const stateKey = businessId ? `rickyai-video-studio-state-${businessId}` : "rickyai-video-studio-state";
  const persisted = readLocalStorage(stateKey, {
    lengthMode: "standard" as LengthMode,
    generatedVideoScript: null as any,
    approvedScript: null as any,
    scriptApproved: false,
  });

  const [lengthMode, setLengthMode] = useState<LengthMode>(persisted.lengthMode);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [generatedVideoScript, setGeneratedVideoScript] = useState<any>(persisted.generatedVideoScript);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("queued");
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRestoredVideo, setIsRestoredVideo] = useState(false);

  // Script approval state
  const [pendingScript, setPendingScript] = useState<any>(null);
  const [approvedScript, setApprovedScript] = useState<any>(persisted.approvedScript);
  const [scriptApproved, setScriptApproved] = useState(persisted.scriptApproved);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [rewriteCount, setRewriteCount] = useState(0);
  const [scriptVersions, setScriptVersions] = useState<any[]>([]);
  const scriptPanelRef = useRef<HTMLDivElement>(null);

  // Speed tier selection
  const [speedTier, setSpeedTier] = useState<SpeedTier>("instant");

  // Tracks previous businessId so we can detect switches without firing on mount
  const prevBusinessIdRef = useRef<string | null>(businessId);

  // Cinematic tier gating
  const videoTier = useMemo(() => {
    const plan = subscription.plan;
    if (plan === "agency") return "agency";
    if (plan === "growth") return "pro";
    if (plan === "business") return "pro";
    if (plan === "creator") return "free";
    return "free";
  }, [subscription.plan]);

  // Persist state (scoped to this business)
  useEffect(() => {
    writeLocalStorage(stateKey, { lengthMode, generatedVideoScript, approvedScript, scriptApproved });
  }, [stateKey, lengthMode, generatedVideoScript, approvedScript, scriptApproved]);

  // ── Clear all session state when the user switches businesses ──
  useEffect(() => {
    if (prevBusinessIdRef.current === businessId) return;
    prevBusinessIdRef.current = businessId;
    if (!businessId) return;
    setActiveJobId(null);
    setGeneratingVideo(false);
    setFinalVideoUrl(null);
    setIsRestoredVideo(false);
    setJobStatus("queued");
    setGeneratedVideoScript(null);
    setApprovedScript(null);
    setScriptApproved(false);
    setPendingScript(null);
    setRewriteCount(0);
    setSpeedTier("instant");
    setScriptVersions([]);
  }, [businessId]);

  // ── Restore most recent completed video on mount ──
  useEffect(() => {
    if (!businessId || finalVideoUrl || generatingVideo || activeJobId || approvedScript || generatedVideoScript) return;
    supabase
      .from("video_generation_jobs")
      .select("id, video_url, result_payload, status")
      .eq("business_id", businessId)
      .in("status", ["completed", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.result_payload) setGeneratedVideoScript(data.result_payload as any);
        if (data.video_url) {
          setFinalVideoUrl(data.video_url);
          setIsRestoredVideo(true);
        } else if (data.status === "processing") {
          // Creatomate is still rendering — resume the polling loop so the user
          // sees a spinner instead of the demo video while waiting for the webhook.
          setActiveJobId(data.id);
          setGeneratingVideo(true);
        }
      });
  }, [businessId]);

  // ── Poll active video generation job ──
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("video_generation_jobs")
        .select("status, result_payload, video_url, error_message")
        .eq("id", activeJobId)
        .single();

      if (!data) return;

      setJobStatus(data.status);
      if (data.result_payload) setGeneratedVideoScript(data.result_payload);

      if (data.status === "processing") {
        // Creatomate is rendering — keep polling until webhook callback sets video_url
        if (data.video_url) {
          clearInterval(interval);
          setGeneratingVideo(false);
          setFinalVideoUrl(data.video_url);
          toast.success("Your video is ready! 🎬");
        }
      } else if (data.status === "completed" || data.status === "media_ready") {
        clearInterval(interval);
        setGeneratingVideo(false);

        if (data.video_url) {
          setFinalVideoUrl(data.video_url);
          toast.success("Your video is ready! 🎬");
          return;
        }

        // Fallback: try signed URL endpoint
        try {
          const urlResult = await supabase.functions.invoke("get-signed-video-url", { body: { job_id: activeJobId } });
          if (!urlResult.error && urlResult.data?.url) {
            setFinalVideoUrl(urlResult.data.url);
            toast.success("Your video is ready! 🎬");
            return;
          }
        } catch { /* ignore */ }

        toast.error("Video ready but URL unavailable — check your Media Library");
      } else if (data.status === "failed") {
        clearInterval(interval);
        setGeneratingVideo(false);
        toast.error(data.error_message || "Production failed — try again");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  // ── Generate script for approval ──
  const handleGenerateScript = async () => {
    if (!businessId) {
      toast.error("Please set up your business profile first.");
      return;
    }
    setGeneratingScript(true);
    try {
      const response = await supabase.functions.invoke("generate-video-v2", {
        body: { businessId, videoType: "promotional", lengthMode, mode: "script_only" },
      });
      if (response.error) throw new Error(response.error.message);
      const script = response.data?.script;
      if (!script) throw new Error("No script returned");

      setPendingScript(script);
      setScriptApproved(false);
      setApprovedScript(null);
      setScriptVersions(prev => [...prev, { script, timestamp: new Date().toISOString(), version: prev.length + 1 }]);
      toast.success("Script ready for your review! 📝");
    } catch (err: any) {
      console.error("[VideoStudio] Script generation failed:", err);
      toast.error(err.message || "Failed to generate script");
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleApproveScript = () => {
    if (!pendingScript) return;
    setApprovedScript(pendingScript);
    setScriptApproved(true);
    setPendingScript(null);
    toast.success("Script approved! You can now produce your video. ✅");
  };

  const handleRewriteScript = async () => {
    if (rewriteCount >= MAX_REWRITES) {
      toast.error(`You've used all ${MAX_REWRITES} rewrites. Please edit the script manually or approve the current version.`);
      return;
    }
    if (!pendingScript || !businessId) return;
    setGeneratingScript(true);
    try {
      const response = await supabase.functions.invoke("rewrite-script", {
        body: { currentScript: pendingScript, businessId, lengthMode },
      });
      if (response.error) throw new Error(response.error.message);
      const newScript = response.data?.script;
      if (!newScript) throw new Error("No rewritten script returned");

      setRewriteCount(prev => prev + 1);
      setPendingScript(newScript);
      setScriptVersions(prev => [...prev, { script: newScript, timestamp: new Date().toISOString(), version: prev.length + 1 }]);

      const provider = response.data?.providerUsed;
      const providerLabel = provider === "openai" ? "ChatGPT" : provider === "anthropic" ? "Claude" : "AI";
      toast.success(`Script rewritten by ${providerLabel}! Review the new version. ✏️`);
    } catch (err: any) {
      console.error("[VideoStudio] Script rewrite failed:", err);
      toast.error(err.message || "Failed to rewrite script");
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleProduceVideo = async () => {
    if (!businessId) {
      toast.error("Please set up your business profile first.");
      return;
    }
    if (!scriptApproved || !approvedScript) {
      toast.error("Please approve your script before we create the video.");
      scriptPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setGeneratingVideo(true);
    setFinalVideoUrl(null);
    setIsRestoredVideo(false);
    setJobStatus("queued");
    setGeneratedVideoScript(null);

    try {
      const response = await supabase.functions.invoke("generate-video-v2", {
        body: {
          businessId,
          videoType: "promotional",
          lengthMode,
          approvedScript,
          speedTier,
          videoTier,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.job_id) {
        setActiveJobId(response.data.job_id);
        const tierLabel = speedTier === "cinematic" ? "5-10 min" : speedTier === "standard" ? "3-7 min" : "2-5 min";
        toast.info(`🎬 Creatomate is rendering your video (${tierLabel})`);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (err: any) {
      console.error("[VideoStudio] Produce failed:", err);
      toast.error(err.message || "Failed to start video production");
      setGeneratingVideo(false);
    }
  };

  const resetFlow = () => {
    setGeneratedVideoScript(null);
    setFinalVideoUrl(null);
    setActiveJobId(null);
    setJobStatus("queued");
    setPendingScript(null);
    setApprovedScript(null);
    setScriptApproved(false);
    setRewriteCount(0);
    setSpeedTier("instant");
    setScriptVersions([]);
    removeLocalStorage(stateKey);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyToClipboard(text, id)}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
      {copiedId === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copiedId === id ? "Copied!" : "Copy"}
    </button>
  );

  const getStatusLabel = () => {
    switch (jobStatus) {
      case "queued": return "Starting up...";
      case "generating_script": return "✍️ Writing your script...";
      case "generating_images": return "🎨 Finding the best photos...";
      case "generating_voiceover": return "🎙️ Recording voiceover...";
      case "rendering_video": return "🎬 Rendering with Creatomate...";
      case "processing": return "🎬 Creatomate is rendering your video...";
      default: return "Processing...";
    }
  };

  const handleDownloadGuide = () => {
    const link = document.createElement('a');
    link.href = '/RickyAI-Video-Studio-Guide.pdf';
    link.download = 'RickyAI-Video-Studio-Guide.pdf';
    link.click();
  };

  return (
    <StepLayout title="Video Studio" description="Produce a professional video for your business"
      icon="🎬" loading={false} hasData={!!finalVideoUrl || !!generatedVideoScript} onGenerate={() => {}} needsProfile={!businessId}
      hideGenerateButton>

      <div className="space-y-6">
        {/* ═══ STEP 1: Length Selector ═══ */}
        <div className="glass rounded-2xl p-6">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Choose Video Length
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LENGTH_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => { setLengthMode(opt.key); if (scriptApproved) { setScriptApproved(false); setApprovedScript(null); setPendingScript(null); } }}
                className={`rounded-2xl p-4 text-center transition-all border ${
                  lengthMode === opt.key
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}>
                <div className="text-2xl mb-1">{opt.emoji}</div>
                <div className="text-sm font-bold text-foreground">{opt.label}</div>
                <div className="text-xs font-semibold text-primary">{opt.duration}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ STEP 2: Generate & Review Script ═══ */}
        <div ref={scriptPanelRef} className="glass rounded-2xl p-6">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Review Your Script
          </h4>

          {/* Script approved badge */}
          {scriptApproved && approvedScript && !pendingScript && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary">Script Approved ✅</span>
                </div>
                <p className="text-xs font-semibold text-foreground mb-2">{approvedScript.title}</p>
                <div className="space-y-2">
                  {approvedScript.scenes?.map((scene: any, i: number) => (
                    <div key={i} className="flex gap-2 text-[11px]">
                      <span className="text-primary font-bold shrink-0">Scene {i + 1}</span>
                      <span className="text-foreground/80">{scene.voiceover_line || scene.text_overlay}</span>
                    </div>
                  ))}
                </div>
                {approvedScript.usedFallbackScript && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">ℹ️ Script built from your saved strategy data (AI credits were low).</p>
                )}
              </div>
              <button onClick={() => { setScriptApproved(false); setApprovedScript(null); setPendingScript(null); setRewriteCount(0); }}
                className="text-[10px] text-muted-foreground hover:text-foreground underline">
                Start over with a new script
              </button>
            </div>
          )}

          {/* Pending script for review */}
          {pendingScript && !scriptApproved && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                <p className="text-xs font-semibold text-foreground mb-1">{pendingScript.title}</p>
                <p className="text-[10px] text-muted-foreground mb-3">Click any line below to edit it directly.</p>
                <div className="space-y-3">
                  {pendingScript.scenes?.map((scene: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-primary">Scene {i + 1} — {scene.shotType || "general"}</span>
                        <span className="text-[10px] text-muted-foreground">{scene.duration_seconds}s</span>
                      </div>
                      <label className="text-[10px] text-muted-foreground font-semibold">Voiceover:</label>
                      <textarea
                        value={scene.voiceover_line || ""}
                        onChange={(e) => {
                          const updated = { ...pendingScript, scenes: pendingScript.scenes.map((s: any, idx: number) =>
                            idx === i ? { ...s, voiceover_line: e.target.value } : s
                          )};
                          updated.voiceover_script = updated.scenes.map((s: any) => s.voiceover_line).filter(Boolean).join(" ");
                          setPendingScript(updated);
                        }}
                        className="w-full mt-1 p-2 text-xs text-foreground bg-background rounded-lg border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none min-h-[40px]"
                        rows={2}
                      />
                      <label className="text-[10px] text-muted-foreground font-semibold mt-2 block">On-screen text:</label>
                      <input
                        type="text"
                        value={scene.text_overlay || ""}
                        onChange={(e) => {
                          const updated = { ...pendingScript, scenes: pendingScript.scenes.map((s: any, idx: number) =>
                            idx === i ? { ...s, text_overlay: e.target.value } : s
                          )};
                          setPendingScript(updated);
                        }}
                        className="w-full mt-1 p-2 text-xs text-foreground bg-background rounded-lg border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="(optional on-screen caption)"
                      />
                    </div>
                  ))}
                </div>
                {pendingScript.voiceover_script && (
                  <div className="mt-3 p-2 rounded-lg bg-secondary/50">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Full voiceover:</p>
                    <p className="text-[11px] text-foreground/80">{pendingScript.voiceover_script}</p>
                    <CopyButton text={pendingScript.voiceover_script} id="pending-vo" />
                  </div>
                )}
                {pendingScript.usedFallbackScript && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">ℹ️ Script built from your saved strategy data (AI credits were low).</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={handleApproveScript}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center justify-center gap-2">
                  <ThumbsUp className="w-4 h-4" /> Yes, use this script
                </button>
                <button onClick={handleRewriteScript} disabled={generatingScript || rewriteCount >= MAX_REWRITES}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center gap-2">
                  {generatingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                  No, rewrite it
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                {rewriteCount >= MAX_REWRITES
                  ? "You've used all rewrites. Approve or tweak manually."
                  : `You can ask for up to ${MAX_REWRITES - rewriteCount} more rewrite${MAX_REWRITES - rewriteCount !== 1 ? "s" : ""}.`}
              </p>
            </div>
          )}

          {/* No script yet — generate button */}
          {!pendingScript && !scriptApproved && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-4">
                Generate your promo script first. You'll review and approve it before any video is produced.
              </p>
              <button onClick={handleGenerateScript} disabled={generatingScript || !businessId}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 mx-auto">
                {generatingScript ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating Script...</>
                ) : (
                  <><FileText className="w-4 h-4" /> Generate Script</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ═══ STEP 2.5: Speed Tier Selector ═══ */}
        {scriptApproved && (
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> Choose Production Speed
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SPEED_TIERS.map(tier => {
                const isLocked = tier.key === "cinematic" && videoTier === "free";
                return (
                  <button
                    key={tier.key}
                    onClick={() => {
                      if (isLocked) {
                        toast.info("Cinematic tier requires a paid plan. Upgrade to unlock!");
                        return;
                      }
                      setSpeedTier(tier.key);
                    }}
                    className={`rounded-2xl p-4 text-left transition-all border relative ${
                      speedTier === tier.key
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : isLocked
                        ? "border-border/50 opacity-60 cursor-not-allowed"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {isLocked && (
                      <div className="absolute top-2 right-2">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-2xl mb-1">{tier.emoji}</div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{tier.label}</span>
                      {speedTier === tier.key && <Check className="w-3 h-3 text-primary" />}
                    </div>
                    <div className="text-xs font-semibold text-primary">{tier.speed}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">{tier.desc}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-foreground/70">Quality: {tier.quality}</span>
                      <span className="text-[10px] text-muted-foreground">• {tier.engine}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Time expectation notices */}
            {speedTier === "cinematic" && (
              <div className="mt-3 p-2.5 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-[10px] text-accent-foreground">
                  ⏱ <strong>Cinematic videos take 5-10 minutes.</strong> Creatomate renders your full production in the background — you'll be notified when it's ready.
                </p>
              </div>
            )}
            {speedTier === "standard" && (
              <div className="mt-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-foreground/70">
                  🎬 <strong>Standard videos take 3-7 minutes.</strong> Creatomate produces polished AI video with professional quality.
                </p>
              </div>
            )}
            {speedTier === "instant" && (
              <div className="mt-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-foreground/70">
                  ⚡ <strong>Instant — ready in 2-5 minutes!</strong> Creatomate renders AI images + voiceover into your video automatically.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 3: PRODUCE BUTTON (gated by script approval) ═══ */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" /> Produce Video
              </h4>
              <p className="text-[10px] text-muted-foreground">
                {scriptApproved
                  ? "Your script is approved — click to start production."
                  : "Please generate and approve a script first (Step 2 above)."}
              </p>
            </div>
            <button onClick={handleProduceVideo} disabled={generatingVideo || !businessId || !scriptApproved}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {generatingVideo ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Producing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Produce Video</>
              )}
            </button>
          </div>

          {!scriptApproved && !generatingVideo && (
            <div className="mt-3 p-2 rounded-lg bg-accent/10 border border-accent/20">
              <p className="text-[10px] text-accent-foreground">📝 Please approve your script above before producing the video.</p>
            </div>
          )}

          {/* ═══ LIVE PROGRESS ═══ */}
          {generatingVideo && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Loader2 className="w-6 h-6 animate-spin text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{getStatusLabel()}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {generatedVideoScript?.message || "Creatomate is rendering your video. This takes 2-10 minutes."}
                  </p>
                </div>
              </div>

              {generatedVideoScript?.pipeline_steps && (
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(generatedVideoScript.pipeline_steps).map(([step, status]: [string, any]) => {
                    const isDone = status === "completed";
                    const isFail = typeof status === "string" && (status.includes("failed") || status.includes("exhausted"));
                    const isFallback = typeof status === "string" && (status.includes("fallback") || status.includes("placeholder") || status === "no_key");
                    return (
                      <div key={step} className={`text-center p-2 rounded-lg ${
                        isDone ? "bg-primary/10 text-primary" :
                        isFail ? "bg-destructive/10 text-destructive" :
                        isFallback ? "bg-accent/10 text-accent-foreground" :
                        "bg-secondary/50 text-muted-foreground"
                      }`}>
                        <div className="text-sm font-bold">
                          {isDone ? "✅" : isFail ? "❌" : isFallback ? "⚠️" : <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
                        </div>
                        <div className="text-[10px] font-medium capitalize">{step.replace(/_/g, " ")}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(generatedVideoScript?.scene_images?.length ?? 0) > 0 && (
                <div className="p-3 rounded-xl bg-secondary/30">
                  <p className="text-[10px] font-semibold text-foreground mb-2">🖼️ Scene photos ({generatedVideoScript.scene_images.length})</p>
                  <div className="grid grid-cols-4 gap-1">
                    {generatedVideoScript.scene_images.map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Scene ${i + 1}`} className="w-full rounded-lg object-cover aspect-video" />
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ PIPELINE LOGS ═══ */}
              {generatedVideoScript?.pipeline_logs?.length > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    📋 Pipeline Logs ({generatedVideoScript.pipeline_logs.length})
                  </summary>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-background/80 border border-border p-2 space-y-0.5 font-mono">
                    {generatedVideoScript.pipeline_logs.map((log: string, i: number) => (
                      <p key={i} className={`text-[9px] leading-tight ${
                        log.includes("✅") ? "text-primary" :
                        log.includes("⚠️") ? "text-accent" :
                        log.includes("❌") ? "text-destructive" :
                        "text-muted-foreground"
                      }`}>{log}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* ═══ FINISHED VIDEO ═══ */}
        {finalVideoUrl && !generatingVideo && (
          <div className="glass rounded-2xl p-6 ring-2 ring-primary/30">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Your Finished Video
            </h4>

            {isRestoredVideo && (pendingScript || approvedScript) && (
              <div className="mb-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This video is from a previous session. Click <strong>Produce Video</strong> to create a new video matching your current script.
                </p>
              </div>
            )}

            {generatedVideoScript?.is_fallback && (
              <div className="mb-3 p-2 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-[10px] text-accent-foreground">⚠️ This is a fallback slideshow — upload real photos for full video production.</p>
              </div>
            )}

            {generatedVideoScript?.usedFallbackScript && (
              <div className="mb-3 p-2 rounded-lg bg-secondary/50 border border-border">
                <p className="text-[10px] text-muted-foreground">ℹ️ This video used your saved strategy data because AI credits were low.</p>
              </div>
            )}

            <video controls autoPlay className="w-full rounded-xl bg-black max-h-[400px]">
              <source src={finalVideoUrl} type={finalVideoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
            </video>

            <div className="flex gap-2 mt-3">
              <a href={finalVideoUrl} download className="flex-1 text-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download Video
              </a>
              <button onClick={resetFlow} className="px-4 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80">
                Make Another
              </button>
              <button onClick={onComplete} className="px-4 py-2 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary/50 flex items-center gap-1">
                ← Back
              </button>
            </div>

            {generatedVideoScript?.total_duration_seconds && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Duration: ~{generatedVideoScript.total_duration_seconds}s
                {generatedVideoScript.real_image_count !== undefined && ` • ${generatedVideoScript.real_image_count} real photos used`}
                {generatedVideoScript.usedFallbackScript ? " • Saved-data script" : " • AI script"}
                {" • 🎬 Creatomate"}
              </p>
            )}
          </div>
        )}

        {/* ═══ SCRIPT DETAILS (after completion) ═══ */}
        {generatedVideoScript && !generatingVideo && (
          <div className="space-y-3">
            {(generatedVideoScript.title || generatedVideoScript.voiceover_script) && (
              <div className="glass rounded-2xl p-4">
                {generatedVideoScript.title && <h5 className="text-xs font-semibold text-primary mb-1">{generatedVideoScript.title}</h5>}
                {generatedVideoScript.description && <p className="text-xs text-muted-foreground">{generatedVideoScript.description}</p>}
                {generatedVideoScript.voiceover_script && (
                  <div className="mt-2 p-2 rounded-lg bg-secondary/30">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Voiceover Script:</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{generatedVideoScript.voiceover_script}</p>
                    <CopyButton text={generatedVideoScript.voiceover_script} id="vo-script" />
                  </div>
                )}
                {generatedVideoScript.caption && (
                  <div className="mt-2 p-2 rounded-lg bg-secondary/30">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Caption:</p>
                    <p className="text-xs text-foreground/80">{generatedVideoScript.caption}</p>
                    <CopyButton text={generatedVideoScript.caption} id="caption" />
                  </div>
                )}
                {generatedVideoScript.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {generatedVideoScript.hashtags.map((h: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">#{h.replace('#','')}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generatedVideoScript.voiceover_url && (
              <div className="glass rounded-2xl p-4">
                <h5 className="text-xs font-semibold text-foreground mb-2">🎙️ AI Voiceover</h5>
                <audio controls className="w-full">
                  <source src={generatedVideoScript.voiceover_url} type="audio/mpeg" />
                </audio>
              </div>
            )}

            {generatedVideoScript.scene_images?.length > 0 && !finalVideoUrl && (
              <div className="glass rounded-2xl p-4">
                <h5 className="text-xs font-semibold text-foreground mb-2">🖼️ Scene Images ({generatedVideoScript.scene_images.length})</h5>
                <div className="grid grid-cols-3 gap-1">
                  {generatedVideoScript.scene_images.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Scene ${i + 1}`} className="w-full rounded-lg object-cover aspect-video" />
                  ))}
                </div>
              </div>
            )}

            {generatedVideoScript.message && (
              <div className="glass rounded-2xl p-3">
                <p className="text-xs text-muted-foreground">{generatedVideoScript.message}</p>
              </div>
            )}

            {/* Pipeline logs (after completion) */}
            {generatedVideoScript?.pipeline_logs?.length > 0 && (
              <details className="glass rounded-2xl p-4">
                <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  📋 Pipeline Logs ({generatedVideoScript.pipeline_logs.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-background/80 border border-border p-2 space-y-0.5 font-mono">
                  {generatedVideoScript.pipeline_logs.map((log: string, i: number) => (
                    <p key={i} className={`text-[9px] leading-tight ${
                      log.includes("✅") ? "text-primary" :
                      log.includes("⚠️") ? "text-accent" :
                      log.includes("❌") ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>{log}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ═══ SAMPLE VIDEO ═══ */}
        {!finalVideoUrl && !generatingVideo && (
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Sample AI-Generated Video
            </h4>
            <p className="text-xs text-muted-foreground mb-3">Here's what RickyAI can produce for your business.</p>
            <video controls className="w-full rounded-xl max-h-[300px] bg-black">
              <source src={demoVideoAsset.url} type="video/mp4" />
            </video>
          </div>
        )}

        {/* ═══ MEDIA LIBRARY ═══ */}
        <MediaLibrary businessId={businessId} />

        {/* Guide + External Connections */}
        <VideoStudioGuide onDownloadGuide={handleDownloadGuide} />
        <ExternalAppConnections />
      </div>
    </StepLayout>
  );
};

export default VideoStudioStep;
