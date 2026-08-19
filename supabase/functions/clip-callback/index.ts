import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * clip-callback — Webhook endpoint for Klap to POST when a project finishes.
 *
 * B-02 SECURITY: This endpoint is public (verify_jwt = false) but is protected by
 * a pre-shared token embedded in the callback URL registered in the Klap dashboard:
 *   https://<project>.supabase.co/functions/v1/clip-callback?secret=<KLAP_WEBHOOK_SECRET>
 *
 * The token is compared with constant-time equality to prevent timing attacks.
 * Requests without a matching token receive 401.  Duplicate callbacks are
 * rejected via webhook_receipts idempotency store.
 *
 * Klap webhook payload shape (approximate — may vary by API version):
 * {
 *   "id": "project-uuid",
 *   "status": "done" | "failed",
 *   "clips": [{ "id": "...", "video_url": "...", "title": "..." }],
 *   "error": "..."
 * }
 *
 * verify_jwt = false in config.toml — this is a public webhook endpoint.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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

  // ── B-02: Token verification ──
  const webhookSecret = Deno.env.get("KLAP_WEBHOOK_SECRET");
  if (webhookSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? "";
    if (!constantTimeEqual(provided, webhookSecret)) {
      console.warn("[clip-callback] Rejected: invalid secret token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.warn("[clip-callback] KLAP_WEBHOOK_SECRET not set — token check skipped (set it to enable protection)");
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rawBody = await req.json();
    console.log("[clip-callback] Received:", JSON.stringify(rawBody));

    const body = Array.isArray(rawBody) ? rawBody[0] : rawBody;
    const externalJobId: string | null = body.id || null;
    const klapStatus: string = body.status || "";

    if (!externalJobId) {
      return new Response(JSON.stringify({ error: "Missing project id in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let status: "completed" | "failed" | null = null;
    if (klapStatus === "done" || klapStatus === "succeeded") status = "completed";
    else if (klapStatus === "failed" || klapStatus === "error") status = "failed";

    if (!status) {
      console.log(`[clip-callback] Ignoring in-progress ping for ${externalJobId} (status=${klapStatus})`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── B-02: Idempotency check ──
    const fingerprint = `klap:${externalJobId}:${klapStatus}`;
    const { error: receiptErr } = await supabase
      .from("webhook_receipts")
      .insert({
        provider: "klap",
        event_fingerprint: fingerprint,
        payload_summary: JSON.stringify({ external_job_id: externalJobId, status }),
      });

    if (receiptErr) {
      if (receiptErr.code === "23505") {
        console.log(`[clip-callback] Duplicate callback ignored for fingerprint: ${fingerprint}`);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[clip-callback] Receipt insert error:", receiptErr.message);
    }

    const { data: job, error: lookupErr } = await supabase
      .from("clip_generation_jobs")
      .select("id, user_id, business_id")
      .eq("external_job_id", externalJobId)
      .eq("provider", "klap")
      .single();

    if (lookupErr || !job) {
      console.error("[clip-callback] Job not found for external_job_id:", externalJobId);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[clip-callback] Updating job ${job.id}: status=${status}`);

    const clips: any[] = body.clips || body.videos || [];
    const clipUrls: string[] = clips
      .map((c: any) => c.video_url || c.url || c.download_url)
      .filter(Boolean);

    const updateFields: Record<string, any> = {
      status,
      result_payload: body,
      updated_at: new Date().toISOString(),
    };

    if (status === "completed") {
      updateFields.clip_urls = clipUrls;
      updateFields.clip_count = clipUrls.length;
    } else {
      updateFields.error_message = body.error || "Klap reported failure";
    }

    const { error: updateErr } = await supabase
      .from("clip_generation_jobs")
      .update(updateFields)
      .eq("id", job.id);

    if (updateErr) {
      console.error("[clip-callback] DB update failed:", updateErr);
      throw new Error(updateErr.message);
    }

    console.log(`[clip-callback] Job ${job.id} updated — ${clipUrls.length} clips`);

    return new Response(
      JSON.stringify({ success: true, job_id: job.id, status, clip_count: clipUrls.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[clip-callback] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
