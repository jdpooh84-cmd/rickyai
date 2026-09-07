// email-unsubscribe — one-click unsubscribe for contacts per CAN-SPAM requirements
// verify_jwt = false — recipients arrive from email links with no Supabase session
// Security: token is a cryptographically random UUID stored in contacts table
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing unsubscribe token.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  // Validate token is UUID format before hitting the DB
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(token)) {
    return new Response("Invalid token.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: contact, error: findErr } = await supabase
    .from("contacts")
    .select("id, email_consent_status, do_not_contact")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (findErr || !contact) {
    // Return success-looking page to prevent token enumeration
    return new Response(unsubscribePage(true), { status: 200, headers: { "Content-Type": "text/html" } });
  }

  if (contact.email_consent_status !== "revoked") {
    await supabase
      .from("contacts")
      .update({ email_consent_status: "revoked" })
      .eq("id", contact.id);

    console.log(`[email-unsubscribe] Contact ${contact.id} unsubscribed via token`);
  }

  // One-Click Unsubscribe spec (RFC 8058) — POST requests from mail clients
  if (req.method === "POST") {
    return new Response(null, { status: 200 });
  }

  return new Response(unsubscribePage(true), { status: 200, headers: { "Content-Type": "text/html" } });
});

function unsubscribePage(success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe – Ricky AI</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #555; line-height: 1.6; }
    a { color: #6366f1; }
  </style>
</head>
<body>
  ${success
    ? `<h1>You're unsubscribed.</h1>
       <p>You won't receive any more email from this business via Ricky AI. This may take up to 24 hours to take full effect.</p>
       <p>If you have questions, contact <a href="mailto:support@rickyai.com">support@rickyai.com</a>.</p>`
    : `<h1>Unable to unsubscribe.</h1>
       <p>That link may have expired or already been used. If you continue to receive emails, contact <a href="mailto:support@rickyai.com">support@rickyai.com</a>.</p>`
  }
</body>
</html>`;
}
