import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  BarChart3, Plus, TrendingUp, TrendingDown, Lightbulb, AlertTriangle,
  CheckCircle, Target, ArrowRight, RefreshCw
} from "lucide-react";
import {
  ATTRIBUTION_MODELS, CAMPAIGN_TYPES, OUTCOME_FIELDS,
  calculatePerformanceScore, generateInsights, detectDataGaps,
  type CampaignOutcome, type AttributionModel,
} from "@/lib/attribution";

interface Props {
  businessId: string | null;
  locationId: string | null;
}

const PerformanceStep = ({ businessId, locationId }: Props) => {
  const { user } = useAuth();
  const [outcomes, setOutcomes] = useState<CampaignOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AttributionModel>('last_touch');
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    campaign_name: '', campaign_type: 'Social Media Post', campaign_goal: '',
    offer: '', cta_used: '', target_audience: '', platform: '', launched_at: '',
    views: 0, clicks: 0, replies: 0, form_submissions: 0, lead_captures: 0,
    appointment_requests: 0, bookings: 0, purchases: 0, repeat_purchases: 0,
    revenue_cents: 0, calls_received: 0, customer_feedback: '',
    what_customers_mentioned: '', felt_successful: false, manual_notes: '',
  });

  useEffect(() => {
    if (!user || !businessId) return;
    loadOutcomes();
  }, [user, businessId]);

  const loadOutcomes = async () => {
    if (!user || !businessId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_outcomes")
      .select("*")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOutcomes(data.map(d => ({
        ...d,
        what_worked: Array.isArray(d.what_worked) ? d.what_worked as string[] : [],
        what_failed: Array.isArray(d.what_failed) ? d.what_failed as string[] : [],
        optimization_signals: (d.optimization_signals as Record<string, unknown>) || {},
      })));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !businessId || !form.campaign_name.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("campaign_outcomes").insert({
      user_id: user.id,
      business_id: businessId,
      location_id: locationId || null,
      campaign_name: form.campaign_name,
      campaign_type: form.campaign_type,
      campaign_goal: form.campaign_goal || null,
      offer: form.offer || null,
      cta_used: form.cta_used || null,
      target_audience: form.target_audience || null,
      platform: form.platform || null,
      launched_at: form.launched_at || null,
      views: form.views,
      clicks: form.clicks,
      replies: form.replies,
      form_submissions: form.form_submissions,
      lead_captures: form.lead_captures,
      appointment_requests: form.appointment_requests,
      bookings: form.bookings,
      purchases: form.purchases,
      repeat_purchases: form.repeat_purchases,
      revenue_cents: Math.round(form.revenue_cents * 100),
      calls_received: form.calls_received,
      customer_feedback: form.customer_feedback || null,
      what_customers_mentioned: form.what_customers_mentioned || null,
      felt_successful: form.felt_successful,
      manual_notes: form.manual_notes || null,
      attribution_model: selectedModel,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to save — " + error.message);
    } else {
      toast.success("Campaign results saved! Ricky is learning.");
      setShowForm(false);
      resetForm();
      loadOutcomes();
    }
  };

  const resetForm = () => setForm({
    campaign_name: '', campaign_type: 'Social Media Post', campaign_goal: '',
    offer: '', cta_used: '', target_audience: '', platform: '', launched_at: '',
    views: 0, clicks: 0, replies: 0, form_submissions: 0, lead_captures: 0,
    appointment_requests: 0, bookings: 0, purchases: 0, repeat_purchases: 0,
    revenue_cents: 0, calls_received: 0, customer_feedback: '',
    what_customers_mentioned: '', felt_successful: false, manual_notes: '',
  });

  const insights = generateInsights(outcomes);

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display text-foreground mb-2">📊 Performance & Attribution</h1>
        <p className="text-muted-foreground">See what's working, what's not, and what Ricky will improve next. Track real campaign results to make every future campaign smarter.</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">What's Working</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="enter">Enter Results</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Attribution model selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                How should Ricky assign credit?
              </CardTitle>
              <CardDescription>Choose how Ricky decides which campaign gets credit for a result.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ATTRIBUTION_MODELS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setSelectedModel(m.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedModel === m.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insights cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-green-500/20 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                  <TrendingUp className="w-4 h-4" /> What Worked
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.topPerformers.length > 0 ? (
                  <ul className="space-y-2">
                    {insights.topPerformers.map((t, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Add campaigns to see insights.</p>}
              </CardContent>
            </Card>

            <Card className="border-red-500/20 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <TrendingDown className="w-4 h-4" /> What Didn't Work
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.weakSpots.length > 0 ? (
                  <ul className="space-y-2">
                    {insights.weakSpots.map((w, i) => (
                      <li key={i} className="text-sm text-foreground flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Not enough data yet.</p>}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <Lightbulb className="w-4 h-4" /> What Ricky Will Change Next
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {insights.nextActions.map((a, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Quick stats */}
          {outcomes.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Campaigns Tracked', value: outcomes.length },
                { label: 'Total Leads', value: outcomes.reduce((s, o) => s + o.lead_captures, 0) },
                { label: 'Total Bookings', value: outcomes.reduce((s, o) => s + o.bookings, 0) },
                { label: 'Total Revenue', value: `$${(outcomes.reduce((s, o) => s + o.revenue_cents, 0) / 100).toLocaleString()}` },
              ].map(stat => (
                <Card key={stat.label}>
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── CAMPAIGNS TAB ─── */}
        <TabsContent value="campaigns" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : outcomes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium">No campaigns tracked yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Go to the "Enter Results" tab to add your first campaign.
                </p>
              </CardContent>
            </Card>
          ) : (
            outcomes.map(o => {
              const score = calculatePerformanceScore(o);
              const gaps = detectDataGaps(o);
              return (
                <Card key={o.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{o.campaign_name}</h3>
                          <Badge variant="outline" className="text-xs">{o.campaign_type}</Badge>
                          {o.platform && <Badge variant="secondary" className="text-xs">{o.platform}</Badge>}
                        </div>
                        {o.campaign_goal && (
                          <p className="text-sm text-muted-foreground mt-1">Goal: {o.campaign_goal}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          {o.views > 0 && <span>👁️ {o.views} views</span>}
                          {o.clicks > 0 && <span>🖱️ {o.clicks} clicks</span>}
                          {o.lead_captures > 0 && <span>🎯 {o.lead_captures} leads</span>}
                          {o.bookings > 0 && <span>✅ {o.bookings} bookings</span>}
                          {o.purchases > 0 && <span>🛒 {o.purchases} purchases</span>}
                          {o.calls_received > 0 && <span>📞 {o.calls_received} calls</span>}
                          {o.revenue_cents > 0 && <span>💰 ${(o.revenue_cents / 100).toLocaleString()}</span>}
                        </div>
                        {gaps.length > 0 && (
                          <div className="mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-xs font-medium text-yellow-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Ricky needs more info:
                            </p>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {gaps.slice(0, 2).map((g, i) => <li key={i}>• {g}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 ${
                          score >= 70 ? 'border-green-500 text-green-600 bg-green-500/10' :
                          score >= 40 ? 'border-yellow-500 text-yellow-600 bg-yellow-500/10' :
                          'border-red-500 text-red-600 bg-red-500/10'
                        }`}>
                          {score}
                        </div>
                        <span className="text-[10px] text-muted-foreground">Score</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── ENTER RESULTS TAB ─── */}
        <TabsContent value="enter" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Log Campaign Results
              </CardTitle>
              <CardDescription>
                Tell Ricky what happened with your campaign — even rough numbers help. The more you share, the smarter your future campaigns become.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campaign info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Campaign Name *</Label>
                  <Input
                    placeholder="e.g. Spring Sale Video, Grand Opening Post"
                    value={form.campaign_name}
                    onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Campaign Type</Label>
                  <Select value={form.campaign_type} onValueChange={v => setForm(f => ({ ...f, campaign_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Goal</Label>
                  <Input
                    placeholder="e.g. Get 20 new leads, Book 10 appointments"
                    value={form.campaign_goal}
                    onChange={e => setForm(f => ({ ...f, campaign_goal: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Offer / Promotion</Label>
                  <Input
                    placeholder="e.g. 20% off, Free consultation"
                    value={form.offer}
                    onChange={e => setForm(f => ({ ...f, offer: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Call-to-Action Used</Label>
                  <Input
                    placeholder="e.g. Book Now, Call Today, Learn More"
                    value={form.cta_used}
                    onChange={e => setForm(f => ({ ...f, cta_used: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Platform</Label>
                  <Input
                    placeholder="e.g. Instagram, TikTok, Email, Google"
                    value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Launch Date</Label>
                  <Input
                    type="date"
                    value={form.launched_at}
                    onChange={e => setForm(f => ({ ...f, launched_at: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Target Audience</Label>
                  <Input
                    placeholder="e.g. Local families, Small business owners"
                    value={form.target_audience}
                    onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                  />
                </div>
              </div>

              {/* Results */}
              <div>
                <h4 className="font-medium text-foreground mb-3">Results (enter what you know — estimates are fine)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {OUTCOME_FIELDS.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs">
                        {field.icon} {field.label}
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={field.key === 'revenue_cents' ? form.revenue_cents : (form as Record<string, unknown>)[field.key] as number}
                        onChange={e => setForm(f => ({ ...f, [field.key]: Number(e.target.value) || 0 }))}
                        placeholder={field.key === 'revenue_cents' ? 'Dollar amount' : '0'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Qualitative */}
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Your Take</h4>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.felt_successful}
                    onCheckedChange={v => setForm(f => ({ ...f, felt_successful: v }))}
                  />
                  <Label>Did this campaign feel successful?</Label>
                </div>
                <div>
                  <Label>What did customers say or mention?</Label>
                  <Textarea
                    placeholder="e.g. Several people mentioned the video, two customers asked about the special..."
                    value={form.what_customers_mentioned}
                    onChange={e => setForm(f => ({ ...f, what_customers_mentioned: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Any other notes?</Label>
                  <Textarea
                    placeholder="Anything else Ricky should know about this campaign..."
                    value={form.manual_notes}
                    onChange={e => setForm(f => ({ ...f, manual_notes: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving || !form.campaign_name.trim()} className="w-full sm:w-auto">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Save Results & Let Ricky Learn
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </StepLayout>
  );
};

export default PerformanceStep;
