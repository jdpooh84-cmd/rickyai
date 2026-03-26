import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Building2, MapPin, Video, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onComplete: (businessId: string, locationId: string | null) => void;
  onSkip: () => void;
}

type WizardStep = "info" | "format" | "producing" | "done";

const CreateVideoFlow = ({ onComplete, onSkip }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>("info");
  const [saving, setSaving] = useState(false);
  const [producing, setProducing] = useState(false);
  const [videoResult, setVideoResult] = useState<any>(null);

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

  const handleSaveAndContinue = async () => {
    if (!businessName.trim()) { toast.error("Enter your business name"); return; }
    if (!city.trim()) { toast.error("Enter your city"); return; }
    if (!user) return;

    setSaving(true);
    try {
      // Create business
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

      // Create location
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

      // Mark onboarding
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
    setProducing(true);

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

      setVideoResult(response.data);
      setStep("done");
      toast.success("Your first video content is ready! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Production failed — try again");
      setStep("format");
    } finally {
      setProducing(false);
    }
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
            { key: "tiktok" as const, label: "TikTok / Reels Short", desc: "15-30 sec vertical video. Perfect for daily social.", emoji: "🎵", platforms: "TikTok, Instagram Reels, YouTube Shorts" },
            { key: "reel" as const, label: "Instagram Reel", desc: "30-60 sec vertical video. Great for brand stories.", emoji: "📸", platforms: "Instagram, Facebook Reels" },
            { key: "youtube" as const, label: "YouTube Video", desc: "1-3 min horizontal video. Ideal for tutorials & promos.", emoji: "▶️", platforms: "YouTube, Facebook, LinkedIn" },
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
                  <div className="text-[10px] text-muted-foreground/70 mt-1">{opt.platforms}</div>
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
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Creating your video...</h2>
        <p className="text-muted-foreground text-sm">
          Our AI is writing a script, generating professional scene images, and packaging everything for {businessName}.
          This takes about 30-60 seconds.
        </p>
        <div className="flex justify-center gap-3 mt-4">
          {["Writing script", "Generating images", "Packaging"].map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Your first video is ready! 🎉</h2>
        <p className="text-muted-foreground text-sm">Here's what we made for {businessName}.</p>
      </div>

      {/* Scene Images */}
      {videoResult?.scene_images?.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-3">🖼️ Your Scene Images</h3>
          <div className="grid grid-cols-2 gap-3">
            {videoResult.scene_images.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Scene ${i + 1}`} className="w-full rounded-xl object-cover aspect-video" />
            ))}
          </div>
        </div>
      )}

      {/* Video Player */}
      {videoResult?.video_url && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-3">🎬 Your Video</h3>
          <video controls className="w-full rounded-xl bg-black max-h-[400px]">
            <source src={videoResult.video_url} type="video/mp4" />
          </video>
        </div>
      )}

      {/* Script */}
      {videoResult?.script && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-2">{videoResult.script.title}</h3>
          <p className="text-xs text-muted-foreground mb-3">{videoResult.script.description}</p>
          {videoResult.script.voiceover_script && (
            <div className="p-3 rounded-xl bg-secondary/30 mb-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">🎙️ Voiceover:</p>
              <p className="text-xs text-secondary-foreground">{videoResult.script.voiceover_script}</p>
            </div>
          )}
          {videoResult.script.caption && (
            <div className="p-3 rounded-xl bg-secondary/30">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">📝 Caption:</p>
              <p className="text-xs text-secondary-foreground">{videoResult.script.caption}</p>
            </div>
          )}
          {videoResult.script.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {videoResult.script.hashtags.map((h: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">#{h.replace("#", "")}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message */}
      {videoResult?.message && (
        <div className="glass rounded-2xl p-4">
          <p className="text-sm text-secondary-foreground">{videoResult.message}</p>
        </div>
      )}

      <Button onClick={() => onComplete(createdBusinessId!, createdLocationId)} className="w-full gap-2" size="lg">
        <ArrowRight className="w-4 h-4" /> Go to My Dashboard
      </Button>
    </div>
  );
};

export default CreateVideoFlow;
