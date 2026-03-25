import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const VideoStudioStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(8);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Video Studio" description="Your video production plan with ideas, gear, and workflow."
      icon="🎬" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.video_strategy && (
            <div className="glass rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-foreground mb-2">📺 Video Strategy</h4>
              <p className="text-sm text-secondary-foreground">{data.video_strategy}</p>
            </div>
          )}

          {data.video_ideas?.map((v: any, i: number) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground">{v.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${v.difficulty === "easy" ? "bg-primary/10 text-primary" : v.difficulty === "medium" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"}`}>{v.difficulty}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{v.type} • Est. views: {v.estimated_views}</p>
              <p className="text-sm text-secondary-foreground">{v.script_outline}</p>
              {v.equipment && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {v.equipment.map((e: string, j: number) => <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{e}</span>)}
                </div>
              )}
            </div>
          ))}

          {data.equipment_recommendations && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🎥 Equipment</h4>
              {data.equipment_recommendations.map((e: any, i: number) => (
                <div key={i} className="flex items-center justify-between mb-2 p-2 rounded-lg bg-secondary/30">
                  <div>
                    <span className="text-sm text-foreground">{e.item}</span>
                    <span className="text-xs text-muted-foreground ml-2">{e.price_range}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${e.priority === "essential" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{e.priority}</span>
                </div>
              ))}
            </div>
          )}

          {data.filming_tips && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">💡 Filming Tips</h4>
              {data.filming_tips.map((t: string, i: number) => <p key={i} className="text-xs text-secondary-foreground mb-1">• {t}</p>)}
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default VideoStudioStep;
