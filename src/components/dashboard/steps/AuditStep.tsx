import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const AuditStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(5);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Audit" description="Content strategy audit with a 4-week action calendar."
      icon="📋" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Content Score</p>
            <span className="text-5xl font-bold font-display text-primary">{data.content_score}</span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>

          {data.pillar_topics && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">🏛️ Content Pillars</h4>
              <div className="flex flex-wrap gap-2">
                {data.pillar_topics.map((t: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}

          {data.content_gaps && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🔍 Content Gaps</h4>
              <div className="space-y-2">
                {data.content_gaps.map((g: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <span className="text-sm text-foreground">{g.gap}</span>
                    <div className="flex gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.priority === "high" ? "bg-destructive/20 text-destructive" : g.priority === "medium" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"}`}>{g.priority}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{g.effort}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.content_calendar && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">📅 4-Week Content Calendar</h4>
              <div className="space-y-3">
                {data.content_calendar.map((w: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">Week {w.week}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{w.platform}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{w.topic}</p>
                    <p className="text-xs text-muted-foreground">{w.type} • Goal: {w.goal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default AuditStep;
