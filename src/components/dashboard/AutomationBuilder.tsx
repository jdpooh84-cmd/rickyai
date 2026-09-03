import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Plus, Trash2, GripVertical } from "lucide-react";

interface Step { id?: string; step_order: number; delay_minutes: number; channel: string; template: string; active: boolean; }
interface Automation {
  id: string; name: string; trigger_event: string; active: boolean; created_at: string;
  lifecycle_steps?: Step[];
}

interface Props { businessId: string | null; }

const TRIGGERS = [
  "lead.created", "lead.qualified", "call.completed", "appointment.booked",
  "appointment.completed", "appointment.no_show", "offer.redeemed", "contact.inactive_90",
];

export default function AutomationBuilder({ businessId }: Props) {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editAutomation, setEditAutomation] = useState<Automation | null>(null);
  const [form, setForm] = useState({ name: "", trigger_event: "lead.created" });
  const [steps, setSteps] = useState<Step[]>([]);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("lifecycle_automations")
      .select("*, lifecycle_steps(*)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    setAutomations(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const openNew = () => {
    setEditAutomation(null);
    setForm({ name: "", trigger_event: "lead.created" });
    setSteps([{ step_order: 1, delay_minutes: 0, channel: "sms", template: "", active: true }]);
    setShowBuilder(true);
  };

  const openEdit = (a: Automation) => {
    setEditAutomation(a);
    setForm({ name: a.name, trigger_event: a.trigger_event });
    setSteps(a.lifecycle_steps || []);
    setShowBuilder(true);
  };

  const saveAutomation = async () => {
    if (!businessId || !form.name) return;
    let automationId = editAutomation?.id;
    if (!automationId) {
      const { data } = await supabase.from("lifecycle_automations").insert({
        business_id: businessId, name: form.name, trigger_event: form.trigger_event, active: false,
      }).select().single();
      automationId = data?.id;
    } else {
      await supabase.from("lifecycle_automations").update(form).eq("id", automationId);
    }
    if (!automationId) return;

    // Delete old steps, insert new ones
    await supabase.from("lifecycle_steps").delete().eq("automation_id", automationId);
    if (steps.length > 0) {
      await supabase.from("lifecycle_steps").insert(steps.map((s, i) => ({
        automation_id: automationId, step_order: i + 1, delay_minutes: s.delay_minutes,
        channel: s.channel, template: s.template, active: s.active,
      })));
    }

    toast({ title: "Automation saved" });
    setShowBuilder(false);
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("lifecycle_automations").update({ active }).eq("id", id);
    load();
  };

  const addStep = () => {
    setSteps(prev => [...prev, { step_order: prev.length + 1, delay_minutes: 60, channel: "sms", template: "", active: true }]);
  };

  const removeStep = (i: number) => setSteps(prev => prev.filter((_, idx) => idx !== i));
  const updateStep = (i: number, field: string, value: unknown) => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Lifecycle Automations</h1>
          <p className="text-muted-foreground text-sm mt-1">Automated follow-up sequences triggered by events</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />New Automation</Button>
      </div>

      {automations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No automations yet. Create one to automate your follow-ups.</p>
        </div>
      )}

      {automations.map(a => (
        <Card key={a.id} className="glass">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex-1 cursor-pointer" onClick={() => openEdit(a)}>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{a.name}</p>
                <Badge className="text-xs bg-secondary text-muted-foreground">{a.trigger_event}</Badge>
                {a.active && <Badge className="text-xs bg-green-500/10 text-green-400">Active</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{a.lifecycle_steps?.length || 0} steps</p>
            </div>
            <Switch checked={a.active} onCheckedChange={v => toggleActive(a.id, v)} />
          </CardContent>
        </Card>
      ))}

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editAutomation ? "Edit" : "New"} Automation</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <Input placeholder="Automation name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <div>
              <label className="text-xs text-muted-foreground">Trigger Event</label>
              <Select value={form.trigger_event} onValueChange={v => setForm(p => ({ ...p, trigger_event: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Steps</p>
                <Button size="sm" variant="outline" onClick={addStep}><Plus className="w-3 h-3 mr-1" />Add Step</Button>
              </div>
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                      <Button size="sm" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Delay (minutes after trigger)</label>
                        <Input type="number" value={step.delay_minutes} onChange={e => updateStep(i, "delay_minutes", +e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Channel</label>
                        <Select value={step.channel} onValueChange={v => updateStep(i, "channel", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="internal">Internal Note</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Message Template</label>
                      <Textarea value={step.template} onChange={e => updateStep(i, "template", e.target.value)} rows={2} placeholder="Hi {{first_name}}, just following up..." />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveAutomation} className="flex-1">Save Automation</Button>
              <Button variant="ghost" onClick={() => setShowBuilder(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
