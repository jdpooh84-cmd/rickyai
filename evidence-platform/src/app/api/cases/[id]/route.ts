import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { safeLog } from "@/lib/security/sanitizer";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
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

  // Fetch case (RLS enforces org membership)
  const { data: verificationCase, error: caseError } = await supabase
    .from("verification_cases")
    .select("*")
    .eq("id", id)
    .single();

  if (caseError || !verificationCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Fetch related data in parallel
  const [claimsResult, sourcesResult, matchesResult, prosecutorResult, scoringResult, reportResult] =
    await Promise.all([
      supabase.from("extracted_claims").select("*").eq("case_id", id).order("created_at"),
      supabase.from("evidence_sources").select("*").eq("case_id", id).order("source_tier"),
      supabase.from("evidence_matches").select("*").eq("case_id", id),
      supabase.from("prosecutor_reviews").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("scoring_results").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("verification_reports").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  if (claimsResult.error) {
    safeLog("error", "Failed to fetch claims", { error: claimsResult.error, caseId: id });
  }

  return NextResponse.json({
    case: verificationCase,
    claims: claimsResult.data ?? [],
    sources: sourcesResult.data ?? [],
    matches: matchesResult.data ?? [],
    prosecutor: prosecutorResult.data ?? null,
    scoring: scoringResult.data ?? null,
    report: reportResult.data ?? null,
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

  // Only allow cancellation of queued or failed cases
  const { data: existing } = await supabase
    .from("verification_cases")
    .select("id, status, created_by")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  if (existing.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["queued", "failed"].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot cancel case in status: ${existing.status}` },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("verification_cases")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    safeLog("error", "Failed to cancel case", { error, caseId: id });
    return NextResponse.json({ error: "Failed to cancel case" }, { status: 500 });
  }

  return NextResponse.json({ id, status: "cancelled" });
}
