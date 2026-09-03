/**
 * send-appointment-reminders — Appointment confirmation and reminder SMS worker.
 *
 * Called by pg_cron every 15 minutes (see migration 20260903000016_automation_cron.sql).
 *
 * Two sweeps per run:
 *
 * REMINDERS — appointments where:
 *   status IN ('requested', 'confirmed')
 *   AND start_at BETWEEN now() AND now() + 24 hours
 *   AND reminder_sent_at IS NULL
 *   (limit 50)
 *   → Sends "tomorrow at {{time}}" reminder via SMS.
 *   → Sets reminder_sent_at = now().
 *
 * CONFIRMATIONS — appointments where:
 *   status = 'requested'
 *   AND confirmation_sent_at IS NULL
 *   AND created_at < now() - 5 minutes
 *   (limit 50)
 *   → Sends "your appointment has been requested" confirmation via SMS.
 *   → Sets confirmation_sent_at = now() and status = 'confirmed'.
 *
 * Auth: RECONCILE_SECRET query param (constant-time compare).
 *       verify_jwt = false — pg_cron cannot present a JWT.
 *
 * Security: phone numbers, names, and emails are NEVER logged.
 *           Only appointment IDs and status transitions appear in logs.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function formatTime(isoString: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}

function formatDate(isoString: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}

async function sendSms(
  to: string,
  body: string,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: "twilio_not_configured" };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
    });
    let data: Record<string, unknown> = {};
    try {
      data = await resp.json();
    } catch { /* non-JSON */ }
    if (!resp.ok) {
      return { success: false, error: String(data["message"] ?? resp.status) };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

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

  // Auth: require RECONCILE_SECRET
  const reconcileSecret = Deno.env.get("RECONCILE_SECRET");
  if (!reconcileSecret) {
    console.error("[send-appointment-reminders] RECONCILE_SECRET not set — refusing to run");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const reqUrl = new URL(req.url);
  const provided = reqUrl.searchParams.get("secret") ?? "";
  if (!constantTimeEqual(provided, reconcileSecret)) {
    console.warn("[send-appointment-reminders] Rejected: invalid secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const in24h = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();
  const fiveMinutesAgo = new Date(nowMs - 5 * 60 * 1000).toISOString();

  let remindersSent = 0;
  let confirmationsSent = 0;
  let skipped = 0;

  // -----------------------------------------------------------------------
  // SWEEP 1: Reminders — appointments in the next 24 hours without reminder
  // -----------------------------------------------------------------------
  const { data: reminderAppts, error: reminderErr } = await supabase
    .from("appointments")
    .select(`
      id,
      business_id,
      contact_id,
      appointment_type_id,
      start_at,
      status,
      contact:contacts!inner(id, phone, first_name, sms_consent_status, do_not_contact),
      appointment_type:appointment_types(id, name),
      business:businesses!inner(id, business_name, timezone)
    `)
    .in("status", ["requested", "confirmed"])
    .gte("start_at", now)
    .lte("start_at", in24h)
    .is("reminder_sent_at", null)
    .limit(50);

  if (reminderErr) {
    console.error("[send-appointment-reminders] Reminder query error:", reminderErr.message);
  }

  for (const appt of (reminderAppts ?? [])) {
    const apptId = appt.id as string;
    const contact = appt.contact as Record<string, unknown> | null;
    const business = appt.business as Record<string, unknown> | null;
    const apptType = appt.appointment_type as Record<string, unknown> | null;

    if (!contact) {
      console.log(`[send-appointment-reminders] appt=${apptId} skipped=no_contact`);
      skipped++;
      continue;
    }

    if (contact.do_not_contact) {
      console.log(`[send-appointment-reminders] appt=${apptId} skipped=do_not_contact`);
      skipped++;
      continue;
    }
    if (contact.sms_consent_status === "revoked") {
      console.log(`[send-appointment-reminders] appt=${apptId} skipped=sms_consent_revoked`);
      skipped++;
      continue;
    }
    if (!contact.phone) {
      console.log(`[send-appointment-reminders] appt=${apptId} skipped=no_phone`);
      skipped++;
      continue;
    }

    const firstName = (contact.first_name as string | null) ?? "there";
    const businessName = (business?.business_name as string | null) ?? "us";
    const timezone = (business?.timezone as string | null) ?? "America/New_York";
    const serviceName = (apptType?.name as string | null) ?? "appointment";
    const apptTime = formatTime(appt.start_at as string, timezone);

    const body =
      `Hi ${firstName}, this is a reminder from ${businessName}. ` +
      `Your ${serviceName} appointment is tomorrow at ${apptTime}. ` +
      `Reply STOP to opt out.`;

    const result = await sendSms(contact.phone as string, body);

    if (result.error === "twilio_not_configured") {
      console.log(`[send-appointment-reminders] appt=${apptId} skipped=twilio_not_configured`);
      skipped++;
      continue;
    }

    if (result.success) {
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", apptId);
      console.log(`[send-appointment-reminders] appt=${apptId} reminder=sent`);
      remindersSent++;
    } else {
      console.log(`[send-appointment-reminders] appt=${apptId} reminder=failed error=${result.error}`);
      skipped++;
    }
  }

  // -----------------------------------------------------------------------
  // SWEEP 2: Confirmations — requested appointments with no confirmation yet
  // -----------------------------------------------------------------------
  const { data: confirmAppts, error: confirmErr } = await supabase
    .from("appointments")
    .select(`
      id,
      business_id,
      contact_id,
      appointment_type_id,
      start_at,
      status,
      contact:contacts!inner(id, phone, first_name, sms_consent_status, do_not_contact),
      appointment_type:appointment_types(id, name),
      business:businesses!inner(id, business_name, timezone)
    `)
    .eq("status", "requested")
    .is("confirmation_sent_at", null)
    .lt("created_at", fiveMinutesAgo)
    .limit(50);

  if (confirmErr) {
    console.error("[send-appointment-reminders] Confirmation query error:", confirmErr.message);
  }

  for (const appt of (confirmAppts ?? [])) {
    const apptId = appt.id as string;
    const contact = appt.contact as Record<string, unknown> | null;
    const business = appt.business as Record<string, unknown> | null;
    const apptType = appt.appointment_type as Record<string, unknown> | null;

    if (!contact) {
      console.log(`[send-appointment-reminders] appt=${apptId} confirm=skipped reason=no_contact`);
      skipped++;
      continue;
    }
    if (contact.do_not_contact) {
      console.log(`[send-appointment-reminders] appt=${apptId} confirm=skipped reason=do_not_contact`);
      skipped++;
      continue;
    }
    if (contact.sms_consent_status === "revoked") {
      console.log(`[send-appointment-reminders] appt=${apptId} confirm=skipped reason=sms_consent_revoked`);
      skipped++;
      continue;
    }
    if (!contact.phone) {
      console.log(`[send-appointment-reminders] appt=${apptId} confirm=skipped reason=no_phone`);
      skipped++;
      continue;
    }

    const firstName = (contact.first_name as string | null) ?? "there";
    const businessName = (business?.business_name as string | null) ?? "us";
    const timezone = (business?.timezone as string | null) ?? "America/New_York";
    const serviceName = (apptType?.name as string | null) ?? "appointment";
    const apptDate = formatDate(appt.start_at as string, timezone);
    const apptTime = formatTime(appt.start_at as string, timezone);

    const body =
      `Hi ${firstName}, your ${serviceName} appointment with ${businessName} ` +
      `on ${apptDate} at ${apptTime} has been requested. We'll confirm shortly.`;

    const result = await sendSms(contact.phone as string, body);

    if (result.error === "twilio_not_configured") {
      console.log(`[send-appointment-reminders] appt=${apptId} confirm=skipped reason=twilio_not_configured`);
      skipped++;
      continue;
    }

    if (result.success) {
      const doneAt = new Date().toISOString();
      await supabase
        .from("appointments")
        .update({ confirmation_sent_at: doneAt, status: "confirmed" })
        .eq("id", apptId);
      console.log(`[send-appointment-reminders] appt=${apptId} confirmation=sent status=confirmed`);
      confirmationsSent++;
    } else {
      console.log(`[send-appointment-reminders] appt=${apptId} confirmation=failed error=${result.error}`);
      skipped++;
    }
  }

  console.log(
    `[send-appointment-reminders] Done. reminders_sent=${remindersSent} confirmations_sent=${confirmationsSent} skipped=${skipped}`,
  );

  return new Response(
    JSON.stringify({ reminders_sent: remindersSent, confirmations_sent: confirmationsSent, skipped }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
