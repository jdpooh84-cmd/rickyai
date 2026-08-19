import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decrypt } from "../_shared/credential-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

// Klap API v1 — https://v1.klap.app
// Auth: Authorization: Bearer {api_key}
// Submit: POST /api/v1/project  { "url": "...", "lang": "en" }
// Poll:   GET  /api/v1/project/{id}
// Done response: { "id":"...", "status":"done", "clips": [{ "id":"...", "video_url":"...", "title":"..." }] }
const KLAP_BASE = "https://v1.klap.app";

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

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { businessId, sourceVideoUrl, storagePath } = body as {
      businessId: string;
      sourceVideoUrl: string;
      storagePath?: string;
    };

    if (!businessId || !sourceVideoUrl) {
      return new Response(JSON.stringify({ error: "Missing businessId or sourceVideoUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BYO-key gate: user must supply their own Klap API key ──
    const { data: klapKeyRow } = await supabase
      .from("user_api_keys")
      .select("api_key_encrypted, key_iv, key_version")
      .eq("user_id", user.id)
      .eq("provider", "klap")
      .eq("is_valid", true)
      .maybeSingle();

    if (!klapKeyRow?.api_key_encrypted) {
      return new Response(JSON.stringify({
        error: "NO_KLAP_KEY",
        message: "Connect your Klap API key in the Connections panel to auto-clip footage.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let klapKey: string;
    try {
      if (klapKeyRow.key_version === "v1-aes256gcm" && klapKeyRow.key_iv) {
        klapKey = await decrypt(klapKeyRow.api_key_encrypted, klapKeyRow.key_iv);
      } else {
        klapKey = klapKeyRow.api_key_encrypted;
      }
    } catch (decryptErr: any) {
      console.error("[clip-video] Failed to decrypt Klap key:", decryptErr?.message);
      return new Response(JSON.stringify({ error: "KEY_DECRYPT_FAILED", message: "Could not read your Klap API key. Please re-enter it in the Connections panel." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Submit video to Klap ──
    console.log(`[clip-video] Submitting video to Klap for user ${user.id}: ${sourceVideoUrl}`);
    const klapSubmit = await fetch(`${KLAP_BASE}/api/v1/project`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${klapKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: sourceVideoUrl, lang: "en" }),
    });

    if (!klapSubmit.ok) {
      const errText = await klapSubmit.text();
      console.error(`[clip-video] Klap submit failed (${klapSubmit.status}): ${errText}`);
      return new Response(JSON.stringify({
        error: "KLAP_SUBMIT_FAILED",
        message: `Klap rejected the video (${klapSubmit.status}): ${errText.slice(0, 200)}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const klapData = await klapSubmit.json();
    const externalJobId: string = klapData.id;
    console.log(`[clip-video] Klap project created: ${externalJobId}`);

    // ── Create clip_generation_jobs row ──
    const { data: jobRow, error: jobErr } = await supabase
      .from("clip_generation_jobs")
      .insert({
        user_id: user.id,
        business_id: businessId,
        source_video_url: sourceVideoUrl,
        source_storage_path: storagePath || null,
        provider: "klap",
        external_job_id: externalJobId,
        status: "processing",
      })
      .select("id")
      .single();

    if (jobErr || !jobRow) {
      console.error("[clip-video] Failed to create job row:", jobErr);
      return new Response(JSON.stringify({ error: "Failed to create clip job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = jobRow.id;
    console.log(`[clip-video] Clip job created: ${jobId}, external: ${externalJobId}`);

    // ── Background: poll Klap until done (max ~90s window) ──
    // Klap typically finishes in 5-15 minutes. The background task will run until
    // the edge function wall-clock limit (~150s). If Klap isn't done by then,
    // the job stays "processing" and the frontend continues polling.
    // The clip-callback webhook will update the job when Klap completes.
    EdgeRuntime.waitUntil(pollKlapUntilDone(supabase, jobId, externalJobId, klapKey));

    return new Response(JSON.stringify({ job_id: jobId, external_job_id: externalJobId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[clip-video] Unhandled error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Poll Klap every 30s. Runs in background after the HTTP response is sent.
// If Klap finishes within the function window, updates the DB immediately.
// If not, the clip-callback webhook handles the final update.
async function pollKlapUntilDone(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  externalJobId: string,
  klapKey: string,
): Promise<void> {
  const MAX_POLLS = 4; // 4 × 30s = 2min background window (conservative)
  const POLL_INTERVAL_MS = 30_000;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    try {
      const resp = await fetch(`${KLAP_BASE}/api/v1/project/${externalJobId}`, {
        headers: { "Authorization": `Bearer ${klapKey}` },
      });

      if (!resp.ok) {
        console.warn(`[clip-video/poll] Klap check failed (${resp.status}), will retry`);
        continue;
      }

      const data = await resp.json();
      const klapStatus: string = data.status || "";
      console.log(`[clip-video/poll] ${externalJobId} status: ${klapStatus}`);

      if (klapStatus === "done") {
        const clips: any[] = data.clips || data.videos || [];
        const clipUrls = clips
          .map((c: any) => c.video_url || c.url || c.download_url)
          .filter(Boolean);

        await supabase
          .from("clip_generation_jobs")
          .update({
            status: "completed",
            clip_urls: clipUrls,
            clip_count: clipUrls.length,
            result_payload: data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        console.log(`[clip-video/poll] Job ${jobId} completed — ${clipUrls.length} clips`);
        return;
      }

      if (klapStatus === "failed" || klapStatus === "error") {
        await supabase
          .from("clip_generation_jobs")
          .update({
            status: "failed",
            error_message: data.error || "Klap reported failure",
            result_payload: data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        console.error(`[clip-video/poll] Job ${jobId} failed by Klap`);
        return;
      }
    } catch (pollErr) {
      console.warn(`[clip-video/poll] Poll attempt ${i + 1} threw:`, pollErr);
    }
  }

  console.log(`[clip-video/poll] Background window expired for job ${jobId} — clip-callback will complete it`);
}
