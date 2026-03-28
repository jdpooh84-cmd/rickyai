import { useState } from "react";
import { Building2, FileCheck, Users, FileText, Shield, Loader2, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface IntakeData {
  org_name: string;
  entity_type: string;
  mission: string;
  sam_registered: string;
  uei: string;
  federal_funding_history: string;
  non_federal_experience: string;
  staff_gov_experience: string;
  annual_budget: string;
  timekeeping_system: string;
  accounting_system: string;
  geographic_area: string;
}

const INITIAL_INTAKE: IntakeData = {
  org_name: "",
  entity_type: "",
  mission: "",
  sam_registered: "",
  uei: "",
  federal_funding_history: "",
  non_federal_experience: "",
  staff_gov_experience: "",
  annual_budget: "",
  timekeeping_system: "",
  accounting_system: "",
  geographic_area: "",
};

const PILLAR_ICONS = [Building2, FileCheck, Users, FileText, Shield];
const PILLAR_NAMES = [
  "Entity Readiness & Registration",
  "Capability & Past Performance",
  "Subcontracting & Teaming",
  "Proposal Development & Pipeline",
  "Compliance, Systems & Audit Readiness",
];

interface FederalContractingStepProps {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

const FederalContractingStep = ({ businessId, locationId, onComplete }: FederalContractingStepProps) => {
  const [intake, setIntake] = useState<IntakeData>(INITIAL_INTAKE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [streamText, setStreamText] = useState("");
  const [expandedPillar, setExpandedPillar] = useState<number | null>(null);

  const updateField = (field: keyof IntakeData, value: string) => {
    setIntake(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!intake.org_name || !intake.mission || !intake.entity_type) {
      toast.error("Please fill in at least: Organization Name, Entity Type, and Mission.");
      return;
    }

    setLoading(true);
    setStreamText("");
    setResult(null);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/federal-contracting`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ intake }),
      });

      if (resp.status === 429) {
        toast.error("Rate limit exceeded. Please try again in a moment.");
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Please add funds.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast.error("Failed to start analysis.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setStreamText(fullText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Parse the final markdown into structured result
      setResult({ markdown: fullText });
      toast.success("Federal Contracting Readiness analysis complete!");
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (result || streamText) {
    const displayText = result?.markdown || streamText;

    return (
      <StepLayout
        step={16}
        title="Federal Contracting Readiness"
        description="Your comprehensive government contracting readiness assessment"
        icon={<Building2 className="w-5 h-5 text-primary" />}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {loading ? "Analyzing..." : "Analysis Complete"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setStreamText(""); }}>
              New Analysis
            </Button>
          </div>

          {/* Pillar navigation cards */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            {PILLAR_NAMES.map((name, i) => {
              const Icon = PILLAR_ICONS[i];
              return (
                <button
                  key={i}
                  onClick={() => setExpandedPillar(expandedPillar === i ? null : i)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    expandedPillar === i
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-secondary/50"
                  }`}
                >
                  <Icon className="w-4 h-4 text-primary mb-1" />
                  <p className="text-xs font-medium text-foreground leading-tight">{name}</p>
                </button>
              );
            })}
          </div>

          {/* Full rendered output */}
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-foreground leading-relaxed">
                {displayText}
              </div>
            </CardContent>
          </Card>
        </div>
      </StepLayout>
    );
  }

  return (
    <StepLayout
      step={16}
      title="Federal Contracting Readiness"
      description="AI-powered assessment to transform your organization into a qualified government contractor"
      icon={<Building2 className="w-5 h-5 text-primary" />}
    >
      <div className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Organization Intake
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Fill in as much as you can. Fields left blank will be noted as assumptions in your plan.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Organization Name *</label>
                <Input
                  placeholder="e.g. Community Impact Alliance"
                  value={intake.org_name}
                  onChange={e => updateField("org_name", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Entity Type *</label>
                <Select value={intake.entity_type} onValueChange={v => updateField("entity_type", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="501c3">501(c)(3) Nonprofit</SelectItem>
                    <SelectItem value="501c4">501(c)(4) Nonprofit</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="scorp">S-Corp</SelectItem>
                    <SelectItem value="ccorp">C-Corp</SelectItem>
                    <SelectItem value="sole_prop">Sole Proprietorship</SelectItem>
                    <SelectItem value="fiscal_sponsor">Fiscal Sponsor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Mission & Services *</label>
              <Textarea
                placeholder="Describe your mission and the services you provide (2-3 sentences)"
                value={intake.mission}
                onChange={e => updateField("mission", e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Active SAM.gov Registration?</label>
                <Select value={intake.sam_registered} onValueChange={v => updateField("sam_registered", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unsure">Not Sure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">UEI (if known)</label>
                <Input
                  placeholder="e.g. ABC123DEF456"
                  value={intake.uei}
                  onChange={e => updateField("uei", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Federal Funding History</label>
              <Textarea
                placeholder="Have you ever received federal grants or contracts? Briefly describe."
                value={intake.federal_funding_history}
                onChange={e => updateField("federal_funding_history", e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Non-Federal Experience</label>
              <Textarea
                placeholder="Foundation grants, state/local contracts, corporate partnerships, etc."
                value={intake.non_federal_experience}
                onChange={e => updateField("non_federal_experience", e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Staff with Government Contracting Experience?</label>
              <Textarea
                placeholder="Any staff with prior government contracting experience (even from previous employers)?"
                value={intake.staff_gov_experience}
                onChange={e => updateField("staff_gov_experience", e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Annual Operating Budget</label>
                <Select value={intake.annual_budget} onValueChange={v => updateField("annual_budget", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_250k">Under $250K</SelectItem>
                    <SelectItem value="250k_500k">$250K – $500K</SelectItem>
                    <SelectItem value="500k_1m">$500K – $1M</SelectItem>
                    <SelectItem value="1m_5m">$1M – $5M</SelectItem>
                    <SelectItem value="5m_plus">$5M+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Geographic Service Area</label>
                <Input
                  placeholder="e.g. Columbus, OH metro area"
                  value={intake.geographic_area}
                  onChange={e => updateField("geographic_area", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Timekeeping System</label>
                <Input
                  placeholder="e.g. TSheets, manual spreadsheets, none"
                  value={intake.timekeeping_system}
                  onChange={e => updateField("timekeeping_system", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Accounting System</label>
                <Input
                  placeholder="e.g. QuickBooks, Sage, none"
                  value={intake.accounting_system}
                  onChange={e => updateField("accounting_system", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            This tool produces a $7,000–$15,000 value readiness package — included with your premium subscription.
          </p>
          <Button onClick={handleGenerate} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                Generate Readiness Plan
              </>
            )}
          </Button>
        </div>
      </div>
    </StepLayout>
  );
};

export default FederalContractingStep;
