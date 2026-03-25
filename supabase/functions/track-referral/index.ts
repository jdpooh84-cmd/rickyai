import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { action, referral_code } = await req.json();

    if (action === "click") {
      // Track a click on a referral link (no auth needed)
      const { data: codeData, error } = await supabaseClient
        .from("referral_codes")
        .select("id, clicks")
        .eq("code", referral_code)
        .eq("is_active", true)
        .maybeSingle();

      if (!codeData) {
        return new Response(JSON.stringify({ error: "Invalid referral code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      await supabaseClient
        .from("referral_codes")
        .update({ clicks: (codeData.clicks || 0) + 1 })
        .eq("id", codeData.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "convert") {
      // Track a conversion (user signed up via referral)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Auth required for conversion");

      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      const referredUserId = userData.user?.id;
      if (!referredUserId) throw new Error("Not authenticated");

      const { data: codeData } = await supabaseClient
        .from("referral_codes")
        .select("id, user_id, conversions, commission_rate_percent")
        .eq("code", referral_code)
        .eq("is_active", true)
        .maybeSingle();

      if (!codeData) {
        return new Response(JSON.stringify({ error: "Invalid referral code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      // Don't allow self-referral
      if (codeData.user_id === referredUserId) {
        return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Check if already converted
      const { data: existing } = await supabaseClient
        .from("referral_conversions")
        .select("id")
        .eq("referred_user_id", referredUserId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Already referred" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Create conversion record
      // Default commission: 10% of monthly ($79) = $7.90 = 790 cents
      const commissionCents = Math.round(7900 * (Number(codeData.commission_rate_percent) / 100));

      await supabaseClient.from("referral_conversions").insert({
        referral_code_id: codeData.id,
        referred_user_id: referredUserId,
        referrer_user_id: codeData.user_id,
        status: "pending",
        commission_cents: commissionCents,
      });

      // Update conversion count
      await supabaseClient
        .from("referral_codes")
        .update({ conversions: (codeData.conversions || 0) + 1 })
        .eq("id", codeData.id);

      return new Response(JSON.stringify({ success: true, commission_cents: commissionCents }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
