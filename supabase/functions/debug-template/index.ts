Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Admin-only: require RECONCILE_SECRET header (debug utility, not called by frontend)
  const reconcileSecret = Deno.env.get("RECONCILE_SECRET");
  const providedSecret = req.headers.get("x-reconcile-secret");
  if (!reconcileSecret || !providedSecret || reconcileSecret !== providedSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("CREATOMATE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "CREATOMATE_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const templateId = "a863011b-2269-435d-b397-339e8fc0f736";
  const resp = await fetch(`https://api.creatomate.com/v1/templates/${templateId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const body = await resp.json();
  return new Response(JSON.stringify(body, null, 2), {
    status: resp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
