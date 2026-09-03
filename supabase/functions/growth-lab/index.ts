import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, requireOneOf, optionalString, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function stableHash(input: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Use first 4 bytes as a 32-bit int, mod 10000
  const val = (hashArray[0] * 16777216 + hashArray[1] * 65536 + hashArray[2] * 256 + hashArray[3]) >>> 0;
  return val % 10000;
}

function zTest(p1: number, n1: number, p2: number, n2: number): number {
  if (n1 === 0 || n2 === 0) return 0;
  const p = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 0;
  return Math.abs((p1 - p2) / se);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();

    const validated = validate(() => ({
      action: requireOneOf(body.action, "action", [
        "create_experiment",
        "assign_variant",
        "record_outcome",
        "get_results",
      ] as const),
      businessId: body.businessId !== undefined ? requireUuid(body.businessId, "businessId") : undefined,
      experimentId: body.experimentId !== undefined ? requireUuid(body.experimentId, "experimentId") : undefined,
    }));
    if (validated instanceof Response) return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { action } = body;

    if (action === "create_experiment") {
      const { businessId, name, hypothesis, experimentFamily, controlDescription, treatmentDescription, metric, minimumSample, minimumRuntimeDays } = body;
      if (!businessId || !name) return new Response(JSON.stringify({ error: "businessId and name required" }), { status: 400, headers: corsHeaders });

      const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).eq("user_id", user.id).maybeSingle();
      if (!biz) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

      const { data: exp } = await supabase.from("growth_experiments").insert({
        business_id: businessId,
        name,
        hypothesis,
        experiment_family: experimentFamily,
        control_description: controlDescription,
        treatment_description: treatmentDescription,
        metric: metric || "conversion",
        minimum_sample: minimumSample || 100,
        minimum_runtime_days: minimumRuntimeDays || 7,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();

      // Create control and treatment variants
      await supabase.from("growth_experiment_variants").insert([
        { experiment_id: exp!.id, name: "control", allocation_start: 0, allocation_end: 4999 },
        { experiment_id: exp!.id, name: "treatment", allocation_start: 5000, allocation_end: 9999 },
      ]);

      return new Response(JSON.stringify({ experiment: exp }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "assign_variant") {
      const { experimentId, subjectId } = body;
      const { data: variants } = await supabase.from("growth_experiment_variants").select("*").eq("experiment_id", experimentId);
      if (!variants || variants.length === 0) return new Response(JSON.stringify({ error: "No variants" }), { status: 404, headers: corsHeaders });

      const bucket = await stableHash(`${experimentId}${subjectId}`);
      const variant = variants.find(v => bucket >= v.allocation_start && bucket <= v.allocation_end) || variants[0];

      // Record exposure
      await supabase.from("growth_experiment_exposures").insert({
        experiment_id: experimentId,
        variant_id: variant.id,
        subject_id: subjectId,
        business_id: body.businessId,
      }).onConflict().ignoreDuplicates();

      return new Response(JSON.stringify({ variant: variant.name, variantId: variant.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "record_outcome") {
      const { experimentId, variantId, subjectId, metricValue, converted } = body;
      await supabase.from("growth_experiment_outcomes").insert({
        experiment_id: experimentId,
        variant_id: variantId,
        subject_id: subjectId,
        metric_value: metricValue || 0,
        converted: converted || false,
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_results") {
      const { experimentId } = body;
      const { data: exp } = await supabase.from("growth_experiments").select("*").eq("id", experimentId).maybeSingle();
      if (!exp) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

      const { data: variants } = await supabase.from("growth_experiment_variants").select("*").eq("experiment_id", experimentId);
      const { data: outcomes } = await supabase.from("growth_experiment_outcomes").select("*").eq("experiment_id", experimentId);
      const { data: exposures } = await supabase.from("growth_experiment_exposures").select("*").eq("experiment_id", experimentId);

      const results = (variants || []).map(v => {
        const vExposures = (exposures || []).filter(e => e.variant_id === v.id);
        const vOutcomes = (outcomes || []).filter(o => o.variant_id === v.id);
        const conversions = vOutcomes.filter(o => o.converted).length;
        const rate = vExposures.length > 0 ? conversions / vExposures.length : 0;
        return { variant: v.name, exposures: vExposures.length, conversions, conversionRate: rate };
      });

      // Check guardrails
      const control = results.find(r => r.variant === "control");
      const treatment = results.find(r => r.variant === "treatment");
      let canDeclareWinner = false;
      let winner = "too_early";

      if (control && treatment) {
        const totalExposures = control.exposures + treatment.exposures;
        const runtimeDays = exp.started_at
          ? (Date.now() - new Date(exp.started_at).getTime()) / 86400000
          : 0;
        const meetsMinSample = totalExposures >= exp.minimum_sample;
        const meetsMinRuntime = runtimeDays >= exp.minimum_runtime_days;

        if (meetsMinSample && meetsMinRuntime) {
          const z = zTest(control.conversionRate, control.exposures, treatment.conversionRate, treatment.exposures);
          if (z > 1.96) {
            canDeclareWinner = true;
            winner = treatment.conversionRate > control.conversionRate ? "treatment" : "control";
          } else {
            winner = "inconclusive";
          }
        }
      }

      return new Response(JSON.stringify({ results, canDeclareWinner, winner, experiment: exp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
