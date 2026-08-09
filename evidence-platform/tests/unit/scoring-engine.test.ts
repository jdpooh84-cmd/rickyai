import { describe, it, expect } from "vitest";
import { scoreEvidence } from "@/lib/verification/scoring-engine";
import type { ScoringInput } from "@/lib/verification/scoring-engine";

const baseEvidence = {
  relationship: "supports" as const,
  entailment_score: 0.9,
  source_tier: 1,
  identity_status: "verified",
  retraction_status: "current" as const,
  is_accessible: true,
  published_at: "2023-01-01",
  claim_time_scope: null,
  jurisdiction_match: true,
  population_match: true,
};

const baseInput: ScoringInput = {
  evidence: [baseEvidence],
  prosecutor: null,
  stakes_level: "medium",
  materiality: "medium",
  has_audit_trail: true,
};

describe("scoreEvidence", () => {
  it("returns VERIFIED_ENOUGH_TO_ACT for strong single primary source", () => {
    const result = scoreEvidence(baseInput);
    expect(result.verdict).toBe("VERIFIED_ENOUGH_TO_ACT");
    expect(result.components.total_score).toBeGreaterThanOrEqual(80);
  });

  it("returns CONTRADICTED when credible source contradicts the claim", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: [
        { ...baseEvidence, relationship: "contradicts", source_tier: 1 },
      ],
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("CONTRADICTED");
  });

  it("applies retraction penalty of 30 for retracted source", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: [{ ...baseEvidence, retraction_status: "retracted" }],
    };
    const result = scoreEvidence(input);
    expect(result.components.retraction_penalty).toBe(30);
    expect(result.verdict).toBe("CONTRADICTED");
  });

  it("returns REQUIRES_QUALIFIED_REVIEW for high-stakes claim with prosecutor recommendation", () => {
    const input: ScoringInput = {
      ...baseInput,
      stakes_level: "high",
      prosecutor: {
        objections: [
          { objection_type: "high_stakes_unsafe", severity: "critical" },
        ],
        recommendation: "require_qualified_review",
        single_provider_warning: true,
      },
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("REQUIRES_QUALIFIED_REVIEW");
  });

  it("blocks verdict when audit trail is missing", () => {
    const input: ScoringInput = {
      ...baseInput,
      has_audit_trail: false,
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("UNVERIFIABLE");
    const override = result.policy_overrides.find((o) => o.rule === "g");
    expect(override?.applied).toBe(true);
  });

  it("returns UNVERIFIABLE for empty evidence", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: [],
    };
    const result = scoreEvidence(input);
    expect(result.verdict).toBe("UNVERIFIABLE");
    expect(result.components.total_score).toBe(0);
  });

  it("scores corroboration higher with 3+ supporting sources", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: [baseEvidence, baseEvidence, baseEvidence],
    };
    const result = scoreEvidence(input);
    expect(result.components.corroboration).toBe(10);
  });

  it("does not exceed 100 total score", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: Array(10).fill(baseEvidence) as typeof baseInput.evidence,
    };
    const result = scoreEvidence(input);
    expect(result.components.total_score).toBeLessThanOrEqual(100);
  });

  it("returns MIXED_OR_UNCERTAIN for partial support with missing context", () => {
    const input: ScoringInput = {
      ...baseInput,
      evidence: [
        { ...baseEvidence, relationship: "partially_supports", source_tier: 3 },
      ],
      prosecutor: {
        objections: [{ objection_type: "missing_context", severity: "high" }],
        recommendation: "add_caveat",
        single_provider_warning: false,
      },
    };
    const result = scoreEvidence(input);
    expect(["MIXED_OR_UNCERTAIN", "PARTIALLY_SUPPORTED"]).toContain(result.verdict);
  });
});
