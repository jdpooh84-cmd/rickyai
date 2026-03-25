import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateICS, downloadICS, actionPlanToEvents, googleCalendarUrl } from "@/lib/calendar";
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
      toast.success("Calendar file downloaded! Import it into Google Calendar, Apple Calendar, or Outlook.");
    } catch {
      toast.error("Failed to generate calendar file");
    }
  };

  const handleOpenGoogle = () => {
    const events = actionPlanToEvents(actionItems, businessName);
    if (events.length > 0) {
      window.open(googleCalendarUrl(events[0]), "_blank");
      toast.info("Opening Google Calendar. For all events, use the .ics download option.");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <Button variant="outline" size="sm" onClick={handleExportICS} className="gap-2">
        <Download className="w-3.5 h-3.5" />
        Export to Calendar (.ics)
      </Button>
      <Button variant="outline" size="sm" onClick={handleOpenGoogle} className="gap-2">
        <CalendarDays className="w-3.5 h-3.5" />
        Add to Google Calendar
      </Button>
    </div>
  );
};

export default CalendarExportButton;
