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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const userId = userData.user?.id;
    if (!userId) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Unauthorized: admin role required");

    // Fetch all stats using service role
    const [profiles, businesses, referrals, payouts, activeAds, campaigns] = await Promise.all([
      supabaseClient.from("profiles").select("user_id, display_name, created_at", { count: "exact" }),
      supabaseClient.from("businesses").select("id", { count: "exact" }),
      supabaseClient.from("referral_codes").select("*").order("conversions", { ascending: false }).limit(20),
      supabaseClient.from("affiliate_payouts").select("*").eq("status", "pending"),
      supabaseClient.from("ad_placements").select("id", { count: "exact" }).eq("is_active", true),
      supabaseClient.from("ad_campaigns").select("spent_cents"),
    ]);

    return new Response(JSON.stringify({
      total_users: profiles.count || 0,
      total_businesses: businesses.count || 0,
      top_referrers: referrals.data || [],
      pending_payouts: payouts.data || [],
      active_ads: activeAds.count || 0,
      total_ad_revenue_cents: campaigns.data?.reduce((s: number, c: any) => s + c.spent_cents, 0) || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message.includes("Unauthorized") ? 403 : 500,
    });
  }
});
