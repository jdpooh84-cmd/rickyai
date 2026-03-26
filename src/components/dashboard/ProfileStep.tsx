import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, MapPin, Save, Building2 } from "lucide-react";
import { toast } from "sonner";

interface BusinessForm {
  id?: string;
  owner_name: string;
  business_name: string;
  business_category: string;
  niche: string;
  website_url: string;
  google_business_profile: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  youtube_url: string;
  linkedin_url: string;
  target_audience: string;
  brand_tone: string;
  services: string;
  competitors: string;
  content_goals: string;
  referral_goals: string;
  funding_goals: string;
}

interface LocationForm {
  id?: string;
  location_name: string;
  city: string;
  state: string;
  country: string;
  service_area: string;
  is_primary: boolean;
}

const emptyBusiness: BusinessForm = {
  owner_name: "", business_name: "", business_category: "", niche: "",
  website_url: "", google_business_profile: "", facebook_url: "", instagram_url: "",
  tiktok_url: "", youtube_url: "", linkedin_url: "", target_audience: "",
  brand_tone: "", services: "", competitors: "", content_goals: "",
  referral_goals: "", funding_goals: "",
};

const emptyLocation: LocationForm = {
  location_name: "", city: "", state: "", country: "US", service_area: "", is_primary: true,
};

const Field = ({ label, value, onChange, placeholder, type = "text", textarea = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean;
}) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
    {textarea ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    )}
  </div>
);

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold font-display text-primary mt-6 mb-3 flex items-center gap-2">
    {children}
  </h3>
);

interface ProfileStepProps {
  onComplete?: () => void;
}

