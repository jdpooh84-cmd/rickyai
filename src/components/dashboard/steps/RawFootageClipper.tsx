import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Download, Scissors, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface Props {
  businessId: string | null;
}

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg"];
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

const RawFootageClipper = ({ businessId }: Props) => {
  const [hasKlapKey, setHasKlapKey] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [clipStatus, setClipStatus] = useState<string>("queued");
  const [clips, setClips] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for Klap key on mount
  useEffect(() => {
    supabase
      .from("user_api_keys")
      .select("id")
      .eq("provider", "klap")
      .eq("is_valid", true)
      .maybeSingle()
      .then(({ data }) => setHasKlapKey(!!data));
  }, []);

  // Poll active clip job every 10 seconds
  useEffect(() => {
    if (!activeJobId || clipStatus === "completed" || clipStatus === "failed") return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("clip_generation_jobs")
        .select("status, clip_urls, error_message")
        .eq("id", activeJobId)
        .single();

      if (!data) return;
      setClipStatus(data.status);

      if (data.status === "completed") {
        clearInterval(interval);
        const urls: string[] = data.clip_urls || [];
        setClips(urls);
        if (urls.length > 0) {
          toast.success(`${urls.length} clip${urls.length !== 1 ? "s" : ""} ready! ✂️`);
        } else {
          toast.warning("Klap finished but returned no clips. Try a longer video.");
        }
      } else if (data.status === "failed") {
        clearInterval(interval);
        toast.error(data.error_message || "Klap clipping failed — try again.");
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [activeJobId, clipStatus]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be re-selected
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|webm|mpeg|mpg)$/i)) {
      toast.error("Please select an MP4, MOV, AVI, or WebM video file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Video must be under 500 MB.");
      return;
    }
    if (!businessId) {
      toast.error("Please set up your business profile first.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setClips([]);
    setActiveJobId(null);
    setClipStatus("queued");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const timestamp = Date.now();
      const storagePath = `raw-footage/${user.id}/${timestamp}.${ext}`;

      // Upload to Supabase Storage with progress tracking
      // The JS client doesn't expose upload progress natively; we simulate it
      // by updating progress at start, mid (after upload), and done.
      setUploadProgress(10);
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(storagePath, file, {
          contentType: file.type || `video/${ext}`,
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      setUploadProgress(100);

      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, "");
      const publicVideoUrl = `${supabaseUrl}/storage/v1/object/public/media/${storagePath}`;

      setUploading(false);

      // Call clip-video edge function
      const response = await supabase.functions.invoke("clip-video", {
        body: { businessId, sourceVideoUrl: publicVideoUrl, storagePath },
      });

      if (response.data?.error === "NO_KLAP_KEY") {
        setHasKlapKey(false);
        toast.error("Connect your Klap API key below to auto-clip footage.", { duration: 8000 });
        return;
      }

      if (response.error) throw new Error(response.error.message);

      const jobId: string | null = response.data?.job_id ?? null;
      if (!jobId) throw new Error("No job ID returned from clip-video");

      setActiveJobId(jobId);
      setClipStatus("processing");
      toast.info("Klap is analyzing your footage — clips take 5-15 minutes. Leave this page open or check back later.");
    } catch (err: any) {
      console.error("[RawFootageClipper]", err);
      toast.error(err.message || "Failed to process footage");
      setUploading(false);
    }
  };

  const resetClipper = () => {
    setClips([]);
    setActiveJobId(null);
    setClipStatus("queued");
    setUploadProgress(0);
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Scissors className="w-4 h-4 text-primary" /> Clip Your Real Footage
      </h4>
      <p className="text-xs text-muted-foreground">
        Upload video you recorded yourself. Klap's AI finds the best moments and cuts them into
        short-form clips ready for TikTok, Reels, and Shorts — automatically.
      </p>

      {/* Missing key banner */}
      {hasKlapKey === false && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-xs font-semibold text-destructive mb-1">🔑 Klap API key required</p>
          <p className="text-[10px] text-muted-foreground">
            Add your Klap key in <strong>Connect Your Tools</strong> below to enable auto-clipping.{" "}
            <a href="https://klap.app" target="_blank" rel="noopener noreferrer"
              className="underline text-primary inline-flex items-center gap-0.5">
              Get a Klap key <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>
      )}

      {/* Upload dropzone */}
      {!activeJobId && !clips.length && (
        <div
          role="button"
          tabIndex={0}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && !uploading && fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-xs font-semibold text-foreground">Uploading... {uploadProgress}%</p>
              <Progress value={uploadProgress} className="h-1.5 max-w-xs mx-auto" />
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs font-semibold text-foreground">
                Drop your video here or click to browse
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                MP4, MOV, AVI, WebM • Max 500 MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Processing state */}
      {activeJobId && clipStatus !== "completed" && clipStatus !== "failed" && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
          <Loader2 className="w-6 h-6 animate-spin text-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Klap is analyzing your footage…</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              This takes 5-15 minutes. You can leave this page — clips will be here when you come back.
            </p>
          </div>
        </div>
      )}

      {/* Clips ready */}
      {clips.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-foreground">
            {clips.length} clip{clips.length !== 1 ? "s" : ""} ready 🎉
          </p>
          <div className="space-y-3">
            {clips.map((url, i) => (
              <div key={i} className="rounded-xl border border-border bg-secondary/10 p-3">
                <video
                  controls
                  className="w-full rounded-lg max-h-[220px] bg-black mb-2"
                  preload="metadata"
                >
                  <source src={url} type="video/mp4" />
                </video>
                <a
                  href={url}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                >
                  <Download className="w-3 h-3" /> Download Clip {i + 1}
                </a>
              </div>
            ))}
          </div>
          <button
            onClick={resetClipper}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Upload another video
          </button>
        </div>
      )}
    </div>
  );
};

export default RawFootageClipper;
