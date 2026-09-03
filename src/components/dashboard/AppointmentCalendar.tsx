import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, ChevronLeft, ChevronRight, Clock, CheckCircle, Loader2 } from "lucide-react";

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

interface AppointmentType {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

interface Slot {
  start: string;
  end: string;
  available: boolean;
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

type BookingStep = "select" | "slots" | "confirm" | "success";

// ─── BookingFlow ──────────────────────────────────────────────────────────────

function BookingFlow({
  businessId,
  onBooked,
}: {
  businessId: string;
  onBooked: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<BookingStep>("select");
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [holdId, setHoldId] = useState("");
  const [holdExpiry, setHoldExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(600); // seconds
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", notes: "" });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [bookedId, setBookedId] = useState("");

  // Load appointment types
  useEffect(() => {
    supabase
      .from("appointment_types")
      .select("id, name, duration_minutes, price_cents")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name")
      .then(({ data }) => setApptTypes(data ?? []));
  }, [businessId]);

  // Countdown timer for hold
  useEffect(() => {
    if (step !== "confirm" || !holdExpiry) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((holdExpiry.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        toast({ title: "Hold expired", description: "Your slot reservation expired. Please select again.", variant: "destructive" });
        setStep("slots");
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => clearInterval(countdownRef.current!);
  }, [step, holdExpiry]);

  const loadSlots = async () => {
    if (!selectedTypeId || !selectedDate) return;
    setLoadingSlots(true);
    try {
      const { data, error } = await supabase.functions.invoke("book-appointment", {
        body: { action: "get_availability", businessId, appointmentTypeId: selectedTypeId, date: selectedDate },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setSlots(data.slots ?? []);
      setStep("slots");
    } catch (e: unknown) {
      toast({ title: "Error loading slots", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoadingSlots(false);
    }
  };

  const holdSlot = async (slot: Slot) => {
    setHoldLoading(true);
    setSelectedSlot(slot);
    try {
      const { data, error } = await supabase.functions.invoke("book-appointment", {
        body: { action: "hold_slot", businessId, appointmentTypeId: selectedTypeId, start: slot.start },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (!data.held) {
        toast({ title: "Slot unavailable", description: "That slot was just taken. Please choose another.", variant: "destructive" });
        // Reload slots
        setStep("slots");
        loadSlots();
        return;
      }
      setHoldId(data.holdId);
      setHoldExpiry(new Date(data.expiresAt));
      setStep("confirm");
    } catch (e: unknown) {
      toast({ title: "Error reserving slot", description: (e as Error).message, variant: "destructive" });
    } finally {
      setHoldLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!form.firstName || !form.phone) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    setConfirmLoading(true);
    try {
      // Upsert contact first
      const { data: contactData, error: contactErr } = await supabase
        .from("contacts")
        .upsert(
          { business_id: businessId, first_name: form.firstName, last_name: form.lastName, phone: form.phone },
          { onConflict: "business_id,phone", ignoreDuplicates: false }
        )
        .select("id")
        .single();
      if (contactErr || !contactData) throw new Error(contactErr?.message || "Failed to save contact");

      const { data, error } = await supabase.functions.invoke("book-appointment", {
        body: {
          action: "confirm_booking",
          businessId,
          holdId,
          contactId: contactData.id,
          notes: form.notes,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      if (!data.booked) {
        const msg = data.reason === "hold_expired"
          ? "Your hold expired. Please start over."
          : "Booking failed. Please try again.";
        toast({ title: "Booking failed", description: msg, variant: "destructive" });
        setStep("select");
        return;
      }
      setBookedId(data.appointmentId);
      setStep("success");
      onBooked();
    } catch (e: unknown) {
      toast({ title: "Error confirming booking", description: (e as Error).message, variant: "destructive" });
    } finally {
      setConfirmLoading(false);
    }
  };

  const reset = () => {
    setStep("select");
    setSelectedTypeId("");
    setSelectedDate("");
    setSlots([]);
    setSelectedSlot(null);
    setHoldId("");
    setHoldExpiry(null);
    setForm({ firstName: "", lastName: "", phone: "", notes: "" });
    setBookedId("");
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4 text-primary" /> Book an Appointment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ── Step 1: Select type + date ── */}
        {step === "select" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Appointment Type</label>
              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {apptTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.duration_minutes} min)
                      {t.price_cents > 0 ? ` — $${(t.price_cents / 100).toFixed(2)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {apptTypes.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No appointment types configured for this business.</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!selectedTypeId || !selectedDate || loadingSlots}
              onClick={loadSlots}
            >
              {loadingSlots ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Check Availability
            </Button>
          </div>
        )}

        {/* ── Step 2: Slot picker ── */}
        {step === "slots" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground font-medium">
                Available slots for {selectedDate}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setStep("select")}>
                Back
              </Button>
            </div>
            {slots.filter((s) => s.available).length === 0 && (
              <p className="text-sm text-muted-foreground">No available slots for this day.</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <Button
                  key={slot.start}
                  size="sm"
                  variant={slot.available ? "outline" : "ghost"}
                  disabled={!slot.available || holdLoading}
                  className={!slot.available ? "opacity-30 cursor-not-allowed line-through" : ""}
                  onClick={() => holdSlot(slot)}
                >
                  {holdLoading && selectedSlot?.start === slot.start
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : formatTime(slot.start)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Contact form + countdown ── */}
        {step === "confirm" && selectedSlot && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatTime(selectedSlot.start)} — {formatTime(selectedSlot.end)}
                </p>
                <p className="text-xs text-muted-foreground">{selectedDate}</p>
              </div>
              <div className={`text-sm font-mono font-bold ${countdown < 60 ? "text-destructive" : "text-yellow-400"}`}>
                {formatCountdown(countdown)} remaining
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">First Name *</label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Last Name</label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep("slots")}>
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={confirmLoading}
                onClick={confirmBooking}
              >
                {confirmLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm Booking
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Success ── */}
        {step === "success" && (
          <div className="text-center space-y-3 py-2">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Appointment Booked!</p>
              {selectedSlot && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedDate} at {formatTime(selectedSlot.start)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">ID: {bookedId.slice(0, 8)}…</p>
            </div>
            <Button size="sm" variant="outline" onClick={reset}>
              Book Another
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

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

      {/* Booking flow — shown only when businessId is available */}
      {businessId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <BookingFlow businessId={businessId} onBooked={load} />
          </div>
          {/* Today's appointments */}
          <div className="lg:col-span-2">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <Clock className="w-4 h-4 text-primary" /> Today's Appointments
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
      )}

      {/* Calendar grid */}
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
