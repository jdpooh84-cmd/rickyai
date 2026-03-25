import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import CalendarExportButton from "@/components/dashboard/CalendarExportButton";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const GrantSearchStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(12);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Grant Search" description="Find grants, funding, and alternative capital for your business."
      icon="💰" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.funding_readiness_score !== undefined && (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">Funding Readiness</p>
              <span className="text-5xl font-bold font-display text-primary">{data.funding_readiness_score}</span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
          )}

          {data.grants?.map((g: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{g.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.difficulty === "easy" ? "bg-primary/10 text-primary" : g.difficulty === "competitive" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{g.difficulty}</span>
              </div>
              <p className="text-lg font-bold text-primary mb-1">{g.amount}</p>
              <p className="text-xs text-muted-foreground mb-1">{g.eligibility}</p>
              <p className="text-xs text-muted-foreground">📅 Deadline: {g.deadline}</p>
              <p className="text-xs text-accent mt-2">💡 {g.tips}</p>
            </div>
          ))}

          {data.alternative_funding && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🔄 Alternative Funding</h4>
              {data.alternative_funding.map((f: any, i: number) => (
                <div key={i} className="mb-3 p-3 rounded-lg bg-secondary/30">
                  <p className="text-sm font-medium text-foreground">{f.type}</p>
                  <p className="text-xs text-muted-foreground mb-1">{f.description}</p>
                  <p className="text-xs text-primary">Best for: {f.best_for}</p>
                </div>
              ))}
            </div>
          )}

          {data.preparation_steps && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">📝 Preparation Steps</h4>
              {data.preparation_steps.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className="text-xs font-bold text-primary">{i + 1}.</span>
                  <p className="text-sm text-secondary-foreground">{s}</p>
                </div>
              ))}
              <CalendarExportButton
                actionItems={data.preparation_steps.map((s: string, i: number) => ({ action: s, timeframe: "this month" }))}
                stepName="Grant Preparation"
              />
            </div>
          )}

          {data.grants && data.grants.length > 0 && (
            <CalendarExportButton
              actionItems={data.grants.map((g: any) => ({ action: `Apply: ${g.name} (${g.amount})`, timeframe: g.deadline, description: g.eligibility }))}
              stepName="Grant Deadlines"
            />
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default GrantSearchStep;
