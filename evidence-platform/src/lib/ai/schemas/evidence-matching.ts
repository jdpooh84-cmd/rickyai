import { z } from "zod";

export const EvidenceMatchSchema = z.object({
  relationship: z.enum([
    "supports",
    "partially_supports",
    "contradicts",
    "context_only",
    "not_relevant",
    "irrelevant",
    "cannot_verify",
  ]),
  entailment_score: z.number().min(0).max(1),
  reasoning: z.object({
    what_passage_says: z.string(),
    what_claim_says: z.string(),
    why_relationship: z.string(),
    scope_limits: z.string().nullable(),
    correlation_causation_note: z.string().nullable(),
  }),
});

export type EvidenceMatch = z.infer<typeof EvidenceMatchSchema>;
