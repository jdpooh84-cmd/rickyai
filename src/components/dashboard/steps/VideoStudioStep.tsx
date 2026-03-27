import { useEffect, useRef, useState } from "react";
import StepLayout from "./StepLayout";
import VideoStudioGuide from "./VideoStudioGuide";
import ExternalAppConnections from "./ExternalAppConnections";
import MediaLibrary from "../MediaLibrary";
import { Copy, Check, Film, Sparkles, Play, Download, Loader2, Clock, Image } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { composeVideo } from "@/lib/videoComposer";
import demoVideoAsset from "@/assets/demo-business-promo.mp4.asset.json";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/persistence";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

type LengthMode = "short" | "standard" | "long";

const STATE_KEY = "rickyai-video-studio-state";

const LENGTH_OPTIONS: { key: LengthMode; label: string; duration: string; emoji: string; desc: string }[] = [
  { key: "short", label: "Short", duration: "~30s", emoji: "⚡", desc: "Quick social clips for TikTok, Reels, Shorts" },
  { key: "standard", label: "Standard", duration: "~60s", emoji: "🎬", desc: "Full promo for Instagram, Facebook, YouTube" },
  { key: "long", label: "Long", duration: "~90s", emoji: "📹", desc: "Extended brand story or commercial" },
];

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const persisted = readLocalStorage(STATE_KEY, { lengthMode: "standard" as LengthMode, generatedVideoScript: null as any });
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

  // Persist state
  useEffect(() => {
    writeLocalStorage(STATE_KEY, { lengthMode, generatedVideoScript });
  }, [lengthMode, generatedVideoScript]);

  // ── Poll active video generation job ──
  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("video_generation_jobs")
        .select("status, result_payload, video_url, error_message")
        .eq("id", activeJobId)
        .single();

      if (data) {
        setJobStatus(data.status);
        if (data.result_payload) setGeneratedVideoScript(data.result_payload);

        if (data.status === "completed" || data.status === "media_ready") {
          clearInterval(interval);
          setGeneratingVideo(false);

          const payload = data.result_payload as any;
          const clips = payload?.video_clips || [];
          const images = payload?.scene_images || [];

          if ((clips.length > 0 || images.length > 0) && !composedRef.current) {
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
          } else if (data.video_url) {
            setFinalVideoUrl(data.video_url);
            toast.success("Your video is ready! 🎬");
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

  const handleProduceVideo = async () => {
    if (!businessId) {
      toast.error("Please set up your business profile first.");
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
        body: { businessId, videoType: "promotional", lengthMode },
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.job_id) {
        setActiveJobId(response.data.job_id);
        toast.info("🎬 Video production started!");
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
    removeLocalStorage(STATE_KEY);
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
      case "rendering_video": return "🎬 Rendering with Runway AI...";
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

  return (
    <StepLayout title="Video Studio" description="Produce a professional video for your business"
      icon="🎬" loading={false} hasData={!!finalVideoUrl || !!generatedVideoScript} onGenerate={() => {}} needsProfile={!businessId}
      hideGenerateButton>

      {/* ═══ STEP 1: Length Selector ═══ */}
      <div className="space-y-6">
        <div className="glass rounded-2xl p-6">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Choose Video Length
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {LENGTH_OPTIONS.map(opt => (
              <button key={opt.key} onClick={() => setLengthMode(opt.key)}
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

        {/* ═══ PRODUCE BUTTON ═══ */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" /> Produce Video
              </h4>
              <p className="text-[10px] text-muted-foreground">
                One click — script, photos, Runway rendering, and final assembly.
              </p>
            </div>
            <button onClick={handleProduceVideo} disabled={generatingVideo || composingVideo || !businessId}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {generatingVideo || composingVideo ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Producing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Produce Video</>
              )}
            </button>
          </div>

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

              {/* Pipeline step indicators */}
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

              {/* Scene images preview */}
              {generatedVideoScript?.scene_images?.length > 0 && (
                <div className="p-3 rounded-xl bg-secondary/30">
                  <p className="text-[10px] font-semibold text-foreground mb-2">🖼️ Scene photos ({generatedVideoScript.scene_images.length})</p>
                  <div className="grid grid-cols-4 gap-1">
                    {generatedVideoScript.scene_images.map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Scene ${i + 1}`} className="w-full rounded-lg object-cover aspect-video" />
                    ))}
                  </div>
                </div>
              )}

              {/* Clip rendering progress */}
              {generatedVideoScript?.total_clips && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Runway clips</span>
                    <span>{generatedVideoScript.clips_completed || 0}/{generatedVideoScript.total_clips}</span>
                  </div>
                  <Progress value={((generatedVideoScript.clips_completed || 0) / generatedVideoScript.total_clips) * 100} className="h-2" />
                </div>
              )}
            </div>
          )}

          {/* Composing overlay */}
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
                <p className="text-[10px] text-accent-foreground">⚠️ This is a fallback slideshow — upload real photos or replenish credits for full Runway video.</p>
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
            </div>

            {generatedVideoScript?.total_duration_seconds && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Duration: ~{generatedVideoScript.total_duration_seconds}s
                {generatedVideoScript.real_image_count !== undefined && ` • ${generatedVideoScript.real_image_count} real photos used`}
                {generatedVideoScript.usedFallbackScript ? " • Saved-data script" : " • AI script"}
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
