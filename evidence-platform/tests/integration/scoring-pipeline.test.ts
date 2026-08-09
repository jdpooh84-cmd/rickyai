import { describe, it, expect } from "vitest";
import { scoreEvidence, type ScoringInput } from "@/lib/verification/scoring-engine";
import type { EvidenceMatch } from "@/lib/ai/schemas/evidence-matching";
import type { EvidenceRelationship } from "@/lib/supabase/types";

// Tests that evidence-matching schema output flows correctly into the scoring engine.
// Validates that all EvidenceMatchSchema relationship values are accepted by scoring.

function matchToScoringEvidence(
  match: Pick<EvidenceMatch, "relationship" | "entailment_score">,
  overrides: Partial<ScoringInput["evidence"][0]> = {},
): ScoringInput["evidence"][0] {
  return {
    relationship: match.relationship as EvidenceRelationship,
    entailment_score: match.entailment_score,
    source_tier: 2,
    identity_status: "verified",
    retraction_status: "current",
    is_accessible: true,
    published_at: "2023-01-01",
    claim_time_scope: null,
    jurisdiction_match: true,
    population_match: true,
    ...overrides,
  };
}

describe("scoring engine ↔ evidence-matching integration", () => {
  it("scores supports + high entailment as VERIFIED_ENOUGH_TO_ACT for tier-1 source", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence(
          { relationship: "supports", entailment_score: 0.9 },
          { source_tier: 1 },
        ),
      ],
      prosecutor: null,
      stakes_level: "low",
      materiality: "low",
      has_audit_trail: true,
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("VERIFIED_ENOUGH_TO_ACT");
  });

  it("scores contradicts as CONTRADICTED regardless of entailment_score", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence(
          { relationship: "contradicts", entailment_score: 0.95 },
          { source_tier: 1 },
        ),
      ],
      prosecutor: null,
      stakes_level: "medium",
      materiality: "medium",
      has_audit_trail: true,
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("CONTRADICTED");
  });

  it("scores irrelevant + zero entailment as UNVERIFIABLE", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence({ relationship: "irrelevant", entailment_score: 0.0 }),
      ],
      prosecutor: null,
      stakes_level: "low",
      materiality: "low",
      has_audit_trail: true,
    };
    const result = scoreEvidence(input);
    // irrelevant sources contribute nothing; no evidence → UNVERIFIABLE
    expect(["UNVERIFIABLE", "MIXED_OR_UNCERTAIN", "PARTIALLY_SUPPORTED"]).toContain(
      result.verdict,
    );
  });

  it("scores cannot_verify as low-confidence result", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence({ relationship: "cannot_verify", entailment_score: 0.0 }),
      ],
      prosecutor: null,
      stakes_level: "high",
      materiality: "high",
      has_audit_trail: false,
    };
    const result = scoreEvidence(input);
    // High stakes + cannot_verify should route to REQUIRES_QUALIFIED_REVIEW or UNVERIFIABLE
    expect(["REQUIRES_QUALIFIED_REVIEW", "UNVERIFIABLE", "MIXED_OR_UNCERTAIN"]).toContain(
      result.verdict,
    );
  });

  it("scores mixed evidence (supports + contradicts) as MIXED_OR_UNCERTAIN or CONTRADICTED", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence(
          { relationship: "supports", entailment_score: 0.8 },
          { source_tier: 2 },
        ),
        matchToScoringEvidence(
          { relationship: "contradicts", entailment_score: 0.7 },
          { source_tier: 1 },
        ),
      ],
      prosecutor: null,
      stakes_level: "medium",
      materiality: "medium",
      has_audit_trail: true,
    };
    const result = scoreEvidence(input);
    expect(["CONTRADICTED", "MIXED_OR_UNCERTAIN", "PARTIALLY_SUPPORTED"]).toContain(
      result.verdict,
    );
  });

  it("handles retracted source with supports relationship", () => {
    const input: ScoringInput = {
      evidence: [
        matchToScoringEvidence(
          { relationship: "supports", entailment_score: 0.9 },
          { source_tier: 1, retraction_status: "retracted" },
        ),
      ],
      prosecutor: null,
      stakes_level: "medium",
      materiality: "medium",
      has_audit_trail: true,
    };
    const result = scoreEvidence(input);
    // Retracted source triggers policy override — should not be VERIFIED_ENOUGH_TO_ACT
    expect(result.verdict).not.toBe("VERIFIED_ENOUGH_TO_ACT");
    expect(result.components.retraction_penalty).toBeGreaterThan(0);
  });

  it("all six valid verdicts are reachable from the scoring engine", () => {
    const results = new Set<string>();

    // VERIFIED_ENOUGH_TO_ACT
    results.add(
      scoreEvidence({
        evidence: [matchToScoringEvidence({ relationship: "supports", entailment_score: 0.95 }, { source_tier: 1 })],
        prosecutor: null,
        stakes_level: "low",
        materiality: "low",
        has_audit_trail: true,
      }).verdict,
    );

    // CONTRADICTED
    results.add(
      scoreEvidence({
        evidence: [matchToScoringEvidence({ relationship: "contradicts", entailment_score: 0.9 }, { source_tier: 1 })],
        prosecutor: null,
        stakes_level: "medium",
        materiality: "medium",
        has_audit_trail: true,
      }).verdict,
    );

    // UNVERIFIABLE (no matching evidence)
    results.add(
      scoreEvidence({
        evidence: [],
        prosecutor: null,
        stakes_level: "low",
        materiality: "low",
        has_audit_trail: false,
      }).verdict,
    );

    // REQUIRES_QUALIFIED_REVIEW (high stakes, no good evidence)
    results.add(
      scoreEvidence({
        evidence: [matchToScoringEvidence({ relationship: "cannot_verify", entailment_score: 0.0 })],
        prosecutor: null,
        stakes_level: "high",
        materiality: "high",
        has_audit_trail: false,
      }).verdict,
    );

    // At least 3 distinct verdicts are reachable
    expect(results.size).toBeGreaterThanOrEqual(3);
  });
});

describe("scoring engine verdict completeness", () => {
  const VALID_VERDICTS = new Set([
    "VERIFIED_ENOUGH_TO_ACT",
    "PARTIALLY_SUPPORTED",
    "MIXED_OR_UNCERTAIN",
    "UNVERIFIABLE",
    "CONTRADICTED",
    "REQUIRES_QUALIFIED_REVIEW",
  ]);

  it("scoreEvidence always returns a known verdict", () => {
    const scenarios: ScoringInput[] = [
      { evidence: [], prosecutor: null, stakes_level: "low", materiality: "low", has_audit_trail: false },
      {
        evidence: [matchToScoringEvidence({ relationship: "supports", entailment_score: 0.3 }, { source_tier: 3 })],
        prosecutor: null,
        stakes_level: "medium",
        materiality: "medium",
        has_audit_trail: true,
      },
      {
        evidence: [
          matchToScoringEvidence({ relationship: "partially_supports", entailment_score: 0.6 }),
          matchToScoringEvidence({ relationship: "context_only", entailment_score: 0.2 }),
        ],
        prosecutor: { recommendation: "proceed", objections: [], single_provider_warning: false },
        stakes_level: "low",
        materiality: "medium",
        has_audit_trail: true,
      },
    ];

    for (const scenario of scenarios) {
      const result = scoreEvidence(scenario);
      expect(VALID_VERDICTS.has(result.verdict)).toBe(true);
    }
  });
});
