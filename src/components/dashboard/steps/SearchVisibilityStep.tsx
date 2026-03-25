import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  businessId: string;
  locationId: string | null;
  onComplete: () => void;
}

const SearchVisibilityStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(13);

  useEffect(() => {
    if (businessId) loadExisting(businessId);
  }, [businessId]);

  const handleGenerate = async () => {
    const result = await generate(businessId, locationId);
    if (result) onComplete();
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const gradeColor = (grade: string) => {
    if (grade === "A" || grade === "A+") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (grade === "B" || grade === "B+") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    if (grade === "C" || grade === "C+") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <StepLayout
      title="Search Visibility Engine"
      description="See how well your business can be found, answered, and cited across SEO, AEO, GEO, and AI-driven search."
      icon="🔍"
      loading={loading}
      hasData={!!data}
      onGenerate={handleGenerate}
      onRegenerate={handleGenerate}
      needsProfile={!businessId}
    >
      {data && (
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="p-6 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold text-foreground">Overall Visibility Score</h2>
              <span className={`text-4xl font-bold ${scoreColor(data.overall_score || 0)}`}>
                {data.overall_score || 0}/100
              </span>
            </div>
            <Progress value={data.overall_score || 0} className="h-3 mb-3" />
            <p className="text-sm text-muted-foreground">{data.overall_summary}</p>
          </div>

          {/* Tabs for each visibility dimension */}
          <Tabs defaultValue="seo" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="seo">🌐 SEO</TabsTrigger>
              <TabsTrigger value="aeo">💬 AEO</TabsTrigger>
              <TabsTrigger value="geo">📍 GEO</TabsTrigger>
              <TabsTrigger value="ai">🤖 AI Overviews</TabsTrigger>
            </TabsList>

            {/* SEO Tab */}
            <TabsContent value="seo" className="space-y-4 mt-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">Search Engine Optimization</h3>
                  <Badge className={gradeColor(data.seo?.grade || "C")}>{data.seo?.grade || "C"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{data.seo?.summary}</p>
                
                {data.seo?.factors?.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-t border-border/50">
                    <span className="text-sm text-foreground">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={f.score} className="w-24 h-2" />
                      <span className={`text-xs font-medium ${scoreColor(f.score)}`}>{f.score}</span>
                    </div>
                  </div>
                ))}

                {data.seo?.recommendations?.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <h4 className="text-sm font-semibold text-foreground mb-2">🎯 Quick Wins</h4>
                    <ul className="space-y-1">
                      {data.seo.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-primary">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AEO Tab */}
            <TabsContent value="aeo" className="space-y-4 mt-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">Answer Engine Optimization</h3>
                  <Badge className={gradeColor(data.aeo?.grade || "C")}>{data.aeo?.grade || "C"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{data.aeo?.summary}</p>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  💡 <strong>Ricky says:</strong> {data.aeo?.ricky_explanation}
                </p>

                {data.aeo?.questions_your_business_should_answer?.map((q: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/50 mb-2">
                    <p className="text-sm font-medium text-foreground mb-1">❓ {q.question}</p>
                    <p className="text-xs text-muted-foreground">{q.suggested_answer}</p>
                  </div>
                ))}

                {data.aeo?.optimized_faqs?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">📋 Optimized FAQs for Your Website</h4>
                    {data.aeo.optimized_faqs.map((faq: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-accent/5 border border-accent/10 mb-2">
                        <p className="text-sm font-medium text-foreground">Q: {faq.question}</p>
                        <p className="text-xs text-muted-foreground mt-1">A: {faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* GEO Tab */}
            <TabsContent value="geo" className="space-y-4 mt-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">Generative Engine Optimization</h3>
                  <Badge className={gradeColor(data.geo?.grade || "C")}>{data.geo?.grade || "C"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{data.geo?.summary}</p>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  💡 <strong>Ricky says:</strong> {data.geo?.ricky_explanation}
                </p>

                {data.geo?.citation_readiness && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {Object.entries(data.geo.citation_readiness).map(([key, val]: any) => (
                      <div key={key} className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-center">
                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                        <p className={`text-lg font-bold ${scoreColor(val)}`}>{val}%</p>
                      </div>
                    ))}
                  </div>
                )}

                {data.geo?.optimized_summaries?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">📝 AI-Optimized Business Summaries</h4>
                    {data.geo.optimized_summaries.map((s: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-accent/5 border border-accent/10 mb-2">
                        <p className="text-xs font-medium text-primary mb-1">{s.use_case}</p>
                        <p className="text-sm text-foreground">{s.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI Overviews Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">AI Overview Presence</h3>
                  <Badge className={gradeColor(data.ai_overviews?.grade || "C")}>{data.ai_overviews?.grade || "C"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{data.ai_overviews?.summary}</p>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  💡 <strong>Ricky says:</strong> {data.ai_overviews?.ricky_explanation}
                </p>

                {data.ai_overviews?.visibility_gaps?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">⚠️ Visibility Gaps</h4>
                    {data.ai_overviews.visibility_gaps.map((g: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 py-2 border-t border-border/50">
                        <span className="text-orange-400 text-xs mt-0.5">●</span>
                        <div>
                          <p className="text-sm text-foreground">{g.gap}</p>
                          <p className="text-xs text-muted-foreground">{g.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {data.ai_overviews?.scripts_for_visibility?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-2">🎬 Content Scripts to Boost AI Visibility</h4>
                    {data.ai_overviews.scripts_for_visibility.map((s: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/10 mb-2">
                        <p className="text-sm font-medium text-foreground mb-1">{s.title}</p>
                        <p className="text-xs text-muted-foreground mb-2">{s.script}</p>
                        <Badge variant="secondary" className="text-[10px]">{s.platform}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Plan */}
          {data.action_plan?.length > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-display font-semibold text-foreground mb-3">🗺️ 30-Day Action Plan</h3>
              {data.action_plan.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2 border-t border-border/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.impact} · {a.timeframe}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default SearchVisibilityStep;
