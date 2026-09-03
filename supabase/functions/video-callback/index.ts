import { createClient } from "npm:@supabase/supabase-js@2.57.2";

/**
 * video-callback — Webhook endpoint for Creatomate (and Make.com legacy) to POST
 * finished video results back.
 *
 * B-02 SECURITY: This endpoint is public (verify_jwt = false) but is protected by
 * a pre-shared token embedded in the callback URL registered with Creatomate:
 *   https://<project>.supabase.co/functions/v1/video-callback?secret=<CREATOMATE_WEBHOOK_SECRET>
 *
 * The token is compared with constant-time equality to prevent timing attacks.
 * Requests without a matching token receive 401.  Duplicate callbacks are
 * rejected via webhook_receipts idempotency store.
 *
 * Creatomate webhook payload (single render object or array):
 * {
 *   id: string,                // creatomate render ID
 *   status: "succeeded" | "failed",
 *   url?: string,              // final video URL
 *   snapshot_url?: string,
 *   metadata: string,          // JSON string or plain UUID: our job_id
 *   error_message?: string,
 * }
 *
 * Make.com legacy payload:
 * {
 *   job_id: string,
 *   status: "completed" | "failed",
 *   video_url?: string,
 * }
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
  const webhookSecret = Deno.env.get("CREATOMATE_WEBHOOK_SECRET");
  if (webhookSecret) {
    const url = new URL(req.url);
    const provided = url.searchParams.get("secret") ?? "";
    if (!constantTimeEqual(provided, webhookSecret)) {
      console.warn("[video-callback] Rejected: invalid secret token");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    console.error("[video-callback] CREATOMATE_WEBHOOK_SECRET not configured — all webhook calls rejected for safety");
    return new Response(JSON.stringify({ error: "Webhook endpoint not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rawBody = await req.json();
    console.log("[video-callback] RAW BODY:", JSON.stringify(rawBody));

    // Creatomate sends an array or single object
    const body = Array.isArray(rawBody) ? rawBody[0] : rawBody;

    console.log("[video-callback] body.status:", body.status);
    console.log("[video-callback] body.metadata raw:", body.metadata);

    // ── Resolve job_id ──
    let job_id: string | null = null;
    if (body.metadata) {
      const raw = String(body.metadata).trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
        job_id = raw;
      } else {
        try {
          const meta = JSON.parse(raw);
          job_id = meta?.job_id || null;
        } catch (_) {
          job_id = raw || null;
        }
      }
    }
    job_id = job_id || body.job_id || null;
    console.log("[video-callback] Extracted job_id:", job_id);

    // ── Resolve status ──
    const rawStatus: string = body.status || "";
    let status: "completed" | "failed" | null = null;
    if (rawStatus === "succeeded" || rawStatus === "completed") status = "completed";
    else if (rawStatus === "failed") status = "failed";

    if (!status) {
      return new Response(JSON.stringify({ ok: true, ignored: true, raw_status: rawStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── B-02: Idempotency check ──
    const creatomateRenderId: string | null = body.id || null;
    const fingerprint = creatomateRenderId
      ? `creatomate:${creatomateRenderId}:${rawStatus}`
      : `job:${job_id}:${rawStatus}`;

    const { error: receiptErr } = await supabase
      .from("webhook_receipts")
      .insert({
        provider: "creatomate",
        event_fingerprint: fingerprint,
        payload_summary: JSON.stringify({ job_id, status, render_id: creatomateRenderId }),
      });

    if (receiptErr) {
      if (receiptErr.code === "23505") {
        // Duplicate — already processed
        console.log(`[video-callback] Duplicate callback ignored for fingerprint: ${fingerprint}`);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[video-callback] Receipt insert error:", receiptErr.message);
    }

    // ── Resolve video URL ──
    const video_url = body.url || body.video_url || body.direct_mp4_url || body.merged_video_url || null;
    const thumbnail_url = body.snapshot_url || body.thumbnail_url || null;
    const error_message = body.error_message || body.error || null;
    const duration_seconds = body.duration_seconds || null;
    const voiceover_url = body.voiceover_url || null;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id in payload or metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await supabase
      .from("video_generation_jobs")
      .select("id, user_id, business_id, result_payload, status")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[video-callback] Received callback for job ${job_id}: status=${status}, render_id=${creatomateRenderId}`);

    let finalVideoUrl: string | null = video_url;

    if (status === "completed" && finalVideoUrl && !finalVideoUrl.includes(supabaseUrl)) {
      try {
        console.log(`[video-callback] Downloading video from: ${finalVideoUrl}`);
        const videoResponse = await fetch(finalVideoUrl, {
          redirect: "follow",
          headers: { "User-Agent": "RickyAI-Pipeline/1.0" },
        });

        if (videoResponse.ok) {
          const contentType = videoResponse.headers.get("content-type") || "video/mp4";
          const ext = contentType.includes("webm") ? "webm" : "mp4";
          const blob = await videoResponse.arrayBuffer();

          if (blob.byteLength > 10240) {
            const storagePath = `videos/${job.business_id}/${job_id}/final.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from("media")
              .upload(storagePath, blob, {
                contentType: contentType.includes("video") ? contentType : `video/${ext}`,
                upsert: true,
              });

            if (!uploadErr) {
              finalVideoUrl = `${supabaseUrl}/storage/v1/object/public/media/${storagePath}`;
              console.log(`[video-callback] Re-hosted video: ${finalVideoUrl}`);
            } else {
              console.error("[video-callback] Storage upload failed:", uploadErr.message);
            }
          } else {
            console.warn(`[video-callback] Downloaded file too small (${blob.byteLength} bytes), keeping original URL`);
          }
        } else {
          console.warn(`[video-callback] Could not download video (${videoResponse.status}), keeping original URL`);
        }
      } catch (dlErr) {
        console.error("[video-callback] Download/re-host failed:", dlErr);
      }
    }

    const existingPayload = (job.result_payload as Record<string, any>) || {};
    const updatedPayload = {
      ...existingPayload,
      video_url: finalVideoUrl,
      video_type: "direct",
      voiceover_url: voiceover_url || existingPayload.voiceover_url,
      total_duration_seconds: duration_seconds || existingPayload.total_duration_seconds,
      pipeline_steps: {
        ...(existingPayload.pipeline_steps || {}),
        creatomate: status === "completed" ? "completed" : "failed",
      },
      message: status === "completed"
        ? `✅ Video ready! ${duration_seconds ? `(${duration_seconds}s)` : ""}`
        : `❌ Video production failed: ${error_message || "unknown error"}`,
      callback_received_at: new Date().toISOString(),
    };

    const nowIso = new Date().toISOString();
    const updateFields: Record<string, any> = {
      status,
      pipeline_stage: status === "completed" ? "completed" : "failed",
      video_url: finalVideoUrl,
      result_payload: {
        ...updatedPayload,
        completed_at: status === "completed" ? nowIso : null,
        original_provider_url: video_url || null,
        creatomate_render_id: creatomateRenderId || null,
      },
      error_message: status === "failed" ? (error_message || "Production failed") : null,
      updated_at: nowIso,
    };
    if (status === "completed") updateFields.completed_at = nowIso;
    if (creatomateRenderId) updateFields.creatomate_render_id = creatomateRenderId;

    const { error: updateErr } = await supabase
      .from("video_generation_jobs")
      .update(updateFields)
      .eq("id", job_id)
      .eq("user_id", job.user_id);

    if (updateErr) {
      console.error("[video-callback] Failed to update job:", JSON.stringify(updateErr));
      throw new Error(`Failed to update job: ${updateErr.message}`);
    }
    console.log(`[video-callback] DB update matched job ${job_id}: OK`);

    if (status === "completed" && finalVideoUrl) {
      await supabase
        .from("content_posts")
        .update({
          media_url: finalVideoUrl,
          media_type: "video",
          thumbnail_url: thumbnail_url || null,
          status: "media_ready",
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", job.business_id)
        .eq("user_id", job.user_id)
        .eq("production_tool", "creatomate")
        .order("created_at", { ascending: false })
        .limit(1);

      const isActualVideoUrl = /\.(mp4|webm|mov)(\?|$)/i.test(finalVideoUrl);
      if (isActualVideoUrl) {
        await supabase
          .from("business_media")
          .insert({
            business_id: job.business_id,
            user_id: job.user_id,
            file_name: `creatomate-video-${job_id.substring(0, 8)}.mp4`,
            file_type: "video",
            shot_type: "environment",
            storage_path: finalVideoUrl,
            public_url: finalVideoUrl,
            mime_type: "video/mp4",
            tags: ["creatomate", "ai-generated", "promotional"],
          });
      }

      console.log(`[video-callback] Job ${job_id} completed. Video saved.`);
    } else {
      console.log(`[video-callback] Job ${job_id} marked as ${status}.`);
    }

    return new Response(JSON.stringify({
      success: true,
      job_id,
      status,
      video_url: finalVideoUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[video-callback] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
