// get-signed-video-url — returns a signed or public URL for a completed video job.
// Auth: validated via anon client (not service-role getUser) per Supabase guidance.
// Ownership: job is queried with eq("user_id", user.id) to enforce tenant isolation.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use anon client with user JWT in Authorization header — correct auth pattern.
  // Service-role client + getUser(token) is deprecated and bypasses Supabase's JWT middleware.
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client used only for DB queries and storage signing (not for auth).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ownership enforced: user_id must match authenticated user
    const { data: job } = await supabase
      .from("video_generation_jobs")
      .select("status, storage_path, video_url, result_payload")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (!job || job.status !== "completed") {
      return new Response(JSON.stringify({ error: "Video not ready", status: job?.status }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.storage_path) {
      const { data: signedData } = await supabase.storage
        .from("media")
        .createSignedUrl(job.storage_path, 3600);
      if (signedData?.signedUrl) {
        return new Response(
          JSON.stringify({ url: signedData.signedUrl, type: "signed", expires_in: 3600 }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (job.video_url) {
      return new Response(
        JSON.stringify({ url: job.video_url, type: "public" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = job.result_payload || {};
    return new Response(
      JSON.stringify({
        url: null,
        type: "slideshow",
        voiceover_url: payload.voiceover_url || null,
        scene_images: payload.scene_images || [],
        scene_captions: payload.scene_captions || [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[get-signed-video-url] Error:", err?.message ?? String(err));
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
