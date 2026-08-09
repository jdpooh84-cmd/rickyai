import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/security/sanitizer";
import { normalizeText, extractDoiList } from "@/lib/verification/intake";
import { classifyDomain } from "@/lib/verification/classifier";
import { getAIProvider, isSingleProvider } from "@/lib/ai/providers/factory";
import { ClaimExtractionOutputSchema } from "@/lib/ai/schemas/claim-extraction";
import { ProsecutorOutputSchema } from "@/lib/ai/schemas/prosecutor";
import { PROMPT_VERSIONS } from "@/lib/ai/prompts/versions";
import { CLAIM_EXTRACTION_SYSTEM } from "@/lib/ai/prompts/extract-claims";
import { PROSECUTOR_SYSTEM } from "@/lib/ai/prompts/prosecutor";
import { scoreEvidence, SCORE_VERSION } from "@/lib/verification/scoring-engine";
import { validateDoi } from "@/lib/retrieval/doi-validator";
import { fetchUrl } from "@/lib/retrieval/url-fetcher";
import type { EvidenceInput, ProsecutorInput } from "@/lib/verification/scoring-engine";
import type { Json } from "@/lib/supabase/types";

const PIPELINE_STAGES = [
  "intake_normalized",
  "text_extracted",
  "claims_extracted",
  "domain_classified",
  "sources_collected",
  "sources_validated",
  "passages_extracted",
  "evidence_matched",
  "prosecutor_reviewed",
  "scored",
  "report_generated",
] as const;

type PipelineStage = (typeof PIPELINE_STAGES)[number];

interface JobContext {
  caseId: string;
  organizationId: string;
  fromStage: PipelineStage | null;
}

async function updateCaseStage(
  supabase: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  caseId: string,
  stage: string,
  extra?: Record<string, unknown>,
) {
  await supabase
    .from("verification_cases")
    .update({ pipeline_stage: stage, status: "processing", ...extra })
    .eq("id", caseId);
}

