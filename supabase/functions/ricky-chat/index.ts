import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const QUESTION_LIMIT = 25;

const stepNames = ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search"];

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

    // ── Check question limit ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("ricky_question_count, ricky_limit_reached")
      .eq("user_id", user.id)
      .single();

    const count = profile?.ricky_question_count ?? 0;
    const limitReached = profile?.ricky_limit_reached ?? false;

    if (limitReached || count >= QUESTION_LIMIT) {
      return new Response(JSON.stringify({
        reply: "You've reached Ricky's 25-question limit for now. You can still use all the tools in the app, and we'll refresh Ricky's questions again soon! 🙌",
        questionCount: count,
        limitReached: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Load business context ──
    let businessContext = "";
    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .eq("user_id", user.id)
        .single();
      if (business) {
        businessContext = `
User's business: ${business.business_name} (${business.business_category || "uncategorized"}).
Services: ${business.services || "not specified"}.
Target audience: ${business.target_audience || "not specified"}.
Brand tone: ${business.brand_tone || "not specified"}.
Website: ${business.website_url || "none"}.
Location info from their profile.`;
      }
    }

    // ── Scoped system prompt ──
    const systemPrompt = `You are Ricky, a friendly FAQ assistant for RickyAI — a local business growth and video marketing platform. You are NOT a general-purpose AI. You follow strict rules about what you can answer.

SCOPE — You may ONLY answer questions in these categories:
1. **About this app / website**: How to use Ricky.AI, what each section/step does, how pricing/tiers work, how to connect tools (Runway, ElevenLabs, etc.), how Video Studio works, how the strategy steps work, how to upload media, etc.
2. **About the client's business**: Information already in their business profile (location, services, target audience, brand tone). Summarize or explain what they entered.
3. **Simple public info lookups**: Factual questions that help with marketing — like best video dimensions for Instagram Reels, ideal posting times, what hashtags to use, current time in a city, etc.

OUT OF SCOPE — If the user asks about anything else (personal advice, politics, entertainment, coding, random trivia, health, finance, etc.), reply EXACTLY with:
"I'm just your Ricky.AI guide 😊 I can help with this app and your business marketing, but I'm not set up to answer that kind of question. Try asking me about a feature in the app or your business strategy!"

Current step: ${stepNames[currentStep] || "Dashboard"} (Step ${currentStep} of 12)
${businessContext}

App features you can explain:
- Step 1 (Connect): Connect social accounts and tools
- Step 2 (Profile): Set up business name, category, services, target audience
- Step 3 (Compete): Competitor analysis
- Step 4 (Scout): Content scouting and research
- Step 5 (Audit): Content audit of existing presence
- Step 6 (Platform): Platform strategy (which social platforms to focus on)
- Step 7 (Script): AI-generated content scripts
- Step 8 (Video Studio): Produce promotional videos with Runway AI, upload media, approve scripts
- Step 9 (Storyboard): Visual storyboard planning
- Step 10 (Export): Export and schedule content
- Step 11 (Lead Scout): Find potential leads and partnerships
- Step 12 (Grant Search): Search for small business grants
- Media Library: Upload photos and video clips for your business
- Ricky Helper: This chat assistant (you!)

Rules:
- Be warm, encouraging, and concise (2-4 sentences max)
- Reference their business by name when possible
- If they ask about the current step, give specific guidance
- Use emojis sparingly but naturally
- If you're unsure whether a question is in scope, err on the side of answering if it relates to marketing or the app`;

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
      // Do NOT increment counter on failure
      return new Response(JSON.stringify({
        reply: "Ricky is taking a quick break while our AI service reconnects. Please try again later, or use the sidebar to keep working! 🔧",
        questionCount: count,
        limitReached: false,
        aiUnavailable: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Increment question counter (only on successful AI response) ──
    const newCount = count + 1;
    const newLimitReached = newCount >= QUESTION_LIMIT;
    await supabase
      .from("profiles")
      .update({
        ricky_question_count: newCount,
        ricky_limit_reached: newLimitReached,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      reply,
      questionCount: newCount,
      limitReached: newLimitReached,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const msg = (error as any).message;
    if (msg === "Missing authorization" || msg === "Unauthorized") {
      return new Response(JSON.stringify({ error: msg }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      reply: "Something went wrong — please try again in a moment.",
      questionCount: 0,
      limitReached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
