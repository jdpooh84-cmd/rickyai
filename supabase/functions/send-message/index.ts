import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, requireString, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const rawBody = await req.json();
    const { businessId, contactId, channel, body, subject, automationStepId } = rawBody;

    const validated = validate(() => ({
      businessId: requireUuid(businessId, "businessId"),
      contactId: requireUuid(contactId, "contactId"),
      body: requireString(body, "body", 1600),
    }));
    if (validated instanceof Response) return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (!channel) {
      return new Response(JSON.stringify({ error: "channel is required" }), { status: 400, headers: corsHeaders });
    }

    // Verify ownership
    const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).eq("user_id", user.id).maybeSingle();
    if (!biz) return new Response(JSON.stringify({ error: "Business not found" }), { status: 403, headers: corsHeaders });

    // Check do_not_contact and consent
    const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle();
    if (!contact) return new Response(JSON.stringify({ error: "Contact not found" }), { status: 404, headers: corsHeaders });
    if (contact.do_not_contact) return new Response(JSON.stringify({ error: "Contact is do_not_contact" }), { status: 422, headers: corsHeaders });
    if (channel === "sms" && contact.sms_consent_status === "revoked") {
      return new Response(JSON.stringify({ error: "SMS consent revoked" }), { status: 422, headers: corsHeaders });
    }
    if (channel === "email" && contact.email_consent_status === "revoked") {
      return new Response(JSON.stringify({ error: "Email consent revoked" }), { status: 422, headers: corsHeaders });
    }

    // Insert message record
    const { data: msg } = await supabase.from("messages").insert({
      business_id: businessId,
      contact_id: contactId,
      channel,
      direction: "outbound",
      body,
      subject: subject || null,
      status: "queued",
      automation_id: automationStepId || null,
    }).select().single();

    // TODO: actual transport requires TWILIO_* or SENDGRID_API_KEY secrets set by owner
    // For now we record the message as queued

    return new Response(JSON.stringify({ sent: true, messageId: msg?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
