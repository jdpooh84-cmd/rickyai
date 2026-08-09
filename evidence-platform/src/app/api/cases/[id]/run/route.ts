import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { safeLog } from "@/lib/security/sanitizer";

type RouteParams = { params: Promise<{ id: string }> };

const RunInputSchema = z.object({
  from_stage: z.string().optional(),
});

const VALID_STAGES = [
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

export async function POST(request: Request, { params }: RouteParams) {
  const { allowed } = checkRateLimit(getRateLimitKey(request));
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = RunInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { from_stage } = parsed.data;

  if (from_stage && !VALID_STAGES.includes(from_stage as (typeof VALID_STAGES)[number])) {
    return NextResponse.json({ error: "Invalid stage name" }, { status: 400 });
  }

  // Verify case exists and user has access (RLS)
  const { data: existing } = await supabase
    .from("verification_cases")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (existing.status === "processing") {
    return NextResponse.json({ error: "Case is already processing" }, { status: 409 });
  }

  if (existing.status === "cancelled") {
    return NextResponse.json({ error: "Cannot re-run a cancelled case" }, { status: 409 });
  }

  // Reset case to queued
  const { error: updateError } = await supabase
    .from("verification_cases")
    .update({ status: "queued", error_message: null, pipeline_stage: from_stage ?? null })
    .eq("id", id);

  if (updateError) {
    safeLog("error", "Failed to reset case for re-run", { error: updateError, caseId: id });
    return NextResponse.json({ error: "Failed to reset case" }, { status: 500 });
  }

  // Enqueue a new job
  const { data: job, error: jobError } = await supabase
    .from("verification_jobs")
    .insert({
      case_id: id,
      job_type: "full_pipeline",
      payload: { from_stage: from_stage ?? null },
      status: "queued",
      attempts: 0,
      run_after: new Date().toISOString(),
    })
    .select()
    .single();

  if (jobError || !job) {
    safeLog("error", "Failed to enqueue re-run job", { error: jobError, caseId: id });
    return NextResponse.json({ error: "Failed to enqueue job" }, { status: 500 });
  }

  return NextResponse.json({ case_id: id, job_id: job.id, status: "queued" }, { status: 202 });
}
