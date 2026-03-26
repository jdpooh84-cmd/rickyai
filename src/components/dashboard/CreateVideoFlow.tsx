import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Building2, MapPin, Video, Sparkles, Check, Loader2, Image, FileText, Music, Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { composeVideo } from "@/lib/videoComposer";

interface Props {
  onComplete: (businessId: string, locationId: string | null) => void;
  onSkip: () => void;
}

type WizardStep = "info" | "format" | "producing" | "done";

const CreateVideoFlow = ({ onComplete, onSkip }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>("info");
  const [saving, setSaving] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("queued");
  const [jobResult, setJobResult] = useState<any>(null);
  const [composingVideo, setComposingVideo] = useState(false);
  const [composePct, setComposePct] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const composedRef = useRef(false);

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [services, setServices] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  // Video format
  const [videoType, setVideoType] = useState<"tiktok" | "reel" | "youtube">("tiktok");

  const [createdBusinessId, setCreatedBusinessId] = useState<string | null>(null);
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId || step !== "producing") return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("video_generation_jobs")
        .select("status, result_payload, video_url, error_message")
        .eq("id", jobId)
        .single();

      if (data) {
        setJobStatus(data.status);
        if (data.result_payload) {
          setJobResult(data.result_payload);
        }
        if (data.status === "completed" || data.status === "media_ready") {
          clearInterval(interval);
          // Auto-compose video from scene images
          const images = (data.result_payload as any)?.scene_images || [];
          if (images.length > 0 && !composedRef.current) {
            composedRef.current = true;
            setComposingVideo(true);
            setJobStatus("composing_video");
            try {
              const blob = await composeVideo({
                sceneImages: images,
                voiceoverUrl: (data.result_payload as any)?.voiceover_url || null,
                businessName: businessName,
                title: (data.result_payload as any)?.title || businessName,
                durationPerScene: 4,
                width: 1080,
                height: 1920,
                onProgress: setComposePct,
              });
              const url = URL.createObjectURL(blob);
              setFinalVideoUrl(url);

              // Upload to storage
              const fileName = `videos/${user?.id}/${jobId}.webm`;
              const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, blob, { contentType: "video/webm", upsert: true });
              if (!uploadErr) {
                const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
                setFinalVideoUrl(urlData.publicUrl);
                // Update the job with the video URL
                await supabase.from("video_generation_jobs").update({
                  video_url: urlData.publicUrl,
                  updated_at: new Date().toISOString(),
                }).eq("id", jobId);
              }
              toast.success("Your video is ready! 🎬");
            } catch (err: any) {
              console.error("Video composition error:", err);
              toast.error("Video assembly failed, but your images and script are ready");
            }
            setComposingVideo(false);
          }
          setStep("done");
        } else if (data.status === "failed") {
          clearInterval(interval);
          toast.error(data.error_message || "Production failed — try again");
          setStep("format");
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId, step]);

  const handleSaveAndContinue = async () => {
    if (!businessName.trim()) { toast.error("Enter your business name"); return; }
    if (!city.trim()) { toast.error("Enter your city"); return; }
    if (!user) return;

    setSaving(true);
    try {
      const { data: biz, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          user_id: user.id,
          business_name: businessName.trim(),
          business_category: category.trim() || null,
          services: services.trim() || null,
          target_audience: targetAudience.trim() || null,
          brand_tone: "Professional",
        })
        .select("id")
        .single();

      if (bizErr) throw bizErr;
      setCreatedBusinessId(biz.id);

      const { data: loc, error: locErr } = await supabase
        .from("locations")
        .insert({
          user_id: user.id,
          business_id: biz.id,
          location_name: `${city.trim()} Office`,
          city: city.trim(),
          state: state.trim() || null,
          country: "US",
          is_primary: true,
        })
        .select("id")
        .single();

      if (locErr) throw locErr;
      setCreatedLocationId(loc.id);

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      setStep("format");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleProduce = async () => {
    if (!createdBusinessId) return;
    setStep("producing");
    setJobStatus("queued");
    setJobResult(null);

    try {
      const productionMode = videoType === "youtube" ? "standard" : "quick";

      const response = await supabase.functions.invoke("generate-video", {
        body: {
          businessId: createdBusinessId,
          videoType: "promotional",
          productionMode,
        },
      });

      if (response.error) throw new Error(response.error.message);

      if (response.data?.job_id) {
        setJobId(response.data.job_id);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Production failed — try again");
      setStep("format");
    }
  };

  const getStatusLabel = () => {
    switch (jobStatus) {
      case "queued": return "Starting up...";
      case "generating_script": return "Writing your script...";
      case "generating_images": return "Creating scene images...";
      case "generating_voiceover": return "Recording voiceover...";
      case "rendering_video": return "Rendering final video...";
      case "composing_video": return `Composing your video... ${composePct}%`;
      default: return "Processing...";
    }
  };

  const getProgressSteps = () => {
    const steps = [
      { label: "Script", done: ["generating_images", "generating_voiceover", "rendering_video", "composing_video", "completed", "media_ready"].includes(jobStatus) },
      { label: "Scene Images", done: ["generating_voiceover", "rendering_video", "composing_video", "completed", "media_ready"].includes(jobStatus) },
      { label: "Video", done: jobStatus === "completed" || jobStatus === "media_ready" || !!finalVideoUrl },
    ];
    return steps;
  };

  if (step === "info") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Let's make your first video</h2>
          <p className="text-muted-foreground text-sm">Tell us about your business. We'll handle the rest.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Business Name *</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              placeholder="e.g., Donato's Pizza" className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">City *</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Virginia Beach"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">State</label>
              <input value={state} onChange={e => setState(e.target.value)} placeholder="VA"
                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">What do you do?</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Pizza Restaurant, Hair Salon, Plumber"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Your services (optional)</label>
            <input value={services} onChange={e => setServices(e.target.value)} placeholder="e.g., Dine-in, Delivery, Catering"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">Who's your ideal customer? (optional)</label>
            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g., Families, Young professionals, Local residents"
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent" />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onSkip} className="flex-1">Skip for now</Button>
          <Button onClick={handleSaveAndContinue} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "format") {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Choose your video style</h2>
          <p className="text-muted-foreground text-sm">Pick where you want to post. We'll optimize the video for that platform.</p>
        </div>

        <div className="space-y-3">
          {([
            { key: "tiktok" as const, label: "TikTok / Reels Short", desc: "15-30 sec vertical video.", emoji: "🎵" },
            { key: "reel" as const, label: "Instagram Reel", desc: "30-60 sec vertical video.", emoji: "📸" },
            { key: "youtube" as const, label: "YouTube Video", desc: "1-3 min horizontal video.", emoji: "▶️" },
          ]).map(opt => (
            <button key={opt.key} onClick={() => setVideoType(opt.key)}
              className={`w-full rounded-2xl p-4 text-left transition-all border ${
                videoType === opt.key ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border hover:border-primary/50"
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{opt.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
                {videoType === opt.key && <Check className="w-5 h-5 text-primary" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep("info")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button onClick={handleProduce} className="flex-1 gap-2">
            <Sparkles className="w-4 h-4" /> Create My Video
          </Button>
        </div>
      </div>
    );
  }

  if (step === "producing") {
    const progressSteps = getProgressSteps();
    const sceneImages = jobResult?.scene_images || [];

    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{getStatusLabel()}</h2>
          <p className="text-muted-foreground text-sm">
            Creating content for {businessName}. This takes about 60 seconds.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex justify-center gap-6">
          {progressSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              {s.done ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              <span className={`text-xs ${s.done ? "text-green-500 font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Show images as they arrive */}
        {sceneImages.length > 0 && (
          <div className="rounded-2xl border border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground">🖼️ Scene images ready ({sceneImages.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {sceneImages.map((url: string, i: number) => (
                <img key={i} src={url} alt={`Scene ${i + 1}`} className="w-full rounded-xl object-cover aspect-video" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // step === "done"
  const result = jobResult || {};
  const sceneImages = result.scene_images || [];
  const videoSrc = finalVideoUrl || result.video_url;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Your video is ready! 🎬</h2>
        <p className="text-muted-foreground text-sm">{result.message || `Here's what we made for ${businessName}.`}</p>
      </div>

      {/* Video Player — always shown first */}
      {videoSrc && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" /> Your Video
          </h3>
          <video controls autoPlay className="w-full rounded-xl bg-black max-h-[500px]">
            <source src={videoSrc} type={videoSrc.endsWith(".webm") ? "video/webm" : "video/mp4"} />
          </video>
          <div className="flex gap-2 mt-3">
            <a href={videoSrc} download={`${businessName}-promo.webm`}
              className="flex-1 text-center px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Download Video
            </a>
          </div>
        </div>
      )}

      {/* Composing in progress */}
      {composingVideo && !videoSrc && (
        <div className="rounded-2xl border border-border p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Assembling your video... {composePct}%</p>
          <p className="text-xs text-muted-foreground mt-1">Combining scene images into a professional video</p>
        </div>
      )}

      {/* Scene Images (collapsed if video exists) */}
      {sceneImages.length > 0 && (
        <details className={videoSrc ? "" : "open"}>
          <summary className="text-sm font-bold text-foreground cursor-pointer mb-2">🖼️ Scene Images ({sceneImages.length})</summary>
          <div className="rounded-2xl border border-border p-4">
            <div className="grid grid-cols-2 gap-3">
              {sceneImages.map((url: string, i: number) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Scene ${i + 1}`} className="w-full rounded-xl object-cover aspect-video hover:opacity-90 transition-opacity cursor-pointer" />
                </a>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* Voiceover */}
      {result.voiceover_url && (
        <div className="rounded-2xl border border-border p-6">
          <h3 className="text-sm font-bold text-foreground mb-3">🎙️ Voiceover</h3>
          <audio controls className="w-full">
            <source src={result.voiceover_url} type="audio/mpeg" />
          </audio>
        </div>
      )}

      {/* Script */}
      {result.title && (
        <details>
          <summary className="text-sm font-bold text-foreground cursor-pointer mb-2">📝 Script & Caption</summary>
          <div className="rounded-2xl border border-border p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">{result.title}</h3>
            <p className="text-xs text-muted-foreground">{result.description}</p>
            {result.voiceover_script && (
              <div className="p-3 rounded-xl bg-secondary/30">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Voiceover Script:</p>
                <p className="text-xs text-secondary-foreground">{result.voiceover_script}</p>
              </div>
            )}
            {result.caption && (
              <div className="p-3 rounded-xl bg-secondary/30">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Caption:</p>
                <p className="text-xs text-secondary-foreground">{result.caption}</p>
              </div>
            )}
            {result.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.hashtags.map((h: string, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">#{h.replace("#", "")}</span>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      <Button onClick={() => onComplete(createdBusinessId!, createdLocationId)} className="w-full gap-2" size="lg">
        <ArrowRight className="w-4 h-4" /> Go to My Dashboard
      </Button>
    </div>
  );
};

export default CreateVideoFlow;
