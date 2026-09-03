/**
 * reconcile-renders — Creatomate stale-job reconciliation.
 *
 * Called by Supabase pg_cron every 10 minutes (see migration 20260903000002).
 *
 * Finds video_generation_jobs stuck in status='processing' for more than
 * STALE_AFTER_MINUTES.  For each stale job:
 *   1. Queries Creatomate for current render status.
 *   2. If completed: stores the video URL and marks the job completed.
 *   3. If failed:    records the error and marks the job failed.
 *   4. If still rendering: leaves it (will re-check next sweep).
 *   5. If not found / unknown render_id: marks the job failed with explanation.
 *
 * This means a missed webhook NEVER permanently strands a video.
 * The function is idempotent: safe to call multiple times for the same job.
 *
 * Authentication: protected by RECONCILE_SECRET env var (compared with the
 * query param ?secret=…). Internal calls from pg_cron/net embed the secret.
 * If RECONCILE_SECRET is unset the function refuses to run rather than
 * proceeding without auth.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const STALE_AFTER_MINUTES = 10;
const MAX_JOBS_PER_SWEEP = 50;

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

  // Auth: require reconcile secret
  const reconcileSecret = Deno.env.get("RECONCILE_SECRET");
  if (!reconcileSecret) {
    console.error("[reconcile-renders] RECONCILE_SECRET is not set — refusing to run");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const provided = url.searchParams.get("secret") ?? "";
  if (!constantTimeEqual(provided, reconcileSecret)) {
    console.warn("[reconcile-renders] Rejected: invalid secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const staleThreshold = new Date(Date.now() - STALE_AFTER_MINUTES * 60 * 1000).toISOString();

  // Find stale processing jobs that have a Creatomate render ID
  const { data: staleJobs, error: fetchErr } = await supabase
    .from("video_generation_jobs")
    .select("id, user_id, business_id, creatomate_render_id, status, updated_at")
    .eq("status", "processing")
    .not("creatomate_render_id", "is", null)
    .lt("updated_at", staleThreshold)
    .order("updated_at", { ascending: true })
    .limit(MAX_JOBS_PER_SWEEP);

  if (fetchErr) {
    console.error("[reconcile-renders] Failed to fetch stale jobs:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!staleJobs || staleJobs.length === 0) {
    console.log("[reconcile-renders] No stale jobs found.");
    return new Response(JSON.stringify({ ok: true, reconciled: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[reconcile-renders] Found ${staleJobs.length} stale job(s) to reconcile.`);

  const results: { jobId: string; outcome: string }[] = [];

  for (const job of staleJobs) {
    const renderId = job.creatomate_render_id as string;
    let outcome = "skipped";

    try {
      // Get the BYO Creatomate key for this user (same pattern as generate-video-v2)
      const { data: keyRow } = await supabase
        .from("user_api_keys")
        .select("encrypted_key, iv, provider")
        .eq("user_id", job.user_id)
        .eq("provider", "creatomate")
        .maybeSingle();

      // Fall back to platform key if no BYO key
      const platformKey = Deno.env.get("CREATOMATE_API_KEY") ?? "";
      let creatomateKey = platformKey;

      if (keyRow?.encrypted_key) {
        try {
          const { decrypt } = await import("../_shared/credential-service.ts");
          creatomateKey = await decrypt(keyRow.encrypted_key, keyRow.iv);
        } catch (decErr) {
          console.warn(`[reconcile-renders] Could not decrypt BYO key for job ${job.id}:`, decErr);
          creatomateKey = platformKey;
        }
      }

      if (!creatomateKey) {
        console.warn(`[reconcile-renders] No Creatomate key available for job ${job.id} — skipping`);
        results.push({ jobId: job.id, outcome: "no_key" });
        continue;
      }

      // Query Creatomate for this render
      const renderRes = await fetch(`https://api.creatomate.com/v2/renders/${renderId}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${creatomateKey}` },
      });

      if (!renderRes.ok) {
        if (renderRes.status === 404) {
          // Render not found — mark job failed
          console.log(`[reconcile-renders] Render ${renderId} not found at Creatomate. Marking job ${job.id} failed.`);
          await supabase
            .from("video_generation_jobs")
            .update({
              status: "failed",
              pipeline_stage: "failed",
              error_message: `Reconciliation: Creatomate render ${renderId} not found`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("user_id", job.user_id);
          outcome = "failed_not_found";
        } else {
          console.warn(`[reconcile-renders] Creatomate API error ${renderRes.status} for render ${renderId}`);
          outcome = "api_error";
        }
        results.push({ jobId: job.id, outcome });
        continue;
      }

      const render = await renderRes.json();
      const renderStatus: string = render.status ?? "";

      if (renderStatus === "succeeded" || renderStatus === "completed") {
        const videoUrl: string | null = render.url ?? null;
        const snapshotUrl: string | null = render.snapshot_url ?? null;
        const nowIso = new Date().toISOString();

        // Check idempotency — don't double-process
        const { error: receiptErr } = await supabase
          .from("webhook_receipts")
          .insert({
            provider: "creatomate",
            event_fingerprint: `creatomate:${renderId}:succeeded:reconcile`,
            payload_summary: JSON.stringify({ job_id: job.id, source: "reconciliation" }),
          });

        if (receiptErr && receiptErr.code === "23505") {
          console.log(`[reconcile-renders] Job ${job.id} already reconciled — skipping`);
          outcome = "already_done";
          results.push({ jobId: job.id, outcome });
          continue;
        }

        await supabase
          .from("video_generation_jobs")
          .update({
            status: "completed",
            pipeline_stage: "completed",
            video_url: videoUrl,
            result_payload: {
              video_url: videoUrl,
              video_type: "direct",
              message: "✅ Video ready! (Recovered by reconciliation)",
              pipeline_steps: { creatomate: "completed" },
              completed_at: nowIso,
              creatomate_render_id: renderId,
              recovered_by_reconciliation: true,
              original_provider_url: videoUrl,
            },
            error_message: null,
            completed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", job.id)
          .eq("user_id", job.user_id);

        // Also update content_posts if linked
        if (videoUrl) {
          await supabase
            .from("content_posts")
            .update({ media_url: videoUrl, status: "media_ready", updated_at: nowIso })
            .eq("business_id", job.business_id)
            .eq("user_id", job.user_id)
            .eq("production_tool", "creatomate")
            .order("created_at", { ascending: false })
            .limit(1);
        }

        console.log(`[reconcile-renders] Job ${job.id} RECOVERED — video: ${videoUrl}`);
        outcome = "recovered";

      } else if (renderStatus === "failed") {
        const errMsg = render.error_message ?? "Creatomate render failed";
        await supabase
          .from("video_generation_jobs")
          .update({
            status: "failed",
            pipeline_stage: "failed",
            error_message: `Reconciliation: ${errMsg}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("user_id", job.user_id);
        console.log(`[reconcile-renders] Job ${job.id} marked FAILED: ${errMsg}`);
        outcome = "failed";

      } else {
        // Still rendering (planned, queued, rendering) — leave it
        console.log(`[reconcile-renders] Job ${job.id} still in provider status '${renderStatus}' — leaving`);
        outcome = "still_rendering";
      }

    } catch (err) {
      console.error(`[reconcile-renders] Error processing job ${job.id}:`, err);
      outcome = "error";
    }

    results.push({ jobId: job.id, outcome });
  }

  const recovered = results.filter((r) => r.outcome === "recovered").length;
  const failed = results.filter((r) => r.outcome.startsWith("fail")).length;
  console.log(`[reconcile-renders] Done. recovered=${recovered} failed=${failed} total=${results.length}`);

  return new Response(
    JSON.stringify({ ok: true, reconciled: results.length, recovered, failed, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
