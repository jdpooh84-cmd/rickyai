import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const PlatformStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(6);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Platform" description="Find your best platforms and know where to focus your energy."
      icon="📱" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.primary_platform && (
            <div className="glass rounded-2xl p-6 border-primary/30 border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">⭐ #1 Platform</span>
              </div>
              <h3 className="text-xl font-bold font-display text-foreground mb-1">{data.primary_platform.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{data.primary_platform.reason}</p>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>📆 {data.primary_platform.posting_frequency}</span>
                <span>📝 {data.primary_platform.content_types?.join(", ")}</span>
              </div>
            </div>
          )}

          {data.secondary_platforms?.map((p: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-foreground">{p.name}</h4>
                <span className="text-xs text-muted-foreground">Priority #{p.priority}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{p.reason}</p>
              <p className="text-xs text-primary">📆 {p.posting_frequency}</p>
            </div>
          ))}

          {data.platforms_to_avoid?.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-destructive mb-2">🚫 Skip These (For Now)</h4>
              {data.platforms_to_avoid.map((p: any, i: number) => (
                <div key={i} className="mb-2">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Time Investment</p>
              <p className="text-lg font-bold text-foreground">{data.time_investment}</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Results Timeline</p>
              <p className="text-lg font-bold text-foreground">{data.growth_timeline}</p>
            </div>
          </div>
        </div>
      )}
    </StepLayout>
  );
};

export default PlatformStep;
