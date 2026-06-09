/**
 * End-to-end pipeline test
 * Signs in as the real user via admin API, fires generate-video-v2,
 * polls until completion or failure, prints the final video URL.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://psmxeckstfeyxlqzzkgw.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// TnT Tinting — Virginia Beach VA
const BUSINESS_ID = "f1ae9f62-9fee-4d2c-b137-4fe3b127f0a4";
const LOCATION_ID = "abd86026-c38b-482b-a6ed-cf9f87dc9e28";
const USER_ID     = "0c87a3cf-ab68-4b8d-b0d5-31a92fe4c030";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Step 1: get user email, generate magic link OTP, exchange for session JWT ─
console.log("Looking up user...");
const { data: userData, error: userErr } = await admin.auth.admin.getUserById(USER_ID);
if (userErr || !userData?.user?.email) {
  console.error("Failed to get user:", userErr?.message);
  process.exit(1);
}
const userEmail = userData.user.email;
console.log(`  User email: ${userEmail}`);

console.log("Generating magic link OTP...");
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: userEmail,
  options: { shouldCreateUser: false },
});
if (linkErr || !linkData?.properties?.email_otp) {
  console.error("Failed to generate link:", linkErr?.message, JSON.stringify(linkData));
  process.exit(1);
}
const emailOtp = linkData.properties.email_otp;
console.log("  OTP generated");

console.log("Exchanging OTP for session...");
const verifyResp = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_ANON_KEY },
  body: JSON.stringify({ type: "magiclink", email: userEmail, token: emailOtp }),
});
const verifyJson = await verifyResp.json();
const userToken = verifyJson.access_token;
if (!userToken) {
  console.error("Failed to exchange OTP:", JSON.stringify(verifyJson));
  process.exit(1);
}
console.log("✅ Got user JWT");

// ── Step 2: create a user-scoped client ─────────────────────────────────────
const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${userToken}` } }
});

// ── Step 3: invoke generate-video-v2 ────────────────────────────────────────
console.log("\nFiring generate-video-v2...");
const startMs = Date.now();
const { data: invokeData, error: invokeErr } = await userClient.functions.invoke("generate-video-v2", {
  body: {
    businessId: BUSINESS_ID,
    locationId: LOCATION_ID,
    videoType: "promotional",
    lengthMode: "standard",
    orientation: "landscape",
  },
});
if (invokeErr) {
  console.error("❌ Invoke error:", invokeErr.message);
  process.exit(1);
}
const jobId = invokeData?.job_id;
if (!jobId) {
  console.error("❌ No job_id in response:", JSON.stringify(invokeData));
  process.exit(1);
}
console.log(`✅ Pipeline started — job_id: ${jobId}`);
console.log(`   Message: ${invokeData.message}`);

// ── Step 4: poll video_generation_jobs until done ───────────────────────────
console.log("\nPolling for completion (checking every 10s, timeout 10min)...");
const POLL_INTERVAL_MS = 10_000;
const TIMEOUT_MS = 600_000;
let lastStage = "";

while (Date.now() - startMs < TIMEOUT_MS) {
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

  const { data: job, error: jobErr } = await admin
    .from("video_generation_jobs")
    .select("id, status, pipeline_stage, video_url, error_message, result_payload, updated_at")
    .eq("id", jobId)
    .single();

  if (jobErr) {
    console.error("  Poll error:", jobErr.message);
    continue;
  }

  const elapsed = Math.round((Date.now() - startMs) / 1000);
  const stage = job.pipeline_stage || job.status;
  if (stage !== lastStage) {
    console.log(`  [${elapsed}s] ${stage}`);
    lastStage = stage;
  }

  if (job.status === "completed") {
    const total = Math.round((Date.now() - startMs) / 1000);
    console.log(`\n✅ COMPLETED in ${total}s`);
    console.log(`   Video URL: ${job.video_url}`);
    const payload = job.result_payload;
    if (payload?.pipeline_steps) {
      console.log("   Pipeline steps:", JSON.stringify(payload.pipeline_steps));
    }
    if (payload?.used_ai_script !== undefined) {
      console.log(`   Used AI script: ${payload.used_ai_script}, fallback: ${payload.is_fallback}`);
    }
    process.exit(0);
  }

  if (job.status === "failed") {
    console.error(`\n❌ FAILED after ${Math.round((Date.now()-startMs)/1000)}s`);
    console.error(`   Error: ${job.error_message}`);
    const payload = job.result_payload;
    if (payload?.pipeline_logs) {
      console.error("   Logs:", payload.pipeline_logs.slice(-5));
    }
    process.exit(1);
  }
}

console.error("❌ TIMEOUT — job did not complete within 10 minutes");
process.exit(1);
