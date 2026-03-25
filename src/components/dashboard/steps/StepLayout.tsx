import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { ReactNode } from "react";

interface StepLayoutProps {
  title: string;
  description: string;
  icon: string;
  loading: boolean;
  hasData: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  children: ReactNode;
  needsProfile?: boolean;
}

const StepLayout = ({ title, description, icon, loading, hasData, onGenerate, onRegenerate, children, needsProfile }: StepLayoutProps) => {
  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">
          {icon} {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {needsProfile && (
        <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 mb-6">
          <p className="text-sm text-foreground">⚠️ Complete your business profile (Step 2) first for personalized results.</p>
        </div>
      )}

      {!hasData && !loading && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">{icon}</span>
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
          <Button variant="hero" size="lg" onClick={onGenerate} disabled={loading}>
            Generate {title}
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Analyzing your business...</p>
          <p className="text-xs text-muted-foreground/60 mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {hasData && !loading && (
        <>
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="w-3 h-3" /> Regenerate
            </Button>
          </div>
          {children}
        </>
      )}
    </div>
  );
};

export default StepLayout;
