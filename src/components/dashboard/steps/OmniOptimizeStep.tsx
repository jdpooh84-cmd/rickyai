import { useEffect, useState } from "react";
import { useStrategyStep } from "@/hooks/useStrategyStep";
import StepLayout from "./StepLayout";
import { LAYER_META, OptLayer, detectIndustryMode, INDUSTRY_LABELS } from "@/lib/optimizationLayers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

const AXES = [
  { key: "discoverability", label: "Discoverability", icon: "🔍", desc: "Can people & AI find you?" },
  { key: "comprehension", label: "Comprehension & Trust", icon: "🤝", desc: "Do they understand & trust you?" },
  { key: "conversion", label: "Conversion & Retention", icon: "💰", desc: "Do they take action & come back?" },
  { key: "orchestration", label: "Orchestration & Measurement", icon: "📊", desc: "Are you tracking what matters?" },
];

const ratingColor = (r: string) => {
  if (r === "Strong") return "text-emerald-400 bg-emerald-500/15";
  if (r === "Adequate") return "text-amber-400 bg-amber-500/15";
  return "text-rose-400 bg-rose-500/15";
};

const OmniOptimizeStep = ({ businessId, locationId, onComplete }: Props) => {
  const { data, loading, generate, loadExisting } = useStrategyStep(15);
  const { user } = useAuth();
  const [industryMode, setIndustryMode] = useState("general");

  useEffect(() => {
    if (businessId) loadExisting(businessId);
  }, [businessId]);

  useEffect(() => {
    if (!businessId || !user) return;
    supabase.from("businesses").select("business_category, niche, services").eq("id", businessId).single()
      .then(({ data: biz }) => {
        if (biz) setIndustryMode(detectIndustryMode(biz.business_category, biz.niche, biz.services));
      });
  }, [businessId, user]);

  const handleGenerate = async () => {
    if (!businessId) return;
    const r = await generate(businessId, locationId);
    if (r) onComplete?.();
  };

  return (
    <StepLayout
      title="Omni Optimize"
      description={`Full 12-pillar diagnostic • ${INDUSTRY_LABELS[industryMode as keyof typeof INDUSTRY_LABELS] || "General"} mode`}
      icon="🎯"
      loading={loading}
      hasData={!!data}
      onGenerate={handleGenerate}
      onRegenerate={handleGenerate}
      needsProfile={!businessId}
    >
      {data && (
        <div className="space-y-6">
          {/* Industry badge */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {data.industry_mode_label || INDUSTRY_LABELS[industryMode as keyof typeof INDUSTRY_LABELS]}
            </span>
            {data._fallback && (
              <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs">Template — retry for full analysis</span>
            )}
          </div>

          {/* Executive Brief */}
          {data.executive_brief && (
            <div className="glass rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-foreground mb-2">📋 Executive Brief</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.executive_brief}</p>
            </div>
          )}

          {/* 4-Axis Diagnostic */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AXES.map(axis => {
              const axisData = data.diagnostic?.[axis.key];
              return (
                <div key={axis.key} className="glass rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{axis.icon}</span>
                      <span className="text-sm font-semibold text-foreground">{axis.label}</span>
                    </div>
                    {axisData?.rating && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ratingColor(axisData.rating)}`}>
                        {axisData.rating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{axis.desc}</p>
                  {axisData?.bullets && (
                    <ul className="space-y-1">
                      {axisData.bullets.map((b: string, i: number) => (
                        <li key={i} className="text-xs text-foreground">• {b}</li>
                      ))}
                    </ul>
                  )}
                  {axisData?.top_fix && (
                    <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <span className="text-[10px] text-primary font-bold">TOP FIX:</span>
                      <p className="text-xs text-foreground">{axisData.top_fix}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pillar Scores */}
          {data.pillar_scores && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">📊 12-Pillar Coverage</h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(Object.keys(LAYER_META) as OptLayer[]).map(layer => {
                  const score = data.pillar_scores?.[layer];
                  return (
                    <div key={layer} className="flex flex-col items-center p-2 rounded-lg bg-secondary/30">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${LAYER_META[layer].color}`}>{layer}</span>
                      <span className="text-lg font-bold text-foreground mt-1">{score?.grade || "—"}</span>
                      <span className="text-[10px] text-muted-foreground">{LAYER_META[layer].description}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 90-Day Roadmap */}
          {data.roadmap && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">🗺️ 90-Day Roadmap</h4>
              <div className="space-y-4">
                {[
                  { phase: "Phase 1: Foundation (Days 1-30)", key: "phase1", color: "border-emerald-500/30" },
                  { phase: "Phase 2: Structure (Days 31-60)", key: "phase2", color: "border-amber-500/30" },
                  { phase: "Phase 3: Expansion (Days 61-90)", key: "phase3", color: "border-primary/30" },
                ].map(p => {
                  const phaseData = data.roadmap?.[p.key];
                  if (!phaseData) return null;
                  return (
                    <div key={p.key} className={`p-3 rounded-lg bg-secondary/30 border-l-2 ${p.color}`}>
                      <span className="text-xs font-bold text-foreground">{p.phase}</span>
                      <p className="text-xs text-muted-foreground mt-1">{phaseData.focus}</p>
                      {phaseData.actions && (
                        <ul className="mt-2 space-y-1">
                          {phaseData.actions.map((a: string, i: number) => (
                            <li key={i} className="text-xs text-foreground">✅ {a}</li>
                          ))}
                        </ul>
                      )}
                      {phaseData.kpis && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {phaseData.kpis.map((k: string, i: number) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Wins */}
          {data.quick_wins && data.quick_wins.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">⚡ Quick Wins (24-72 hours)</h4>
              <div className="space-y-2">
                {data.quick_wins.map((w: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5">
                    <span className="text-xs">🏃</span>
                    <span className="text-xs text-foreground">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simple Summary */}
          {data.simple_summary && (
            <div className="glass rounded-2xl p-6 border border-primary/20">
              <h4 className="text-sm font-semibold text-foreground mb-2">💡 What This Means in Simple Terms</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.simple_summary}</p>
            </div>
          )}
        </div>
      )}
    </StepLayout>
  );
};

export default OmniOptimizeStep;
