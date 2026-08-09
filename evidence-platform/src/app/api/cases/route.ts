import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { CreateCaseInputSchema, hashText, normalizeText } from "@/lib/verification/intake";
import type { CaseStatus } from "@/lib/supabase/types";
import { safeLog } from "@/lib/security/sanitizer";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const status = searchParams.get("status");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("verification_cases")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status as CaseStatus);
  }

  const { data, error, count } = await query;

  if (error) {
    safeLog("error", "Failed to list cases", { error });
    return NextResponse.json({ error: "Failed to load cases" }, { status: 500 });
  }

  return NextResponse.json({ cases: data, total: count ?? 0 });
}

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateCaseInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const rawInput = input.raw_input ? normalizeText(input.raw_input) : null;
  const inputHash = rawInput ? hashText(rawInput) : null;

  const { data: newCase, error: insertError } = await supabase
    .from("verification_cases")
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      title: input.title,
      input_type: input.input_type,
      raw_input: rawInput,
      source_url: input.source_url ?? null,
      status: "queued",
      user_context: { ...(input.user_context ?? {}), input_hash: inputHash },
    })
    .select()
    .single();

  if (insertError || !newCase) {
    safeLog("error", "Failed to create case", { error: insertError });
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    case_id: newCase.id,
    event_type: "case_created",
    event_data: { input_type: input.input_type, title: input.title },
  });

  await supabase.from("verification_jobs").insert({
    case_id: newCase.id,
    job_type: "full_pipeline",
    payload: {},
    status: "queued",
    attempts: 0,
    run_after: new Date().toISOString(),
  });

  return NextResponse.json({ id: newCase.id, status: newCase.status }, { status: 201 });
}
