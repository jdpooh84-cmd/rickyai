import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface Appointment {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  staff_name: string | null;
  notes: string | null;
  contacts: { first_name: string | null; last_name: string | null } | null;
  appointment_types: { name: string; color: string } | null;
}

interface Props { businessId: string | null; locationId: string | null; }

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-green-500/10 text-green-400 border-green-500/20",
  requested: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  no_show: "bg-destructive/10 text-destructive",
  rescheduled: "bg-orange-500/10 text-orange-400",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function AppointmentCalendar({ businessId, locationId }: Props) {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [newAppt, setNewAppt] = useState({ start_at: "", end_at: "", notes: "", status: "requested" });

  const load = async () => {
    if (!businessId) return;
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const { data } = await supabase.from("appointments")
      .select("*, contacts(first_name, last_name), appointment_types(name, color)")
      .eq("business_id", businessId)
      .gte("start_at", start)
      .lte("start_at", end)
      .order("start_at");
    setAppointments(data || []);
  };

  useEffect(() => { load(); }, [businessId, currentMonth]);

  const handleAdd = async () => {
    if (!businessId || !newAppt.start_at) return;
    const { error } = await supabase.from("appointments").insert({
      business_id: businessId,
      location_id: locationId,
      ...newAppt,
      end_at: newAppt.end_at || newAppt.start_at,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Appointment added" });
    setShowAdd(false);
    setNewAppt({ start_at: "", end_at: "", notes: "", status: "requested" });
    load();
  };

  // Build calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayAppts = appointments.filter(a => new Date(a.start_at).toDateString() === today.toDateString());

  const stats = {
    thisWeek: appointments.length,
    noShow: appointments.filter(a => a.status === "no_show").length,
    completed: appointments.filter(a => a.status === "completed").length,
  };
  const completionRate = stats.thisWeek > 0 ? Math.round((stats.completed / stats.thisWeek) * 100) : 0;

  const getDateAppts = (day: number) =>
    appointments.filter(a => new Date(a.start_at).getDate() === day && new Date(a.start_at).getMonth() === month);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your booking calendar</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus className="w-4 h-4" />New Appointment</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "This Month", value: stats.thisWeek },
          { label: "Completed", value: stats.completed },
          { label: "No Shows", value: stats.noShow },
          { label: "Completion Rate", value: `${completionRate}%` },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">{MONTHS[month]} {year}</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(d => <div key={d} className="text-xs text-muted-foreground text-center py-1 font-medium">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day = i + 1;
                  const dayAppts = getDateAppts(day);
                  const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                  return (
                    <div key={day} className={`min-h-[60px] p-1 rounded border ${isToday ? "border-primary bg-primary/5" : "border-border/30 hover:border-border"} cursor-pointer`}>
                      <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>{day}</p>
                      {dayAppts.slice(0, 2).map(a => (
                        <div key={a.id} className={`text-[9px] px-1 py-0.5 rounded mb-0.5 truncate ${STATUS_COLORS[a.status] || "bg-muted"}`}>
                          {a.contacts?.first_name || a.appointment_types?.name || "Appt"}
                        </div>
                      ))}
                      {dayAppts.length > 2 && <p className="text-[9px] text-muted-foreground">+{dayAppts.length - 2}</p>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's appointments */}
        <div>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground flex items-center gap-2 text-base">
                <Clock className="w-4 h-4 text-primary" /> Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayAppts.length === 0 && <p className="text-sm text-muted-foreground">No appointments today</p>}
              {todayAppts.map(a => (
                <div key={a.id} className="glass rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground">{a.contacts?.first_name} {a.contacts?.last_name}</p>
                    <Badge className={`text-xs ${STATUS_COLORS[a.status]}`}>{a.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(a.start_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  {a.appointment_types?.name && <p className="text-xs text-muted-foreground">{a.appointment_types.name}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="datetime-local" value={newAppt.start_at} onChange={e => setNewAppt(p => ({ ...p, start_at: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="datetime-local" value={newAppt.end_at} onChange={e => setNewAppt(p => ({ ...p, end_at: e.target.value }))} />
            </div>
            <Select value={newAppt.status} onValueChange={v => setNewAppt(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["requested", "confirmed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Notes" value={newAppt.notes} onChange={e => setNewAppt(p => ({ ...p, notes: e.target.value }))} />
            <Button className="w-full" onClick={handleAdd}>Create Appointment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
