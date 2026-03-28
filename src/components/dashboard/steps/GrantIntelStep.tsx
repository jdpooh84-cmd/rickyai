import { useState } from "react";
import { Compass, Target, Globe, FileSearch, CheckCircle, ClipboardList, Calendar, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface IntakeData {
  org_name: string;
  website_or_description: string;
  niche_focus: string;
  geography: string;
  who_served: string;
  budget_size: string;
  program_examples: string;
  hard_limits: string;
}

const INITIAL_INTAKE: IntakeData = {
  org_name: "",
  website_or_description: "",
  niche_focus: "",
  geography: "",
  who_served: "",
  budget_size: "",
  program_examples: "",
  hard_limits: "",
};

const SECTION_ICONS = [Compass, Target, Globe, FileSearch, CheckCircle, ClipboardList, Calendar, BookOpen];
const SECTION_NAMES = [
  "Organizational DNA",
  "Project Profiles",
  "Funder Universe",
  "Opportunity Blueprints",
  "Strategic Validation",
  "Data Hygiene Checklist",
  "12-Month Roadmap",
  "Usage Guide",
];

interface GrantIntelStepProps {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

const GrantIntelStep = ({ businessId, locationId, onComplete }: GrantIntelStepProps) => {
  const [intake, setIntake] = useState<IntakeData>(INITIAL_INTAKE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [streamText, setStreamText] = useState("");
  const [activeSection, setActiveSection] = useState<number | null>(null);

  const updateField = (field: keyof IntakeData, value: string) => {
    setIntake(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!intake.org_name || !intake.niche_focus) {
      toast.error("Please fill in at least: Organization Name and Niche/Focus Area.");
      return;
    }

    setLoading(true);
    setStreamText("");
    setResult(null);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grant-intel`;

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

      setResult({ markdown: fullText });
      toast.success("Grant Intelligence pack complete!");
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
      <div className="max-w-3xl mx-auto pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">🔍 Grant Intelligence Pack</h1>
          <p className="text-muted-foreground">Your comprehensive grant strategy and funder mapping</p>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              {loading ? "Generating..." : "Analysis Complete"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setStreamText(""); }}>
              New Analysis
            </Button>
          </div>

          {/* Section navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SECTION_NAMES.map((name, i) => {
              const Icon = SECTION_ICONS[i];
              return (
                <button
                  key={i}
                  onClick={() => setActiveSection(activeSection === i ? null : i)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    activeSection === i
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

          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-foreground leading-relaxed">
                {displayText}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">🔍 Grant Intelligence Pack</h1>
        <p className="text-muted-foreground">AI-powered grant strategy, funder mapping, and 12-month pursuit roadmap</p>
      </div>
      <div className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              Organizational DNA Intake
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Tell us about your organization. Messy notes are fine — we'll organize everything.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Organization Name *</label>
                <Input
                  placeholder="e.g. Bridges to Recovery"
                  value={intake.org_name}
                  onChange={e => updateField("org_name", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Niche / Focus Area *</label>
                <Input
                  placeholder="e.g. neurology clinic for low-income veterans"
                  value={intake.niche_focus}
                  onChange={e => updateField("niche_focus", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Website or Short Description</label>
              <Textarea
                placeholder="What does this organization actually do day to day?"
                value={intake.website_or_description}
                onChange={e => updateField("website_or_description", e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Geography Served</label>
                <Input
                  placeholder="e.g. Richmond, VA metro area"
                  value={intake.geography}
                  onChange={e => updateField("geography", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Annual Budget Size</label>
                <Select value={intake.budget_size} onValueChange={v => updateField("budget_size", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select range..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (under $500K)</SelectItem>
                    <SelectItem value="medium">Medium ($500K – $2M)</SelectItem>
                    <SelectItem value="large">Large ($2M+)</SelectItem>
                    <SelectItem value="unknown">Not sure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Who Do You Serve?</label>
              <Textarea
                placeholder="Age, situation, main challenges of the people you help"
                value={intake.who_served}
                onChange={e => updateField("who_served", e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Program Examples (1–3)</label>
              <Textarea
                placeholder="Describe 1-3 real programs or services you provide"
                value={intake.program_examples}
                onChange={e => updateField("program_examples", e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Hard Limits or Constraints</label>
              <Textarea
                placeholder="e.g. cannot accept government money, faith-based constraints, topics you won't touch"
                value={intake.hard_limits}
                onChange={e => updateField("hard_limits", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Generates a complete grant strategy package — funder mapping, project profiles, priority bets, and 12-month roadmap.
          </p>
          <Button onClick={handleGenerate} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Building Intel Pack...
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                Generate Grant Intel Pack
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GrantIntelStep;
