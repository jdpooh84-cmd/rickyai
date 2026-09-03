import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, AlertCircle } from "lucide-react";

interface PhoneSettings {
  id?: string;
  business_id: string;
  phone_mode: string;
  ai_number: string;
  fallback_number: string;
  after_hours_start: string;
  after_hours_end: string;
  greeting_message: string;
  business_personality: string;
}

interface Props { businessId: string | null; }

const MODES = [
  { value: "always_ai", label: "Always AI", desc: "Ricky answers every call" },
  { value: "after_hours", label: "After Hours", desc: "Ricky answers outside your business hours" },
  { value: "overflow", label: "Overflow", desc: "Ricky answers when you can't pick up" },
  { value: "disabled", label: "Disabled", desc: "Calls go straight to your fallback number" },
];

const PERSONALITIES = ["professional", "friendly", "formal", "casual"];

export default function ReceptionSetup({ businessId }: Props) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<PhoneSettings>>({
    phone_mode: "disabled",
    ai_number: "",
    fallback_number: "",
    after_hours_start: "17:00",
    after_hours_end: "09:00",
    greeting_message: "Thank you for calling! How can I help you today?",
    business_personality: "friendly",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("phone_settings").select("*").eq("business_id", businessId).maybeSingle();
    if (data) setSettings(data);
  };

  useEffect(() => { load(); }, [businessId]);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    const payload = { ...settings, business_id: businessId };
    const { error } = settings.id
      ? await supabase.from("phone_settings").update(payload).eq("id", settings.id)
      : await supabase.from("phone_settings").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Settings saved" });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Reception Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure how Ricky handles your incoming calls</p>
      </div>

      {/* Owner action required */}
      <Card className="glass border-yellow-500/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400 mb-1">OWNER ACTION REQUIRED</p>
              <p className="text-xs text-muted-foreground">
                To enable phone answering, you must:
              </p>
              <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
                <li>Purchase a phone number from Twilio</li>
                <li>Set TWILIO_PHONE_NUMBER, TWILIO_ACCOUNT_SID, and TWILIO_AUTH_TOKEN as Supabase Edge Function secrets</li>
                <li>Configure the Twilio webhook URL to: <code className="bg-secondary px-1 rounded">https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/handle-call</code></li>
                <li>Enter your AI number below and save</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phone Mode */}
      <Card className="glass">
        <CardHeader><CardTitle className="text-foreground flex items-center gap-2"><Phone className="w-4 h-4 text-primary" />Phone Mode</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MODES.map(m => (
              <div
                key={m.value}
                onClick={() => setSettings(p => ({ ...p, phone_mode: m.value }))}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${settings.phone_mode === m.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
              >
                <p className="text-sm font-medium text-foreground">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="glass">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">AI Phone Number (Twilio)</label>
              <Input value={settings.ai_number || ""} onChange={e => setSettings(p => ({ ...p, ai_number: e.target.value }))} placeholder="+15551234567" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fallback Number (your cell / office)</label>
              <Input value={settings.fallback_number || ""} onChange={e => setSettings(p => ({ ...p, fallback_number: e.target.value }))} placeholder="+15559876543" />
            </div>
          </div>

          {(settings.phone_mode === "after_hours") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">After Hours Start</label>
                <Input type="time" value={settings.after_hours_start || "17:00"} onChange={e => setSettings(p => ({ ...p, after_hours_start: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">After Hours End</label>
                <Input type="time" value={settings.after_hours_end || "09:00"} onChange={e => setSettings(p => ({ ...p, after_hours_end: e.target.value }))} />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">AI Greeting Message</label>
            <Textarea value={settings.greeting_message || ""} onChange={e => setSettings(p => ({ ...p, greeting_message: e.target.value }))} rows={3} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Business Personality</label>
            <Select value={settings.business_personality || "friendly"} onValueChange={v => setSettings(p => ({ ...p, business_personality: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONALITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className="w-full">{saving ? "Saving..." : "Save Settings"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
