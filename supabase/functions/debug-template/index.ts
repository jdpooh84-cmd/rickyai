Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
