import { useEffect, useRef, useState, useMemo } from "react";
import StepLayout from "./StepLayout";
import VideoStudioGuide from "./VideoStudioGuide";
import ExternalAppConnections from "./ExternalAppConnections";
import MediaLibrary from "../MediaLibrary";
import { Copy, Check, Film, Sparkles, Play, Download, Loader2, Clock, Image, FileText, RefreshCw, ThumbsUp, ThumbsDown, Link2, Lock, Zap, Clapperboard, Save } from "lucide-react";
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
type SpeedTier = "instant" | "standard" | "cinematic";

const SPEED_TIERS: { key: SpeedTier; label: string; engine: string; speed: string; quality: string; emoji: string; desc: string }[] = [
  { key: "instant", label: "Instant", engine: "Built-in Composer", speed: "10-30 sec", quality: "Good", emoji: "⚡", desc: "Ken Burns slideshow + captions + voiceover. Ready in seconds." },
  { key: "standard", label: "Standard", engine: "HeyGen", speed: "1-3 min", quality: "Great", emoji: "🎬", desc: "AI-powered video with professional polish. Short wait." },
  { key: "cinematic", label: "Cinematic", engine: "Manus AI", speed: "5-15 min", quality: "Best", emoji: "🎥", desc: "Full cinematic production. Best quality — worth the wait." },
];

