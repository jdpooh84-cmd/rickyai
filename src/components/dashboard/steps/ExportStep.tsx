import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const ExportStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(10);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Export" description="Content distribution plan — where, when, and how to publish."
      icon="📤" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.distribution_plan?.map((d: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <h4 className="font-semibold text-foreground mb-2">{d.platform}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>📐 {d.format} ({d.dimensions})</span>
                <span>⏰ {d.posting_time}</span>
                <span>📆 {d.frequency}</span>
                <span># {d.hashtag_strategy}</span>
              </div>
            </div>
          ))}

          {data.repurposing_ideas && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">♻️ Repurposing Ideas</h4>
              {data.repurposing_ideas.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-secondary/30">
                  <span className="text-xs text-foreground">{r.original}</span>
                  <span className="text-primary">→</span>
                  <span className="text-xs text-foreground">{r.repurposed_to}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">{r.effort}</span>
                </div>
              ))}
            </div>
          )}

          {data.kpis_to_track && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">📊 KPIs to Track</h4>
              <div className="space-y-2">
                {data.kpis_to_track.map((k: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <span className="text-sm text-foreground">{k.metric}</span>
                    <div className="text-right">
                      <span className="text-xs text-primary font-bold">{k.target}</span>
                      <span className="text-xs text-muted-foreground ml-2">{k.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.tools_recommended && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">🛠️ Recommended Tools</h4>
              {data.tools_recommended.map((t: any, i: number) => (
                <div key={i} className="mb-2">
                  <span className="text-sm text-foreground font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">— {t.purpose} ({t.cost})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default ExportStep;