const ProfileStep = ({ onComplete }: ProfileStepProps) => {
  const { user } = useAuth();
  const [business, setBusiness] = useState<BusinessForm>(emptyBusiness);
  const [locations, setLocations] = useState<LocationForm[]>([{ ...emptyLocation }]);
  const [existingBusinessId, setExistingBusinessId] = useState<string | null>(null);
  const [existingLocationIds, setExistingLocationIds] = useState<(string | undefined)[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing data
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: businesses } = await supabase
        .from("businesses")
        .select("*")
        .eq("user_id", user.id)
        .limit(1);

      if (businesses && businesses.length > 0) {
        const b = businesses[0];
        setExistingBusinessId(b.id);
        setBusiness({
          id: b.id,
          owner_name: b.owner_name || "",
          business_name: b.business_name,
          business_category: b.business_category || "",
          niche: b.niche || "",
          website_url: b.website_url || "",
          google_business_profile: b.google_business_profile || "",
          facebook_url: b.facebook_url || "",
          instagram_url: b.instagram_url || "",
          tiktok_url: b.tiktok_url || "",
          youtube_url: b.youtube_url || "",
          linkedin_url: b.linkedin_url || "",
          target_audience: b.target_audience || "",
          brand_tone: b.brand_tone || "",
          services: b.services || "",
          competitors: b.competitors || "",
          content_goals: b.content_goals || "",
          referral_goals: b.referral_goals || "",
          funding_goals: b.funding_goals || "",
        });

        const { data: locs } = await supabase
          .from("locations")
          .select("*")
          .eq("business_id", b.id)
          .order("created_at");

        if (locs && locs.length > 0) {
          setLocations(locs.map((l) => ({
            id: l.id,
            location_name: l.location_name,
            city: l.city,
            state: l.state || "",
            country: l.country || "US",
            service_area: l.service_area || "",
            is_primary: l.is_primary,
          })));
          setExistingLocationIds(locs.map((l) => l.id));
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const updateBusiness = (field: keyof BusinessForm, value: string) => {
    setBusiness((prev) => ({ ...prev, [field]: value }));
  };

  const updateLocation = (index: number, field: keyof LocationForm, value: string | boolean) => {
    setLocations((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const addLocation = () => {
    setLocations((prev) => [...prev, { ...emptyLocation, is_primary: false }]);
    setExistingLocationIds((prev) => [...prev, undefined]);
  };

  const removeLocation = (index: number) => {
    if (locations.length <= 1) return;
    setLocations((prev) => prev.filter((_, i) => i !== index));
    setExistingLocationIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!business.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!locations[0]?.city.trim()) {
      toast.error("At least one location with a city is required");
      return;
    }

    setSaving(true);
    try {
      let businessId = existingBusinessId;

      const businessData = {
        user_id: user.id,
        owner_name: business.owner_name || null,
        business_name: business.business_name,
        business_category: business.business_category || null,
        niche: business.niche || null,
        website_url: business.website_url || null,
        google_business_profile: business.google_business_profile || null,
        facebook_url: business.facebook_url || null,
        instagram_url: business.instagram_url || null,
        tiktok_url: business.tiktok_url || null,
        youtube_url: business.youtube_url || null,
        linkedin_url: business.linkedin_url || null,
        target_audience: business.target_audience || null,
        brand_tone: business.brand_tone || null,
        services: business.services || null,
        competitors: business.competitors || null,
        content_goals: business.content_goals || null,
        referral_goals: business.referral_goals || null,
        funding_goals: business.funding_goals || null,
      };

      if (existingBusinessId) {
        await supabase.from("businesses").update(businessData).eq("id", existingBusinessId);
      } else {
        const { data } = await supabase.from("businesses").insert(businessData).select("id").single();
        if (data) {
          businessId = data.id;
          setExistingBusinessId(data.id);
        }
      }

      if (!businessId) throw new Error("Failed to save business");

      // Save locations
      for (let i = 0; i < locations.length; i++) {
        const loc = locations[i];
        const locData = {
          business_id: businessId,
          user_id: user.id,
          location_name: loc.location_name || loc.city,
          city: loc.city,
          state: loc.state || null,
          country: loc.country || "US",
          service_area: loc.service_area || null,
          is_primary: loc.is_primary,
        };

        if (existingLocationIds[i]) {
          await supabase.from("locations").update(locData).eq("id", existingLocationIds[i]!);
        } else {
          const { data } = await supabase.from("locations").insert(locData).select("id").single();
          if (data) {
            setExistingLocationIds((prev) => {
              const next = [...prev];
              next[i] = data.id;
              return next;
            });
          }
        }
      }

      toast.success("Business profile saved!");
      onComplete?.();
    } catch (err) {
      toast.error("Failed to save profile. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground text-sm">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">Business Profile</h1>
        <p className="text-muted-foreground">
          Everything RickyAI generates is based on this profile. The more you fill in, the more
          personalized and powerful your strategy becomes.
        </p>
      </div>

      {/* Business Info */}
      <div className="glass rounded-2xl p-6 mb-6">
        <SectionHeader>
          <Building2 className="w-4 h-4" /> Business Information
        </SectionHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Owner Name" value={business.owner_name} onChange={(v) => updateBusiness("owner_name", v)} placeholder="Jane Smith" />
          <Field label="Business Name *" value={business.business_name} onChange={(v) => updateBusiness("business_name", v)} placeholder="Smith's Bakery" />
          <Field label="Business Category" value={business.business_category} onChange={(v) => updateBusiness("business_category", v)} placeholder="Restaurant, Salon, Clinic..." />
          <Field label="Niche" value={business.niche} onChange={(v) => updateBusiness("niche", v)} placeholder="Artisan sourdough, family dentistry..." />
        </div>

        <SectionHeader>🌐 Website (Optional)</SectionHeader>
        <p className="text-[10px] text-muted-foreground mb-3">Your business website. This is NOT the same as your social media profiles below.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Website URL" value={business.website_url} onChange={(v) => updateBusiness("website_url", v)} placeholder="https://mybusiness.com" type="url" />
          <Field label="Google Business Profile" value={business.google_business_profile} onChange={(v) => updateBusiness("google_business_profile", v)} placeholder="https://g.page/..." type="url" />
        </div>

        <SectionHeader>📱 Social Media Profile URLs</SectionHeader>
        <p className="text-[10px] text-muted-foreground mb-3">
          Paste your profile URLs or handles. These are NOT connected accounts — they help RickyAI understand your online presence.
          To actually connect accounts for posting, use the Connect step.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Facebook URL or @handle" value={business.facebook_url} onChange={(v) => updateBusiness("facebook_url", v)} placeholder="https://facebook.com/mybiz or @mybiz" />
          <Field label="Instagram URL or @handle" value={business.instagram_url} onChange={(v) => updateBusiness("instagram_url", v)} placeholder="https://instagram.com/mybiz or @mybiz" />
          <Field label="TikTok URL or @handle" value={business.tiktok_url} onChange={(v) => updateBusiness("tiktok_url", v)} placeholder="https://tiktok.com/@mybiz or @mybiz" />
          <Field label="YouTube URL" value={business.youtube_url} onChange={(v) => updateBusiness("youtube_url", v)} placeholder="https://youtube.com/@mybiz" />
          <Field label="LinkedIn URL" value={business.linkedin_url} onChange={(v) => updateBusiness("linkedin_url", v)} placeholder="https://linkedin.com/company/mybiz" />
        </div>

        <SectionHeader>🎯 Strategy Inputs</SectionHeader>
        <div className="space-y-4">
          <Field label="Target Audience" value={business.target_audience} onChange={(v) => updateBusiness("target_audience", v)} placeholder="Who are your ideal customers?" textarea />
          <Field label="Brand Tone" value={business.brand_tone} onChange={(v) => updateBusiness("brand_tone", v)} placeholder="Warm & friendly, Bold & authoritative, Premium & polished..." />
          <Field label="Services / Products" value={business.services} onChange={(v) => updateBusiness("services", v)} placeholder="List your main offerings" textarea />
          <Field label="Competitors" value={business.competitors} onChange={(v) => updateBusiness("competitors", v)} placeholder="Who are your main local competitors?" textarea />
        </div>

        <SectionHeader>📈 Goals</SectionHeader>
        <div className="space-y-4">
          <Field label="Content Goals" value={business.content_goals} onChange={(v) => updateBusiness("content_goals", v)} placeholder="What do you want your content to accomplish?" textarea />
          <Field label="Referral Goals" value={business.referral_goals} onChange={(v) => updateBusiness("referral_goals", v)} placeholder="What kind of referral partners or growth do you want?" textarea />
          <Field label="Funding Goals" value={business.funding_goals} onChange={(v) => updateBusiness("funding_goals", v)} placeholder="Are you looking for grants, loans, or investors?" textarea />
        </div>
      </div>

      {/* Locations */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader>
            <MapPin className="w-4 h-4" /> Locations
          </SectionHeader>
          <Button variant="outline" size="sm" onClick={addLocation}>
            <Plus className="w-3 h-3" /> Add Location
          </Button>
        </div>

        <div className="space-y-6">
          {locations.map((loc, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/30 border border-border relative">
              {locations.length > 1 && (
                <button
                  onClick={() => removeLocation(i)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-primary/60">Location {i + 1}</span>
                {loc.is_primary && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Primary</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Location Name" value={loc.location_name} onChange={(v) => updateLocation(i, "location_name", v)} placeholder="Main Office, Downtown Store..." />
                <Field label="City *" value={loc.city} onChange={(v) => updateLocation(i, "city", v)} placeholder="Norfolk" />
                <Field label="State" value={loc.state} onChange={(v) => updateLocation(i, "state", v)} placeholder="Virginia" />
                <Field label="Country" value={loc.country} onChange={(v) => updateLocation(i, "country", v)} placeholder="US" />
                <div className="md:col-span-2">
                  <Field label="Service Area" value={loc.service_area} onChange={(v) => updateLocation(i, "service_area", v)} placeholder="Hampton Roads, Greater Norfolk area..." />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <Button variant="hero" size="lg" className="w-full" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save Business Profile"}
      </Button>
    </div>
  );
};

export default ProfileStep;
