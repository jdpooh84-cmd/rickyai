import donatosPromo from "@/assets/donatos-pizza-promo.mp4.asset.json";
import donatosCloseup from "@/assets/donatos-pizza-closeup.mp4.asset.json";
import donatosExterior from "@/assets/donatos-pizza-exterior.mp4.asset.json";
import { Download, Share2, Copy, Check, MapPin, Phone, Globe, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const DemoVideoShowcase = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  const videos = [
    {
      id: "hero",
      title: "🎬 Donato's Pizza — Main Promo",
      description: "10-second hero video showcasing the restaurant interior, wood-fired oven, and fresh pizza",
      asset: donatosPromo,
      duration: "10s",
      platform: "TikTok / Instagram Reels",
    },
    {
      id: "food",
      title: "🍕 Fresh Pizza Close-Up",
      description: "5-second food close-up — stretchy cheese, golden crust, perfect for food content",
      asset: donatosCloseup,
      duration: "5s",
      platform: "Instagram Stories / Reels",
    },
    {
      id: "exterior",
      title: "🏪 Restaurant Exterior — Golden Hour",
      description: "5-second establishing shot at sunset — welcoming storefront, community vibes",
      asset: donatosExterior,
      duration: "5s",
      platform: "YouTube Intro / Facebook",
    },
  ];

  const caption = `🍕 Donato's Pizza — Where Every Slice Tells a Story

📍 1833 Republic Rd., Virginia Beach, VA
🔥 Wood-fired perfection, made fresh daily
👨‍👩‍👧‍👦 Family-owned. Community-loved.

Come taste the difference! 🇮🇹

#DonatosPizza #VirginiaBeach #WoodFiredPizza #LocalEats #PizzaLovers #VABeach #FamilyOwned #BestPizzaInTown #ItalianFood #FreshPizza`;

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
          <h1 className="text-sm font-bold text-foreground">Video Package</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Business Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-foreground">🍕 Donato's Pizza</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>1833 Republic Rd., Virginia Beach, VA</span>
          </div>
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
                  download={`donatos-pizza-${v.id}.mp4`}
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
            📝 Ready-to-Post Caption & Hashtags
          </h3>
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
              { name: "Instagram Stories", video: "Food Close-Up", emoji: "📱" },
              { name: "YouTube Shorts", video: "Main Promo", emoji: "▶️" },
              { name: "Facebook", video: "Exterior Shot", emoji: "👍" },
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
