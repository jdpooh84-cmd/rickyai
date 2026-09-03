import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const { priceId } = await req.json();
    if (!priceId) throw new Error("Price ID is required");

    // Server-side allowlist — reject any price ID not on this list to prevent
    // clients from substituting arbitrary Stripe prices (e.g. $1 test prices).
    const VALID_PRICE_IDS = new Set([
      "price_1TeGX2RUytwslneZ7OMOagHD", // Creator $59/mo
      "price_1TeGX2RUytwslneZLs6JpyHL", // Business Starter $169/mo
      "price_1TeGX1RUytwslneZpYfpkgXd", // Growth $249/mo
      "price_1TeGX1RUytwslneZCWA5jEqx", // Agency $799/mo
      "price_1TeGX3RUytwslneZ98JVVxM0", // Federal Contracting add-on $50/mo
      "price_1TeGX1RUytwslneZ29hrgbs3", // Grant Intelligence add-on $50/mo
    ]);
    if (!VALID_PRICE_IDS.has(priceId)) {
      logStep("REJECTED: unknown price ID", { priceId });
      return new Response(JSON.stringify({ error: "Invalid price ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    logStep("Price ID validated", { priceId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      const newCustomer = await stripe.customers.create({ email: user.email, metadata: { supabase_uid: user.id } });
      customerId = newCustomer.id;
      logStep("New customer created", { customerId });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { address: "auto", name: "auto" },
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/signup?checkout=cancelled`,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
