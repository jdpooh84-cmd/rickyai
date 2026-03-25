import { Activity } from "lucide-react";

const StrategySummary = () => {
  return (
    <div className="w-72 border-l border-border bg-card/50 p-5 overflow-y-auto hidden lg:block">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-sm text-foreground">Strategy Summary</h3>
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Active Business</p>
          <p className="text-sm text-foreground font-medium">No business selected</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Active Location</p>
          <p className="text-sm text-foreground font-medium">No location selected</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Visibility Grade</p>
          <p className="text-sm text-muted-foreground">Complete Step 3</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Best Platform</p>
          <p className="text-sm text-muted-foreground">Complete Step 6</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border">
          <p className="text-xs text-muted-foreground mb-1">Progress</p>
          <div className="w-full bg-secondary rounded-full h-2 mt-1">
            <div className="bg-gradient-hero h-2 rounded-full" style={{ width: "0%" }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">0 of 12 steps complete</p>
        </div>
      </div>
    </div>
  );
};

export default StrategySummary;
