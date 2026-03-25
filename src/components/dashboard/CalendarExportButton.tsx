import { CalendarDays, Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICS, downloadICS, actionPlanToEvents } from "@/lib/calendar";
import { toast } from "sonner";

interface CalendarExportButtonProps {
  actionItems: any[];
  businessName?: string;
  stepName?: string;
}

const CalendarExportButton = ({ actionItems, businessName, stepName }: CalendarExportButtonProps) => {
  if (!actionItems || actionItems.length === 0) return null;

  const handleExportICS = () => {
    try {
      const events = actionPlanToEvents(actionItems, businessName);
      const ics = generateICS(events, `RickyAI - ${stepName || "Action Plan"}`);
      downloadICS(ics, `rickyai-${(stepName || "action-plan").toLowerCase().replace(/\s+/g, "-")}.ics`);
      toast.success("Calendar file downloaded! Works with Apple Calendar, Google Calendar, Outlook, and any calendar app.", {
        duration: 5000,
      });
    } catch {
      toast.error("Failed to generate calendar file");
    }
  };

  return (
    <div className="space-y-2 mt-4">
      <Button variant="outline" size="sm" onClick={handleExportICS} className="gap-2">
        <Download className="w-3.5 h-3.5" />
        Download Calendar File (.ics)
      </Button>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
        <CalendarDays className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Works with all calendar apps:</p>
          <p>📱 <strong>iPhone/iPad:</strong> Open the .ics file → it auto-imports into Apple Calendar</p>
          <p>📧 <strong>Google Calendar:</strong> Go to Google Calendar → Settings → Import → select the .ics file</p>
          <p>💼 <strong>Outlook/Microsoft 365:</strong> Open the .ics file → it auto-imports into Outlook Calendar</p>
          <p><Smartphone className="w-3 h-3 inline" /> <strong>Android:</strong> Open the .ics file → choose your calendar app</p>
        </div>
      </div>
    </div>
  );
};

export default CalendarExportButton;
