import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { safeLog } from "@/lib/security/sanitizer";
import { runBenchmarks } from "@/lib/benchmarks/runner";
import type { Json } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const { allowed } = checkRateLimit(getRateLimitKey(request));
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Admin only
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results = await runBenchmarks();

    const { data: run, error: insertError } = await supabase
      .from("benchmark_runs")
      .insert({
        run_by: user.id,
        score_version: results.score_version,
        total_fixtures: results.total,
        passed: results.passed,
        failed: results.failed,
        gate_results: results.gate_results as unknown as Json,
        all_gates_pass: results.all_gates_pass,
        details: results.details as unknown as Json,
      })
      .select()
      .single();

    if (insertError || !run) {
      safeLog("error", "Failed to store benchmark run", { error: insertError });
      return NextResponse.json({ error: "Failed to store results" }, { status: 500 });
    }

    return NextResponse.json(
      {
        run_id: run.id,
        all_gates_pass: results.all_gates_pass,
        passed: results.passed,
        failed: results.failed,
        total: results.total,
        gate_results: results.gate_results,
        score_version: results.score_version,
      },
      { status: results.all_gates_pass ? 200 : 422 },
    );
  } catch (err) {
    safeLog("error", "Benchmark run error", { error: err });
    return NextResponse.json({ error: "Benchmark run failed" }, { status: 500 });
  }
}
