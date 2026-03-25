import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VIDEO_FORMATS, DEFAULT_VIDEO_FORMAT, type VideoFormat } from "@/lib/videoFormats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Zap, AlertTriangle, CheckCircle, Calendar, Film, FileText, Shield, BarChart3 } from "lucide-react";
import StepLayout from "./StepLayout";

interface Props {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

type ProductionMode = "quick" | "standard" | "longform";
type PostFrequency = "1x" | "2x" | "3x";
type PostSchedule = "daily" | "weekly" | "monthly";

const CampaignBlueprintStep = ({ businessId, locationId, onComplete }: Props) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>(DEFAULT_VIDEO_FORMAT);
  const [productionMode, setProductionMode] = useState<ProductionMode>("standard");
  const [postFrequency, setPostFrequency] = useState<PostFrequency>("1x");
  const [postSchedule, setPostSchedule] = useState<PostSchedule>("weekly");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) loadExisting();
  }, [businessId]);

  const loadExisting = async () => {
    try {
      const { data: existing } = await supabase
        .from("strategy_outputs")
        .select("output_data")
        .eq("business_id", businessId!)
        .eq("step_number", 14)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) setData(existing.output_data);
    } catch {}
  };

  const handleGenerate = async () => {
    if (!businessId) {
      toast.error("Please set up your business profile first (Step 2)");
      return;
    }
    setLoading(true);
    try {
      const response = await supabase.functions.invoke("campaign-blueprint", {
        body: { businessId, locationId, productionMode, postFrequency, postSchedule, videoFormat },
      });
      if (response.error) throw new Error(response.error.message);
      setData(response.data);
      toast.success("Campaign Blueprint generated!");
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate blueprint.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button onClick={() => copyText(text, id)}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
      {copiedId === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copiedId === id ? "Copied!" : "Copy"}
    </button>
  );

  // Config screen
  if (!data) {
    const formatSpec = VIDEO_FORMATS[videoFormat];
    return (
      <StepLayout title="Campaign Blueprint" description="Generate your entire content strategy in one shot"
        icon="🎯" loading={loading} hasData={false} onGenerate={handleGenerate} needsProfile={!businessId}
        generateLabel="🚀 Generate Full Blueprint">

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One AI call creates your complete campaign — episodes, hooks, derivatives for every platform, 
            production specs, posting schedule, and compliance review. No step-by-step processing needed.
          </p>

          {/* Video Format */}
          <div className="glass rounded-2xl p-5">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" /> Video Format
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.entries(VIDEO_FORMATS) as [VideoFormat, typeof formatSpec][]).map(([key, spec]) => (
                <button key={key} onClick={() => setVideoFormat(key)}
                  className={`rounded-xl p-4 text-left transition-all ${
                    videoFormat === key ? "bg-primary/10 ring-2 ring-primary" : "glass hover:ring-2 hover:ring-primary/30"
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-foreground">{spec.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {spec.width}×{spec.height}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{spec.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {spec.platforms.map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground">{p}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Production Mode */}
          <div className="glass rounded-2xl p-5">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Production Mode
            </h4>
            <div className="flex gap-2">
              {([["quick", "⚡ Quick (15-30s)"], ["standard", "🎬 Standard (1-3min)"], ["longform", "📹 Long-Form (5-15min)"]] as const).map(([val, label]) => (
                <button key={val} onClick={() => setProductionMode(val)}
                  className={`flex-1 rounded-xl px-3 py-3 text-xs font-medium transition-all ${
                    productionMode === val ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:text-foreground"
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Posting */}
          <div className="glass rounded-2xl p-5">
            <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" /> Posting Schedule
            </h4>
            <div className="flex gap-2 mb-3">
              {(["1x", "2x", "3x"] as const).map(val => (
                <button key={val} onClick={() => setPostFrequency(val)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                    postFrequency === val ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
                  }`}>{val.replace("x", "")} post{val !== "1x" ? "s" : ""}/day</button>
              ))}
            </div>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map(val => (
                <button key={val} onClick={() => setPostSchedule(val)}
                  className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all capitalize ${
                    postSchedule === val ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"
                  }`}>{val} plan</button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-[10px] text-muted-foreground">
              ⚠️ <strong>Disclaimer:</strong> Optimal posting times may differ by location and target audience niche. 
              Results vary — this strategy works for many businesses but outcomes depend on your market, consistency, and content quality.
            </p>
          </div>
        </div>
      </StepLayout>
    );
  }

  // Results
  return (
    <StepLayout title="Campaign Blueprint" description={data.campaign_summary || "Your full campaign is ready."}
      icon="🎯" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>

      {/* Format badge */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setData(null)} className="text-xs text-muted-foreground hover:text-foreground">← Reconfigure</button>
        {data.video_format && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            {data.video_format.aspect_ratio} • {data.video_format.resolution}
          </span>
        )}
      </div>

      {/* Compliance */}
      {data.compliance_check && (
        <div className={`glass rounded-2xl p-5 mb-4 ${data.compliance_check.status === "pass" ? "ring-1 ring-primary/30" : "ring-1 ring-destructive/30"}`}>
          <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance: {data.compliance_check.status === "pass" ? (
              <span className="text-primary flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Pass</span>
            ) : (
              <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Flagged</span>
            )}
          </h4>
          {data.compliance_check.flagged_items?.length > 0 && (
            <div className="space-y-1">
              {data.compliance_check.flagged_items.map((item: any, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-foreground">Episode {item.episode}: {item.issue}</p>
                  <p className="text-[10px] text-muted-foreground">💡 {item.suggestion}</p>
                </div>
              ))}
            </div>
          )}
          {data.compliance_check.legal_notes?.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground">Legal Notes:</p>
              {data.compliance_check.legal_notes.map((n: string, i: number) => (
                <p key={i} className="text-[10px] text-muted-foreground">• {n}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Episodes */}
      {data.episodes?.map((ep: any, i: number) => (
        <Card key={i} className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Episode {ep.episode_number}: {ep.title}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ep.duration}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-2 rounded-lg bg-primary/5">
              <p className="text-[10px] font-semibold text-primary mb-1">🎣 Hook</p>
              <p className="text-xs text-foreground">{ep.hook}</p>
            </div>
            <p className="text-xs text-muted-foreground">{ep.body_outline}</p>
            <p className="text-xs text-foreground"><strong>CTA:</strong> {ep.cta}</p>

            {/* B-roll & text overlays */}
            {ep.broll_cues && (
              <div className="flex flex-wrap gap-1">
                {ep.broll_cues.map((b: string, j: number) => (
                  <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">🎥 {b}</span>
                ))}
              </div>
            )}

            {/* Derivatives */}
            {ep.derivatives && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Platform Derivatives:</p>
                {ep.derivatives.map((d: any, j: number) => (
                  <div key={j} className="flex items-center justify-between p-1.5 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-foreground">{d.platform}</span>
                      <span className="text-[10px] text-muted-foreground">{d.duration} • {d.format}</span>
                    </div>
                    <CopyBtn text={d.hook_variation} id={`deriv-${i}-${j}`} />
                  </div>
                ))}
              </div>
            )}

            {/* Production prompts */}
            {ep.production_prompts && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground">Production Prompts:</p>
                {Object.entries(ep.production_prompts).map(([tool, prompt]: [string, any]) => (
                  <div key={tool} className="flex items-center justify-between p-1.5 rounded-lg bg-accent/5">
                    <span className="text-xs font-medium text-foreground capitalize">{tool.replace(/_/g, " ")}</span>
                    <CopyBtn text={String(prompt)} id={`prompt-${i}-${tool}`} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Posting Schedule */}
      {data.posting_schedule && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Posting Schedule
          </h4>
          {data.posting_schedule.best_times_by_platform?.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 mb-1">
              <span className="text-xs font-medium text-foreground">{p.platform}</span>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">{p.times?.join(", ")}</span>
                {p.timezone_note && <p className="text-[10px] text-muted-foreground/70">{p.timezone_note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spec Sheet */}
      {data.spec_sheet && (
        <div className="glass rounded-2xl p-5 mb-4">
          <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Video Spec Sheet (DNA)
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div><strong>Logo:</strong> {data.spec_sheet.logo_placement}</div>
            <div><strong>Fonts:</strong> {data.spec_sheet.font_suggestions?.join(", ")}</div>
            <div><strong>Intro:</strong> {data.spec_sheet.intro_template}</div>
            <div><strong>Outro:</strong> {data.spec_sheet.outro_template}</div>
          </div>
          {data.spec_sheet.brand_colors && (
            <div className="flex gap-2 mt-3">
              {data.spec_sheet.brand_colors.map((c: string, i: number) => (
                <div key={i} className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: c }} title={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly Review Prompt */}
      {data.weekly_review_prompt && (
        <div className="glass rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Weekly Review Master Prompt
            </h4>
            <CopyBtn text={data.weekly_review_prompt} id="weekly-prompt" />
          </div>
          <p className="text-xs text-muted-foreground">
            Use this prompt once a week with your performance CSV to update next week's strategy. 
            This avoids daily AI costs — the delayed feedback loop is more cost-effective.
          </p>
          <p className="text-xs text-secondary-foreground mt-2 whitespace-pre-wrap">{data.weekly_review_prompt}</p>
        </div>
      )}

      <div className="p-3 rounded-xl bg-muted/50 border border-border">
        <p className="text-[10px] text-muted-foreground">
          ⚠️ <strong>Disclaimer:</strong> Posting times are general recommendations and may differ based on your location, niche, and target audience. 
          Results are not guaranteed — content performance varies by market, consistency, and quality of execution.
        </p>
      </div>
    </StepLayout>
  );
};

export default CampaignBlueprintStep;
