import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, Plus, Check, AlertCircle } from "lucide-react";

interface Offer {
  id: string; name: string; type: string; value: number;
  approval_status: string; active: boolean; created_at: string;
  valid_from: string | null; valid_until: string | null;
}

interface Props { businessId: string | null; }

const APPROVAL_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-green-500/10 text-green-400",
  rejected: "bg-destructive/10 text-destructive",
};

const OFFER_TYPES = ["percentage", "fixed_amount", "free_estimate", "free_addon", "priority_booking"];

export default function OffersManager({ businessId }: Props) {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "percentage", value: 10, valid_from: "", valid_until: "", redemption_limit: "" });

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("offers").select("*").eq("business_id", businessId).order("created_at", { ascending: false });
    setOffers(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const createOffer = async () => {
    if (!businessId || !form.name) return;
    const { error } = await supabase.from("offers").insert({
      business_id: businessId,
      name: form.name,
      type: form.type,
      value: form.value,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      redemption_limit: form.redemption_limit ? +form.redemption_limit : null,
      approval_status: "pending",
      active: false,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Offer created", description: "Pending your approval before Ricky can present it" });
    setShowAdd(false);
    setForm({ name: "", type: "percentage", value: 10, valid_from: "", valid_until: "", redemption_limit: "" });
    load();
  };

  const approve = async (id: string) => {
    await supabase.from("offers").update({ approval_status: "approved", active: true }).eq("id", id);
    toast({ title: "Offer approved" });
    load();
  };

  const deactivate = async (id: string) => {
    await supabase.from("offers").update({ active: false, approval_status: "rejected" }).eq("id", id);
    load();
  };

  const formatValue = (o: Offer) => {
    if (o.type === "percentage") return `${o.value}% off`;
    if (o.type === "fixed_amount") return `$${o.value} off`;
    return o.type.replace(/_/g, " ");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Offers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage promotional offers Ricky can present to customers</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus className="w-4 h-4" />Create Offer</Button>
      </div>

      <Card className="glass border-yellow-500/20">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Offers require your approval before Ricky can present them to customers. Review and approve each offer below.</p>
        </CardContent>
      </Card>

      {offers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No offers yet. Create your first promotional offer.</p>
        </div>
      )}

      <div className="space-y-3">
        {offers.map(o => (
          <Card key={o.id} className="glass">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{o.name}</p>
                  <Badge className={APPROVAL_COLORS[o.approval_status]}>{o.approval_status}</Badge>
                  {o.active && <Badge className="bg-green-500/10 text-green-400">Active</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{formatValue(o)}</p>
                {(o.valid_from || o.valid_until) && (
                  <p className="text-xs text-muted-foreground">
                    {o.valid_from && `From ${new Date(o.valid_from).toLocaleDateString()}`}
                    {o.valid_until && ` · Until ${new Date(o.valid_until).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {o.approval_status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => approve(o.id)} className="gap-1 text-green-400 border-green-500/20">
                    <Check className="w-3 h-3" />Approve
                  </Button>
                )}
                {o.active && (
                  <Button size="sm" variant="ghost" onClick={() => deactivate(o.id)} className="text-destructive">Deactivate</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Offer</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Offer name (e.g. New Customer 10% Off)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OFFER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {["percentage", "fixed_amount"].includes(form.type) && (
                <div>
                  <label className="text-xs text-muted-foreground">Value ({form.type === "percentage" ? "%" : "$"})</label>
                  <Input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: +e.target.value }))} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Valid From (optional)</label>
                <Input type="date" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valid Until (optional)</label>
                <Input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max Redemptions (leave blank for unlimited)</label>
              <Input type="number" value={form.redemption_limit} onChange={e => setForm(p => ({ ...p, redemption_limit: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={createOffer}>Create (Pending Approval)</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
