/**
 * Closed-Loop Attribution & Optimization Logic
 * Simple, free-first attribution models that work without paid tools.
 */

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'owner_confirmed';

export const ATTRIBUTION_MODELS: { value: AttributionModel; label: string; description: string }[] = [
  { value: 'first_touch', label: 'First Touch', description: 'Full credit to the first campaign that reached the customer' },
  { value: 'last_touch', label: 'Last Touch', description: 'Full credit to the last campaign before the conversion' },
  { value: 'linear', label: 'Even Split', description: 'Equal credit spread across all campaigns in the journey' },
  { value: 'time_decay', label: 'Time Decay', description: 'More credit to recent campaigns, less to older ones' },
  { value: 'owner_confirmed', label: 'You Decide', description: 'You assign credit based on what you know about your customers' },
];

export const CAMPAIGN_TYPES = [
  'Social Media Post', 'Video Ad', 'Email Campaign', 'Text/SMS', 'Flyer/Print',
  'Google Ad', 'Referral', 'Event', 'Promotion/Sale', 'Content/Blog', 'Other',
];

export const OUTCOME_FIELDS = [
  { key: 'views', label: 'Views', icon: '👁️' },
  { key: 'clicks', label: 'Clicks', icon: '🖱️' },
  { key: 'replies', label: 'Replies / Messages', icon: '💬' },
  { key: 'form_submissions', label: 'Form Submissions', icon: '📋' },
  { key: 'lead_captures', label: 'New Leads', icon: '🎯' },
  { key: 'appointment_requests', label: 'Appointment Requests', icon: '📅' },
  { key: 'bookings', label: 'Bookings', icon: '✅' },
  { key: 'purchases', label: 'Purchases', icon: '🛒' },
  { key: 'repeat_purchases', label: 'Repeat Purchases', icon: '🔄' },
  { key: 'calls_received', label: 'Phone Calls', icon: '📞' },
  { key: 'revenue_cents', label: 'Revenue ($)', icon: '💰', isCurrency: true },
] as const;

export interface CampaignOutcome {
  id: string;
  campaign_name: string;
  campaign_type: string;
  campaign_goal?: string;
  offer?: string;
  cta_used?: string;
  target_audience?: string;
  content_format?: string;
  platform?: string;
  launched_at?: string;
  views: number;
  clicks: number;
  replies: number;
  form_submissions: number;
  lead_captures: number;
  appointment_requests: number;
  bookings: number;
  purchases: number;
  repeat_purchases: number;
  revenue_cents: number;
  calls_received: number;
  customer_feedback?: string;
  what_customers_mentioned?: string;
  felt_successful?: boolean;
  manual_notes?: string;
  attribution_model: string;
  attribution_score: number;
  what_worked: string[];
  what_failed: string[];
  optimization_signals: Record<string, unknown>;
  status: string;
  created_at: string;
}

/**
 * Calculate a simple performance score (0-100) for a campaign outcome.
 */
export function calculatePerformanceScore(outcome: CampaignOutcome): number {
  let score = 0;
  let maxPossible = 0;

  // Engagement signals (weight: 1)
  if (outcome.views > 0) { score += Math.min(outcome.clicks / outcome.views * 100, 20); maxPossible += 20; }
  
  // Conversion signals (weight: 3)
  const conversions = outcome.lead_captures + outcome.bookings + outcome.purchases + outcome.appointment_requests;
  if (outcome.clicks > 0) { score += Math.min(conversions / outcome.clicks * 100 * 3, 40); maxPossible += 40; }
  
  // Revenue signal (weight: 2)
  if (outcome.revenue_cents > 0) { score += 20; maxPossible += 20; }
  
  // Qualitative boost
  if (outcome.felt_successful) score += 10;
  maxPossible += 10;
  
  // Repeat purchase bonus
  if (outcome.repeat_purchases > 0) score += 10;
  maxPossible += 10;

  return maxPossible > 0 ? Math.round(Math.min(score / maxPossible * 100, 100)) : 0;
}