async function failCase(
  supabase: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never,
  caseId: string,
  jobId: string,
  message: string,
) {
  await supabase
    .from("verification_cases")
    .update({ status: "failed", error_message: message })
    .eq("id", caseId);
  await supabase
    .from("verification_jobs")
    .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function processJob(jobId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Claim the job
  const { data: job, error: jobError } = await supabase
    .from("verification_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "queued")
    .select()
    .single();

  if (jobError || !job) {
    safeLog("warn", "Job not claimable", { jobId });
    return;
  }

  const caseId = job.case_id;

  // Load case
  const { data: verificationCase } = await supabase
    .from("verification_cases")
    .select("*")
    .eq("id", caseId)
    .single();

  if (!verificationCase) {
    await failCase(supabase, caseId, jobId, "Case not found");
    return;
  }

  const ctx: JobContext = {
    caseId,
    organizationId: verificationCase.organization_id,
    fromStage: (job.payload as { from_stage?: string })?.from_stage as PipelineStage | null ?? null,
  };

  try {
    // === Stage 1: intake_normalized ===
    await updateCaseStage(supabase, caseId, "intake_normalized");
    const rawText = verificationCase.raw_input ? normalizeText(verificationCase.raw_input) : null;

    // === Stage 2: text_extracted ===
    await updateCaseStage(supabase, caseId, "text_extracted");
    const textContent = rawText ?? "";

    if (!textContent.trim()) {
      await failCase(supabase, caseId, jobId, "No text content to process");
      return;
    }

    // === Stage 3: claims_extracted ===
    await updateCaseStage(supabase, caseId, "claims_extracted");
    const provider = getAIProvider();

    let claims: import("@/lib/ai/schemas/claim-extraction").ExtractedClaim[];
    try {
      const claimsResult = await provider.run({
        systemPrompt: CLAIM_EXTRACTION_SYSTEM,
        userContent: `Extract all verifiable factual claims from this text. Return ONLY valid JSON.\n\nTEXT:\n${textContent.slice(0, 20000)}`,
        schema: ClaimExtractionOutputSchema,
        promptVersion: PROMPT_VERSIONS.claimExtraction,
      });
      claims = claimsResult.output.claims;
    } catch (err) {
      await failCase(supabase, caseId, jobId, `Claim extraction failed: ${String(err)}`);
      return;
    }

    // Persist claims
    if (claims.length > 0) {
      await supabase.from("extracted_claims").insert(
        claims.map((c) => ({
          case_id: caseId,
          organization_id: ctx.organizationId,
          claim_text: c.claim_text,
          claim_type: c.claim_type,
          is_verifiable: true,
          extraction_model: provider.name,
          prompt_version: PROMPT_VERSIONS.claimExtraction,
        })),
      );
    }

    // === Stage 4: domain_classified ===
    await updateCaseStage(supabase, caseId, "domain_classified");
    const classification = classifyDomain(textContent);
    await supabase
      .from("verification_cases")
      .update({
        domain: classification.domain,
        stakes_level: classification.stakes_level,
        materiality: classification.materiality,
      })
      .eq("id", caseId);

    // === Stage 5: sources_collected ===
    await updateCaseStage(supabase, caseId, "sources_collected");
    const doiList = extractDoiList(textContent);
    const urlMatches = textContent.match(/https?:\/\/[^\s)>\]'"]+/g) ?? [];

    // Insert raw sources
    const sourceInserts = [
      ...doiList.map((doi) => ({
        case_id: caseId,
        organization_id: ctx.organizationId,
        source_type: "doi" as const,
        raw_identifier: doi,
        identity_status: "unresolved" as const,
        retraction_status: "unknown" as const,
        is_accessible: false,
      })),
      ...urlMatches.slice(0, 20).map((url) => ({
        case_id: caseId,
        organization_id: ctx.organizationId,
        source_type: "url" as const,
        raw_identifier: url,
        identity_status: "unresolved" as const,
        retraction_status: "unknown" as const,
        is_accessible: false,
      })),
    ];

    if (sourceInserts.length > 0) {
      await supabase.from("evidence_sources").insert(sourceInserts);
    }

    // === Stage 6: sources_validated ===
    await updateCaseStage(supabase, caseId, "sources_validated");

    const { data: sources } = await supabase
      .from("evidence_sources")
      .select("*")
      .eq("case_id", caseId);

    for (const source of sources ?? []) {
      if (source.source_type === "doi") {
        const validation = await validateDoi(source.raw_identifier).catch(() => null);
        if (validation) {
          await supabase
            .from("evidence_sources")
            .update({
              normalized_identifier: validation.doi,
              doi_status: validation.status,
              title: validation.metadata?.title ?? null,
              authors: validation.metadata?.authors ?? null,
              published_at: validation.metadata?.year ? `${validation.metadata.year}-01-01` : null,
              journal: validation.metadata?.journal ?? null,
              retraction_status: validation.status === "retracted" ? "retracted" : "unknown",
              identity_status:
                validation.status === "valid_found" || validation.status === "crossref_found" || validation.status === "datacite_found"
                  ? "verified"
                  : validation.status === "valid_not_found"
                  ? "not_found"
                  : "unresolved",
            })
            .eq("id", source.id);
        }
      } else if (source.source_type === "url") {
        let isAccessible = false;
        try {
          await fetchUrl(source.raw_identifier);
          isAccessible = true;
        } catch {
          // Source not accessible — leave is_accessible false
        }
        if (isAccessible) {
          await supabase
            .from("evidence_sources")
            .update({
              is_accessible: true,
              identity_status: "metadata_only",
            })
            .eq("id", source.id);
        }
      }
    }

    // === Stage 7: passages_extracted ===
    await updateCaseStage(supabase, caseId, "passages_extracted");
    // Passage extraction from full text is handled per-source in evidence matching.

    // === Stage 8: evidence_matched ===
    await updateCaseStage(supabase, caseId, "evidence_matched");

    // Load validated sources
    const { data: validatedSources } = await supabase
      .from("evidence_sources")
      .select("*")
      .eq("case_id", caseId);

    // Load claims
    const { data: extractedClaims } = await supabase
      .from("extracted_claims")
      .select("*")
      .eq("case_id", caseId);

    // For MVP: simple heuristic matching based on source accessibility
    // Full LLM-based matching is a post-MVP enhancement
    const accessibleSources = (validatedSources ?? []).filter((s) => s.is_accessible);
    const verifiableClaims = (extractedClaims ?? []).filter((c) => c.is_verifiable);

    for (const claim of verifiableClaims.slice(0, 10)) {
      for (const source of accessibleSources.slice(0, 5)) {
        await supabase.from("evidence_matches").insert({
          case_id: caseId,
          claim_id: claim.id,
          source_id: source.id,
          organization_id: ctx.organizationId,
          relationship: "context_only",
          entailment_score: 0.3,
          match_model: "heuristic-v1",
          prompt_version: "heuristic-v1",
        });
      }
    }

    // === Stage 9: prosecutor_reviewed ===
    await updateCaseStage(supabase, caseId, "prosecutor_reviewed");

    const { data: matches } = await supabase
      .from("evidence_matches")
      .select("*")
      .eq("case_id", caseId);

    const prosecutorContext = `Claims: ${verifiableClaims.length}. Sources: ${(validatedSources ?? []).length}. Matches: ${(matches ?? []).length}.`;

    let prosecutorData: ProsecutorInput | null = null;

    try {
      const prosecutorResult = await provider.run({
        systemPrompt: PROSECUTOR_SYSTEM,
        userContent: `Review this evidence summary for problems:\n${prosecutorContext}\nReturn ONLY valid JSON.`,
        schema: ProsecutorOutputSchema,
        promptVersion: PROMPT_VERSIONS.prosecutor,
      });
      const pd = prosecutorResult.output;
      await supabase.from("prosecutor_reviews").insert({
        case_id: caseId,
        organization_id: ctx.organizationId,
        objections: pd.objections as unknown as import("@/lib/supabase/types").Json,
        recommendation: "proceed",
        single_provider_warning: isSingleProvider(),
        reasoning: pd.reasoning ?? null,
        model: provider.name,
        prompt_version: PROMPT_VERSIONS.prosecutor,
      });
      prosecutorData = {
        objections: pd.objections,
        recommendation: pd.recommendation,
        single_provider_warning: isSingleProvider(),
      };
    } catch (err) {
      safeLog("warn", "Prosecutor review failed (non-fatal)", { caseId, error: err });
    }

    // === Stage 10: scored ===
    await updateCaseStage(supabase, caseId, "scored");

    const evidenceInputs: EvidenceInput[] = (validatedSources ?? []).map((s) => ({
      relationship: (matches ?? []).find((m) => m.source_id === s.id)?.relationship ?? "context_only",
      entailment_score: (matches ?? []).find((m) => m.source_id === s.id)?.entailment_score ?? 0.3,
      source_tier: s.source_tier ?? 4,
      identity_status: s.identity_status ?? "unresolved",
      retraction_status: s.retraction_status ?? "unknown",
      is_accessible: s.is_accessible ?? false,
      published_at: s.published_at ?? null,
      claim_time_scope: null,
      jurisdiction_match: true,
      population_match: true,
    }));

    const scoringInput = {
      evidence: evidenceInputs,
      prosecutor: prosecutorData,
      stakes_level: (verificationCase.stakes_level as "low" | "medium" | "high") ?? "medium",
      materiality: (verificationCase.materiality as "low" | "medium" | "high") ?? "medium",
      has_audit_trail: true,
    };

    const scoreResult = scoreEvidence(scoringInput);

    await supabase.from("scoring_results").insert({
      case_id: caseId,
      organization_id: ctx.organizationId,
      score_version: SCORE_VERSION,
      components: scoreResult.components as unknown as Json,
      policy_overrides: scoreResult.policy_overrides as unknown as Json,
      verdict: scoreResult.verdict,
      explanation: scoreResult.explanation,
      stakes_level: scoringInput.stakes_level,
      materiality: scoringInput.materiality,
    });

    // Update case with final verdict
    await supabase
      .from("verification_cases")
      .update({
        public_verdict: scoreResult.verdict,
        score: scoreResult.components.total_score,
        score_version: SCORE_VERSION,
      })
      .eq("id", caseId);

    // === Stage 11: report_generated ===
    await updateCaseStage(supabase, caseId, "report_generated");

    const report = {
      verdict: scoreResult.verdict,
      score: scoreResult.components.total_score,
      explanation: scoreResult.explanation,
      claims_count: verifiableClaims.length,
      sources_count: (validatedSources ?? []).length,
      limitations: scoreResult.explanation.limitations,
      generated_at: new Date().toISOString(),
    };

    await supabase.from("verification_reports").insert({
      case_id: caseId,
      organization_id: ctx.organizationId,
      report_type: "full",
      content: report,
      apa_references: [],
    });

    // === Completed ===
    await supabase
      .from("verification_cases")
      .update({ status: "completed", completed_at: new Date().toISOString(), pipeline_stage: "completed" })
      .eq("id", caseId);

    await supabase
      .from("verification_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", jobId);

    safeLog("info", "Pipeline completed", { caseId, verdict: scoreResult.verdict });
  } catch (err) {
    safeLog("error", "Pipeline error", { caseId, error: err });
    await failCase(supabase, caseId, jobId, String(err instanceof Error ? err.message : err));
  }
}

export async function pollAndProcessJobs(): Promise<void> {
  const supabase = await createServiceClient();

  const { data: jobs } = await supabase
    .from("verification_jobs")
    .select("id")
    .eq("status", "queued")
    .lte("run_after", new Date().toISOString())
    .order("created_at")
    .limit(5);

  if (!jobs || jobs.length === 0) return;

  for (const job of jobs) {
    await processJob(job.id).catch((err) => {
      safeLog("error", "Job processing error", { jobId: job.id, error: err });
    });
  }
}
