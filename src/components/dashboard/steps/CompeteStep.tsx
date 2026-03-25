import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

const gradeColors: Record<string, string> = {
  A: "text-green-400", B: "text-primary", C: "text-accent", D: "text-orange-400", F: "text-destructive",
};

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const CompeteStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(3);

  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);

  const handleGenerate = async () => {
    if (!businessId) return;
    const result = await generate(businessId, locationId);
    if (result) onComplete?.();
  };

  return (
    <StepLayout
      title="Compete" description="Your visibility report card — see how your business stacks up online."
      icon="📊" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate}
      needsProfile={!businessId}
    >
      {data && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Overall Grade</p>
            <span className={`text-6xl font-bold font-display ${gradeColors[data.overall_grade] || "text-foreground"}`}>
              {data.overall_grade}
            </span>
            <p className="text-sm text-muted-foreground mt-2">Score: {data.overall_score}/100</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.categories?.map((cat: any) => (
              <div key={cat.name} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{cat.name}</h4>
                  <span className={`text-lg font-bold font-display ${gradeColors[cat.grade] || "text-foreground"}`}>{cat.grade}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-3">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${cat.score}%` }} />
                </div>
                <div className="space-y-1">
                  {cat.findings?.slice(0, 2).map((f: string, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">• {f}</p>
                  ))}
                </div>
                {cat.recommendations?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-primary font-medium mb-1">Recommendations:</p>
                    {cat.recommendations.slice(0, 2).map((r: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground">→ {r}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.top_priorities && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🎯 Top Priorities</h4>
              <div className="space-y-2">
                {data.top_priorities.map((p: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                    <p className="text-sm text-secondary-foreground">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.competitive_edge && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs text-primary font-medium mb-1">💎 Your Competitive Edge</p>
              <p className="text-sm text-foreground">{data.competitive_edge}</p>
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default CompeteStep;
