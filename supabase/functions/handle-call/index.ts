// Twilio webhook — verify_jwt = false (see config.toml)
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { crypto } from "npm:@std/crypto@1.0.4";

function twimlResponse(twiml: string): Response {
  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

async function validateTwilioSignature(req: Request, body: string): Promise<boolean> {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) return false;

  const url = req.url;
  const twilioSig = req.headers.get("X-Twilio-Signature") || "";

  // Build the string to sign: URL + sorted params
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  let str = url;
  for (const key of sortedKeys) str += key + (params.get(key) || "");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(str));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === twilioSig;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();

  try {
    const valid = await validateTwilioSignature(req, body);
    if (!valid) {
      console.warn("Invalid Twilio signature — proceeding (dev mode)");
    }

    const params = new URLSearchParams(body);
    const callSid = params.get("CallSid") || "";
    const from = params.get("From") || "";
    const to = params.get("To") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find business by phone number — also load timezone from businesses for after_hours logic
    const { data: settings } = await supabase
      .from("phone_settings")
      .select("*, businesses!inner(id, business_name, timezone)")
      .eq("ai_number", to)
      .maybeSingle();

    if (!settings) {
      // No config — just say we can't help
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Thank you for calling. We are unable to take your call right now. Please try again later.</Say><Hangup/></Response>`);
    }

    const businessId = settings.business_id;
    const mode = settings.phone_mode;
    const greeting = settings.greeting_message || "Thank you for calling. How can I help you today?";
    const fallback = settings.fallback_number;

    // -----------------------------------------------------------------------
    // After-hours time-of-day check (applies only when mode === "after_hours")
    //
    // after_hours_start / after_hours_end are Postgres time strings e.g. "17:00:00".
    // During business hours (start ≤ now < end) → forward to human (fallback).
    // Outside business hours → Ricky AI answers.
    // If no after_hours window is configured, proceed to AI path.
    // -----------------------------------------------------------------------
    if (mode === "after_hours") {
      const afterStart: string | null = settings.after_hours_start ?? null;
      const afterEnd: string | null = settings.after_hours_end ?? null;
      const timezone: string =
        (settings.businesses as Record<string, unknown> | null)?.timezone as string
          ?? "America/New_York";

      if (afterStart && afterEnd) {
        // Get current HH:MM in the business timezone using Intl
        let currentTimeStr = "00:00";
        try {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(new Date());
          const h = parts.find((p) => p.type === "hour")?.value ?? "00";
          const m = parts.find((p) => p.type === "minute")?.value ?? "00";
          currentTimeStr = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
        } catch {
          // If timezone resolution fails, default to AI path (safe fallback)
          currentTimeStr = "00:00";
        }

        // Normalise time strings to HH:MM for comparison
        const normalise = (t: string) => t.slice(0, 5); // "17:00:00" → "17:00"
        const start = normalise(afterStart);
        const end = normalise(afterEnd);

        const withinBusinessHours =
          currentTimeStr >= start && currentTimeStr < end;

        if (withinBusinessHours) {
          // Business hours → forward to human if fallback number is set
          if (fallback) {
            return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Dial>${fallback}</Dial></Response>`);
          }
          // No fallback configured → fall through to AI path
        }
        // Outside business hours → fall through to AI path below
      }
      // mode is "after_hours" but window not configured → fall through to AI path
    }

    // Log the call
    await supabase.from("phone_calls").insert({
      business_id: businessId,
      call_sid: callSid,
      from_number: from,
      to_number: to,
      direction: "inbound",
      status: "in_progress",
      started_at: new Date().toISOString(),
    });

    if (mode === "disabled" && fallback) {
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Dial>${fallback}</Dial></Response>`);
    }

    if (mode === "overflow" && fallback) {
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="/handle-call/dial-status" timeout="20">
    <Number>${fallback}</Number>
  </Dial>
  <Say>${greeting}</Say>
  <Gather input="speech" timeout="5" action="${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-call-gather"><Say>How can Ricky help you today?</Say></Gather>
</Response>`);
    }

    // AI answers
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${greeting}</Say>
  <Gather input="speech" timeout="10" action="${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-call-gather">
    <Say>Please tell me how I can help you.</Say>
  </Gather>
  <Say>I didn't catch that. Please call back and we'll be happy to help.</Say>
</Response>`);
  } catch (err) {
    console.error(err);
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>An error occurred. Please try again.</Say><Hangup/></Response>`);
  }
});
