import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const threatColors = { high: "text-destructive", medium: "text-accent", low: "text-primary" };

const ScoutStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(4);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);

  const handleGenerate = async () => {
    if (!businessId) return;
    const result = await generate(businessId, locationId);
    if (result) onComplete?.();
  };

  return (
    <StepLayout title="Scout" description="Competitive intelligence — know your market landscape."
      icon="🔍" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1">Market Position</p>
            <span className="text-2xl font-bold font-display text-foreground capitalize">{data.market_position}</span>
          </div>

          {data.competitors?.map((c: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-foreground">{c.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${threatColors[c.threat_level as keyof typeof threatColors]} bg-secondary`}>
                  {c.threat_level} threat
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-primary font-medium mb-1">Strengths</p>
                  {c.strengths?.map((s: string, j: number) => <p key={j} className="text-xs text-muted-foreground">+ {s}</p>)}
                </div>
                <div>
                  <p className="text-xs text-destructive font-medium mb-1">Weaknesses</p>
                  {c.weaknesses?.map((w: string, j: number) => <p key={j} className="text-xs text-muted-foreground">− {w}</p>)}
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-primary mb-2">🚀 Opportunities</h4>
              {data.opportunities?.map((o: string, i: number) => <p key={i} className="text-xs text-secondary-foreground mb-1">• {o}</p>)}
            </div>
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-destructive mb-2">⚠️ Threats</h4>
              {data.threats?.map((t: string, i: number) => <p key={i} className="text-xs text-secondary-foreground mb-1">• {t}</p>)}
            </div>
          </div>

          {data.quick_wins && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-accent mb-2">⚡ Quick Wins (This Week)</h4>
              {data.quick_wins.map((q: string, i: number) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className="text-xs font-bold text-accent">{i + 1}.</span>
                  <p className="text-sm text-secondary-foreground">{q}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default ScoutStep;
