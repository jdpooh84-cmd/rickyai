import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Film, Download, ExternalLink, Play, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoJob {
  id: string;
  status: string;
  video_url: string | null;
  result_payload: any;
  request_payload: any;
  created_at: string;
  business_id: string;
}

interface Props {
  onBack?: () => void;
}

const WatchVideo = ({ onBack }: Props) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchJobs = async () => {
      const { data } = await supabase
        .from("video_generation_jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setJobs((data as any[]) || []);
      setLoading(false);
    };
    fetchJobs();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Film className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">No videos yet</h2>
        <p className="text-sm text-muted-foreground">Go to Video Studio (Step 8) and click "Produce Video" to create your first one.</p>
        {onBack && <Button variant="outline" onClick={onBack}>← Go to Video Studio</Button>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" /> Your Videos
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">{jobs.length} video{jobs.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="space-y-4">
        {jobs.map(job => {
          const result = job.result_payload as any;
          const sceneImages = result?.scene_images || [];
          const hasVideo = !!job.video_url;
          const hasImages = sceneImages.length > 0;

          return (
            <div key={job.id} className="glass rounded-2xl p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{result?.title || "Promotional Video"}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()} • {job.status === "completed" ? "✅ Complete" : job.status === "media_ready" ? "🖼️ Images Ready" : job.status === "script_ready" ? "📝 Script Ready" : job.status === "processing" ? "⏳ Processing" : `⚠️ ${job.status}`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  job.status === "completed" ? "bg-green-500/10 text-green-400" :
                  job.status === "media_ready" ? "bg-primary/10 text-primary" :
                  job.status === "failed" ? "bg-destructive/10 text-destructive" :
                  "bg-amber-500/10 text-amber-400"
                }`}>
                  {job.status.replace("_", " ")}
                </span>
              </div>

              {/* Video Player */}
              {hasVideo && (
                <div>
                  <video controls className="w-full rounded-xl bg-black max-h-[350px]">
                    <source src={job.video_url!} type="video/mp4" />
                  </video>
                  <div className="flex gap-2 mt-2">
                    <a href={job.video_url!} download className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                      <Download className="w-3 h-3" /> Download
                    </a>
                  </div>
                </div>
              )}

              {/* Scene Images */}
              {!hasVideo && hasImages && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">🖼️ {sceneImages.length} AI-generated scene images — import into CapCut or Canva to assemble:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {sceneImages.map((url: string, i: number) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Scene ${i + 1}`} className="w-full rounded-lg object-cover aspect-video" />
                        <a href={url} download className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded bg-black/60 text-white">
                          <Download className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script */}
              {result?.voiceover_script && (
                <div className="p-3 rounded-xl bg-secondary/20">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Script:</p>
                  <p className="text-xs text-secondary-foreground">{result.voiceover_script}</p>
                </div>
              )}

              {/* Caption + Hashtags */}
              {result?.caption && (
                <div className="p-3 rounded-xl bg-secondary/20">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Caption:</p>
                  <p className="text-xs text-secondary-foreground">{result.caption}</p>
                  {result.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.hashtags.map((h: string, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">#{h.replace("#", "")}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Voiceover Audio */}
              {result?.voiceover_url && (
                <div className="p-3 rounded-xl bg-accent/5">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Voiceover:</p>
                  <audio controls className="w-full h-8"><source src={result.voiceover_url} type="audio/mpeg" /></audio>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WatchVideo;
