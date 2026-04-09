import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("video_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already completed/failed, just return current status
    if (job.status === "completed" || job.status === "failed") {
      return new Response(JSON.stringify({ status: job.status, video_url: job.video_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Increment poll_attempts
    const newPollAttempts = (job.poll_attempts || 0) + 1;

    // If we have a manus_task_id, poll Manus API
    if (job.manus_task_id) {
      const manusKey = Deno.env.get("MANUS_API_KEY");
      if (manusKey) {
        try {
          const manusResp = await fetch(`https://api.manus.ai/v1/tasks/${job.manus_task_id}`, {
            headers: { Authorization: `Bearer ${manusKey}` },
          });

          if (manusResp.ok) {
            const manusData = await manusResp.json();
            console.log(`[check-video-status] Manus status for ${job.manus_task_id}: ${manusData.status}`);

            if (manusData.status === "completed" || manusData.status === "done") {
              // Look for video URL in outputs
              const videoUrl = manusData.output?.video_url ||
                manusData.outputs?.find((o: any) => o.type === "video")?.url ||
                manusData.result?.url;

              if (videoUrl) {
                // Download from Manus and re-upload to our storage
                try {
                  const videoResp = await fetch(videoUrl);
                  if (videoResp.ok) {
                    const videoBlob = await videoResp.blob();
                    const storagePath = `videos/${job.user_id}/${jobId}/final.mp4`;
                    const { error: uploadErr } = await supabaseAdmin.storage
                      .from("media")
                      .upload(storagePath, videoBlob, { contentType: "video/mp4", upsert: true });

                    if (!uploadErr) {
                      const { data: urlData } = supabaseAdmin.storage.from("media").getPublicUrl(storagePath);
                      await supabaseAdmin.from("video_generation_jobs").update({
                        status: "completed",
                        pipeline_stage: "completed",
                        video_url: urlData.publicUrl,
                        poll_attempts: newPollAttempts,
                        last_polled_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      }).eq("id", jobId);

                      return new Response(JSON.stringify({ status: "completed", video_url: urlData.publicUrl }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                      });
                    }
                  }
                } catch (dlErr) {
                  console.error("[check-video-status] Failed to download Manus video:", dlErr);
                }

                // If download/upload failed, still mark completed with Manus URL
                await supabaseAdmin.from("video_generation_jobs").update({
                  status: "completed",
                  pipeline_stage: "completed",
                  video_url: videoUrl,
                  poll_attempts: newPollAttempts,
                  last_polled_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }).eq("id", jobId);

                return new Response(JSON.stringify({ status: "completed", video_url: videoUrl }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            } else if (manusData.status === "failed" || manusData.status === "error") {
              await supabaseAdmin.from("video_generation_jobs").update({
                status: "failed",
                pipeline_stage: "failed",
                error_message: manusData.error || "Manus task failed",
                poll_attempts: newPollAttempts,
                last_polled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", jobId);

              return new Response(JSON.stringify({ status: "failed", error: manusData.error }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (manusErr) {
          console.error("[check-video-status] Manus API error:", manusErr);
        }
      }
    }

    // Update poll attempts
    await supabaseAdmin.from("video_generation_jobs").update({
      poll_attempts: newPollAttempts,
      last_polled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({
      status: job.status,
      pipeline_stage: job.pipeline_stage,
      poll_attempts: newPollAttempts,
      fallback_ready: job.fallback_ready,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[check-video-status] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
