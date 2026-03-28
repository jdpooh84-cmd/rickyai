import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      logStep("Auth failed or no user - returning unsubscribed", { error: userError?.message });
      return new Response(JSON.stringify({
        subscribed: false,
        trial_active: false,
        trial_ends_at: null,
        addon_product_ids: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    // Check trial status
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .single();

    const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({
        subscribed: false,
        trial_active: !!trialActive,
        trial_ends_at: profile?.trial_ends_at || null,
        addon_product_ids: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    // Fetch ALL active subscriptions (main plan + add-ons)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    // Known add-on product IDs
    const ADDON_PRODUCT_IDS = [
      "prod_UEZOQ0OGfVdYPi", // Federal Contracting
      "prod_UEZOL1ICzSWAnt", // Grant Intelligence
    ];

    let mainProductId = null;
    let subscriptionEnd = null;
    const addonProductIds: string[] = [];

    for (const sub of subscriptions.data) {
      for (const item of sub.items.data) {
        const prodId = typeof item.price.product === "string" ? item.price.product : (item.price.product as any).id;
        if (ADDON_PRODUCT_IDS.includes(prodId)) {
          addonProductIds.push(prodId);
        } else if (!mainProductId) {
          mainProductId = prodId;
          subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
        }
      }
    }

    const hasActiveSub = !!mainProductId;
    logStep("Subscription check complete", { mainProductId, addonProductIds, subscriptionEnd });

    if (hasActiveSub) {
      // Upsert usage tracking
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      await supabaseClient
        .from("usage_tracking")
        .upsert(
          { user_id: user.id, period_start: periodStart, period_end: periodEnd },
          { onConflict: "user_id,period_start" }
        );
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: mainProductId,
      subscription_end: subscriptionEnd,
      trial_active: !!trialActive,
      trial_ends_at: profile?.trial_ends_at || null,
      addon_product_ids: addonProductIds,
    }), {
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