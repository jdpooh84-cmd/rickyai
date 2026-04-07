import donatosPromo from "@/assets/donatos-pizza-promo.mp4.asset.json";
import donatosCloseup from "@/assets/donatos-pizza-closeup.mp4.asset.json";
import donatosExterior from "@/assets/donatos-pizza-exterior.mp4.asset.json";
import { Download, Copy, Check, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const DemoVideoShowcase = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  const videos = [
    {
      id: "hero",
      title: "🎬 Main Promo — Hero Video",
      description: "10-second hero video showcasing your business interior, signature process, and finished product",
      asset: donatosPromo,
      duration: "10s",
      platform: "TikTok / Instagram Reels",
    },
    {
      id: "product",
      title: "✨ Product Close-Up",
      description: "5-second product close-up — perfect for showcasing craftsmanship and quality",
      asset: donatosCloseup,
      duration: "5s",
      platform: "Instagram Stories / Reels",
    },
    {
      id: "exterior",
      title: "🏪 Storefront — Golden Hour",
      description: "5-second establishing shot at sunset — welcoming exterior, community vibes",
      asset: donatosExterior,
      duration: "5s",
      platform: "YouTube Intro / Facebook",
    },
  ];

  const caption = `✨ [Your Business Name] — Where Quality Meets Passion

📍 [Your Address, Your City]
🔥 [Your signature offering — what makes you different]
💯 [Your story — family-owned, veteran-owned, est. year, etc.]

Come experience the difference!

#SmallBusiness #LocalBusiness #SupportLocal #YourCity #YourIndustry #ShopLocal #CommunityFirst #QualityMatters`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-sm font-bold text-foreground">Sample Video Package</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-foreground">🎥 Sample Video Package</h1>
          <p className="text-sm text-muted-foreground">
            This is what RickyAI generates for any business — any industry, any location.
          </p>
          <p className="text-xs text-primary font-semibold">3 Videos Ready • Full Social Media Package</p>
        </div>

        {/* Videos */}
        {videos.map((v) => (
          <div key={v.id} className="rounded-2xl overflow-hidden border border-border bg-card">
            <video
              controls
              playsInline
              className="w-full aspect-[9/16] max-h-[500px] bg-black object-contain"
            >
              <source src={v.asset.url} type="video/mp4" />
            </video>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{v.title}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{v.duration}</span>
              </div>
              <p className="text-xs text-muted-foreground">{v.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Best for: {v.platform}</span>
                <a
                  href={v.asset.url}
                  download={`sample-video-${v.id}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </div>
          </div>
        ))}

        {/* Ready-to-Post Caption */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            📝 Sample Caption Template
          </h3>
          <p className="text-[10px] text-muted-foreground">Replace the [brackets] with your business details</p>
          <div className="p-3 rounded-xl bg-secondary/30 text-sm text-secondary-foreground whitespace-pre-wrap">
            {caption}
          </div>
          <button
            onClick={() => handleCopy(caption, "caption")}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {copied === "caption" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied === "caption" ? "Copied!" : "Copy Caption"}
          </button>
        </div>

        {/* Posting Checklist */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-bold text-foreground">📱 Post to These Platforms</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "TikTok", video: "Main Promo", emoji: "🎵" },
              { name: "Instagram Reels", video: "Main Promo", emoji: "📸" },
              { name: "Instagram Stories", video: "Product Close-Up", emoji: "📱" },
              { name: "YouTube Shorts", video: "Main Promo", emoji: "▶️" },
              { name: "Facebook", video: "Storefront Shot", emoji: "👍" },
              { name: "Google Business", video: "Main Promo", emoji: "📍" },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/20 border border-border">
                <span className="text-base">{p.emoji}</span>
                <div>
                  <div className="text-xs font-semibold text-foreground">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">Use: {p.video}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoVideoShowcase;
