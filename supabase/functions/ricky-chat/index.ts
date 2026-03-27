import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { message, businessId, currentStep } = await req.json();

    let businessContext = "";
    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .eq("user_id", user.id)
        .single();
      if (business) {
        businessContext = `\nUser's business: ${business.business_name} (${business.business_category || "uncategorized"}). Services: ${business.services || "not specified"}. Target audience: ${business.target_audience || "not specified"}.`;
      }
    }

    const stepNames = ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search"];

    const systemPrompt = `You are Ricky, a proactive and encouraging AI growth guide for RickyAI — a local business growth platform. You help small business owners build their online presence step by step.

Current step: ${stepNames[currentStep] || "Dashboard"} (Step ${currentStep} of 12)
${businessContext}

Rules:
- Be warm, encouraging, and actionable
- Give specific advice, not generic platitudes  
- Keep responses concise (2-4 sentences max)
- Reference their business by name when possible
- Guide them through the current step
- Use emojis sparingly but naturally
- If they seem stuck, suggest the next action`;

    let reply: string;

    try {
      const aiResponse = await fetch(AI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        console.error(`[ricky-chat] AI returned ${status}`);
        throw new Error(`AI_UNAVAILABLE_${status}`);
      }

      const aiData = await aiResponse.json();
      reply = aiData.choices[0].message.content;
    } catch (aiErr: any) {
      console.error("[ricky-chat] AI fallback triggered:", aiErr.message);
      const stepName = stepNames[currentStep] || "the dashboard";
      reply = `Hey! 👋 Ricky is temporarily offline because our AI service is unavailable. But you can still use the rest of the app — keep working through ${stepName} and I'll be back to help soon! If you need guidance, check the help guides in each step.`;
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Only auth errors reach here — still return 200 with error info when possible
    const msg = error.message;
    if (msg === "Missing authorization" || msg === "Unauthorized") {
      return new Response(JSON.stringify({ error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ reply: "Something went wrong — please try again in a moment." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
