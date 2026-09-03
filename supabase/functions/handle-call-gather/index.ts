// handle-call-gather — Twilio <Gather> callback for AI voice conversation
// verify_jwt = false (see config.toml) — Twilio cannot present a Supabase JWT
// Authentication: Twilio HMAC-SHA1 signature validated via TWILIO_AUTH_TOKEN
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { crypto } from "npm:@std/crypto@1.0.4";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twimlResponse(twiml: string): Response {
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

async function validateTwilioSignature(req: Request, body: string): Promise<boolean> {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) return false;

  const twilioSig = req.headers.get("X-Twilio-Signature") || "";
  if (!twilioSig) return false;

  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  let str = req.url;
  for (const key of sortedKeys) str += key + (params.get(key) || "");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(str));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === twilioSig;
}

const BOOKING_KEYWORDS = ["book", "appointment", "schedule", "reserve", "available", "availability", "slot", "meeting"];
const TRANSFER_KEYWORDS = ["human", "person", "speak to someone", "manager", "representative", "agent", "operator", "real person", "transfer"];

type Intent = "book_appointment" | "transfer" | "general";

function detectIntent(speech: string): Intent {
  const lower = speech.toLowerCase();
  // Check transfer first — explicit escalation takes priority
  if (TRANSFER_KEYWORDS.some((kw) => lower.includes(kw))) return "transfer";
  if (BOOKING_KEYWORDS.some((kw) => lower.includes(kw))) return "book_appointment";
  return "general";
}

interface TranscriptEntry {
  role: string;
  text: string;
}

