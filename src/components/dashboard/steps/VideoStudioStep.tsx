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
import { composeVideo } from "@/lib/videoComposer";
import demoVideoAsset from "@/assets/demo-business-promo.mp4.asset.json";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/persistence";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type LengthMode = "short" | "standard" | "long" | "extended";
type ManusModel = "default" | "veo3";

const STATE_KEY = "rickyai-video-studio-state";
const MAX_REWRITES = 3;

const LENGTH_OPTIONS: { key: LengthMode; label: string; duration: string; emoji: string; desc: string }[] = [
  { key: "short", label: "Standard", duration: "~60s", emoji: "⚡", desc: "Quick social clips for TikTok, Reels, Shorts" },
  { key: "standard", label: "Standard+", duration: "~60s", emoji: "🎬", desc: "Full promo for Instagram, Facebook, YouTube" },
  { key: "long", label: "Long", duration: "~90s", emoji: "📹", desc: "Extended brand story or commercial" },
  { key: "extended", label: "Extended", duration: "~120s", emoji: "🎥", desc: "Full-length cinematic brand film or ad spot" },
];

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { subscription } = useAuth();
  const persisted = readLocalStorage(STATE_KEY, {
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
  const [composingVideo, setComposingVideo] = useState(false);
  const [composePct, setComposePct] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const composedRef = useRef(false);

  // Script approval state
  const [pendingScript, setPendingScript] = useState<any>(persisted.approvedScript && persisted.scriptApproved ? null : null);
  const [approvedScript, setApprovedScript] = useState<any>(persisted.approvedScript);
  const [scriptApproved, setScriptApproved] = useState(persisted.scriptApproved);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [rewriteCount, setRewriteCount] = useState(0);
  const [scriptVersions, setScriptVersions] = useState<any[]>([]);
  const scriptPanelRef = useRef<HTMLDivElement>(null);
  // Manus import state
  const [manusUrlInput, setManusUrlInput] = useState("");
  const [showManusImport, setShowManusImport] = useState(false);
  const [importingManus, setImportingManus] = useState(false);
  // Manus model selection
  const [manusModel, setManusModel] = useState<ManusModel>("default");

  // Derive tier for Manus model gating
  const manusTier = useMemo(() => {
    const plan = subscription.plan;
    if (plan === "agency") return "agency";
    if (plan === "growth") return "pro";
    if (plan === "business") return "pro";
    if (plan === "creator") return "free";
    return "free";
  }, [subscription.plan]);

  // Persist state
  useEffect(() => {
    writeLocalStorage(STATE_KEY, { lengthMode, generatedVideoScript, approvedScript, scriptApproved });
  }, [lengthMode, generatedVideoScript, approvedScript, scriptApproved]);

  // ── Poll active video generation job ──
  useEffect(() => {
    if (!activeJobId) return;
    composedRef.current = false; // Reset for new job
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("video_generation_jobs")
        .select("status, result_payload, video_url, error_message")
        .eq("id", activeJobId)
        .single();

      if (data) {
        setJobStatus(data.status);
        if (data.result_payload) setGeneratedVideoScript(data.result_payload);

        if (data.status === "processing") {
          // Manus job dispatched to Make.com — keep polling, don't stop
          setGeneratedVideoScript(data.result_payload);
          // Check if video_url was filled in by the callback
          if (data.video_url) {
            clearInterval(interval);
            setGeneratingVideo(false);
            setFinalVideoUrl(data.video_url);
            toast.success("Your video is ready from Manus AI! 🎬");
          }
          // Otherwise keep polling — Make.com hasn't called back yet
        } else if (data.status === "completed" || data.status === "media_ready") {
          clearInterval(interval);
          setGeneratingVideo(false);

          const payload = data.result_payload as any;
          const clips = payload?.video_clips || [];
          const images = payload?.scene_images || [];

          if (data.video_url) {
            setFinalVideoUrl(data.video_url);
            toast.success("Your video is ready! 🎬");
          } else if ((clips.length > 0 || images.length > 0) && !composedRef.current) {
            composedRef.current = true;
            setComposingVideo(true);
            setJobStatus("composing_video");
            try {
              const blob = await composeVideo({
                sceneImages: images,
                videoClips: clips.length > 0 ? clips : undefined,
                voiceoverUrl: payload?.voiceover_url || null,
                businessName: payload?.title || "Video",
                title: payload?.title,
                sceneCaptions: payload?.scene_captions || [],
                durationPerScene: 5,
                totalDurationSeconds: payload?.total_duration_seconds,
                width: 1080,
                height: 1920,
                onProgress: setComposePct,
              });
              const url = URL.createObjectURL(blob);
              setFinalVideoUrl(url);

              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const fileName = `videos/${session.user.id}/${activeJobId}/final.webm`;
                const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, blob, { contentType: "video/webm", upsert: true });
                if (!uploadErr) {
                  const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
                  setFinalVideoUrl(urlData.publicUrl);
                  await supabase.from("video_generation_jobs").update({
                    video_url: urlData.publicUrl,
                    updated_at: new Date().toISOString(),
                  }).eq("id", activeJobId);
                }
              }
              toast.success("Your video is ready! 🎬");
            } catch (err: any) {
              console.error("Video composition error:", err);
              toast.error("Video assembly had issues, but your clips and images are ready");
            }
            setComposingVideo(false);
          } else {
            toast.success("Production complete!");
          }
        } else if (data.status === "failed") {
          clearInterval(interval);
          setGeneratingVideo(false);
          toast.error(data.error_message || "Production failed — try again");
        }
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
      const response = await supabase.functions.invoke("generate-video", {
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
    composedRef.current = false;
    setJobStatus("queued");
    setComposePct(0);
    setGeneratedVideoScript(null);
    try {
      const response = await supabase.functions.invoke("generate-video", {
        body: { businessId, videoType: "promotional", lengthMode, approvedScript, manusModel, manusTier },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.job_id) {
        setActiveJobId(response.data.job_id);
        toast.info("🎬 Video production started with your approved script!");
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
    composedRef.current = false;
    setPendingScript(null);
    setApprovedScript(null);
    setScriptApproved(false);
    setRewriteCount(0);
    setScriptVersions([]);
    removeLocalStorage(STATE_KEY);
  };

  const handleImportManusVideo = async () => {
    if (!manusUrlInput.trim() || !businessId) return;
    setImportingManus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const fileName = manusUrlInput.split("/").pop() || "manus-video.mp4";
      const shotType = fileName.toLowerCase().includes("food") ? "food" : fileName.toLowerCase().includes("people") ? "people" : "environment";
      const { error } = await supabase.from("business_media").insert({
        business_id: businessId,
        user_id: user.id,
        file_name: fileName,
        file_type: "video",
        shot_type: shotType,
        storage_path: `manus-imports/${user.id}/${fileName}`,
        public_url: manusUrlInput.trim(),
        tags: ["manus", "imported", "video"],
      });
      if (error) throw error;
      toast.success("Manus video added to your Media Library! 🎬");
      setManusUrlInput("");
      setShowManusImport(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to import Manus video");
    } finally {
      setImportingManus(false);
    }
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
      case "rendering_video": return "🎬 Rendering with Manus AI...";
      case "processing": return "🤖 Waiting for Manus AI to finish rendering... (this can take a few minutes)";
      case "composing_video": return `🎬 Assembling final video... ${composePct}%`;
      default: return "Processing...";
    }
  };

  const handleDownloadGuide = () => {
    const link = document.createElement('a');
    link.href = '/RickyAI-Video-Studio-Guide.pdf';
    link.download = 'RickyAI-Video-Studio-Guide.pdf';
    link.click();
  };

  // The script to display in review panel
  const reviewScript = pendingScript || (scriptApproved ? null : null);

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
                          // Also update the full voiceover_script
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

        {/* ═══ STEP 2.5: Manus Video Quality Selector ═══ */}
        {scriptApproved && (
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> Choose Video Quality
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {/* Standard (Default Model) */}
              <button
                onClick={() => setManusModel("default")}
                className={`rounded-2xl p-4 text-left transition-all border ${
                  manusModel === "default"
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">Standard</span>
                  {manusModel === "default" && <Check className="w-3 h-3 text-primary ml-auto" />}
                </div>
                <p className="text-[10px] text-muted-foreground">Good for social media & quick promos</p>
                <p className="text-[10px] text-muted-foreground">Supports 16:9, 9:16, and 1:1</p>
                {manusTier === "free" && <p className="text-[10px] text-primary mt-1 font-semibold">≤15s recommended on Free tier</p>}
                <p className="text-[10px] text-primary/70 mt-1 font-medium">✅ Included in your plan</p>
              </button>

              {/* Cinematic (Veo 3) */}
              <button
                onClick={() => {
                  if (manusTier === "agency") {
                    setManusModel("veo3");
                  } else {
                    toast.info("Cinematic (Veo 3) quality requires the Agency plan. Upgrade to unlock!");
                  }
                }}
                className={`rounded-2xl p-4 text-left transition-all border relative ${
                  manusModel === "veo3"
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : manusTier !== "agency"
                    ? "border-border/50 opacity-70 cursor-not-allowed"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {manusTier !== "agency" && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Film className="w-4 h-4 text-accent-foreground" />
                  <span className="text-sm font-bold text-foreground">Cinematic (Veo 3)</span>
                  {manusModel === "veo3" && <Check className="w-3 h-3 text-primary ml-auto" />}
                </div>
                <p className="text-[10px] text-muted-foreground">Highest quality AI video</p>
                <p className="text-[10px] text-muted-foreground">16:9 widescreen only</p>
                <p className="text-[10px] text-muted-foreground">Best for TV-style commercials</p>
                {manusTier !== "agency" ? (
                  <p className="text-[10px] text-accent-foreground mt-1 font-semibold">🔒 Upgrade to Agency</p>
                ) : (
                  <p className="text-[10px] text-primary/70 mt-1 font-medium">✅ Unlocked on Agency</p>
                )}
              </button>
            </div>
            {manusTier === "free" && manusModel === "default" && (
              <p className="text-[10px] text-muted-foreground mt-3 text-center">
                💡 Free tier: clips under 15 seconds recommended to stay within credit limits. Upgrade to Pro for longer videos.
              </p>
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
            <button onClick={handleProduceVideo} disabled={generatingVideo || composingVideo || !businessId || !scriptApproved}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {generatingVideo || composingVideo ? (
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
                    {generatedVideoScript?.message || "This may take 2-5 minutes."}
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

              {generatedVideoScript?.total_clips && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Manus clips</span>
                    <span>{generatedVideoScript.clips_completed || 0}/{generatedVideoScript.total_clips}</span>
                  </div>
                  <Progress value={((generatedVideoScript.clips_completed || 0) / generatedVideoScript.total_clips) * 100} className="h-2" />
                </div>
              )}
            </div>
          )}

          {composingVideo && (
            <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Assembling your final video... {composePct}%</p>
              <Progress value={composePct} className="mt-2 h-2" />
            </div>
          )}
        </div>

        {/* ═══ FINISHED VIDEO ═══ */}
        {finalVideoUrl && !generatingVideo && !composingVideo && (
          <div className="glass rounded-2xl p-6 ring-2 ring-primary/30">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Your Finished Video
            </h4>

            {generatedVideoScript?.is_fallback && (
              <div className="mb-3 p-2 rounded-lg bg-accent/10 border border-accent/20">
                <p className="text-[10px] text-accent-foreground">⚠️ This is a fallback slideshow — upload real photos or connect Manus AI for full video production.</p>
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

            {/* Manus prompt preview */}
            {generatedVideoScript?.manus_prompt_preview && (
              <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border">
                <p className="text-[10px] font-bold text-primary mb-1">🤖 Manus AI Prompt (ready to send)</p>
                <p className="text-[10px] text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{generatedVideoScript.manus_prompt_preview}</p>
                <CopyButton text={generatedVideoScript.manus_prompt_preview} id="manus-prompt" />
              </div>
            )}

            {/* Manus video URL import */}
            {!showManusImport ? (
              <button onClick={() => setShowManusImport(true)}
                className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Import a Manus AI video URL to Media Library
              </button>
            ) : (
              <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
                <p className="text-[10px] font-semibold text-foreground">Paste your Manus AI video URL:</p>
                <input type="url" value={manusUrlInput} onChange={e => setManusUrlInput(e.target.value)}
                  placeholder="https://manus.ai/video/..." className="w-full p-2 text-xs rounded-lg border border-border bg-background text-foreground" />
                <div className="flex gap-2">
                  <button onClick={handleImportManusVideo} disabled={importingManus || !manusUrlInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                    {importingManus ? "Importing..." : "Yes, add to Media Library"}
                  </button>
                  <button onClick={() => { setShowManusImport(false); setManusUrlInput(""); }}
                    className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs hover:bg-secondary/80">No thanks</button>
                </div>
              </div>
            )}

            {generatedVideoScript?.total_duration_seconds && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Duration: ~{generatedVideoScript.total_duration_seconds}s
                {generatedVideoScript.real_image_count !== undefined && ` • ${generatedVideoScript.real_image_count} real photos used`}
                {generatedVideoScript.usedFallbackScript ? " • Saved-data script" : " • AI script"}
                {generatedVideoScript.preferred_video_generator === "manus" && " • 🤖 Manus AI"}
              </p>
            )}
          </div>
        )}

        {/* ═══ SCRIPT DETAILS (after completion) ═══ */}
        {generatedVideoScript && !generatingVideo && !composingVideo && (
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
