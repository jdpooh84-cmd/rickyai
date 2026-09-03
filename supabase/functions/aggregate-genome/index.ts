/**
 * aggregate-genome — Growth Genome aggregation pipeline worker.
 *
 * Called by pg_cron every hour (see migration 20260903000016_automation_cron.sql).
 *
 * Collects concluded Growth Lab experiments from businesses that have opted in
 * to genome contribution (growth_genome_settings.contribute_anonymized = true),
 * and aggregates anonymized findings into genome_contributions and
 * genome_aggregate_findings.
 *
 * NOTE on schema: The DB schema for these tables (milestone9_genome.sql) differs
 * from the task specification. This function uses the actual columns present:
 *   genome_contributions: business_id, experiment_family, context_industry,
 *                         control_exposures, control_conversions,
 *                         treatment_exposures, treatment_conversions, effect_estimate
 *   genome_aggregate_findings: experiment_family, context_hash, similar_businesses,
 *                              total_observations, effect_estimate, uncertainty,
 *                              evidence_level
 *
 * Privacy threshold: only contributes experiments with >= 30 total exposures.
 * Business-identifying data (business_id, name) is NEVER logged or stored in
 * aggregate findings. Only experiment_family (type of experiment) and
 * anonymized metrics are stored.
 *
 * Auth: RECONCILE_SECRET query param (constant-time compare).
 *       verify_jwt = false — pg_cron cannot present a JWT.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const PRIVACY_MIN_EXPOSURES = 30;
const MAX_EXPERIMENTS_PER_SWEEP = 20;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Slugify an experiment family name for use as a stable context key. */
function slugify(text: string): string {
  return (text ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

/**
 * Map evidence count to a qualitative evidence level using a simple threshold.
 * evidence_level CHECK constraint: 'anecdotal' | 'weak' | 'moderate' | 'strong'
 */
function evidenceLevel(count: number): string {
  if (count >= 50) return "strong";
  if (count >= 20) return "moderate";
  if (count >= 5) return "weak";
  return "anecdotal";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: require RECONCILE_SECRET
  const reconcileSecret = Deno.env.get("RECONCILE_SECRET");
  if (!reconcileSecret) {
    console.error("[aggregate-genome] RECONCILE_SECRET not set — refusing to run");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const reqUrl = new URL(req.url);
  const provided = reqUrl.searchParams.get("secret") ?? "";
  if (!constantTimeEqual(provided, reconcileSecret)) {
    console.warn("[aggregate-genome] Rejected: invalid secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load business IDs that have opted in to genome contribution.
  // contribute_anonymized=true is the canonical opt-in flag.
  const { data: genomeSets, error: genomeErr } = await supabase
    .from("growth_genome_settings")
    .select("business_id")
    .eq("contribute_anonymized", true);

  if (genomeErr) {
    console.error("[aggregate-genome] Failed to load genome settings:", genomeErr.message);
    return new Response(JSON.stringify({ error: genomeErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const optedInBusinessIds = (genomeSets ?? []).map(
    (r: Record<string, unknown>) => r.business_id as string,
  );

  if (optedInBusinessIds.length === 0) {
    console.log("[aggregate-genome] No businesses opted in — nothing to do.");
    return new Response(
      JSON.stringify({ experiments_processed: 0, contributions_added: 0, skipped_privacy: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Find concluded experiments from opted-in businesses that have not yet been
  // contributed. We detect "already contributed" by checking genome_contributions
  // for a row with this business_id AND experiment_family created on the same UTC
  // date as the experiment's updated_at. This is a best-effort guard — the table
  // has no experiment_id FK because the schemas diverged. A proper unique index
  // would be the durable fix (future migration).
  const { data: experiments, error: expErr } = await supabase
    .from("growth_experiments")
    .select(`
      id,
      business_id,
      name,
      hypothesis,
      experiment_family,
      metric,
      status,
      started_at,
      updated_at
    `)
    .eq("status", "concluded")
    .in("business_id", optedInBusinessIds)
    .order("updated_at", { ascending: true })
    .limit(MAX_EXPERIMENTS_PER_SWEEP);

  if (expErr) {
    console.error("[aggregate-genome] Failed to load experiments:", expErr.message);
    return new Response(JSON.stringify({ error: expErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!experiments || experiments.length === 0) {
    console.log("[aggregate-genome] No concluded experiments to process.");
    return new Response(
      JSON.stringify({ experiments_processed: 0, contributions_added: 0, skipped_privacy: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(`[aggregate-genome] Found ${experiments.length} concluded experiment(s) to evaluate.`);

  let experimentsProcessed = 0;
  let contributionsAdded = 0;
  let skippedPrivacy = 0;

  for (const exp of experiments) {
    const experimentId = exp.id as string;
    const businessId = exp.business_id as string;
    const family = (exp.experiment_family as string | null) ?? "unknown";
    const metric = (exp.metric as string | null) ?? "conversion";

    try {
      // Load variants for this experiment
      const { data: variants } = await supabase
        .from("growth_experiment_variants")
        .select("id, name, allocation_start, allocation_end")
        .eq("experiment_id", experimentId);

      // Load exposures and outcomes
      const { data: exposures } = await supabase
        .from("growth_experiment_exposures")
        .select("id, variant_id")
        .eq("experiment_id", experimentId);

      const { data: outcomes } = await supabase
        .from("growth_experiment_outcomes")
        .select("id, variant_id, converted")
        .eq("experiment_id", experimentId);

      const variantList = variants ?? [];
      const exposureList = exposures ?? [];
      const outcomeList = outcomes ?? [];

      // Privacy threshold: require >= 30 total exposures across all variants
      const totalExposures = exposureList.length;
      if (totalExposures < PRIVACY_MIN_EXPOSURES) {
        // Never log business-identifying info; log only experiment ID and count
        console.log(
          `[aggregate-genome] experiment=${experimentId} skipped=privacy threshold=${PRIVACY_MIN_EXPOSURES} actual=${totalExposures}`,
        );
        skippedPrivacy++;
        continue;
      }

      // Compute per-variant stats
      const controlVariant = variantList.find(
        (v: Record<string, unknown>) => v.name === "control",
      );
      const treatmentVariant = variantList.find(
        (v: Record<string, unknown>) => v.name === "treatment",
      );

      const controlId = controlVariant?.id as string | undefined;
      const treatmentId = treatmentVariant?.id as string | undefined;

      const controlExposures = controlId
        ? exposureList.filter((e: Record<string, unknown>) => e.variant_id === controlId).length
        : Math.floor(totalExposures / 2);
      const treatmentExposures = treatmentId
        ? exposureList.filter((e: Record<string, unknown>) => e.variant_id === treatmentId).length
        : totalExposures - controlExposures;

      const controlConversions = controlId
        ? outcomeList.filter(
          (o: Record<string, unknown>) => o.variant_id === controlId && o.converted === true,
        ).length
        : 0;
      const treatmentConversions = treatmentId
        ? outcomeList.filter(
          (o: Record<string, unknown>) => o.variant_id === treatmentId && o.converted === true,
        ).length
        : 0;

      const controlRate = controlExposures > 0 ? controlConversions / controlExposures : 0;
      const treatmentRate = treatmentExposures > 0 ? treatmentConversions / treatmentExposures : 0;
      const effectEstimate = treatmentRate - controlRate;

      // Check if this experiment has already been contributed (best-effort dedup).
      // The contribution row's created_at date is compared against the experiment's
      // updated_at date — if a contribution was made on the same UTC day, skip.
      const updatedDate = (exp.updated_at as string | null)?.slice(0, 10) ?? "";
      if (updatedDate) {
        const { data: existing } = await supabase
          .from("genome_contributions")
          .select("id")
          .eq("business_id", businessId)
          .eq("experiment_family", family)
          .gte("created_at", updatedDate)
          .lt("created_at", new Date(new Date(updatedDate).getTime() + 86400000).toISOString().slice(0, 10))
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(
            `[aggregate-genome] experiment=${experimentId} skipped=already_contributed`,
          );
          experimentsProcessed++;
          continue;
        }
      }

      // Insert anonymized contribution. Business identity is captured in business_id
      // only for RLS purposes — aggregate findings contain NO business-identifying data.
      const { error: insertErr } = await supabase
        .from("genome_contributions")
        .insert({
          business_id: businessId,
          experiment_family: family,
          metric,
          control_exposures: controlExposures,
          control_conversions: controlConversions,
          treatment_exposures: treatmentExposures,
          treatment_conversions: treatmentConversions,
          effect_estimate: effectEstimate,
        });

      if (insertErr) {
        console.error(
          `[aggregate-genome] experiment=${experimentId} contribution insert failed:`,
          insertErr.message,
        );
        experimentsProcessed++;
        continue;
      }

      console.log(`[aggregate-genome] experiment=${experimentId} contribution=inserted`);
      contributionsAdded++;
      experimentsProcessed++;

      // Build a stable context_hash from the experiment family slug
      const familySlug = slugify(family);

      // Aggregate: load all existing contributions for this experiment_family
      const { data: allContribs } = await supabase
        .from("genome_contributions")
        .select("control_exposures, control_conversions, treatment_exposures, treatment_conversions, effect_estimate")
        .eq("experiment_family", family);

      const contribs = allContribs ?? [];
      const cohortSize = contribs.length;
      const totalObs = contribs.reduce(
        (sum: number, c: Record<string, unknown>) =>
          sum + ((c.control_exposures as number) || 0) + ((c.treatment_exposures as number) || 0),
        0,
      );
      const avgEffect = cohortSize > 0
        ? contribs.reduce(
          (sum: number, c: Record<string, unknown>) => sum + ((c.effect_estimate as number) || 0),
          0,
        ) / cohortSize
        : 0;
      // Simple uncertainty: std dev of effect estimates
      const variance = cohortSize > 1
        ? contribs.reduce(
          (sum: number, c: Record<string, unknown>) =>
            sum + Math.pow(((c.effect_estimate as number) || 0) - avgEffect, 2),
          0,
        ) / cohortSize
        : 0;
      const uncertainty = Math.sqrt(variance);

      // Upsert genome_aggregate_findings by (experiment_family, context_hash)
      const { error: upsertErr } = await supabase
        .from("genome_aggregate_findings")
        .upsert(
          {
            experiment_family: family,
            context_hash: familySlug,
            similar_businesses: cohortSize,
            total_observations: totalObs,
            effect_estimate: avgEffect,
            uncertainty,
            evidence_level: evidenceLevel(cohortSize),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "experiment_family,context_hash" },
        );

      if (upsertErr) {
        console.error(
          `[aggregate-genome] aggregate upsert failed for family=${family}:`,
          upsertErr.message,
        );
      } else {
        console.log(
          `[aggregate-genome] aggregate updated family=${family} cohort=${cohortSize} evidence_level=${evidenceLevel(cohortSize)}`,
        );
      }
    } catch (err) {
      console.error(`[aggregate-genome] experiment=${experimentId} unexpected error:`, String(err));
      experimentsProcessed++;
    }
  }

  console.log(
    `[aggregate-genome] Done. experiments_processed=${experimentsProcessed} contributions_added=${contributionsAdded} skipped_privacy=${skippedPrivacy}`,
  );

  return new Response(
    JSON.stringify({ experiments_processed: experimentsProcessed, contributions_added: contributionsAdded, skipped_privacy: skippedPrivacy }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
