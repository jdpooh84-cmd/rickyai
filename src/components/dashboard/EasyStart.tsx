import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Globe, Loader2, Phone, ChevronRight } from "lucide-react";

interface Props {
  businessId: string | null;
  onComplete: () => void;
}

interface DiscoveredInfo {
  services: string[];
  hours: string;
  locations: string[];
  businessName: string;
}

const STEPS = [
  "Website",
  "Learning",
  "Review",
  "Phone",
  "Follow-up",
  "Summary",
  "Ready",
];

export default function EasyStart({ businessId, onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [noWebsite, setNoWebsite] = useState(false);
  const [researching, setResearching] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredInfo | null>(null);
  const [phoneMode, setPhoneMode] = useState("after_hours");
  const [followUpEnabled, setFollowUpEnabled] = useState<boolean | null>(null);
  const [completing, setCompleting] = useState(false);

  const handleResearch = async () => {
    if (!businessId) return;
    if (noWebsite) { setStep(2); return; }
    if (!websiteUrl) return;

    setStep(1);
    setResearching(true);

    try {
      const res = await supabase.functions.invoke("research-website", {
        body: { businessId, url: websiteUrl },
      });

      // Load discovered knowledge
      const { data: knowledge } = await supabase.from("business_knowledge")
        .select("*").eq("business_id", businessId).limit(20);

      const services = (knowledge || []).filter(k => k.type === "service").map(k => (k.value as { text?: string })?.text || k.subject).filter(Boolean);
      const hours = (knowledge || []).find(k => k.type === "hour")?.subject || "Not found";
      const locations = (knowledge || []).filter(k => k.type === "service_area").map(k => k.subject);
      const biz = await supabase.from("businesses").select("business_name").eq("id", businessId).maybeSingle();

      setDiscovered({
        services: services.slice(0, 5),
        hours,
        locations: locations.slice(0, 3),
        businessName: biz.data?.business_name || "Your Business",
      });

      setResearching(false);
      setStep(2);
    } catch (e) {
      setResearching(false);
      toast({ title: "Could not research website", description: "You can add your business info manually", variant: "destructive" });
      setStep(2);
    }
  };

  const handleComplete = async () => {
    if (!businessId) return;
    setCompleting(true);

    // Save phone settings
    await supabase.from("phone_settings").upsert({
      business_id: businessId,
      phone_mode: phoneMode,
      greeting_message: "Thank you for calling! How can I help you today?",
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id" });

    // Mark easystart complete
    await supabase.from("businesses").update({
      easystart_completed: true,
      easystart_step: 8,
    }).eq("id", businessId);

    // Create a welcome lifecycle automation if follow-up enabled
    if (followUpEnabled) {
      const { data: automation } = await supabase.from("lifecycle_automations").insert({
        business_id: businessId,
        name: "No-show Follow-up",
        trigger_event: "call.completed",
        active: true,
      }).select().single();

      if (automation) {
        await supabase.from("lifecycle_steps").insert({
          automation_id: automation.id,
          step_order: 1,
          delay_minutes: 60,
          channel: "sms",
          template: "Hi! We missed connecting after your call. Would you like to schedule a time? Just reply YES and we'll set something up.",
          active: true,
        });
      }
    }

    setCompleting(false);
    setStep(7);
  };

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Getting Ricky ready...</span>
            <span className="text-sm text-primary font-medium">{progressPct}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex gap-1 mt-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
        </div>

        {/* Step 0: Website */}
        {step === 0 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Globe className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-display font-bold text-foreground">What's your business website?</h2>
                <p className="text-sm text-muted-foreground mt-1">Ricky will read your website to learn about your business automatically</p>
              </div>

              {!noWebsite ? (
                <div className="space-y-3">
                  <Input
                    placeholder="https://yourbusiness.com"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleResearch()}
                  />
                  <Button className="w-full" onClick={handleResearch} disabled={!websiteUrl}>
                    Learn About My Business <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                  <button onClick={() => { setNoWebsite(true); setStep(2); }} className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center">
                    I don't have a website →
                  </button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Learning */}
        {step === 1 && (
          <Card className="glass">
            <CardContent className="p-6 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <h2 className="text-xl font-display font-bold text-foreground">Learning about your business...</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                {["Visiting your website", "Finding your services", "Reading your hours", "Identifying your service areas"].map((item, i) => (
                  <div key={item} className={`flex items-center gap-2 justify-center ${researching && i === 1 ? "text-foreground" : ""}`}>
                    {!researching ? <Check className="w-4 h-4 text-green-400" /> : <div className="w-4 h-4 rounded-full border border-muted animate-pulse" />}
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-display font-bold text-foreground">
                {discovered ? "Here's what I learned about your business" : "Let's add your business details"}
              </h2>
              {discovered ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-secondary/20">
                    <p className="text-xs text-muted-foreground">Business Name</p>
                    <p className="text-sm font-medium text-foreground">{discovered.businessName}</p>
                  </div>
                  {discovered.services.length > 0 && (
                    <div className="p-3 rounded-lg bg-secondary/20">
                      <p className="text-xs text-muted-foreground">Services Found</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {discovered.services.map(s => <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {discovered.locations.length > 0 && (
                    <div className="p-3 rounded-lg bg-secondary/20">
                      <p className="text-xs text-muted-foreground">Service Areas</p>
                      <p className="text-sm text-foreground">{discovered.locations.join(", ")}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">You can add your business details in the Knowledge Verifier after setup is complete.</p>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => setStep(4)}>
                  {discovered ? "Looks Right →" : "Continue →"}
                </Button>
                {discovered && (
                  <Button variant="outline" onClick={() => setStep(3)}>Make Changes</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Knowledge editor (simplified) */}
        {step === 3 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-display font-bold text-foreground">Make Changes</h2>
              <p className="text-sm text-muted-foreground">You can edit your business knowledge in detail from the Knowledge Verifier section in the sidebar after setup. For now, click Continue to proceed.</p>
              <Button className="w-full" onClick={() => setStep(4)}>Continue →</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Phone mode */}
        {step === 4 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <div className="text-center">
                <Phone className="w-10 h-10 mx-auto mb-2 text-primary" />
                <h2 className="text-xl font-display font-bold text-foreground">Set up your phone answering</h2>
                <p className="text-sm text-muted-foreground mt-1">How should Ricky handle incoming calls?</p>
              </div>
              <div className="space-y-2">
                {[
                  { value: "always_ai", label: "Always answer", desc: "Ricky answers every call" },
                  { value: "after_hours", label: "After hours only", desc: "Ricky covers nights and weekends" },
                  { value: "overflow", label: "When you're busy", desc: "Ricky picks up when you can't" },
                  { value: "disabled", label: "Not now", desc: "Skip phone setup for now" },
                ].map(m => (
                  <div
                    key={m.value}
                    onClick={() => setPhoneMode(m.value)}
                    className={`p-3 rounded-lg border cursor-pointer ${phoneMode === m.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <p className="text-sm font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(5)}>Continue →</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Follow-up */}
        {step === 5 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-display font-bold text-foreground">Automatic follow-ups</h2>
              <p className="text-sm text-muted-foreground">If someone calls but doesn't schedule, should Ricky automatically follow up with them?</p>
              <div className="space-y-2">
                {[
                  { value: true, label: "Yes, follow up automatically", desc: "Ricky sends a friendly text 1 hour after missed calls" },
                  { value: false, label: "No, I'll handle it", desc: "You decide when and how to follow up" },
                  { value: null, label: "Not sure yet", desc: "You can set this up later in Automations" },
                ].map(opt => (
                  <div
                    key={String(opt.value)}
                    onClick={() => setFollowUpEnabled(opt.value)}
                    className={`p-3 rounded-lg border cursor-pointer ${followUpEnabled === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <p className="text-sm font-medium text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(6)} disabled={followUpEnabled === undefined}>Continue →</Button>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Summary checklist */}
        {step === 6 && (
          <Card className="glass">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-display font-bold text-foreground">Almost ready!</h2>
              <p className="text-sm text-muted-foreground">Here's what we're setting up for you:</p>
              <div className="space-y-2">
                {[
                  { done: true, label: "Business profile created" },
                  { done: !noWebsite && !!discovered, label: "Website research complete", pending: noWebsite, pendingLabel: "Add manually via Knowledge Verifier" },
                  { done: phoneMode !== "disabled", label: `Phone mode: ${phoneMode.replace(/_/g, " ")}`, pending: phoneMode === "disabled", pendingLabel: "Phone answering disabled" },
                  { done: !!followUpEnabled, label: "Automatic follow-up enabled", pending: !followUpEnabled, pendingLabel: "Manual follow-up" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    {item.done ? <Check className="w-4 h-4 text-green-400" /> : <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />}
                    <span className={`text-sm ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.done ? item.label : (item.pendingLabel || item.label)}
                    </span>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={handleComplete} disabled={completing}>
                {completing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Setting up...</> : "Activate Ricky →"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Ricky is ready */}
        {step === 7 && (
          <Card className="glass border-primary/30">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto">
                <span className="text-2xl font-bold text-primary-foreground">R</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">Ricky is ready!</h2>
              <p className="text-sm text-muted-foreground">
                Your AI growth operating system is active. Ricky will start working to fill your calendar, recover leads, and grow your business — all with your approval.
              </p>
              <div className="grid grid-cols-3 gap-3 py-2">
                {["Fill your calendar", "Follow up on leads", "Track your growth"].map(item => (
                  <div key={item} className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs text-primary font-medium">{item}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full text-base py-5" onClick={onComplete}>
                Enter My Dashboard →
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
