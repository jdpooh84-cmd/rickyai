import { z } from "zod";

export const ClaimSchema = z.object({
  claim_text: z.string().min(1),
  claim_type: z.enum(["factual", "statistical", "causal", "comparative", "predictive"]),
  domain: z.string(),
  materiality: z.enum(["low", "medium", "high"]),
  stakes_level: z.enum(["low", "medium", "high"]),
  jurisdiction: z.string().nullable(),
  population_scope: z.string().nullable(),
  time_scope: z.string().nullable(),
  evidence_needed: z.string(),
});

export type ExtractedClaim = z.infer<typeof ClaimSchema>;

export const ClaimExtractionOutputSchema = z.object({
  claims: z.array(ClaimSchema),
  extraction_notes: z.string().optional(),
});

export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionOutputSchema>;
