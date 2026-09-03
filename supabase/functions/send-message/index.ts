// send-message — outbound SMS (Twilio) and email (SendGrid) transport
// verify_jwt = true (default) — requires authenticated user JWT
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, requireString, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Transport helpers
// ---------------------------------------------------------------------------

type SmsResult =
  | { success: true; sid: string }
  | { success: false; error: { code: string; message: string } };

async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!authToken || !fromNumber) {
    return {
      success: false,
      error: { code: "config_error", message: "TWILIO_AUTH_TOKEN or TWILIO_PHONE_NUMBER not set" },
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formBody = new URLSearchParams({ To: to, From: fromNumber, Body: body });

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(accountSid + ":" + authToken)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });
  } catch (fetchErr) {
    return { success: false, error: { code: "network_error", message: String(fetchErr) } };
  }

  let data: Record<string, unknown> = {};
  try {
    data = await resp.json();
  } catch {
    // non-JSON body from Twilio on some errors
  }

  if (!resp.ok) {
    return {
      success: false,
      error: {
        code: String(data["code"] ?? resp.status),
        message: String(data["message"] ?? "Twilio request failed"),
      },
    };
  }

  return { success: true, sid: String(data["sid"] ?? "") };
}

type EmailResult =
  | { success: true; messageId: string | null }
  | { success: false; error: { code: string; message: string } };

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  fromName: string,
): Promise<EmailResult> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY")!;
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");

  if (!fromEmail) {
    return {
      success: false,
      error: { code: "config_error", message: "SENDGRID_FROM_EMAIL not set" },
    };
  }

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: "text/plain", value: body }],
  };

  let resp: Response;
  try {
    resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchErr) {
    return { success: false, error: { code: "network_error", message: String(fetchErr) } };
  }

  if (!resp.ok) {
    let errMsg = "SendGrid request failed";
    try {
      const errData = await resp.json() as { errors?: Array<{ message: string }> };
      errMsg = errData?.errors?.[0]?.message ?? errMsg;
    } catch {
      // ignore parse error
    }
    return { success: false, error: { code: String(resp.status), message: errMsg } };
  }

  const messageId = resp.headers.get("X-Message-Id");
  return { success: true, messageId };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const rawBody = await req.json();
    const { businessId, contactId, channel, body, subject, automationStepId } = rawBody;

    // Core validation
    const validated = validate(() => ({
      businessId: requireUuid(businessId, "businessId"),
      contactId: requireUuid(contactId, "contactId"),
      body: requireString(body, "body", 1600),
    }));
    if (validated instanceof Response) {
      return new Response(validated.body, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!channel) {
      return new Response(JSON.stringify({ error: "channel is required" }), { status: 400, headers: corsHeaders });
    }
    if (channel !== "sms" && channel !== "email") {
      return new Response(JSON.stringify({ error: "channel must be sms or email" }), { status: 400, headers: corsHeaders });
    }

    // Email requires subject
    if (channel === "email") {
      const subjectValidation = validate(() => ({
        subject: requireString(subject, "subject", 998),
      }));
      if (subjectValidation instanceof Response) {
        return new Response(subjectValidation.body, {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verify business ownership
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!biz) {
      return new Response(JSON.stringify({ error: "Business not found" }), { status: 403, headers: corsHeaders });
    }

    // Load contact with required fields — must belong to the verified business (tenant isolation)
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, phone, email, do_not_contact, sms_consent_status, email_consent_status")
      .eq("id", contactId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), { status: 404, headers: corsHeaders });
    }

    // DNC / consent checks
    if (contact.do_not_contact) {
      return new Response(JSON.stringify({ error: "Contact is do_not_contact" }), { status: 422, headers: corsHeaders });
    }
    if (channel === "sms" && contact.sms_consent_status === "revoked") {
      return new Response(JSON.stringify({ error: "SMS consent revoked" }), { status: 422, headers: corsHeaders });
    }
    if (channel === "email" && contact.email_consent_status === "revoked") {
      return new Response(JSON.stringify({ error: "Email consent revoked" }), { status: 422, headers: corsHeaders });
    }

    // Validate contact has the required address for the channel
    if (channel === "sms" && !contact.phone) {
      return new Response(JSON.stringify({ error: "Contact has no phone number" }), { status: 422, headers: corsHeaders });
    }
    if (channel === "email" && !contact.email) {
      return new Response(JSON.stringify({ error: "Contact has no email address" }), { status: 422, headers: corsHeaders });
    }

    // Insert message record with status "queued"
    const { data: msg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        business_id: businessId,
        contact_id: contactId,
        channel,
        direction: "outbound",
        body,
        subject: subject ?? null,
        status: "queued",
        automation_id: automationStepId ?? null,
      })
      .select("id")
      .single();

    if (insertErr || !msg) {
      console.error("[send-message] Failed to insert message record:", insertErr?.message);
      return new Response(JSON.stringify({ error: "Failed to create message record" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const msgId: string = msg.id;

    // ---------------------------------------------------------------------------
    // SMS transport
    // ---------------------------------------------------------------------------
    if (channel === "sms") {
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      if (!accountSid) {
        // Integration not configured — leave as queued
        console.log(`[send-message] msg=${msgId} channel=sms status=queued reason=transport_not_configured`);
        return new Response(
          JSON.stringify({ sent: false, queued: true, reason: "transport_not_configured", messageId: msgId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await sendSms(contact.phone, body);

      if (result.success) {
        await supabase
          .from("messages")
          .update({ status: "sent", provider_message_id: result.sid })
          .eq("id", msgId);
        console.log(`[send-message] msg=${msgId} channel=sms status=sent`);
        return new Response(
          JSON.stringify({ sent: true, messageId: msgId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        await supabase
          .from("messages")
          .update({ status: "failed", error_details: result.error })
          .eq("id", msgId);
        console.log(`[send-message] msg=${msgId} channel=sms status=failed code=${result.error.code}`);
        return new Response(
          JSON.stringify({ sent: false, messageId: msgId, error: result.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ---------------------------------------------------------------------------
    // Email transport
    // ---------------------------------------------------------------------------
    if (channel === "email") {
      const apiKey = Deno.env.get("SENDGRID_API_KEY");
      if (!apiKey) {
        // Integration not configured — leave as queued
        console.log(`[send-message] msg=${msgId} channel=email status=queued reason=transport_not_configured`);
        return new Response(
          JSON.stringify({ sent: false, queued: true, reason: "transport_not_configured", messageId: msgId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const result = await sendEmail(contact.email, subject, body, biz.business_name);

      if (result.success) {
        await supabase
          .from("messages")
          .update({ status: "sent", provider_message_id: result.messageId ?? null })
          .eq("id", msgId);
        console.log(`[send-message] msg=${msgId} channel=email status=sent`);
        return new Response(
          JSON.stringify({ sent: true, messageId: msgId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        await supabase
          .from("messages")
          .update({ status: "failed", error_details: result.error })
          .eq("id", msgId);
        console.log(`[send-message] msg=${msgId} channel=email status=failed code=${result.error.code}`);
        return new Response(
          JSON.stringify({ sent: false, messageId: msgId, error: result.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Should not reach here (channel already validated above)
    return new Response(JSON.stringify({ error: "Unsupported channel" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error("[send-message] Unexpected error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
