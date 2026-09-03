import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, Clock } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailRule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}

interface ApptType {
  id?: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  description: string;
  color: string;
}

interface Props { businessId: string | null; locationId: string | null; }

export default function SchedulingSetup({ businessId, locationId }: Props) {
  const { toast } = useToast();
  const [rules, setRules] = useState<AvailRule[]>([]);
  const [apptTypes, setApptTypes] = useState<ApptType[]>([]);
  const [newType, setNewType] = useState<ApptType>({ name: "", duration_minutes: 60, price_cents: 0, description: "", color: "#6366f1" });
  const [showAddType, setShowAddType] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const [{ data: r }, { data: t }] = await Promise.all([
      supabase.from("availability_rules").select("*").eq("business_id", businessId).order("day_of_week"),
      supabase.from("appointment_types").select("*").eq("business_id", businessId).order("name"),
    ]);
    setRules(r || []);
    setApptTypes(t || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const toggleDay = async (day: number) => {
    const existing = rules.find(r => r.day_of_week === day);
    if (existing?.id) {
      await supabase.from("availability_rules").update({ active: !existing.active }).eq("id", existing.id);
    } else {
      await supabase.from("availability_rules").insert({
        business_id: businessId,
        location_id: locationId,
        day_of_week: day,
        start_time: "09:00",
        end_time: "17:00",
        active: true,
      });
    }
    load();
  };

  const updateTime = async (id: string, field: "start_time" | "end_time", value: string) => {
    await supabase.from("availability_rules").update({ [field]: value }).eq("id", id);
    load();
  };

  const addApptType = async () => {
    if (!businessId || !newType.name) return;
    const { error } = await supabase.from("appointment_types").insert({ ...newType, business_id: businessId });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Appointment type added" });
    setNewType({ name: "", duration_minutes: 60, price_cents: 0, description: "", color: "#6366f1" });
    setShowAddType(false);
    load();
  };

  const deleteType = async (id: string) => {
    await supabase.from("appointment_types").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Scheduling Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">Set your business hours and appointment types</p>
      </div>

      {/* Business Hours */}
      <Card className="glass">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Business Hours</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day, i) => {
            const rule = rules.find(r => r.day_of_week === i);
            const isActive = rule?.active;
            return (
              <div key={day} className="flex items-center gap-3">
                <Switch checked={!!isActive} onCheckedChange={() => toggleDay(i)} />
                <span className="w-24 text-sm text-foreground font-medium">{day}</span>
                {isActive && rule?.id ? (
                  <div className="flex gap-2 items-center">
                    <Input type="time" value={rule.start_time} onChange={e => updateTime(rule.id!, "start_time", e.target.value)} className="w-32" />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input type="time" value={rule.end_time} onChange={e => updateTime(rule.id!, "end_time", e.target.value)} className="w-32" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{isActive ? "Setting up..." : "Closed"}</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Appointment Types */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Appointment Types</CardTitle>
            <Button size="sm" onClick={() => setShowAddType(true)} className="gap-1"><Plus className="w-3 h-3" />Add Type</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {apptTypes.length === 0 && <p className="text-sm text-muted-foreground">No appointment types yet. Add one to start booking.</p>}
          {apptTypes.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.duration_minutes} min · ${(t.price_cents / 100).toFixed(0)}</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteType(t.id!)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
            </div>
          ))}

          {showAddType && (
            <div className="space-y-2 p-3 rounded-lg border border-border">
              <Input placeholder="Type name (e.g. Initial Consultation)" value={newType.name} onChange={e => setNewType(p => ({ ...p, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Duration (min)</label>
                  <Input type="number" value={newType.duration_minutes} onChange={e => setNewType(p => ({ ...p, duration_minutes: +e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Price ($)</label>
                  <Input type="number" value={newType.price_cents / 100} onChange={e => setNewType(p => ({ ...p, price_cents: Math.round(+e.target.value * 100) }))} />
                </div>
              </div>
              <Input placeholder="Description" value={newType.description} onChange={e => setNewType(p => ({ ...p, description: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" onClick={addApptType}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddType(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar */}
      <Card className="glass border-yellow-500/20">
        <CardContent className="p-4">
          <p className="font-medium text-foreground mb-1">Google Calendar Integration</p>
          <p className="text-sm text-muted-foreground mb-3">Connect your Google Calendar to sync appointments automatically.</p>
          <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-xs text-yellow-400">OWNER ACTION REQUIRED: Set up a Google OAuth app and configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Supabase secrets. Then the Connect button will enable two-way sync.</p>
          </div>
          <Button variant="outline" className="mt-3" disabled>Connect Google Calendar (Setup Required)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