/**
 * Generate plain-language insights from campaign outcomes.
 */
export function generateInsights(outcomes: CampaignOutcome[]): {
  topPerformers: string[];
  weakSpots: string[];
  nextActions: string[];
} {
  if (outcomes.length === 0) {
    return {
      topPerformers: ['No campaigns tracked yet — add your first campaign to start learning.'],
      weakSpots: [],
      nextActions: ['Create a campaign and come back to enter results.'],
    };
  }

  const scored = outcomes.map(o => ({ ...o, score: calculatePerformanceScore(o) }));
  scored.sort((a, b) => b.score - a.score);

  const topPerformers: string[] = [];
  const weakSpots: string[] = [];
  const nextActions: string[] = [];

  // Top performers
  const best = scored[0];
  if (best.score > 50) {
    topPerformers.push(`"${best.campaign_name}" was your strongest campaign (score: ${best.score}/100).`);
    if (best.cta_used) topPerformers.push(`The CTA "${best.cta_used}" drove the most action.`);
    if (best.campaign_type) topPerformers.push(`${best.campaign_type} format is working well for your audience.`);
  }

  // Weak spots
  const worst = scored[scored.length - 1];
  if (scored.length > 1 && worst.score < 30) {
    weakSpots.push(`"${worst.campaign_name}" underperformed (score: ${worst.score}/100).`);
    if (worst.views > 0 && worst.clicks === 0) weakSpots.push('People saw it but didn\'t click — the hook or headline may need work.');
    if (worst.clicks > 0 && worst.purchases === 0 && worst.bookings === 0) weakSpots.push('People clicked but didn\'t convert — the offer or landing page may need improvement.');
  }

  // Pattern detection
  const typeGroups: Record<string, number[]> = {};
  scored.forEach(s => {
    const t = s.campaign_type || 'other';
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(s.score);
  });

  const typeAvgs = Object.entries(typeGroups).map(([type, scores]) => ({
    type,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  typeAvgs.sort((a, b) => b.avg - a.avg);

  if (typeAvgs.length > 1) {
    nextActions.push(`Focus more on "${typeAvgs[0].type}" campaigns — they perform ${Math.round(typeAvgs[0].avg - typeAvgs[typeAvgs.length - 1].avg)}% better on average.`);
  }

  // CTA analysis
  const ctaGroups: Record<string, number[]> = {};
  scored.filter(s => s.cta_used).forEach(s => {
    if (!ctaGroups[s.cta_used!]) ctaGroups[s.cta_used!] = [];
    ctaGroups[s.cta_used!].push(s.score);
  });
  const ctaAvgs = Object.entries(ctaGroups).map(([cta, scores]) => ({
    cta,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  if (ctaAvgs.length > 0) {
    ctaAvgs.sort((a, b) => b.avg - a.avg);
    nextActions.push(`Your best-performing CTA is "${ctaAvgs[0].cta}" — use it more often.`);
  }

  if (nextActions.length === 0) {
    nextActions.push('Keep tracking results — Ricky needs at least 3 campaigns to find strong patterns.');
  }

  return { topPerformers, weakSpots, nextActions };
}

/**
 * Self-healing: detect data gaps and provide guidance.
 */
export function detectDataGaps(outcome: CampaignOutcome): string[] {
  const gaps: string[] = [];
  if (!outcome.launched_at) gaps.push('Missing launch date — add it so we can track timing patterns.');
  if (!outcome.campaign_goal) gaps.push('No campaign goal set — knowing the goal helps measure success.');
  if (!outcome.cta_used) gaps.push('No CTA recorded — tracking CTAs helps identify winning phrases.');
  if (outcome.views === 0 && outcome.clicks === 0 && outcome.purchases === 0 && outcome.calls_received === 0) {
    gaps.push('No results entered yet — even rough estimates help Ricky learn.');
  }
  if (outcome.felt_successful === null || outcome.felt_successful === undefined) {
    gaps.push('Tell us if this campaign felt successful — your gut feeling is valuable data.');
  }
  return gaps;
}
