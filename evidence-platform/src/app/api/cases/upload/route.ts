import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getRateLimitKey } from "@/lib/security/rate-limiter";
import { validateMimeType, validateFileSize } from "@/lib/verification/parsers";
import { hashBuffer, sanitizeStoragePath } from "@/lib/verification/intake";
import { safeLog } from "@/lib/security/sanitizer";
import { z } from "zod";

const MAX_FILE_SIZE = parseInt(process.env["MAX_FILE_SIZE_BYTES"] ?? "15728640", 10);

const UploadMetaSchema = z.object({
  title: z.string().min(1).max(500),
  stakes_level: z.enum(["low", "medium", "high"]).optional(),
  materiality: z.enum(["low", "medium", "high"]).optional(),
});

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const metaParsed = UploadMetaSchema.safeParse({
    title: formData.get("title"),
    stakes_level: formData.get("stakes_level") ?? undefined,
    materiality: formData.get("materiality") ?? undefined,
  });
  if (!metaParsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: metaParsed.error.flatten() },
      { status: 400 },
    );
  }

  const mimeType = file.type;
  if (!validateMimeType(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Accepted: PDF, DOCX, TXT, Markdown.` },
      { status: 415 },
    );
  }

  if (!validateFileSize(file.size)) {
    return NextResponse.json(
      { error: `File exceeds maximum size of ${MAX_FILE_SIZE} bytes.` },
      { status: 413 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentHash = hashBuffer(buffer);

  // Create case record first to get the ID for the storage path.
  const { data: newCase, error: insertError } = await supabase
    .from("verification_cases")
    .insert({
      organization_id: profile.organization_id,
      created_by: user.id,
      title: metaParsed.data.title,
      input_type: "file_upload",
      raw_input: null,
      stakes_level: metaParsed.data.stakes_level ?? null,
      materiality: metaParsed.data.materiality ?? null,
      status: "queued",
      user_context: { content_hash: contentHash, original_filename: file.name, mime_type: mimeType },
    })
    .select()
    .single();

  if (insertError || !newCase) {
    safeLog("error", "Failed to create case for upload", { error: insertError });
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }

  const storagePath = sanitizeStoragePath(profile.organization_id, newCase.id, file.name);

  // Upload to Supabase Storage using the service client (bypasses RLS for storage bucket).
  const serviceClient = await createServiceClient();
  const { error: uploadError } = await serviceClient.storage
    .from("case-uploads")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    safeLog("error", "Storage upload failed", { error: uploadError, caseId: newCase.id });
    await supabase
      .from("verification_cases")
      .update({ status: "failed", error_message: "File storage upload failed" })
      .eq("id", newCase.id);
    return NextResponse.json({ error: "File upload to storage failed" }, { status: 500 });
  }

  // Store the storage path on the case record.
  await supabase
    .from("verification_cases")
    .update({ file_path: storagePath })
    .eq("id", newCase.id);

  await supabase.from("audit_events").insert({
    organization_id: profile.organization_id,
    actor_id: user.id,
    case_id: newCase.id,
    event_type: "case_created",
    event_data: { input_type: "file_upload", title: metaParsed.data.title, mime_type: mimeType },
  });

  await supabase.from("verification_jobs").insert({
    case_id: newCase.id,
    job_type: "full_pipeline",
    payload: {},
    status: "queued",
    attempts: 0,
    run_after: new Date().toISOString(),
  });

  return NextResponse.json({ id: newCase.id, status: "queued" }, { status: 201 });
}
