import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUuid, validate } from "../_shared/validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const rawBody = await req.json();
    const { businessId, horizonDays = 7 } = rawBody;

    const validated = validate(() => ({
      businessId: requireUuid(businessId, "businessId"),
    }));
    if (validated instanceof Response) return new Response(validated.body, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).eq("user_id", user.id).maybeSingle();
    if (!biz) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const horizonEnd = new Date();
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays);
    const horizonStart = new Date();

    // Read service economics
    const { data: economics } = await supabase.from("service_economics").select("*").eq("business_id", businessId);

    // Read available capacity (unused hours this week)
    const { data: capacity } = await supabase.from("resource_capacity")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "available")
      .gte("date", horizonStart.toISOString().split("T")[0])
      .lte("date", horizonEnd.toISOString().split("T")[0]);

    // Read leads without appointments
    const { data: openLeads } = await supabase.from("leads")
      .select("*, contacts(first_name, last_name)")
      .eq("business_id", businessId)
      .in("status", ["new", "contacted"])
      .is("converted_at", null);

    // Read inactive contacts (>90 days no activity)
    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const { data: inactiveContacts } = await supabase.from("contacts")
      .select("id, first_name, last_name, customer_status")
      .eq("business_id", businessId)
      .eq("customer_status", "customer")
      .lt("last_seen_at", cutoff90.toISOString());

    // Build candidate actions using arithmetic
    const actions = [];

    const totalAvailableMinutes = (capacity || []).reduce((sum, r) => sum + (r.available_minutes || 0), 0);
    const totalAvailableHours = totalAvailableMinutes / 60;

    // Best-margin service
    const topService = (economics || []).sort((a, b) =>
      (b.expected_gross_contribution_cents || 0) - (a.expected_gross_contribution_cents || 0)
    )[0];

    if (openLeads && openLeads.length > 0 && topService) {
      const expectedBookings = Math.min(openLeads.length, Math.floor(openLeads.length * 0.25));
      const expectedContrib = expectedBookings * (topService.expected_gross_contribution_cents || 0);
      actions.push({
        type: "follow_up_leads",
        title: `Follow up with ${openLeads.length} open leads`,
        description: `Contact ${openLeads.length} prospects who haven't scheduled yet. Estimated ${expectedBookings} bookings at ~$${Math.round((topService.expected_revenue_cents || 0) / 100)}/ea.`,
        expectedBookings,
        expectedRevenueCents: expectedBookings * (topService.expected_revenue_cents || 0),
        expectedContribCents: expectedContrib,
        confidence: 0.7,
        priority: 1,
      });
    }

    if (inactiveContacts && inactiveContacts.length > 0) {
      const reactivationRate = 0.12;
      const expectedBookings = Math.round(inactiveContacts.length * reactivationRate);
      const avgRevenue = topService ? topService.expected_revenue_cents : 15000;
      actions.push({
        type: "reactivate_customers",
        title: `Reactivate ${inactiveContacts.length} inactive customers`,
        description: `${inactiveContacts.length} customers haven't booked in 90+ days. A targeted reactivation campaign could bring back ~${expectedBookings}.`,
        expectedBookings,
        expectedRevenueCents: expectedBookings * avgRevenue,
        expectedContribCents: expectedBookings * (topService?.expected_gross_contribution_cents || avgRevenue * 0.4),
        confidence: 0.55,
        priority: 2,
      });
    }

    if (totalAvailableHours > 4 && topService) {
      const possibleJobs = Math.floor(totalAvailableHours / (topService.expected_labor_hours || 2));
      actions.push({
        type: "fill_capacity",
        title: `Fill ${Math.round(totalAvailableHours)}h of unused capacity`,
        description: `${Math.round(totalAvailableHours)} technician-hours are available this week. Filling ${possibleJobs} ${topService.service_name} jobs could add $${Math.round(possibleJobs * (topService.expected_gross_contribution_cents || 0) / 100)}.`,
        expectedBookings: possibleJobs,
        expectedRevenueCents: possibleJobs * (topService.expected_revenue_cents || 0),
        expectedContribCents: possibleJobs * (topService.expected_gross_contribution_cents || 0),
        confidence: 0.5,
        priority: 3,
      });
    }

    // Sort by contribution
    actions.sort((a, b) => (b.expectedContribCents || 0) - (a.expectedContribCents || 0));

    const totalExpectedCents = actions.reduce((sum, a) => sum + (a.expectedContribCents || 0), 0);

    return new Response(JSON.stringify({
      actions,
      totalExpectedContribCents: totalExpectedCents,
      horizonDays,
      dataQuality: {
        hasEconomics: (economics || []).length > 0,
        hasCapacity: (capacity || []).length > 0,
        openLeads: openLeads?.length || 0,
        inactiveCustomers: inactiveContacts?.length || 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
