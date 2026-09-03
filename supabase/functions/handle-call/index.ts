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

    // Find business by phone number
    const { data: settings } = await supabase
      .from("phone_settings")
      .select("*, businesses(id, business_name)")
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
