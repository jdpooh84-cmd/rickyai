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
    const callerId = userData.user?.id;
    if (!callerId) throw new Error("Not authenticated");

    // Verify caller is admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Unauthorized: admin role required");

    const body = await req.json();
    const { action } = body;

    // --- User Management ---
    if (action === "search") {
      const { email } = body;
      const { data: users, error } = await supabaseClient.auth.admin.listUsers({ perPage: 50 });
      if (error) throw error;
      
      const filtered = email
        ? users.users.filter(u => u.email?.toLowerCase().includes(email.toLowerCase()))
        : users.users;

      const userIds = filtered.map(u => u.id);
      const { data: roles } = await supabaseClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const rolesMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      const result = filtered.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        roles: rolesMap[u.id] || [],
      }));

      return new Response(JSON.stringify({ users: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "grant_role") {
      const { user_id, role } = body;
      if (!user_id || !role) throw new Error("user_id and role are required");
      const { error } = await supabaseClient
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id,role" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "revoke_role") {
      const { user_id, role } = body;
      if (!user_id || !role) throw new Error("user_id and role are required");
      if (user_id === callerId && role === "admin") {
        throw new Error("Cannot remove your own admin role");
      }
      const { error } = await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", role);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Affiliate Payouts ---
    if (action === "list_payouts") {
      const { data: payouts } = await supabaseClient
        .from("affiliate_payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ payouts: payouts || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_referrers") {
      const { data: referrers } = await supabaseClient
        .from("referral_codes")
        .select("user_id, code, conversions, commission_rate_percent")
        .order("conversions", { ascending: false })
        .limit(20);
      return new Response(JSON.stringify({ referrers: referrers || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_payout") {
      const { payout_id, status } = body;
      if (!payout_id || !status) throw new Error("payout_id and status required");
      const updateData: any = { status };
      if (status === "paid") updateData.paid_at = new Date().toISOString();
      const { error } = await supabaseClient
        .from("affiliate_payouts")
        .update(updateData)
        .eq("id", payout_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Advertiser Management ---
    if (action === "list_advertisers") {
      const { data: advertisers } = await supabaseClient
        .from("advertiser_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: campaigns } = await supabaseClient
        .from("ad_campaigns")
        .select("id, name, status, budget_cents, spent_cents, advertiser_id")
        .order("created_at", { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ advertisers: advertisers || [], campaigns: campaigns || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_advertiser") {
      const { company_name, contact_email, industry } = body;
      if (!company_name || !contact_email || !industry) throw new Error("company_name, contact_email, industry required");
      const { error } = await supabaseClient
        .from("advertiser_accounts")
        .insert({ company_name, contact_email, industry, status: "pending" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_advertiser_status") {
      const { advertiser_id, status } = body;
      if (!advertiser_id || !status) throw new Error("advertiser_id and status required");
      const { error } = await supabaseClient
        .from("advertiser_accounts")
        .update({ status })
        .eq("id", advertiser_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: msg.includes("Unauthorized") ? 403 : 400,
    });
  }
});
