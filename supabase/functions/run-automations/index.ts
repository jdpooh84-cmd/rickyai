/**
 * run-automations — Lifecycle automation step execution worker.
 *
 * Called by pg_cron every 5 minutes (see migration 20260903000016_automation_cron.sql).
 *
 * Processes pending automation_step_executions where:
 *   status = 'pending' AND scheduled_at <= now()
 * joined with active enrollments and active automations. Limit 50 per sweep.
 *
 * For each execution:
 *  - Loads contact; applies DNC / consent guards
 *  - Renders template variables: {{first_name}}, {{business_name}}
 *  - Dispatches SMS (Twilio), email (SendGrid), or internal (no transport)
 *  - Updates execution row to 'sent' / 'skipped' / 'failed'
 *  - After each enrollment's executions are done, marks enrollment 'completed'
 *
 * Auth: RECONCILE_SECRET query param (constant-time compare).
 *       verify_jwt = false — pg_cron cannot present a JWT.
 *
 * Security: API keys, phone numbers, and email addresses are NEVER logged.
 *           Only execution IDs and status transitions appear in logs.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const MAX_EXECUTIONS_PER_SWEEP = 50;

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

function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(val);
  }
  return out;
}

async function sendSms(
  to: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
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
    return { success: true, sid: String(data["sid"] ?? "") };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  fromName: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = Deno.env.get("SENDGRID_API_KEY");
  const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL");
  if (!apiKey || !fromEmail) {
    return { success: false, error: "sendgrid_not_configured" };
  }
  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: "text/plain", value: body }],
      }),
    });
    if (!resp.ok) {
      let msg = "SendGrid request failed";
      try {
        const err = await resp.json() as { errors?: Array<{ message: string }> };
        msg = err?.errors?.[0]?.message ?? msg;
      } catch { /* ignore */ }
      return { success: false, error: msg };
    }
    return { success: true, messageId: resp.headers.get("X-Message-Id") ?? undefined };
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
    console.error("[run-automations] RECONCILE_SECRET not set — refusing to run");
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const reqUrl = new URL(req.url);
  const provided = reqUrl.searchParams.get("secret") ?? "";
  if (!constantTimeEqual(provided, reconcileSecret)) {
    console.warn("[run-automations] Rejected: invalid secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();

  // Fetch pending executions with all needed joins.
  // lifecycle_steps uses column 'template' (not 'message_template').
  // Filtering on nested columns is applied in-code after the query for reliability.
  const { data: rawExecutions, error: fetchErr } = await supabase
    .from("automation_step_executions")
    .select(`
      id,
      enrollment_id,
      step_id,
      scheduled_at,
      enrollment:automation_enrollments!inner(
        id,
        business_id,
        contact_id,
        status,
        business:businesses!inner(id, business_name)
      ),
      step:lifecycle_steps!inner(
        id,
        channel,
        template,
        automation:lifecycle_automations!inner(id, active, name)
      )
    `)
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(MAX_EXECUTIONS_PER_SWEEP);

  if (fetchErr) {
    console.error("[run-automations] Failed to fetch executions:", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Filter in-code: only active enrollments in active automations
  const executions = (rawExecutions ?? []).filter(
    (e: Record<string, unknown>) => {
      const enrollment = e.enrollment as Record<string, unknown> | null;
      const step = e.step as Record<string, unknown> | null;
      const automation = step?.automation as Record<string, unknown> | null;
      return enrollment?.status === "active" && automation?.active === true;
    },
  );

  if (executions.length === 0) {
    console.log("[run-automations] No pending executions ready to process.");
    return new Response(
      JSON.stringify({ processed: 0, sent: 0, skipped: 0, failed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(`[run-automations] Processing ${executions.length} execution(s).`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const enrollmentsSeen = new Set<string>();

  for (const exec of executions) {
    const execId = exec.id as string;
    const enrollmentId = exec.enrollment_id as string;
    const enrollment = exec.enrollment as Record<string, unknown>;
    const step = exec.step as Record<string, unknown>;
    const contactId = enrollment.contact_id as string | null;
    const businessName = (enrollment.business as Record<string, unknown> | null)?.business_name as string ?? "";
    const channel = step.channel as string ?? "internal";
    const template = step.template as string ?? "";
    const doneAt = new Date().toISOString();

    enrollmentsSeen.add(enrollmentId);

    try {
      // No contact — skip
      if (!contactId) {
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: "no_contact" })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=no_contact`);
        skipped++;
        continue;
      }

      // Load contact
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, phone, email, first_name, sms_consent_status, email_consent_status, do_not_contact")
        .eq("id", contactId)
        .maybeSingle();

      if (!contact) {
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: "contact_not_found" })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=contact_not_found`);
        skipped++;
        continue;
      }

      // DNC / consent guards
      if (contact.do_not_contact) {
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: "do_not_contact" })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=do_not_contact`);
        skipped++;
        continue;
      }
      if (channel === "sms" && contact.sms_consent_status === "revoked") {
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: "sms_consent_revoked" })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=sms_consent_revoked`);
        skipped++;
        continue;
      }
      if (channel === "email" && contact.email_consent_status === "revoked") {
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: "email_consent_revoked" })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=email_consent_revoked`);
        skipped++;
        continue;
      }

      // Render template — only {{first_name}} and {{business_name}} are supported
      const firstName = (contact.first_name as string | null) ?? "there";
      const message = renderTemplate(template, {
        first_name: firstName,
        business_name: businessName,
      });

      // Dispatch by channel
      if (channel === "internal") {
        // Internal notes require no transport — mark sent immediately
        await supabase
          .from("automation_step_executions")
          .update({ status: "sent", executed_at: doneAt })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} channel=internal status=sent`);
        sent++;

      } else if (channel === "sms") {
        if (!contact.phone) {
          await supabase
            .from("automation_step_executions")
            .update({ status: "skipped", executed_at: doneAt, error: "no_phone" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} status=skipped reason=no_phone`);
          skipped++;
          continue;
        }
        const result = await sendSms(contact.phone as string, message);
        if (result.error === "twilio_not_configured") {
          await supabase
            .from("automation_step_executions")
            .update({ status: "skipped", executed_at: doneAt, error: "twilio_not_configured" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} status=skipped reason=twilio_not_configured`);
          skipped++;
        } else if (result.success) {
          await supabase
            .from("automation_step_executions")
            .update({ status: "sent", executed_at: doneAt, provider_message_id: result.sid ?? null })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} channel=sms status=sent`);
          sent++;
        } else {
          await supabase
            .from("automation_step_executions")
            .update({ status: "failed", executed_at: doneAt, error: result.error ?? "send_failed" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} channel=sms status=failed`);
          failed++;
        }

      } else if (channel === "email") {
        if (!contact.email) {
          await supabase
            .from("automation_step_executions")
            .update({ status: "skipped", executed_at: doneAt, error: "no_email" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} status=skipped reason=no_email`);
          skipped++;
          continue;
        }
        const result = await sendEmail(
          contact.email as string,
          `Message from ${businessName}`,
          message,
          businessName,
        );
        if (result.error === "sendgrid_not_configured") {
          await supabase
            .from("automation_step_executions")
            .update({ status: "skipped", executed_at: doneAt, error: "sendgrid_not_configured" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} status=skipped reason=sendgrid_not_configured`);
          skipped++;
        } else if (result.success) {
          await supabase
            .from("automation_step_executions")
            .update({ status: "sent", executed_at: doneAt, provider_message_id: result.messageId ?? null })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} channel=email status=sent`);
          sent++;
        } else {
          await supabase
            .from("automation_step_executions")
            .update({ status: "failed", executed_at: doneAt, error: result.error ?? "send_failed" })
            .eq("id", execId);
          console.log(`[run-automations] exec=${execId} channel=email status=failed`);
          failed++;
        }

      } else {
        // Unknown channel — skip
        await supabase
          .from("automation_step_executions")
          .update({ status: "skipped", executed_at: doneAt, error: `unknown_channel:${channel}` })
          .eq("id", execId);
        console.log(`[run-automations] exec=${execId} status=skipped reason=unknown_channel`);
        skipped++;
      }
    } catch (err) {
      console.error(`[run-automations] exec=${execId} unexpected error:`, String(err));
      await supabase
        .from("automation_step_executions")
        .update({ status: "failed", executed_at: new Date().toISOString(), error: "unexpected_error" })
        .eq("id", execId)
        .catch(() => { /* best-effort */ });
      failed++;
    }
  }

  // Check each seen enrollment: if no more pending executions remain, mark completed
  for (const enrollmentId of enrollmentsSeen) {
    try {
      const { data: remaining } = await supabase
        .from("automation_step_executions")
        .select("id")
        .eq("enrollment_id", enrollmentId)
        .eq("status", "pending")
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await supabase
          .from("automation_enrollments")
          .update({ status: "completed" })
          .eq("id", enrollmentId)
          .eq("status", "active"); // only if still active (not already exited)
        console.log(`[run-automations] enrollment=${enrollmentId} status=completed`);
      }
    } catch (err) {
      console.error(`[run-automations] enrollment=${enrollmentId} completion check error:`, String(err));
    }
  }

  const processed = sent + skipped + failed;
  console.log(
    `[run-automations] Done. processed=${processed} sent=${sent} skipped=${skipped} failed=${failed}`,
  );

  return new Response(
    JSON.stringify({ processed, sent, skipped, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
