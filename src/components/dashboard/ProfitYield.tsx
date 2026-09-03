import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Plus, Trash2, Loader2, CheckCircle } from "lucide-react";

interface Action {
  type: string; title: string; description: string;
  expectedBookings: number; expectedRevenueCents: number; expectedContribCents: number; confidence: number;
}

interface ServiceEcon {
  id?: string; service_name: string; expected_revenue_cents: number; expected_direct_cost_cents: number;
  expected_labor_hours: number; expected_labor_cost_cents: number; expected_gross_contribution_cents: number;
}

interface Props { businessId: string | null; }

export default function ProfitYield({ businessId }: Props) {
  const { toast } = useToast();
  const [actions, setActions] = useState<Action[]>([]);
  const [services, setServices] = useState<ServiceEcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [approved, setApproved] = useState(false);
  const [form, setForm] = useState<ServiceEcon>({
    service_name: "", expected_revenue_cents: 0, expected_direct_cost_cents: 0,
    expected_labor_hours: 0, expected_labor_cost_cents: 0, expected_gross_contribution_cents: 0,
  });

  const loadServices = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("service_economics").select("*").eq("business_id", businessId);
    setServices(data || []);
  };

  const fetchPlan = async () => {
    if (!businessId) return;
    setLoading(true);
    const res = await supabase.functions.invoke("yield-engine", { body: { businessId } });
    setLoading(false);
    if (res.error) { toast({ title: "Error", description: String(res.error), variant: "destructive" }); return; }
    setActions(res.data.actions || []);
    setApproved(false);
  };

  useEffect(() => { loadServices(); fetchPlan(); }, [businessId]);

  const addService = async () => {
    if (!businessId || !form.service_name) return;
    const contrib = form.expected_revenue_cents - form.expected_direct_cost_cents - form.expected_labor_cost_cents;
    const { error } = await supabase.from("service_economics").insert({
      ...form,
      expected_gross_contribution_cents: contrib,
      business_id: businessId,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Service added" });
    setShowAddService(false);
    setForm({ service_name: "", expected_revenue_cents: 0, expected_direct_cost_cents: 0, expected_labor_hours: 0, expected_labor_cost_cents: 0, expected_gross_contribution_cents: 0 });
    loadServices();
    fetchPlan();
  };

  const deleteService = async (id: string) => {
    await supabase.from("service_economics").delete().eq("id", id);
    loadServices();
  };

  const CONFIDENCE_LABEL = (c: number) => c >= 0.7 ? "High" : c >= 0.5 ? "Medium" : "Low";
  const CONFIDENCE_COLOR = (c: number) => c >= 0.7 ? "bg-green-500/10 text-green-400" : c >= 0.5 ? "bg-yellow-500/10 text-yellow-400" : "bg-muted text-muted-foreground";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Profit Yield Engine</h1>
        <p className="text-muted-foreground text-sm mt-1">What should Ricky focus on this week to maximize profit?</p>
      </div>

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">This Week's Plan</TabsTrigger>
          <TabsTrigger value="services">Service Economics ({services.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Ranked by expected contribution to profit</p>
            <Button variant="outline" size="sm" onClick={fetchPlan} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {loading && <div className="text-center py-8 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Calculating...</div>}

          {!loading && actions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Add service economics and contacts to generate your weekly profit plan.</p>
            </div>
          )}

          {!loading && actions.map((action, i) => (
            <Card key={action.type} className={`glass ${i === 0 ? "border-primary/30" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{i + 1}</span>
                    <p className="font-medium text-foreground">{action.title}</p>
                  </div>
                  <Badge className={CONFIDENCE_COLOR(action.confidence)}>{CONFIDENCE_LABEL(action.confidence)} confidence</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{action.description}</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Expected Bookings", value: action.expectedBookings },
                    { label: "Expected Revenue", value: `$${(action.expectedRevenueCents / 100).toLocaleString()}` },
                    { label: "Expected Contribution", value: `$${(action.expectedContribCents / 100).toLocaleString()}` },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="text-base font-bold text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && actions.length > 0 && (
            <div className="pt-2">
              {approved ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Plan approved — Ricky will begin executing this week's priorities</span>
                </div>
              ) : (
                <Button className="w-full" onClick={() => setApproved(true)}>Approve This Plan</Button>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Enter expected economics for each service to enable profit ranking</p>
            <Button size="sm" onClick={() => setShowAddService(true)}><Plus className="w-3 h-3 mr-1" />Add Service</Button>
          </div>

          {services.map(s => (
            <Card key={s.id} className="glass">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{s.service_name}</p>
                  <div className="grid grid-cols-4 gap-4 mt-2">
                    {[
                      { label: "Revenue", value: `$${(s.expected_revenue_cents / 100).toFixed(0)}` },
                      { label: "Direct Cost", value: `$${(s.expected_direct_cost_cents / 100).toFixed(0)}` },
                      { label: "Labor", value: `${s.expected_labor_hours}h` },
                      { label: "Contribution", value: `$${(s.expected_gross_contribution_cents / 100).toFixed(0)}` },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-xs text-muted-foreground">{f.label}</p>
                        <p className="text-sm font-medium text-foreground">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteService(s.id!)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}

          {services.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No services yet. Add your services and their expected economics.</p>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Service Economics</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Service name (e.g. Furnace Repair)" value={form.service_name} onChange={e => setForm(p => ({ ...p, service_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Expected Revenue ($)</label>
                <Input type="number" value={form.expected_revenue_cents / 100} onChange={e => setForm(p => ({ ...p, expected_revenue_cents: Math.round(+e.target.value * 100) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Direct Costs ($)</label>
                <Input type="number" value={form.expected_direct_cost_cents / 100} onChange={e => setForm(p => ({ ...p, expected_direct_cost_cents: Math.round(+e.target.value * 100) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Labor Hours</label>
                <Input type="number" step="0.5" value={form.expected_labor_hours} onChange={e => setForm(p => ({ ...p, expected_labor_hours: +e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Labor Cost ($)</label>
                <Input type="number" value={form.expected_labor_cost_cents / 100} onChange={e => setForm(p => ({ ...p, expected_labor_cost_cents: Math.round(+e.target.value * 100) }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated contribution: ${((form.expected_revenue_cents - form.expected_direct_cost_cents - form.expected_labor_cost_cents) / 100).toFixed(0)}/job
            </p>
            <Button className="w-full" onClick={addService}>Add Service</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
