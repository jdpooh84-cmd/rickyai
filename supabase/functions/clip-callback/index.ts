import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * clip-callback — Webhook endpoint for Klap to POST when a project finishes.
 *
 * Set this URL in your Klap dashboard → Project settings → Webhook:
 *   https://psmxeckstfeyxlqzzkgw.supabase.co/functions/v1/clip-callback
 *
 * Klap webhook payload shape (approximate — may vary by API version):
 * {
 *   "id": "project-uuid",        // Klap project ID (= external_job_id in our DB)
 *   "status": "done" | "failed",
 *   "clips": [
 *     { "id": "...", "video_url": "...", "title": "..." }
 *   ],
 *   "error": "..."               // present on failure
 * }
 *
 * verify_jwt = false in config.toml — this is a public webhook endpoint.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Map Klap status → our status
    let status: "completed" | "failed" | null = null;
    if (klapStatus === "done" || klapStatus === "succeeded") status = "completed";
    else if (klapStatus === "failed" || klapStatus === "error") status = "failed";

    if (!status) {
      // In-progress ping — ignore
      console.log(`[clip-callback] Ignoring in-progress ping for ${externalJobId} (status=${klapStatus})`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the job row by external_job_id
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

    return new Response(JSON.stringify({ success: true, job_id: job.id, status, clip_count: clipUrls.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[clip-callback] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
