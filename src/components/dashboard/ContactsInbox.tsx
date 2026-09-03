import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, Search, Phone, Mail, UserCheck } from "lucide-react";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone_e164: string | null;
  email: string | null;
  customer_status: string;
  sms_consent_status: string;
  do_not_contact: boolean;
  created_at: string;
}

interface Lead {
  id: string;
  status: string;
  service_interest: string | null;
  urgency: string;
  estimated_value: number | null;
  created_at: string;
  contacts: { first_name: string | null; last_name: string | null } | null;
}

interface Props {
  businessId: string | null;
  locationId: string | null;
}

const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "disqualified", "lost"];
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400",
  contacted: "bg-yellow-500/10 text-yellow-400",
  qualified: "bg-green-500/10 text-green-400",
  converted: "bg-primary/10 text-primary",
  disqualified: "bg-muted text-muted-foreground",
  lost: "bg-destructive/10 text-destructive",
};

const CUSTOMER_STATUS_COLORS: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  lead: "bg-blue-500/10 text-blue-400",
  customer: "bg-green-500/10 text-green-400",
  inactive: "bg-yellow-500/10 text-yellow-400",
  lost: "bg-destructive/10 text-destructive",
};

export default function ContactsInbox({ businessId, locationId }: Props) {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: "", last_name: "", phone_e164: "", email: "", customer_status: "prospect" });

  const loadData = async () => {
    if (!businessId) return;
    setLoading(true);
    const [{ data: c }, { data: l }] = await Promise.all([
      supabase.from("contacts").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      supabase.from("leads").select("*, contacts(first_name, last_name)").eq("business_id", businessId).order("created_at", { ascending: false }),
    ]);
    setContacts(c || []);
    setLeads(l || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [businessId]);

  const handleAddContact = async () => {
    if (!businessId || !newContact.first_name) return;
    const { error } = await supabase.from("contacts").insert({
      ...newContact,
      business_id: businessId,
      location_id: locationId,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Contact added" });
    setShowAdd(false);
    setNewContact({ first_name: "", last_name: "", phone_e164: "", email: "", customer_status: "prospect" });
    loadData();
  };

  const filtered = contacts.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email} ${c.phone_e164}`.toLowerCase().includes(search.toLowerCase())
  );

  const leadsByStatus = LEAD_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s);
    return acc;
  }, {} as Record<string, Lead[]>);

  const stats = {
    total: contacts.length,
    customers: contacts.filter(c => c.customer_status === "customer").length,
    leads: leads.filter(l => l.status === "new").length,
    dnc: contacts.filter(c => c.do_not_contact).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Contacts & Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your contacts and lead pipeline</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contacts", value: stats.total, icon: Users },
          { label: "Customers", value: stats.customers, icon: UserCheck },
          { label: "New Leads", value: stats.leads, icon: Users },
          { label: "Do Not Contact", value: stats.dnc, icon: Phone },
        ].map(s => (
          <Card key={s.label} className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="leads">Lead Pipeline ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            {filtered.length === 0 && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                No contacts yet. Add your first contact to get started.
              </div>
            )}
            {filtered.map(c => (
              <Card key={c.id} className="glass">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                      {(c.first_name?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{c.first_name} {c.last_name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {c.phone_e164 && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone_e164}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {c.do_not_contact && <Badge variant="destructive">DNC</Badge>}
                    <Badge className={CUSTOMER_STATUS_COLORS[c.customer_status] || ""}>{c.customer_status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {["new", "contacted", "qualified"].map(status => (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground capitalize">{status}</h3>
                  <Badge className={STATUS_COLORS[status]}>{leadsByStatus[status]?.length || 0}</Badge>
                </div>
                {(leadsByStatus[status] || []).map(l => (
                  <Card key={l.id} className="glass">
                    <CardContent className="p-3">
                      <p className="font-medium text-sm text-foreground">{l.contacts?.first_name} {l.contacts?.last_name}</p>
                      {l.service_interest && <p className="text-xs text-muted-foreground">{l.service_interest}</p>}
                      {l.estimated_value && <p className="text-xs text-primary">${l.estimated_value.toLocaleString()}</p>}
                      <Badge className={`mt-1 text-xs ${l.urgency === "emergency" ? "bg-red-500/10 text-red-400" : l.urgency === "high" ? "bg-orange-500/10 text-orange-400" : "bg-muted text-muted-foreground"}`}>
                        {l.urgency}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="First name" value={newContact.first_name} onChange={e => setNewContact(p => ({ ...p, first_name: e.target.value }))} />
              <Input placeholder="Last name" value={newContact.last_name} onChange={e => setNewContact(p => ({ ...p, last_name: e.target.value }))} />
            </div>
            <Input placeholder="Phone (+1...)" value={newContact.phone_e164} onChange={e => setNewContact(p => ({ ...p, phone_e164: e.target.value }))} />
            <Input placeholder="Email" type="email" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} />
            <Select value={newContact.customer_status} onValueChange={v => setNewContact(p => ({ ...p, customer_status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["prospect", "lead", "customer", "inactive"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleAddContact}>Add Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
