import { useEffect } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";

interface Props { businessId: string | null; locationId: string | null; onComplete?: () => void; }

const StoryboardStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(9);
  useEffect(() => { if (businessId) loadExisting(businessId); }, [businessId]);
  const handleGenerate = async () => { if (!businessId) return; const r = await generate(businessId, locationId); if (r) onComplete?.(); };

  return (
    <StepLayout title="Storyboard" description="Visual storyboards for your top video concepts."
      icon="🎨" loading={loading} hasData={!!data} onGenerate={handleGenerate} onRegenerate={handleGenerate} needsProfile={!businessId}>
      {data && (
        <div className="space-y-6">
          {data.storyboards?.map((sb: any, i: number) => (
            <div key={i} className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">{sb.title}</h3>
                <span className="text-xs text-muted-foreground">{sb.total_duration} • {sb.mood}</span>
              </div>
              <div className="space-y-3">
                {sb.scenes?.map((scene: any) => (
                  <div key={scene.scene_number} className="p-3 rounded-lg bg-secondary/30 border-l-2 border-primary">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-primary">Scene {scene.scene_number}</span>
                      <span className="text-[10px] text-muted-foreground">{scene.duration}</span>
                    </div>
                    <p className="text-sm text-foreground mb-1">🎥 {scene.visual}</p>
                    <p className="text-xs text-muted-foreground">🔊 {scene.audio}</p>
                    {scene.text_overlay && <p className="text-xs text-accent mt-1">📝 "{scene.text_overlay}"</p>}
                  </div>
                ))}
              </div>
              {sb.color_palette && (
                <div className="mt-3 flex gap-2">
                  {sb.color_palette.map((c: string, j: number) => (
                    <div key={j} className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {data.visual_brand_guidelines && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">🎨 Brand Guidelines</h4>
              <p className="text-sm text-secondary-foreground mb-2">Style: {data.visual_brand_guidelines.style}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-primary font-medium mb-1">✅ Do</p>
                  {data.visual_brand_guidelines.do_list?.map((d: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {d}</p>)}
                </div>
                <div>
                  <p className="text-xs text-destructive font-medium mb-1">❌ Don't</p>
                  {data.visual_brand_guidelines.dont_list?.map((d: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {d}</p>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default StoryboardStep;