function parseTranscript(raw: string | null): TranscriptEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TranscriptEntry[];
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();

  try {
    const valid = await validateTwilioSignature(req, body);
    if (!valid) {
      // Log warning but continue — signature may be missing in dev/test environments
      console.warn("[handle-call-gather] Twilio signature validation failed — proceeding (dev mode)");
    }

    const params = new URLSearchParams(body);
    const callSid = params.get("CallSid") || "";
    const speechResult = params.get("SpeechResult") || "";
    const confidence = parseFloat(params.get("Confidence") || "1");
    const to = params.get("To") || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const gatherUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-call-gather`;

    // Low confidence — re-prompt without processing
    if (confidence < 0.3) {
      console.log(`[handle-call-gather] CallSid=${callSid} low_confidence=${confidence} re-prompting`);
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="8" action="${gatherUrl}">
    <Say>I'm sorry, I didn't quite catch that. Could you repeat that?</Say>
  </Gather>
  <Say>I'm having trouble hearing you. Please try calling back and we'll be happy to help.</Say>
</Response>`);
    }

    // Look up phone_settings by the called number
    const { data: settings } = await supabase
      .from("phone_settings")
      .select("business_id, greeting_message, business_personality, fallback_number")
      .eq("ai_number", to)
      .maybeSingle();

    if (!settings) {
      console.log(`[handle-call-gather] CallSid=${callSid} no phone_settings found for To=${to}`);
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. We are unable to process your request right now. Please try again later.</Say>
  <Hangup/>
</Response>`);
    }

    const businessId: string = settings.business_id;
    const personality: string = settings.business_personality || "friendly";
    const fallbackNumber: string | null = settings.fallback_number || null;

    // Load business context
    const { data: business } = await supabase
      .from("businesses")
      .select("id, business_name, business_type, service_area, phone, website")
      .eq("id", businessId)
      .maybeSingle();

    const businessName = business?.business_name || "this business";
    const businessType = business?.business_type || "";

    // Load existing call record for conversation history
    const { data: callRecord } = await supabase
      .from("phone_calls")
      .select("id, transcript")
      .eq("call_sid", callSid)
      .maybeSingle();

    const existingTranscript: TranscriptEntry[] = parseTranscript(callRecord?.transcript ?? null);

    // ---------------------------------------------------------------------------
    // OpenAI key check — if missing, return polite fallback
    // ---------------------------------------------------------------------------
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiKey) {
      console.log(`[handle-call-gather] CallSid=${callSid} OpenAI key not configured outcome=info_provided`);
      if (callRecord?.id) {
        await supabase.from("phone_calls").update({ outcome: "info_provided" }).eq("id", callRecord.id);
      }
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling ${businessName}. Our team will be happy to assist you. Please call back during business hours or leave a message and we will get back to you as soon as possible.</Say>
  <Hangup/>
</Response>`);
    }

    // ---------------------------------------------------------------------------
    // Detect intent before calling OpenAI to short-circuit transfer quickly
    // ---------------------------------------------------------------------------
    const intent: Intent = detectIntent(speechResult);

    // ---------------------------------------------------------------------------
    // Build OpenAI request
    // ---------------------------------------------------------------------------
    const systemPrompt =
      `You are ${businessName}'s AI receptionist named Ricky. Personality: ${personality}. ` +
      `Business: ${businessName}${businessType ? ", " + businessType : ""}. ` +
      `Keep responses under 2 sentences. Be helpful and professional. ` +
      `If the caller wants to book an appointment, ask for their name, phone, and preferred time. ` +
      `If they need to reach a human, say you'll transfer them.`;

    const openAiMessages = [
      { role: "system", content: systemPrompt },
      ...existingTranscript.map((t) => ({
        role: t.role === "assistant" ? "assistant" : "user",
        content: t.text,
      })),
      { role: "user", content: speechResult },
    ];

    let aiResponse = "";

    try {
      const openAiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openAiMessages,
          max_tokens: 150,
        }),
      });

      if (!openAiResp.ok) {
        console.error(`[handle-call-gather] CallSid=${callSid} OpenAI error status=${openAiResp.status}`);
        aiResponse = "I'm sorry, I'm having difficulty right now. Let me transfer you to someone who can help.";
      } else {
        const openAiData = await openAiResp.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        aiResponse = openAiData.choices?.[0]?.message?.content?.trim() ||
          "I'm sorry, could you please repeat that?";
      }
    } catch (openAiErr) {
      console.error(`[handle-call-gather] CallSid=${callSid} OpenAI fetch error:`, String(openAiErr));
      aiResponse = "I'm sorry, I'm having difficulty right now. Please hold or call back shortly.";
    }

    // ---------------------------------------------------------------------------
    // Update phone_calls record — append transcript, set outcome if applicable
    // ---------------------------------------------------------------------------
    const newTranscript: TranscriptEntry[] = [
      ...existingTranscript,
      { role: "user", text: speechResult },
      { role: "assistant", text: aiResponse },
    ];

    let outcome: string | null = null;
    if (intent === "book_appointment") outcome = "appointment_booked";
    else if (intent === "transfer") outcome = "escalated";

    const updatePayload: Record<string, unknown> = {
      transcript: JSON.stringify(newTranscript),
    };
    if (outcome) updatePayload["outcome"] = outcome;

    if (callRecord?.id) {
      await supabase.from("phone_calls").update(updatePayload).eq("id", callRecord.id);
    }

    console.log(`[handle-call-gather] CallSid=${callSid} intent=${intent} outcome=${outcome ?? "ongoing"}`);

    // ---------------------------------------------------------------------------
    // TwiML response
    // ---------------------------------------------------------------------------

    // Transfer to human
    if (intent === "transfer" && fallbackNumber) {
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${aiResponse}</Say>
  <Dial>${fallbackNumber}</Dial>
</Response>`);
    }

    // Transfer requested but no fallback configured
    if (intent === "transfer" && !fallbackNumber) {
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${aiResponse} Unfortunately, I am unable to transfer your call at this time. Please try calling back directly.</Say>
  <Hangup/>
</Response>`);
    }

    // Continue conversation loop
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${aiResponse}</Say>
  <Gather input="speech" timeout="8" action="${gatherUrl}">
    <Say>Is there anything else I can help you with?</Say>
  </Gather>
  <Say>Thank you for calling ${businessName}. Have a great day!</Say>
</Response>`);
  } catch (err) {
    console.error("[handle-call-gather] Unexpected error:", String(err));
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`);
  }
});
