import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";

interface AdBannerProps {
  placementType: "banner" | "sidebar" | "inline" | "sponsored_tip" | "featured_strategy";
  userIndustry?: string;
  userNiche?: string;
  userLocation?: string;
}

interface AdData {
  id: string;
  headline: string;
  body_text: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_url: string;
  placement_type: string;
}

const AdBanner = ({ placementType, userIndustry, userNiche, userLocation }: AdBannerProps) => {
  const { user } = useAuth();
  const [ad, setAd] = useState<AdData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchAd = async () => {
      const { data } = await supabase
        .from("ad_placements")
        .select("id, headline, body_text, image_url, cta_text, cta_url, placement_type")
        .eq("placement_type", placementType)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (data) {
        setAd(data);
        // Log impression
        await supabase.from("ad_events").insert({
          placement_id: data.id,
          event_type: "impression",
          user_id: user?.id || null,
          user_industry: userIndustry || null,
          user_niche: userNiche || null,
          user_location: userLocation || null,
        });
      }
    };

    fetchAd();
  }, [placementType]);

  const handleClick = async () => {
    if (!ad) return;
    await supabase.from("ad_events").insert({
      placement_id: ad.id,
      event_type: "click",
      user_id: user?.id || null,
      user_industry: userIndustry || null,
      user_niche: userNiche || null,
      user_location: userLocation || null,
    });
    window.open(ad.cta_url, "_blank", "noopener,noreferrer");
  };

  if (!ad || dismissed) return null;

  if (placementType === "sidebar") {
    return (
      <div className="p-4 rounded-xl bg-card border border-border/60 relative group">
        <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Sponsored</p>
        {ad.image_url && <img src={ad.image_url} alt="" className="w-full h-20 object-cover rounded-lg mb-2" />}
        <p className="text-sm font-medium text-foreground mb-1">{ad.headline}</p>
        {ad.body_text && <p className="text-xs text-muted-foreground mb-2">{ad.body_text}</p>}
        <button onClick={handleClick} className="text-xs text-primary font-medium hover:underline">
          {ad.cta_text || "Learn More"} →
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-card/50 border border-border/40 flex items-center gap-3 relative group">
      <button onClick={() => setDismissed(true)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
      <p className="text-[10px] text-muted-foreground/50 uppercase">Sponsored</p>
      {ad.image_url && <img src={ad.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{ad.headline}</p>
      </div>
      <button onClick={handleClick} className="text-xs text-primary font-medium hover:underline whitespace-nowrap">
        {ad.cta_text || "Learn More"}
      </button>
    </div>
  );
};

export default AdBanner;
