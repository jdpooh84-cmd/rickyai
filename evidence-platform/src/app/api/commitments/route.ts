import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { safeLog } from "@/lib/security/sanitizer";
import type { CommitmentStatus } from "@/lib/supabase/types";

const CreateCommitmentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  commitment_text: z.string().min(10).max(10000),
  source_url: z.string().url().optional(),
  committed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  committer_name: z.string().max(200).optional(),
  committer_role: z.string().max(200).optional(),
});

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
    .from("commitments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status as CommitmentStatus);
  }

  const { data, error, count } = await query;

  if (error) {
    safeLog("error", "Failed to list commitments", { error });
    return NextResponse.json({ error: "Failed to load commitments" }, { status: 500 });
  }

  return NextResponse.json({ commitments: data, total: count ?? 0 });
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

  const parsed = CreateCommitmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const { data: commitment, error: insertError } = await supabase
    .from("commitments")
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      title: input.title,
      description: input.description ?? null,
      commitment_text: input.commitment_text,
      source_url: input.source_url ?? null,
      committed_at: input.committed_at ?? null,
      committer_name: input.committer_name ?? null,
      committer_role: input.committer_role ?? null,
    })
    .select()
    .single();

  if (insertError || !commitment) {
    safeLog("error", "Failed to create commitment", { error: insertError });
    return NextResponse.json({ error: "Failed to create commitment" }, { status: 500 });
  }

  await supabase.from("audit_events").insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    event_type: "commitment_created",
    event_data: { commitment_id: commitment.id, title: input.title },
  });

  return NextResponse.json(commitment, { status: 201 });
}
