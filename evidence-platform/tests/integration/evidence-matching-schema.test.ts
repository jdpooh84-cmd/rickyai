import { describe, it, expect } from "vitest";
import { EvidenceMatchSchema } from "@/lib/ai/schemas/evidence-matching";

const validBase = {
  relationship: "supports" as const,
  entailment_score: 0.85,
  reasoning: {
    what_passage_says: "The study found X.",
    what_claim_says: "The claim asserts X.",
    why_relationship: "Passage directly confirms the claim.",
    scope_limits: null,
    correlation_causation_note: null,
  },
};

describe("EvidenceMatchSchema validation", () => {
  describe("valid relationship values", () => {
    const validRelationships = [
      "supports",
      "partially_supports",
      "contradicts",
      "context_only",
      "not_relevant",
      "irrelevant",
      "cannot_verify",
    ] as const;

    for (const rel of validRelationships) {
      it(`accepts relationship "${rel}"`, () => {
        const result = EvidenceMatchSchema.safeParse({ ...validBase, relationship: rel });
        expect(result.success).toBe(true);
      });
    }
  });

  it("rejects unknown relationship value", () => {
    const result = EvidenceMatchSchema.safeParse({
      ...validBase,
      relationship: "maybe",
    });
    expect(result.success).toBe(false);
  });

  describe("entailment_score bounds", () => {
    it("accepts 0.0", () => {
      const result = EvidenceMatchSchema.safeParse({ ...validBase, entailment_score: 0.0 });
      expect(result.success).toBe(true);
    });

    it("accepts 1.0", () => {
      const result = EvidenceMatchSchema.safeParse({ ...validBase, entailment_score: 1.0 });
      expect(result.success).toBe(true);
    });

    it("accepts 0.5", () => {
      const result = EvidenceMatchSchema.safeParse({ ...validBase, entailment_score: 0.5 });
      expect(result.success).toBe(true);
    });

    it("rejects score below 0", () => {
      const result = EvidenceMatchSchema.safeParse({ ...validBase, entailment_score: -0.1 });
      expect(result.success).toBe(false);
    });

    it("rejects score above 1", () => {
      const result = EvidenceMatchSchema.safeParse({ ...validBase, entailment_score: 1.1 });
      expect(result.success).toBe(false);
    });
  });

  describe("reasoning object", () => {
    it("accepts null scope_limits", () => {
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: { ...validBase.reasoning, scope_limits: null },
      });
      expect(result.success).toBe(true);
    });

    it("accepts string scope_limits", () => {
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: { ...validBase.reasoning, scope_limits: "US jurisdiction only" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts null correlation_causation_note", () => {
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: { ...validBase.reasoning, correlation_causation_note: null },
      });
      expect(result.success).toBe(true);
    });

    it("accepts string correlation_causation_note", () => {
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: {
          ...validBase.reasoning,
          correlation_causation_note: "Study shows correlation, not causation.",
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing what_passage_says", () => {
      const { what_passage_says: _, ...incompleteReasoning } = validBase.reasoning;
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: incompleteReasoning,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing what_claim_says", () => {
      const { what_claim_says: _, ...incompleteReasoning } = validBase.reasoning;
      const result = EvidenceMatchSchema.safeParse({
        ...validBase,
        reasoning: incompleteReasoning,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("complete valid objects", () => {
    it("parses a contradicts relationship correctly", () => {
      const input = {
        relationship: "contradicts",
        entailment_score: 0.0,
        reasoning: {
          what_passage_says: "The data shows Y decreased.",
          what_claim_says: "Y increased.",
          why_relationship: "Passage directly contradicts the claim.",
          scope_limits: "2019-2021 only",
          correlation_causation_note: null,
        },
      };
      const result = EvidenceMatchSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relationship).toBe("contradicts");
        expect(result.data.entailment_score).toBe(0.0);
        expect(result.data.reasoning.scope_limits).toBe("2019-2021 only");
      }
    });

    it("parses a cannot_verify relationship correctly", () => {
      const input = {
        relationship: "cannot_verify",
        entailment_score: 0.0,
        reasoning: {
          what_passage_says: "Passage is in German; translation uncertain.",
          what_claim_says: "English claim about German study.",
          why_relationship: "Cannot assess without reliable translation.",
          scope_limits: null,
          correlation_causation_note: null,
        },
      };
      const result = EvidenceMatchSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
