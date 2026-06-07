import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * video-callback — Webhook endpoint for Creatomate (and Make.com legacy) to POST
 * finished video results back.
 *
 * Creatomate webhook payload (single render object or array):
 * {
 *   id: string,                // creatomate render ID
 *   status: "succeeded" | "failed",
 *   url?: string,              // final video URL
 *   snapshot_url?: string,
 *   metadata: string,          // JSON string: { "job_id": "..." }
 *   error_message?: string,
 * }
 *
 * Make.com legacy payload:
 * {
 *   job_id: string,
 *   status: "completed" | "failed",
 *   video_url?: string,
 *   ...
 * }
 */
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const rawBody = await req.json();

    // Creatomate sends an array or single object
    const body = Array.isArray(rawBody) ? rawBody[0] : rawBody;

    // ── Resolve job_id ──
    // Creatomate: body.metadata is a JSON string with { job_id }
    // Make.com legacy: body.job_id directly
    let job_id: string | null = null;
    if (body.metadata) {
      try {
        const meta = typeof body.metadata === "string" ? JSON.parse(body.metadata) : body.metadata;
        job_id = meta?.job_id || null;
      } catch (_) {}
    }
    job_id = job_id || body.job_id || null;

    // ── Resolve status ──
    // Creatomate uses "succeeded" / "failed" / "planned" / "rendering"
    // Make.com uses "completed" / "failed"
    const rawStatus: string = body.status || "";
    let status: "completed" | "failed" | null = null;
    if (rawStatus === "succeeded" || rawStatus === "completed") status = "completed";
    else if (rawStatus === "failed") status = "failed";

    // Ignore in-progress Creatomate status pings
    if (!status) {
      return new Response(JSON.stringify({ ok: true, ignored: true, raw_status: rawStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve video URL ──
    const video_url = body.url || body.video_url || body.direct_mp4_url || body.merged_video_url || null;
    const thumbnail_url = body.snapshot_url || body.thumbnail_url || null;
    const error_message = body.error_message || body.error || null;
    const duration_seconds = body.duration_seconds || null;
    const creatomate_render_id = body.id || null;
    const metadata = body.metadata || null;
    const voiceover_url = body.voiceover_url || null;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id in payload or metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the job
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

    console.log(`[video-callback] Received callback for job ${job_id}: status=${status}, render_id=${creatomate_render_id}`);

    let finalVideoUrl: string | null = video_url;

    // Re-host external video in Supabase storage for reliable playback
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
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${storagePath}`;
              console.log(`[video-callback] Re-hosted video: ${publicUrl}`);
              finalVideoUrl = publicUrl;
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

    // Update the job
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

    const updateFields: Record<string, any> = {
      status,
      video_url: finalVideoUrl,
      result_payload: updatedPayload,
      error_message: status === "failed" ? (error_message || "Production failed") : null,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (creatomate_render_id) updateFields.creatomate_render_id = creatomate_render_id;
    if (finalVideoUrl) updateFields.original_provider_url = video_url;

    const { error: updateErr } = await supabase
      .from("video_generation_jobs")
      .update(updateFields)
      .eq("id", job_id);

    if (updateErr) {
      console.error("[video-callback] Failed to update job:", updateErr);
      throw new Error(`Failed to update job: ${updateErr.message}`);
    }

    // If completed, update content_posts and business_media
    if (status === "completed" && finalVideoUrl) {
      const { error: postErr } = await supabase
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

      if (postErr) {
        console.error("[video-callback] content_posts update error:", postErr);
      }

      const { error: mediaErr } = await supabase
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

      if (mediaErr) {
        console.error("[video-callback] business_media insert error:", mediaErr);
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
