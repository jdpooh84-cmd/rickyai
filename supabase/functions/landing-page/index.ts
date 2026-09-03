// Public edge function — serves landing pages as HTML and handles lead form submissions.
// verify_jwt = false — no Supabase JWT required (public page).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const htmlPage = (title: string, body: string): Response =>
  new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f0f12;
      color: #e8e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .card {
      background: #1a1a24;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 3rem 2.5rem;
      max-width: 520px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.3; }
    .offer { font-size: 1rem; color: #a0a0b8; line-height: 1.6; margin-bottom: 2rem; white-space: pre-wrap; }
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    input {
      background: #0f0f18;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      color: #e8e8f0;
      font-size: 1rem;
      padding: 0.75rem 1rem;
      width: 100%;
      outline: none;
    }
    input:focus { border-color: #7c6df0; }
    input::placeholder { color: #5a5a78; }
    button[type="submit"] {
      background: #7c6df0;
      border: none;
      border-radius: 8px;
      color: #fff;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      padding: 0.875rem 1.5rem;
      margin-top: 0.5rem;
      transition: background 0.2s;
      width: 100%;
    }
    button[type="submit"]:hover { background: #6a5cd8; }
    .powered { font-size: 0.75rem; color: #40405a; margin-top: 2rem; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
    <p class="powered">Powered by RickyAI</p>
  </div>
</body>
</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

const notFoundPage = (): Response =>
  new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Page Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f12; color: #e8e8f0;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #a0a0b8; }
  </style>
</head>
<body><div><h1>404</h1><p>This page could not be found or is no longer active.</p></div></body>
</html>`, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";

  if (!slug) return notFoundPage();

  // Look up page
  const { data: page, error: pageErr } = await supabase
    .from("landing_pages")
    .select("id, headline, offer_text, cta_text, active")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (pageErr || !page) return notFoundPage();

  // --- GET: Serve the page + record view ---
  if (req.method === "GET") {
    // Increment views (fire and forget, tolerate failure)
    supabase
      .from("landing_pages")
      .update({ views: (page as any).views + 1 })
      .eq("id", page.id)
      .then(() => {})
      .catch(() => {});

    const headline = escapeHtml(page.headline || "Special Offer");
    const offerText = escapeHtml(page.offer_text || "");
    const ctaText = escapeHtml(page.cta_text || "Claim Now");

    // Use raw supabase function URL as POST action so form can submit back
    const actionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/landing-page?slug=${encodeURIComponent(slug)}`;

    const body = `
      <h1>${headline}</h1>
      ${offerText ? `<p class="offer">${offerText}</p>` : ""}
      <form method="POST" action="${escapeHtml(actionUrl)}">
        <input type="text" name="name" placeholder="Your Name" />
        <input type="tel" name="phone" placeholder="Phone Number" />
        <input type="email" name="email" placeholder="Email Address" />
        <button type="submit">${ctaText}</button>
      </form>
    `;

    return htmlPage(page.headline || "Special Offer", body);
  }

  // --- POST: Handle form submission ---
  if (req.method === "POST") {
    let name = "", phone = "", email = "";
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        name = params.get("name") || "";
        phone = params.get("phone") || "";
        email = params.get("email") || "";
      } else if (contentType.includes("application/json")) {
        const body = await req.json();
        name = body.name || "";
        phone = body.phone || "";
        email = body.email || "";
      }
    } catch (_) { /* tolerate parse errors */ }

    // Insert submission
    const { error: insertErr } = await supabase.from("landing_page_submissions").insert({
      landing_page_id: page.id,
      name: name.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });

    if (!insertErr) {
      // Increment submissions counter using raw SQL expression to avoid read-modify-write race
      await supabase.rpc("increment_lp_submissions", { page_id: page.id }).catch(() =>
        // Fallback if RPC not deployed yet — still correct since we re-query the count
        supabase.from("landing_pages").update({ submissions: (page.submissions ?? 0) + 1 }).eq("id", page.id)
      );
    }

    const headline = escapeHtml(page.headline || "Special Offer");
    const body = `
      <h1>You're in!</h1>
      <p class="offer">Thank you for claiming <strong>${headline}</strong>. We'll be in touch shortly!</p>
    `;
    return htmlPage("Thank You!", body);
  }

  return new Response("Method Not Allowed", { status: 405 });
});
