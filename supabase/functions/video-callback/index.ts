import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Check if a URL points to a directly playable media file */
const isPlayableUrl = (url: string): boolean =>
  /\.(mp4|webm|mov)(\?|$)/i.test(url) ||
  /supabase\.co\/storage\/v1\/object\/public\/media\//i.test(url) ||
  /s3\.amazonaws\.com\//i.test(url);

/** Check if a URL is a Manus viewer page (not a direct file) */
const isManusPageUrl = (url: string): boolean =>
  /manus\.(im|ai)\/app\//i.test(url) || /share\.manus\.(im|ai)/.test(url);

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
      direct_mp4_url,
      voiceover_url,
      merged_video_url,
      thumbnail_url,
      error_message,
      duration_seconds,
      metadata,
      manus_task_url,
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

    // Determine the best playable URL — prioritize direct MP4/storage URLs
    const candidateUrls = [direct_mp4_url, merged_video_url, video_url].filter(Boolean);
    const playableUrl = candidateUrls.find(u => isPlayableUrl(u)) || null;
    
    // Manus viewer page URL (for fallback "Watch on Manus" button)
    const manusViewerUrl = manus_task_url || candidateUrls.find(u => isManusPageUrl(u)) || null;

    // The final video URL is ONLY a playable direct file, never a viewer page
    const finalVideoUrl = playableUrl;

    const videoType = finalVideoUrl ? "direct" : manusViewerUrl ? "manus_page" : "none";

    console.log(`[video-callback] URL resolution: playable=${finalVideoUrl}, manus_page=${manusViewerUrl}, type=${videoType}`);

    // Update the job
    const existingPayload = (job.result_payload as Record<string, any>) || {};
    const updatedPayload = {
      ...existingPayload,
      ...(metadata || {}),
      video_url: finalVideoUrl || manusViewerUrl,
      video_type: videoType,
      manus_task_url: manusViewerUrl,
      voiceover_url: voiceover_url || existingPayload.voiceover_url,
      merged_video_url: merged_video_url || null,
      total_duration_seconds: duration_seconds || existingPayload.total_duration_seconds,
      pipeline_steps: {
        ...(existingPayload.pipeline_steps || {}),
        manus: status === "completed" ? "completed" : "failed",
        merge: merged_video_url ? "completed" : "not_merged",
      },
      message: status === "completed"
        ? finalVideoUrl
          ? `✅ Video ready! ${duration_seconds ? `(${duration_seconds}s)` : ""}`
          : manusViewerUrl
            ? `✅ Video ready on Manus AI viewer — waiting for direct MP4 upload`
            : `⚠️ Completed but no playable video URL received`
        : `❌ Video production failed: ${error_message || "unknown error"}`,
      callback_received_at: new Date().toISOString(),
    };

    // Only mark as fully "completed" if we have a playable URL
    // If we only have a Manus page, mark as "processing" so the UI keeps polling
    const resolvedStatus = status === "completed" && !finalVideoUrl && manusViewerUrl
      ? "processing"  // Keep polling — Make.com still needs to upload the MP4
      : status;

    const { error: updateErr } = await supabase
      .from("video_generation_jobs")
      .update({
        status: resolvedStatus,
        video_url: finalVideoUrl || manusViewerUrl,
        result_payload: updatedPayload,
        error_message: status === "failed" ? (error_message || "Production failed") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    if (updateErr) {
      console.error("[video-callback] Failed to update job:", updateErr);
      throw new Error(`Failed to update job: ${updateErr.message}`);
    }

    // Only update content_posts and business_media when we have a REAL playable URL
    if (resolvedStatus === "completed" && finalVideoUrl) {
      // Update content_posts
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

      console.log(`[video-callback] ✅ Job ${job_id} completed with playable URL. Saved to content_posts and business_media.`);
    } else if (resolvedStatus === "processing" && manusViewerUrl) {
      console.log(`[video-callback] ⏳ Job ${job_id} has Manus viewer URL but no direct MP4 yet. Keeping as processing.`);
    } else {
      console.log(`[video-callback] Job ${job_id} marked as ${resolvedStatus}.`);
    }

    return new Response(JSON.stringify({
      success: true,
      job_id,
      status: resolvedStatus,
      video_url: finalVideoUrl,
      manus_task_url: manusViewerUrl,
      video_type: videoType,
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
