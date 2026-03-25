import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const ScriptStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(7);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Script" description="Ready-to-use video and content scripts tailored to your business."
      icon="📝" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.scripts?.map((s: any, i: number) => (
            <div key={i} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-foreground">{s.title}</h3>
                <div className="flex gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s.type}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{s.duration}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs text-accent font-bold mb-1">🎣 HOOK</p>
                  <p className="text-sm text-foreground">{s.hook}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="text-xs text-muted-foreground font-bold mb-1">📄 BODY</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{s.body}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary font-bold mb-1">📢 CTA</p>
                  <p className="text-sm text-foreground">{s.cta}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {s.hashtags?.map((h: string, j: number) => (
                  <span key={j} className="text-xs text-primary">{h}</span>
                ))}
              </div>
              {s.platform && <p className="text-xs text-muted-foreground mt-2">Best for: {s.platform}</p>}
            </div>
          ))}

          {data.content_tips && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">💡 Content Tips</h4>
              {data.content_tips.map((t: string, i: number) => <p key={i} className="text-xs text-secondary-foreground mb-1">• {t}</p>)}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default ScriptStep;
