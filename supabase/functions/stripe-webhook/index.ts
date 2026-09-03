// stripe-webhook — handles Stripe subscription lifecycle events
// verify_jwt = false (Stripe cannot present a Supabase JWT)
// Security: Stripe-Signature header validated via STRIPE_WEBHOOK_SECRET (HMAC-SHA256)
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

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

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.warn("[stripe-webhook] Missing Stripe-Signature header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", String(err));
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[stripe-webhook] Received event: ${event.type} id=${event.id}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: record event to prevent double-processing
  const { error: receiptErr } = await supabase
    .from("webhook_receipts")
    .insert({
      provider: "stripe",
      event_fingerprint: event.id,
      payload_summary: JSON.stringify({ type: event.type }),
    });

  if (receiptErr) {
    if (receiptErr.code === "23505") {
      console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[stripe-webhook] Receipt insert error:", receiptErr.message);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(supabase, stripe, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await cancelSubscription(supabase, stripe, sub);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const email = await getEmailFromCustomer(stripe, customerId);
          if (email) {
            await supabase
              .from("profiles")
              .update({ payment_failed: true })
              .eq("email", email);
            console.log(`[stripe-webhook] Marked payment_failed for ${email}`);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const email = await getEmailFromCustomer(stripe, customerId);
          if (email) {
            await supabase
              .from("profiles")
              .update({ payment_failed: false })
              .eq("email", email);
          }
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (handlerErr) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, String(handlerErr));
    return new Response(JSON.stringify({ error: "Handler error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function getEmailFromCustomer(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch {
    return null;
  }
}

async function syncSubscription(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const email = await getEmailFromCustomer(stripe, customerId);
  if (!email) {
    console.warn(`[stripe-webhook] No email for customer ${customerId}`);
    return;
  }

  // Determine plan from the subscription's price ID
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const status = sub.status; // active, trialing, past_due, canceled, etc.

  console.log(`[stripe-webhook] syncSubscription email=${email} priceId=${priceId} status=${status}`);

  // The check-subscription edge function is the canonical source of truth for plan
  // resolution (via getPlanByPriceId). We only push the subscription status fields
  // that check-subscription can't get on-demand without re-querying Stripe.
  // This ensures the DB reflects the true live state between polling cycles.
  await supabase
    .from("profiles")
    .update({
      stripe_subscription_id: sub.id,
      stripe_subscription_status: status,
      stripe_price_id: priceId,
      payment_failed: status === "past_due" || status === "unpaid",
    })
    .eq("email", email);

  console.log(`[stripe-webhook] Updated subscription state for ${email}`);
}

async function cancelSubscription(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const email = await getEmailFromCustomer(stripe, customerId);
  if (!email) return;

  console.log(`[stripe-webhook] cancelSubscription email=${email} sub=${sub.id}`);

  await supabase
    .from("profiles")
    .update({
      stripe_subscription_status: "canceled",
      payment_failed: false,
    })
    .eq("email", email);

  console.log(`[stripe-webhook] Subscription cancelled for ${email}`);
}
