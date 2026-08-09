import { z } from "zod";

export const ProsecutorObjectionSchema = z.object({
  objection_type: z.enum([
    "missing_source",
    "fabricated_citation",
    "mismatched_citation",
    "no_direct_support",
    "wrong_jurisdiction",
    "wrong_population",
    "stale_source",
    "causation_error",
    "omitted_counterevidence",
    "missing_context",
    "conflict_of_interest",
    "retraction_correction",
    "overconfident_wording",
    "high_stakes_unsafe",
  ]),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export const ProsecutorOutputSchema = z.object({
  objections: z.array(ProsecutorObjectionSchema),
  recommendation: z.enum([
    "retain",
    "narrow",
    "add_caveat",
    "replace_source",
    "remove",
    "require_qualified_review",
  ]),
  single_provider_warning: z.boolean(),
  overall_confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string(),
});

export type ProsecutorOutput = z.infer<typeof ProsecutorOutputSchema>;
export type ProsecutorObjection = z.infer<typeof ProsecutorObjectionSchema>;
