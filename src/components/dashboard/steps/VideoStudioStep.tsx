import { useState, useRef } from "react";
import StepLayout from "./StepLayout";
import { Film, Sparkles, Download, Loader2, Play, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { buildPromoTemplate, renderPromoVideo } from "@/lib/videoTemplate";

interface Props {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

const EXAMPLE_PROMPTS = [
  "A 30-second promo showing why customers love us",
  "Highlight our top 3 services with bold text overlays",
  "A quick before-and-after transformation video",
  "Introduce our team and what makes us different",
  "A seasonal sale announcement with urgency",
];

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState<"idle" | "scripting" | "rendering" | "uploading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Tell us what kind of video you want!");
      return;
    }
    if (!businessId) {
      toast.error("Please set up your business profile first (Step 2).");
      return;
    }

    setGenerating(true);
    setError(null);
    setFinalVideoUrl(null);
    setProgress(0);

    try {
      // ── Stage 1: Generate script from prompt + business context ──
      setStage("scripting");
      setProgress(10);

      const { data: biz } = await supabase
        .from("businesses")
        .select("business_name, business_category, niche, services, target_audience, brand_tone")
        .eq("id", businessId)
        .single();

      if (!biz) throw new Error("Business not found. Please complete your profile first.");

      const { data: loc } = await supabase
        .from("locations")
        .select("city, state, country")
        .eq("business_id", businessId)
        .limit(1)
        .maybeSingle();

      setProgress(20);

      // Call AI to turn the user prompt into a structured video script
      const scriptResponse = await supabase.functions.invoke("ai-strategy", {
        body: {
          step: 99, // Special step number for video script generation
          businessId,
          locationId,
          customPrompt: prompt.trim(),
          mode: "video_script",
        },
      });

      if (scriptResponse.error) throw new Error(scriptResponse.error.message);

      const script = scriptResponse.data?.script || scriptResponse.data;
      if (!script || !script.title) {
        // Build a fallback script from the prompt
        const fallbackScript = {
          title: prompt.slice(0, 60),
          description: prompt,
          cta: `Visit ${biz.business_name} today!`,
          scenes: [
            { voiceover_line: prompt, text_overlay: biz.business_name, duration_seconds: 5 },
            { voiceover_line: biz.services || "Quality service you can trust", text_overlay: biz.services?.split(",")[0] || "Our Services", duration_seconds: 15 },
            { voiceover_line: `Trusted by ${biz.target_audience || "our community"}`, text_overlay: "Why Choose Us", duration_seconds: 15 },
            { voiceover_line: `${biz.business_name} — let's get started!`, text_overlay: `Visit ${biz.business_name}`, duration_seconds: 10 },
          ],
        };
        Object.assign(script || {}, fallbackScript);
      }

      setProgress(40);

      // ── Stage 2: Fetch media assets ──
      const { data: mediaItems } = await supabase
        .from("business_media")
        .select("public_url")
        .eq("business_id", businessId)
        .eq("file_type", "image")
        .limit(12);

      const images = mediaItems?.map((m) => m.public_url) || [];

      setProgress(50);

      // ── Stage 3: Render video ──
      setStage("rendering");

      const template = buildPromoTemplate(script, biz.business_name, images);

      const blob = await renderPromoVideo(template, (pct) => {
        setProgress(50 + Math.round(pct * 0.4)); // 50-90%
      });

      if (blob.size < 1000) {
        throw new Error("Video render produced an empty file. Please try Chrome browser.");
      }

      setProgress(90);

      // ── Stage 4: Upload ──
      setStage("uploading");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not logged in");

      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const contentType = blob.type.includes("mp4") ? "video/mp4" : "video/webm";
      const jobId = crypto.randomUUID();
      const fileName = `videos/${authUser.id}/${jobId}/final.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(fileName, blob, { contentType, upsert: true });

      if (uploadErr) {
        // Still show local video even if upload fails
        console.warn("Upload failed:", uploadErr);
        setFinalVideoUrl(URL.createObjectURL(blob));
      } else {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
        setFinalVideoUrl(urlData.publicUrl);

        // Log the job
        await supabase.from("video_generation_jobs").insert({
          id: jobId,
          user_id: authUser.id,
          business_id: businessId,
          location_id: locationId,
          provider: "instant_template",
          status: "completed",
          pipeline_stage: "completed",
          video_url: urlData.publicUrl,
          request_payload: { prompt: prompt.trim() },
          result_payload: { title: script.title, description: script.description },
        });
      }

      setProgress(100);
      setStage("done");
      toast.success("Your video is ready! 🎬");
      onComplete?.();
    } catch (err: any) {
      console.error("[VideoStudio] Generation failed:", err);
      setError(err.message || "Something went wrong. Please try again.");
      toast.error(err.message || "Video generation failed");
      setStage("idle");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = "ricky-ai-video.mp4";
    a.click();
  };

  const handleReset = () => {
    setFinalVideoUrl(null);
    setPrompt("");
    setStage("idle");
    setProgress(0);
    setError(null);
  };

  const stageLabel: Record<string, string> = {
    scripting: "✍️ Writing your script from your description...",
    rendering: "🎬 Rendering your video...",
    uploading: "☁️ Saving to your library...",
    done: "✅ Done!",
  };

  return (
    <StepLayout
      title="Video Studio"
      description="Describe your video and we'll create it automatically"
      icon="🎬"
      loading={false}
      hasData={!!finalVideoUrl}
      onGenerate={() => {}}
      needsProfile={!businessId}
      hideGenerateButton
    >
      <div className="space-y-6">
        {/* ═══ FINISHED VIDEO ═══ */}
        {finalVideoUrl && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Film className="w-4 h-4 text-primary" /> Your Video
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Video
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[500px] mx-auto">
              <video
                ref={videoRef}
                src={finalVideoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {/* ═══ INPUT FORM ═══ */}
        {!finalVideoUrl && !generating && (
          <div className="glass rounded-2xl p-6 space-y-5">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> What kind of video do you want?
            </h4>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A 30-second promo highlighting our best dishes with upbeat music and bold text..."
              className="w-full p-4 rounded-xl border border-border bg-background text-foreground text-sm resize-none min-h-[120px] focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted-foreground/60"
              rows={4}
            />

            {/* Quick prompts */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2 font-medium">Or try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(ex)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-secondary/50 text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !businessId}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              <Film className="w-4 h-4" /> Generate My Video
            </button>
          </div>
        )}

        {/* ═══ PROGRESS ═══ */}
        {generating && (
          <div className="glass rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                {stageLabel[stage] || "Processing..."}
              </p>
              <p className="text-xs text-muted-foreground">
                This usually takes about 60 seconds. Don't close this tab.
              </p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-center text-xs text-muted-foreground">{progress}%</p>
          </div>
        )}

        {/* ═══ TIPS ═══ */}
        {!generating && !finalVideoUrl && (
          <div className="glass rounded-2xl p-5">
            <h5 className="text-xs font-bold text-foreground mb-3">💡 Tips for great videos</h5>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• <strong>Be specific:</strong> "30-second promo for our summer sale" works better than "make a video"</li>
              <li>• <strong>Upload photos first:</strong> Go to your Media Library and add business photos — they'll appear in your video automatically</li>
              <li>• <strong>Mention your audience:</strong> "targeting young professionals" helps tailor the message</li>
              <li>• <strong>Include a call-to-action:</strong> "End with 'Book your appointment today'"</li>
            </ul>
          </div>
        )}
      </div>
    </StepLayout>
  );
};

export default VideoStudioStep;
