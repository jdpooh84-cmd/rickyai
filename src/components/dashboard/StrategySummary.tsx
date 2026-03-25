import { Activity } from "lucide-react";

interface StrategySummaryProps {
  completedSteps?: number[];
  businessName?: string;
  locationName?: string;
}

const StrategySummary = ({ completedSteps = [], businessName, locationName }: StrategySummaryProps) => {
  const progress = Math.round((completedSteps.length / 12) * 100);

  return (
    <div className="w-72 border-l border-border bg-card/50 p-5 overflow-y-auto hidden lg:block">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm text-foreground">Strategy Summary</h3>
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Active Business</p>
          <p className="text-sm text-foreground font-medium">
            {businessName || "No business selected"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Active Location</p>
          <p className="text-sm text-foreground font-medium">
            {locationName || "No location selected"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Visibility Grade</p>
          <p className="text-sm text-foreground font-medium">
            {completedSteps.includes(3) ? "✅ Generated" : "Complete Step 3"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Best Platform</p>
          <p className="text-sm text-foreground font-medium">
            {completedSteps.includes(6) ? "✅ Generated" : "Complete Step 6"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Scripts Ready</p>
          <p className="text-sm text-foreground font-medium">
            {completedSteps.includes(7) ? "✅ Generated" : "Complete Step 7"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Leads & Grants</p>
          <p className="text-sm text-foreground font-medium">
            {completedSteps.includes(11) && completedSteps.includes(12) ? "✅ Generated" : "Complete Steps 11-12"}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Progress</p>
          <div className="w-full bg-secondary rounded-full h-2 mt-1">
            <div className="bg-gradient-hero h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{completedSteps.length} of 12 steps complete</p>
        </div>
      </div>
    </div>
  );
};

export default StrategySummary;
