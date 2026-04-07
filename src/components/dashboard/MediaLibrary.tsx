import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Image, Film, Trash2, Tag, Loader2, Link2, ExternalLink } from "lucide-react";

interface MediaItem {
  id: string;
  file_name: string;
  file_type: string;
  shot_type: string;
  public_url: string;
  tags: string[];
  created_at: string;
}

const SHOT_TYPES = ["food", "people", "environment"] as const;

function guessShotType(name: string): string {
  const n = name.toLowerCase();
  if (/food|menu|product|service|display|showcase|item/.test(n)) return "product";
  if (/exterior|storefront|building|outside|entrance|facade/.test(n)) return "exterior";
  if (/interior|inside|workspace|studio|office|shop|store/.test(n)) return "interior";
  if (/people|team|family|staff|customer|crowd/.test(n)) return "people";
  return "environment";
}

interface Props {
  businessId: string | null;
}

const MediaLibrary = ({ businessId }: Props) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [urlShotType, setUrlShotType] = useState<string>("environment");
  const [importingUrl, setImportingUrl] = useState(false);

  const fetchMedia = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data } = await supabase
      .from("business_media")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    setMedia((data as any[]) || []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!businessId) return;
    setUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); setUploading(false); return; }

    let count = 0;
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) continue;

      const fileType = isVideo ? "video" : "image";
      const folder = isVideo ? "videos" : "images";
      const storagePath = `business/${businessId}/${folder}/${Date.now()}-${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from("media")
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        continue;
      }

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(storagePath);
      const shotType = guessShotType(file.name);

      await supabase.from("business_media").insert({
        business_id: businessId,
        user_id: session.user.id,
        file_type: fileType,
        shot_type: shotType,
        file_name: file.name,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        file_size_bytes: file.size,
        mime_type: file.type,
        tags: [],
      } as any);
      count++;
    }

    if (count > 0) {
      toast.success(`Uploaded ${count} file${count > 1 ? "s" : ""}`);
      fetchMedia();
    }
    setUploading(false);
  };

  const handleImportUrl = async () => {
    if (!businessId || !videoUrl.trim()) return;
    setImportingUrl(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please sign in"); setImportingUrl(false); return; }

    try {
      const fileName = `external-${Date.now()}.mp4`;
      const storagePath = `business/${businessId}/videos/${fileName}`;
      const source = videoUrl.includes("manus") ? "manus" : "external";

      await supabase.from("business_media").insert({
        business_id: businessId,
        user_id: session.user.id,
        file_type: "video",
        shot_type: urlShotType,
        file_name: fileName,
        storage_path: storagePath,
        public_url: videoUrl.trim(),
        file_size_bytes: 0,
        mime_type: "video/mp4",
        tags: [source],
      } as any);

      toast.success("Video added to your Media Library! 🎬");
      setVideoUrl("");
      setShowUrlImport(false);
      fetchMedia();
    } catch (err: any) {
      toast.error("Failed to import video URL");
    }
    setImportingUrl(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
  };

  const updateShotType = async (id: string, shotType: string) => {
    await supabase.from("business_media").update({ shot_type: shotType } as any).eq("id", id);
    setMedia(prev => prev.map(m => m.id === id ? { ...m, shot_type: shotType } : m));
  };

  const deleteMedia = async (item: MediaItem) => {
    await supabase.storage.from("media").remove([(item as any).storage_path]);
    await supabase.from("business_media").delete().eq("id", item.id);
    setMedia(prev => prev.filter(m => m.id !== item.id));
    toast.success("Deleted");
  };

  if (!businessId) return null;

  const images = media.filter(m => m.file_type === "image");
  const videos = media.filter(m => m.file_type === "video");

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" /> Media Library
        </h4>
        <p className="text-[10px] text-muted-foreground mt-1">
          Upload your business photos and clips. Ricky.AI uses these first when creating videos — they make your content look authentic and on-brand.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onClick={() => document.getElementById("media-upload-input")?.click()}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {uploading ? "Uploading..." : "Drag & drop images or videos, or click to browse"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, MP4 supported</p>
        <input
          id="media-upload-input"
          type="file"
          multiple
          accept="image/*,video/mp4"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Import from URL (Manus AI, etc.) */}
      <div>
        <button
          onClick={() => setShowUrlImport(!showUrlImport)}
          className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" /> Import video from URL (Manus AI, etc.)
        </button>
        {showUrlImport && (
          <div className="mt-2 p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
            <p className="text-[10px] text-muted-foreground">Paste a video URL from Manus AI or any external tool to save it to your Media Library.</p>
            <input
              type="url"
              placeholder="https://..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <select
                value={urlShotType}
                onChange={(e) => setUrlShotType(e.target.value)}
                className="text-[10px] bg-background border border-border rounded px-2 py-1 text-foreground"
              >
                {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={handleImportUrl}
                disabled={!videoUrl.trim() || importingUrl}
                className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
              >
                {importingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                Add to Library
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : media.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No media uploaded yet. Add photos of your food, team, and storefront!
        </p>
      ) : (
        <div className="space-y-4">
          {images.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                <Image className="w-3 h-3" /> Photos ({images.length})
              </h5>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map(item => (
                  <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border">
                    <img src={item.public_url} alt={item.file_name} className="w-full aspect-square object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <select
                        value={item.shot_type}
                        onChange={(e) => updateShotType(item.id, e.target.value)}
                        className="text-[10px] bg-black/50 text-white border border-white/30 rounded px-1 py-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button onClick={() => deleteMedia(item)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                      <span className="text-[8px] text-white flex items-center gap-0.5">
                        <Tag className="w-2 h-2" /> {item.shot_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                <Film className="w-3 h-3" /> Video Clips ({videos.length})
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {videos.map(item => (
                  <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border">
                    <video src={item.public_url} className="w-full aspect-video object-cover" muted />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <select
                        value={item.shot_type}
                        onChange={(e) => updateShotType(item.id, e.target.value)}
                        className="text-[10px] bg-black/50 text-white border border-white/30 rounded px-1 py-0.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button onClick={() => deleteMedia(item)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                      <span className="text-[8px] text-white flex items-center gap-0.5">
                        <Tag className="w-2 h-2" /> {item.shot_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