const MANUS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

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
  // Speed tier selection
  const [speedTier, setSpeedTier] = useState<SpeedTier>("instant");
  const jobStartTimeRef = useRef<number>(0);

  // Derive tier for Manus model gating
  const manusTier = useMemo(() => {
    if (subscription.isAdmin) return "agency"; // Admins get full access
    const plan = subscription.plan;
    if (plan === "agency") return "agency";
    if (plan === "growth") return "pro";
    if (plan === "business") return "pro";
    if (plan === "creator") return "free";
    return "free";
  }, [subscription.plan, subscription.isAdmin]);

  // Persist state
  useEffect(() => {
    writeLocalStorage(STATE_KEY, { lengthMode, generatedVideoScript, approvedScript, scriptApproved });
  }, [lengthMode, generatedVideoScript, approvedScript, scriptApproved]);

  // ── Poll active video generation job ──
  useEffect(() => {
    if (!activeJobId) return;
    composedRef.current = false; // Reset for new job
    const interval = setInterval(async () => {
      // Call check-video-status edge function which polls Manus API directly
      try {
        await supabase.functions.invoke("check-video-status", { body: { jobId: activeJobId } });
      } catch (e) {
        console.warn("[VideoStudio] check-video-status call failed, reading DB directly:", e);
      }

      const { data } = await supabase
        .from("video_generation_jobs")
        .select("status, result_payload, video_url, error_message, pipeline_stage, fallback_ready, poll_attempts")
        .eq("id", activeJobId)
        .single();

      if (data) {
        setJobStatus(data.status);
        if (data.result_payload) setGeneratedVideoScript(data.result_payload);

        if (data.status === "processing") {
          setGeneratedVideoScript(data.result_payload);

          // ── AUTO-FALLBACK: if fallback_ready and exceeded timeout OR 40+ poll attempts ──
          const timedOut = jobStartTimeRef.current && Date.now() - jobStartTimeRef.current > MANUS_TIMEOUT_MS;
          const tooManyPolls = (data.poll_attempts || 0) >= 40;

          if ((data as any).fallback_ready && (timedOut || tooManyPolls)) {
            clearInterval(interval);
            console.warn("[VideoStudio] Manus AI timed out — auto-triggering browser fallback");
            toast.warning("Cinematic video is still processing — generating instant draft now ⚡");
            await supabase.from("video_generation_jobs").update({
              pipeline_stage: "composing_browser",
              updated_at: new Date().toISOString(),
            }).eq("id", activeJobId);
            setGeneratingVideo(false);
            setJobStatus("composing_browser");
            handleProduceInstantFallback();
            return;
          }

          // Check if video_url was filled by Manus polling
          if (data.video_url) {
            const url = data.video_url as string;
            const isPlayable = /\.(mp4|webm|mov)(\?|$)/i.test(url) ||
              /supabase\.co\/storage\/v1\/object\/public\/media\//i.test(url) ||
              /s3\.amazonaws\.com\//i.test(url);

            if (isPlayable) {
              clearInterval(interval);
              setGeneratingVideo(false);
              setFinalVideoUrl(url);
              toast.success("Your cinematic video is ready! 🎬");
            }
          }
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
    }, speedTier === "cinematic" ? 20000 : 5000); // Poll every 20s for Manus, 5s for others
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

  // ── Instant fallback: client-side composer with approved script ──
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const handleProduceInstantFallback = async () => {
    if (!businessId || !approvedScript) return;
    setGeneratingVideo(true);
    setComposingVideo(true);
    setJobStatus("composing_video");
    setComposePct(0);
    setSavedToLibrary(false);
    try {
      // Fetch business media for real photos
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const { data: mediaItems } = await supabase.from("business_media")
        .select("public_url").eq("business_id", businessId).eq("file_type", "image").limit(12);
      const images = mediaItems?.map(m => m.public_url) || [];
      // If no real images, create gradient placeholder
      if (images.length === 0) {
        const c = document.createElement("canvas"); c.width = 128; c.height = 128;
        const cx = c.getContext("2d")!;
        const g = cx.createLinearGradient(0, 0, 128, 128);
        g.addColorStop(0, "#1a1a2e"); g.addColorStop(1, "#16213e");
        cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
        images.push(c.toDataURL());
      }

      const blob = await composeVideo({
        sceneImages: images,
        voiceoverUrl: null,
        businessName: approvedScript.title || "Video",
        title: approvedScript.title,
        sceneCaptions: approvedScript.scenes?.map((s: any) => s.voiceover_line) || [],
        durationPerScene: 5,
        totalDurationSeconds: approvedScript.scenes?.length ? approvedScript.scenes.length * 5 : 30,
        width: 1080,
        height: 1920,
        onProgress: setComposePct,
      });
      const localUrl = URL.createObjectURL(blob);
      setFinalVideoUrl(localUrl);

      // Upload to storage + create job record so it appears in Watch Videos
      const jobId = crypto.randomUUID();
      const fileName = `videos/${user.id}/${jobId}/final.webm`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, blob, { contentType: "video/webm", upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        setFinalVideoUrl(urlData.publicUrl);

        // Create a video_generation_jobs record
        await supabase.from("video_generation_jobs").insert({
          id: jobId,
          user_id: user.id,
          business_id: businessId,
          location_id: locationId,
          provider: "instant_composer",
          status: "completed",
          video_url: urlData.publicUrl,
          request_payload: { speedTier: "instant", lengthMode, title: approvedScript.title },
          result_payload: {
            title: approvedScript.title,
            voiceover_script: approvedScript.scenes?.map((s: any) => s.voiceover_line).join(" "),
            scene_images: images,
            caption: approvedScript.description || approvedScript.title,
          },
        });
        setSavedToLibrary(true);
      }
      toast.success("Your instant video is ready! ⚡");
    } catch (err: any) {
      console.error("[VideoStudio] Instant fallback failed:", err);
      toast.error("Failed to compose video — please try again");
    } finally {
      setComposingVideo(false);
      setGeneratingVideo(false);
    }
  };

  // Save a blob-URL video to library after the fact
  const handleSaveToLibrary = async () => {
    if (!finalVideoUrl || !businessId || savedToLibrary) return;
    setSavingToLibrary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // Fetch the blob from the object URL
      const resp = await fetch(finalVideoUrl);
      const blob = await resp.blob();

      const jobId = crypto.randomUUID();
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      const fileName = `videos/${user.id}/${jobId}/final.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, blob, { contentType: blob.type, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
      setFinalVideoUrl(urlData.publicUrl);

      await supabase.from("video_generation_jobs").insert({
        id: jobId,
        user_id: user.id,
        business_id: businessId,
        location_id: locationId,
        provider: "instant_composer",
        status: "completed",
        video_url: urlData.publicUrl,
        request_payload: { speedTier: "instant", lengthMode, title: approvedScript?.title || "Video" },
        result_payload: {
          title: approvedScript?.title || "Instant Video",
          caption: approvedScript?.description || "",
        },
      });

      setSavedToLibrary(true);
      toast.success("Video saved to your library! 📚");
    } catch (err: any) {
      console.error("[VideoStudio] Save to library failed:", err);
      toast.error("Failed to save — please try again");
    } finally {
      setSavingToLibrary(false);
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

    // ── INSTANT TIER: skip server, compose client-side ──
    if (speedTier === "instant") {
      await handleProduceInstantFallback();
      return;
    }

    setGeneratingVideo(true);
    setFinalVideoUrl(null);
    composedRef.current = false;
    setJobStatus("queued");
    setComposePct(0);
    setGeneratedVideoScript(null);
    jobStartTimeRef.current = Date.now(); // Start timeout clock
    try {
      const response = await supabase.functions.invoke("generate-video", {
        body: {
          businessId,
          videoType: "promotional",
          lengthMode,
          approvedScript,
          manusModel: speedTier === "cinematic" ? manusModel : "default",
          manusTier,
          speedTier,
        },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.job_id) {
        setActiveJobId(response.data.job_id);
        const tierLabel = speedTier === "cinematic" ? "Manus AI (5-15 min)" : "HeyGen (1-3 min)";
        toast.info(`🎬 Video production started — ${tierLabel}`);
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
    setSpeedTier("instant");
    setSavedToLibrary(false);
    setSavingToLibrary(false);
    jobStartTimeRef.current = 0;
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
      case "rendering_video": return speedTier === "cinematic" ? "🎬 Rendering with Manus AI..." : "🎬 Rendering with HeyGen...";
      case "processing": return speedTier === "cinematic" 
        ? "🤖 Waiting for Manus AI to finish rendering... (5-15 min, auto-fallback at 10 min)" 
        : "🎬 Waiting for HeyGen to finish... (1-3 min)";
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

        {/* ═══ STEP 2.5: Speed Tier Selector ═══ */}
        {scriptApproved && (
          <div className="glass rounded-2xl p-6">
            <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" /> Choose Production Speed
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SPEED_TIERS.map(tier => {
                const isLocked = tier.key === "cinematic" && manusTier === "free";
                return (
                  <button
                    key={tier.key}
                    onClick={() => {
                      if (isLocked) {
                        toast.info("Cinematic tier requires a paid plan. Upgrade to unlock!");
                        return;
                      }
                      setSpeedTier(tier.key);
                      if (tier.key === "cinematic") setManusModel("default");
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

            {/* Cinematic sub-option: Veo 3 model selector */}
            {speedTier === "cinematic" && manusTier === "agency" && (
              <div className="mt-4 p-3 rounded-xl bg-secondary/30 border border-border">
                <p className="text-[10px] font-semibold text-foreground mb-2">🎬 Cinematic Model:</p>
                <div className="flex gap-2">
                  <button onClick={() => setManusModel("default")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${manusModel === "default" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                    Standard
                  </button>
                  <button onClick={() => setManusModel("veo3")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${manusModel === "veo3" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                    Veo 3 (Best)
                  </button>
                </div>
              </div>
            )}

            {/* Time expectation notice */}
            {speedTier === "cinematic" && (
              <div className="mt-3 p-2.5 rounded-xl bg-accent/10 border border-accent/20">
                <p className="text-[10px] text-accent-foreground">
                  ⏱ <strong>Cinematic videos take 5-15 minutes.</strong> If Manus AI doesn't respond within 10 minutes, we'll automatically create an instant fallback video so you're never stuck waiting.
                </p>
              </div>
            )}
            {speedTier === "standard" && (
              <div className="mt-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-foreground/70">
                  🎬 <strong>Standard videos take 1-3 minutes.</strong> HeyGen produces polished AI video quickly.
                </p>
              </div>
            )}
            {speedTier === "instant" && (
              <div className="mt-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-foreground/70">
                  ⚡ <strong>Instant — ready in seconds!</strong> Uses your real business photos with cinematic Ken Burns effects + on-screen captions.
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
        {finalVideoUrl && !generatingVideo && !composingVideo && (() => {
          const isManusPage = /manus\.(im|ai)\/app\//.test(finalVideoUrl) || /share\.manus\.(im|ai)/.test(finalVideoUrl);
          return (
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

            {isManusPage ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <Clapperboard className="w-10 h-10 text-primary mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground mb-1">🎬 Your Manus AI video is ready!</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Manus produced your cinematic video. Click below to view it on Manus's viewer page — you can download the .mp4 from there.
                  </p>
                  <a href={finalVideoUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">
                    <Play className="w-4 h-4" /> Watch on Manus AI
                  </a>
                </div>
                {generatedVideoScript?.voiceover_url && (
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <p className="text-[10px] font-semibold text-foreground mb-1">🎙️ Play voiceover alongside the video:</p>
                    <audio controls className="w-full">
                      <source src={generatedVideoScript.voiceover_url} type="audio/mpeg" />
                    </audio>
                    <p className="text-[10px] text-muted-foreground mt-1">Tip: Open the Manus video, then hit play on this audio at the same time.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <video controls autoPlay className="w-full rounded-xl bg-black max-h-[400px]">
                  <source src={finalVideoUrl} type={finalVideoUrl.endsWith(".webm") ? "video/webm" : "video/mp4"} />
                </video>
              </>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {isManusPage ? (
                <a href={finalVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Link2 className="w-4 h-4" /> Open Video
                </a>
              ) : (
                <a href={finalVideoUrl} download className="flex-1 text-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download Video
                </a>
              )}
              {!savedToLibrary && !isManusPage && (
                <button onClick={handleSaveToLibrary} disabled={savingToLibrary}
                  className="px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 disabled:opacity-50 flex items-center gap-2">
                  {savingToLibrary ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingToLibrary ? "Saving..." : "Save to Library"}
                </button>
              )}
              {savedToLibrary && (
                <span className="px-4 py-2 rounded-xl bg-green-500/10 text-green-400 text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" /> Saved to Library
                </span>
              )}
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
          );
        })()}

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
