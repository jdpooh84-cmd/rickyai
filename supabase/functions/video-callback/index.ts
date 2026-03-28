import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * video-callback — Webhook endpoint for Make.com to POST finished video results back.
 *
 * Expected payload from Make.com:
 * {
 *   job_id: string,              // video_generation_jobs.id
 *   status: "completed" | "failed",
 *   video_url?: string,          // Final Manus/assembled video URL
 *   voiceover_url?: string,      // ElevenLabs MP3 URL (if Make merged audio)
 *   merged_video_url?: string,   // Final video with audio merged
 *   thumbnail_url?: string,
 *   error_message?: string,
 *   duration_seconds?: number,
 *   metadata?: Record<string, any>
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

    const body = await req.json();
    const {
      job_id,
      status,
      video_url,
      voiceover_url,
      merged_video_url,
      thumbnail_url,
      error_message,
      duration_seconds,
      metadata,
    } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "Missing job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!status || !["completed", "failed"].includes(status)) {
      return new Response(JSON.stringify({ error: "status must be 'completed' or 'failed'" }), {
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

    console.log(`[video-callback] Received callback for job ${job_id}: status=${status}`);

    // Use the merged video URL if provided, otherwise the raw video URL
    const finalVideoUrl = merged_video_url || video_url || null;

    // Update the job
    const existingPayload = (job.result_payload as Record<string, any>) || {};
    const updatedPayload = {
      ...existingPayload,
      ...(metadata || {}),
      video_url: finalVideoUrl,
      voiceover_url: voiceover_url || existingPayload.voiceover_url,
      merged_video_url: merged_video_url || null,
      total_duration_seconds: duration_seconds || existingPayload.total_duration_seconds,
      pipeline_steps: {
        ...(existingPayload.pipeline_steps || {}),
        manus: status === "completed" ? "completed" : "failed",
        merge: merged_video_url ? "completed" : "not_merged",
      },
      message: status === "completed"
        ? `✅ Video ready! ${duration_seconds ? `(${duration_seconds}s)` : ""}`
        : `❌ Video production failed: ${error_message || "unknown error"}`,
      callback_received_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("video_generation_jobs")
      .update({
        status,
        video_url: finalVideoUrl,
        result_payload: updatedPayload,
        error_message: status === "failed" ? (error_message || "Production failed") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    if (updateErr) {
      console.error("[video-callback] Failed to update job:", updateErr);
      throw new Error(`Failed to update job: ${updateErr.message}`);
    }

    // If completed with a video URL, also update content_posts and business_media
    if (status === "completed" && finalVideoUrl) {
      // Update content_posts — find the post linked to this job's business
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
        .eq("production_tool", "manus_ai")
        .order("created_at", { ascending: false })
        .limit(1);

      if (postErr) {
        console.error("[video-callback] content_posts update error:", postErr);
      }

      // Insert into business_media for re-use
      const { error: mediaErr } = await supabase
        .from("business_media")
        .insert({
          business_id: job.business_id,
          user_id: job.user_id,
          file_name: `manus-video-${job_id.substring(0, 8)}.mp4`,
          file_type: "video",
          shot_type: "environment",
          storage_path: finalVideoUrl,
          public_url: finalVideoUrl,
          mime_type: "video/mp4",
          tags: ["manus", "ai-generated", "promotional"],
        });

      if (mediaErr) {
        console.error("[video-callback] business_media insert error:", mediaErr);
      }

      console.log(`[video-callback] ✅ Job ${job_id} completed. Video saved to content_posts and business_media.`);
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
