import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Plus, Loader2, Copy, Eye, FileText } from "lucide-react";

interface LandingPage {
  id: string;
  business_id: string;
  slug: string;
  headline: string | null;
  offer_text: string | null;
  cta_text: string | null;
  active: boolean;
  views: number;
  submissions: number;
  created_at: string;
}

interface CreateForm {
  slug: string;
  headline: string;
  offer_text: string;
  cta_text: string;
  active: boolean;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

const emptyForm = (): CreateForm => ({
  slug: "",
  headline: "",
  offer_text: "",
  cta_text: "Claim Now",
  active: true,
});

interface Props { businessId: string | null; }

export default function LandingPages({ businessId }: Props) {
  const { toast } = useToast();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm());
  const [slugError, setSlugError] = useState("");

  const loadPages = async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast({ title: "Error loading pages", description: error.message, variant: "destructive" }); return; }
    setPages(data || []);
  };

  useEffect(() => { loadPages(); }, [businessId]);

  const validateSlug = (val: string) => {
    if (!val) { setSlugError("Slug is required"); return false; }
    if (!SLUG_REGEX.test(val)) { setSlugError("Only lowercase letters, numbers, and hyphens"); return false; }
    setSlugError("");
    return true;
  };

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setForm(f => ({ ...f, slug: clean }));
    validateSlug(clean);
  };

  const createPage = async () => {
    if (!businessId) return;
    if (!validateSlug(form.slug)) return;
    if (!form.headline.trim()) { toast({ title: "Headline is required", variant: "destructive" }); return; }

    setSaving(true);
    const { error } = await supabase.from("landing_pages").insert({
      business_id: businessId,
      slug: form.slug,
      headline: form.headline.trim(),
      offer_text: form.offer_text.trim() || null,
      cta_text: form.cta_text.trim() || "Claim Now",
      active: form.active,
      views: 0,
      submissions: 0,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Error creating page", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Landing page created" });
    setForm(emptyForm());
    setShowCreate(false);
    loadPages();
  };

  const toggleActive = async (page: LandingPage) => {
    const { error } = await supabase
      .from("landing_pages")
      .update({ active: !page.active })
      .eq("id", page.id);
    if (error) { toast({ title: "Error updating page", description: error.message, variant: "destructive" }); return; }
    loadPages();
  };

  const copyLink = (slug: string) => {
    const url = `https://rickyai.page/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied", description: url });
    }).catch(() => {
      toast({ title: "Copy failed — link is: " + url, variant: "destructive" });
    });
  };

  const totalViews = pages.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalSubmissions = pages.reduce((sum, p) => sum + (p.submissions || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Landing Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage offer landing pages for your campaigns</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-2" />Create Landing Page
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Pages", value: pages.length, icon: FileText },
          { label: "Total Views", value: totalViews.toLocaleString(), icon: Eye },
          { label: "Total Submissions", value: totalSubmissions.toLocaleString(), icon: Globe },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card className="glass border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">New Landing Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Slug (URL path)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">rickyai.page/</span>
                <Input
                  placeholder="my-spring-offer"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  className={slugError ? "border-destructive" : ""}
                />
              </div>
              {slugError && <p className="text-xs text-destructive mt-1">{slugError}</p>}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Headline</label>
              <Input
                placeholder="Get 20% Off Your First Service This Month"
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Offer Text</label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-y"
                placeholder="Describe the offer in detail — what the customer gets, any conditions, expiry..."
                value={form.offer_text}
                onChange={e => setForm(f => ({ ...f, offer_text: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">CTA Button Text</label>
              <Input
                placeholder="Claim Now"
                value={form.cta_text}
                onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-foreground">Active</label>
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${form.active ? "bg-primary" : "bg-input"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form.active ? "translate-x-4" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={createPage} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Page
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setForm(emptyForm()); setSlugError(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages List */}
      {loading && (
        <div className="text-center py-8 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Loading pages...
        </div>
      )}

      {!loading && pages.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No landing pages yet. Create your first one to start capturing leads.</p>
        </div>
      )}

      {!loading && pages.map(page => (
        <Card key={page.id} className="glass">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-foreground truncate">{page.headline || "(No headline)"}</p>
                  <Badge variant={page.active ? "default" : "secondary"} className="flex-shrink-0 text-xs">
                    {page.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  rickyai.page/<span className="text-primary font-medium">{page.slug}</span>
                </p>
                {page.offer_text && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{page.offer_text}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{page.views || 0} views</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{page.submissions || 0} submissions</span>
                  <span>{page.cta_text || "Claim Now"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => copyLink(page.slug)}>
                  <Copy className="w-3 h-3 mr-1" />Copy Link
                </Button>
                <Button
                  size="sm"
                  variant={page.active ? "ghost" : "outline"}
                  onClick={() => toggleActive(page)}
                  className={page.active ? "text-muted-foreground hover:text-destructive" : ""}
                >
                  {page.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
