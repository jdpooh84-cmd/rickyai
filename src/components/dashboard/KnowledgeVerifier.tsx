import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Edit2, Globe, Loader2 } from "lucide-react";

interface Fact {
  id: string;
  type: string;
  subject: string;
  value: Record<string, unknown>;
  confidence: number;
  verification_status: string;
  source_url: string | null;
}

interface Props { businessId: string | null; }

const TYPE_LABELS: Record<string, string> = {
  service: "Services", hour: "Hours", faq: "FAQs", policy: "Policies", service_area: "Service Areas", general: "General",
};

const VS_COLORS: Record<string, string> = {
  unverified: "bg-muted text-muted-foreground",
  owner_verified: "bg-green-500/10 text-green-400",
  owner_corrected: "bg-blue-500/10 text-blue-400",
  owner_supplied: "bg-primary/10 text-primary",
  deprecated: "bg-destructive/10 text-destructive",
};

export default function KnowledgeVerifier({ businessId }: Props) {
  const { toast } = useToast();
  const [facts, setFacts] = useState<Fact[]>([]);
  const [researchUrl, setResearchUrl] = useState("");
  const [researching, setResearching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = async () => {
    if (!businessId) return;
    const { data } = await supabase.from("business_knowledge").select("*").eq("business_id", businessId).order("type");
    setFacts(data || []);
  };

  useEffect(() => { load(); }, [businessId]);

  const verify = async (id: string, status: string, value?: string) => {
    const update: Record<string, unknown> = { verification_status: status, updated_at: new Date().toISOString() };
    if (value !== undefined) update.value = { text: value };
    await supabase.from("business_knowledge").update(update).eq("id", id);
    setEditingId(null);
    load();
  };

  const handleResearch = async () => {
    if (!businessId || !researchUrl) return;
    setResearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("research-website", {
        body: { businessId, url: researchUrl },
      });
      if (res.error) throw res.error;
      toast({ title: "Research complete", description: `Found ${res.data.factsExtracted} facts from ${res.data.pagesFound} pages` });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setResearching(false);
    }
  };

  const byType = Object.keys(TYPE_LABELS).reduce((acc, t) => {
    acc[t] = facts.filter(f => f.type === t);
    return acc;
  }, {} as Record<string, Fact[]>);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Business Knowledge</h1>
        <p className="text-muted-foreground text-sm mt-1">Facts Ricky knows about your business. Verify, correct, or deprecate each one.</p>
      </div>

      {/* Research box */}
      <Card className="glass border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Research My Website</p>
          <div className="flex gap-2">
            <Input placeholder="https://yourbusiness.com" value={researchUrl} onChange={e => setResearchUrl(e.target.value)} />
            <Button onClick={handleResearch} disabled={researching || !researchUrl}>
              {researching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Researching...</> : "Research"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Ricky will visit your website and extract business facts automatically.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="service">
        <TabsList className="flex-wrap">
          {Object.entries(TYPE_LABELS).map(([t, l]) => (
            <TabsTrigger key={t} value={t}>{l} ({byType[t]?.length || 0})</TabsTrigger>
          ))}
        </TabsList>
        {Object.entries(TYPE_LABELS).map(([t, l]) => (
          <TabsContent key={t} value={t} className="mt-4 space-y-2">
            {(byType[t] || []).length === 0 && (
              <p className="text-center py-8 text-muted-foreground">No {l.toLowerCase()} facts yet. Research your website to populate them.</p>
            )}
            {(byType[t] || []).map(fact => (
              <Card key={fact.id} className="glass">
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{fact.subject}</p>
                    {editingId === fact.id ? (
                      <Input className="mt-1 text-sm" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus />
                    ) : (
                      <p className="text-sm text-muted-foreground truncate">{String((fact.value as { text?: string })?.text || JSON.stringify(fact.value))}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge className={VS_COLORS[fact.verification_status] || ""}>{fact.verification_status.replace("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">Confidence: {Math.round((fact.confidence || 0) * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {editingId === fact.id ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => verify(fact.id, "owner_corrected", editValue)}><Check className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" title="Verify" onClick={() => verify(fact.id, "owner_verified")}><Check className="w-3 h-3 text-green-400" /></Button>
                        <Button size="sm" variant="ghost" title="Edit" onClick={() => { setEditingId(fact.id); setEditValue(String((fact.value as { text?: string })?.text || "")); }}><Edit2 className="w-3 h-3 text-blue-400" /></Button>
                        <Button size="sm" variant="ghost" title="Deprecate" onClick={() => verify(fact.id, "deprecated")}><X className="w-3 h-3 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
