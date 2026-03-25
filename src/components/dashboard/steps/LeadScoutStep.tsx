import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const LeadScoutStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(11);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Lead Scout" description="Find leads, referral partners, and growth opportunities."
      icon="👥" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.lead_sources?.map((s: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{s.source}</h4>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.type}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.potential === "high" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{s.potential} potential</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">~{s.estimated_leads_per_month} leads/mo</p>
              {s.action_steps?.map((a: string, j: number) => <p key={j} className="text-xs text-secondary-foreground">→ {a}</p>)}
            </div>
          ))}

          {data.referral_partners && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-accent mb-3">🤝 Referral Partners</h4>
              {data.referral_partners.map((p: any, i: number) => (
                <div key={i} className="mb-4 p-3 rounded-lg bg-secondary/30">
                  <p className="text-sm font-medium text-foreground">{p.business_type}</p>
                  <p className="text-xs text-muted-foreground mb-1">{p.partnership_idea}</p>
                  <p className="text-xs text-primary">💬 "{p.approach_script}"</p>
                  <p className="text-xs text-accent mt-1">🎯 {p.mutual_benefit}</p>
                </div>
              ))}
            </div>
          )}

          {data.lead_magnet_ideas && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">🧲 Lead Magnet Ideas</h4>
              {data.lead_magnet_ideas.map((m: any, i: number) => (
                <div key={i} className="mb-2 p-2 rounded-lg bg-secondary/30">
                  <span className="text-sm text-foreground font-medium">{m.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-2">{m.type}</span>
                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default LeadScoutStep;
