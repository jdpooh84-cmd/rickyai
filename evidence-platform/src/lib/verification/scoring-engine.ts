import type { PublicVerdict, EvidenceRelationship, RetractionStatus } from "@/lib/supabase/types";

export interface EvidenceInput {
  relationship: EvidenceRelationship;
  entailment_score: number;
  source_tier: number;
  identity_status: string;
  retraction_status: RetractionStatus;
  is_accessible: boolean;
  published_at: string | null;
  claim_time_scope: string | null;
  jurisdiction_match: boolean;
  population_match: boolean;
}

export interface ProsecutorInput {
  objections: Array<{
    objection_type: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  recommendation: string;
  single_provider_warning: boolean;
}

export interface ScoringInput {
  evidence: EvidenceInput[];
  prosecutor: ProsecutorInput | null;
  stakes_level: "low" | "medium" | "high";
  materiality: "low" | "medium" | "high";
  has_audit_trail: boolean;
}

export interface ScoreComponents {
  source_integrity: number;
  source_authority: number;
  direct_entailment: number;
  corroboration: number;
  freshness: number;
  scope_fit: number;
  evidence_completeness: number;
  contradiction_penalty: number;
  retraction_penalty: number;
  missing_context_penalty: number;
  total_score: number;
}

export interface PolicyOverride {
  rule: string;
  applied: boolean;
  reason: string;
  forced_verdict: PublicVerdict | null;
}

export interface ScoringResult {
  components: ScoreComponents;
  verdict: PublicVerdict;
  policy_overrides: PolicyOverride[];
  explanation: {
    summary: string;
    score_narrative: string;
    limitations: string[];
  };
}

const SCORE_VERSION = "1.0.0";
export { SCORE_VERSION };

function scoreSourceIntegrity(evidence: EvidenceInput[]): number {
  if (evidence.length === 0) return 0;
  const best = evidence.reduce((acc, e) => {
    let s = 0;
    if (e.identity_status === "verified") s += 8;
    else if (e.identity_status === "metadata_only") s += 4;
    if (e.is_accessible) s += 4;
    if (e.retraction_status === "current") s += 3;
    else if (e.retraction_status === "unknown") s += 1;
    return Math.max(acc, s);
  }, 0);
  return Math.min(15, best);
}

function scoreSourceAuthority(evidence: EvidenceInput[]): number {
  if (evidence.length === 0) return 0;
  const tierToScore: Record<number, number> = { 1: 15, 2: 13, 3: 10, 4: 6, 5: 2 };
  const best = evidence.reduce((acc, e) => {
    const score = tierToScore[e.source_tier] ?? 0;
    return Math.max(acc, score);
  }, 0);
  return best;
}

function scoreDirectEntailment(evidence: EvidenceInput[]): number {
  if (evidence.length === 0) return 0;
  const best = evidence.reduce((acc, e) => {
    let s = 0;
    if (e.relationship === "supports") s = 25;
    else if (e.relationship === "partially_supports") s = 14;
    else if (e.relationship === "context_only") s = 4;
    else s = 0;
    return Math.max(acc, s);
  }, 0);
  return best;
}

function scoreCorroboration(evidence: EvidenceInput[]): number {
  const supporting = evidence.filter(
    (e) => e.relationship === "supports" || e.relationship === "partially_supports",
  );
  if (supporting.length >= 3) return 10;
  if (supporting.length === 2) return 6;
  if (supporting.length === 1) return 0;
  return 0;
}

function scoreFreshness(evidence: EvidenceInput[]): number {
  if (evidence.length === 0) return 0;
  const supporting = evidence.filter(
    (e) => e.relationship === "supports" || e.relationship === "partially_supports",
  );
  if (supporting.length === 0) return 5;

  const now = new Date();
  const best = supporting.reduce((acc, e) => {
    if (!e.published_at) return Math.max(acc, 3);
    const pub = new Date(e.published_at);
    const ageYears = (now.getTime() - pub.getTime()) / (1000 * 60 * 60 * 24 * 365);
    let s = 10;
    if (ageYears > 10) s = 2;
    else if (ageYears > 5) s = 5;
    else if (ageYears > 2) s = 7;
    return Math.max(acc, s);
  }, 0);
  return best;
}

function scoreScopeFit(evidence: EvidenceInput[]): number {
  if (evidence.length === 0) return 0;
  const supporting = evidence.filter(
    (e) => e.relationship === "supports" || e.relationship === "partially_supports",
  );
  if (supporting.length === 0) return 0;
  const best = supporting.reduce((acc, e) => {
    let s = 10;
    if (!e.jurisdiction_match) s -= 4;
    if (!e.population_match) s -= 3;
    return Math.max(acc, s);
  }, 0);
  return Math.max(0, best);
}

function scoreEvidenceCompleteness(evidence: EvidenceInput[], prosecutor: ProsecutorInput | null): number {
  if (evidence.length === 0) return 0;
  let base = 8;
  if (prosecutor) {
    const critical = (prosecutor.objections ?? []).filter((o) => o.severity === "critical").length;
    const high = (prosecutor.objections ?? []).filter((o) => o.severity === "high").length;
    base -= critical * 4;
    base -= high * 2;
  }
  return Math.max(0, Math.min(10, base));
}

function penaltyContradiction(evidence: EvidenceInput[]): number {
  const contradictions = evidence.filter((e) => e.relationship === "contradicts");
  if (contradictions.length === 0) return 0;
  const highTier = contradictions.some((e) => e.source_tier <= 2);
  return highTier ? 20 : 10;
}

function penaltyRetraction(evidence: EvidenceInput[]): number {
  const retracted = evidence.filter((e) => e.retraction_status === "retracted");
  const corrected = evidence.filter((e) => e.retraction_status === "corrected");
  if (retracted.length > 0) return 30;
  if (corrected.length > 0) return 15;
  return 0;
}

function penaltyMissingContext(prosecutor: ProsecutorInput | null): number {
  if (!prosecutor) return 0;
  const missingCtx = (prosecutor.objections ?? []).filter((o) => o.objection_type === "missing_context");
  if (missingCtx.some((o) => o.severity === "critical")) return 15;
  if (missingCtx.some((o) => o.severity === "high")) return 8;
  if (missingCtx.length > 0) return 4;
  return 0;
}

function applyPolicyOverrides(
  components: ScoreComponents,
  evidence: EvidenceInput[],
  prosecutor: ProsecutorInput | null,
  stakes_level: "low" | "medium" | "high",
  has_audit_trail: boolean,
): PolicyOverride[] {
  const overrides: PolicyOverride[] = [];

  const fabricatedOrMismatched =
    (prosecutor?.objections ?? []).some(
      (o) => o.objection_type === "fabricated_citation" || o.objection_type === "mismatched_citation",
    ) ?? false;

  overrides.push({
    rule: "a",
    applied: fabricatedOrMismatched,
    reason: "Fabricated or mismatched source detected",
    forced_verdict: fabricatedOrMismatched ? "UNVERIFIABLE" : null,
  });

  const hasRetracted = evidence.some((e) => e.retraction_status === "retracted");
  overrides.push({
    rule: "b",
    applied: hasRetracted,
    reason: "Retracted source used as support",
    forced_verdict: hasRetracted ? "CONTRADICTED" : null,
  });

  const highStakesUnresolved =
    stakes_level === "high" &&
    (prosecutor?.recommendation === "require_qualified_review" ||
      (prosecutor?.objections ?? []).some((o) => o.objection_type === "high_stakes_unsafe") === true);
  overrides.push({
    rule: "c",
    applied: highStakesUnresolved,
    reason: "High-stakes claim with unresolved critical context",
    forced_verdict: highStakesUnresolved ? "REQUIRES_QUALIFIED_REVIEW" : null,
  });

  const hasCredibleContradiction =
    evidence.some((e) => e.relationship === "contradicts" && e.source_tier <= 3);
  overrides.push({
    rule: "d",
    applied: hasCredibleContradiction,
    reason: "Credible current contradiction present",
    forced_verdict: hasCredibleContradiction ? "CONTRADICTED" : null,
  });

  const metadataOnlySoleSupport =
    stakes_level === "high" &&
    evidence.filter((e) => e.relationship === "supports").length > 0 &&
    evidence
      .filter((e) => e.relationship === "supports")
      .every((e) => !e.is_accessible);
  overrides.push({
    rule: "f",
    applied: metadataOnlySoleSupport,
    reason: "Metadata-only inaccessible source is sole support for high-stakes claim",
    forced_verdict: metadataOnlySoleSupport ? "UNVERIFIABLE" : null,
  });

  overrides.push({
    rule: "g",
    applied: !has_audit_trail,
    reason: "Missing audit trail or policy result",
    forced_verdict: !has_audit_trail ? "UNVERIFIABLE" : null,
  });

  return overrides;
}

function scoreToDefaultVerdict(score: number, evidence: EvidenceInput[]): PublicVerdict {
  const hasContradiction = evidence.some((e) => e.relationship === "contradicts");
  if (hasContradiction && score < 60) return "CONTRADICTED";
  if (score >= 80) return "VERIFIED_ENOUGH_TO_ACT";
  if (score >= 60) return "PARTIALLY_SUPPORTED";
  if (score >= 40) return "MIXED_OR_UNCERTAIN";
  return "UNVERIFIABLE";
}

export function scoreEvidence(input: ScoringInput): ScoringResult {
  const source_integrity = scoreSourceIntegrity(input.evidence);
  const source_authority = scoreSourceAuthority(input.evidence);
  const direct_entailment = scoreDirectEntailment(input.evidence);
  const corroboration = scoreCorroboration(input.evidence);
  const freshness = scoreFreshness(input.evidence);
  const scope_fit = scoreScopeFit(input.evidence);
  const evidence_completeness = scoreEvidenceCompleteness(input.evidence, input.prosecutor);
  const contradiction_penalty = penaltyContradiction(input.evidence);
  const retraction_penalty = penaltyRetraction(input.evidence);
  const missing_context_penalty = penaltyMissingContext(input.prosecutor);

  const total_score = Math.max(
    0,
    Math.min(
      100,
      source_integrity +
        source_authority +
        direct_entailment +
        corroboration +
        freshness +
        scope_fit +
        evidence_completeness -
        contradiction_penalty -
        retraction_penalty -
        missing_context_penalty,
    ),
  );

  const components: ScoreComponents = {
    source_integrity,
    source_authority,
    direct_entailment,
    corroboration,
    freshness,
    scope_fit,
    evidence_completeness,
    contradiction_penalty,
    retraction_penalty,
    missing_context_penalty,
    total_score,
  };

  const policy_overrides = applyPolicyOverrides(
    components,
    input.evidence,
    input.prosecutor,
    input.stakes_level,
    input.has_audit_trail,
  );

  const forcedVerdict = policy_overrides
    .filter((o) => o.applied && o.forced_verdict)
    .map((o) => o.forced_verdict as PublicVerdict)[0];

  const verdict = forcedVerdict ?? scoreToDefaultVerdict(total_score, input.evidence);

  const limitations: string[] = [];
  if (input.evidence.some((e) => !e.is_accessible)) {
    limitations.push("One or more sources could not be fully accessed for passage verification.");
  }
  if (input.prosecutor?.single_provider_warning) {
    limitations.push(
      "Adversarial review used a single AI provider (SINGLE_PROVIDER). Independence is limited.",
    );
  }
  if (input.evidence.length === 0) {
    limitations.push("No evidence was matched to this claim.");
  }

  return {
    components,
    verdict,
    policy_overrides,
    explanation: {
      summary: `Score: ${total_score}/100. Verdict: ${verdict}.`,
      score_narrative: `Source integrity: ${source_integrity}/15, Authority: ${source_authority}/15, Entailment: ${direct_entailment}/25, Corroboration: ${corroboration}/10, Freshness: ${freshness}/10, Scope: ${scope_fit}/10, Completeness: ${evidence_completeness}/10. Penalties: contradiction −${contradiction_penalty}, retraction −${retraction_penalty}, missing context −${missing_context_penalty}.`,
      limitations,
    },
  };
}
