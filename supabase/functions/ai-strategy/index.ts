import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { step, businessId, locationId } = await req.json();

    // Fetch business data
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .single();

    if (!business) throw new Error("Business not found");

    // Fetch location data
    let location = null;
    if (locationId) {
      const { data: loc } = await supabase
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .eq("user_id", user.id)
        .single();
      location = loc;
    }

    const businessContext = `
Business: ${business.business_name}
Owner: ${business.owner_name || "Not specified"}
Category: ${business.business_category || "Not specified"}
Niche: ${business.niche || "Not specified"}
Website: ${business.website_url || "None"}
Google Business: ${business.google_business_profile || "None"}
Facebook: ${business.facebook_url || "None"}
Instagram: ${business.instagram_url || "None"}
TikTok: ${business.tiktok_url || "None"}
YouTube: ${business.youtube_url || "None"}
LinkedIn: ${business.linkedin_url || "None"}
Target Audience: ${business.target_audience || "Not specified"}
Brand Tone: ${business.brand_tone || "Not specified"}
Services: ${business.services || "Not specified"}
Competitors: ${business.competitors || "Not specified"}
Content Goals: ${business.content_goals || "Not specified"}
Referral Goals: ${business.referral_goals || "Not specified"}
Funding Goals: ${business.funding_goals || "Not specified"}
Location: ${location ? `${location.city}, ${location.state || ""} ${location.country || "US"} (${location.service_area || "local area"})` : "Not specified"}
`;

    const stepPrompts: Record<number, { system: string; user: string }> = {
      3: {
        system: "You are a local business visibility expert. Analyze the business and provide a visibility report card. Return valid JSON.",
        user: `Analyze this business's online visibility and grade it A-F across these categories. Return JSON with this structure:
{
  "overall_grade": "A-F letter",
  "overall_score": 0-100,
  "categories": [
    {"name": "Website Quality", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]},
    {"name": "Social Media Presence", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]},
    {"name": "Local SEO", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]},
    {"name": "Google Business Profile", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]},
    {"name": "Content Strategy", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]},
    {"name": "Brand Consistency", "grade": "A-F", "score": 0-100, "findings": ["..."], "recommendations": ["..."]}
  ],
  "top_priorities": ["...top 3 things to fix first..."],
  "competitive_edge": "A brief statement about their strongest differentiator"
}

${businessContext}`
      },
      4: {
        system: "You are a competitive intelligence analyst for local businesses. Return valid JSON.",
        user: `Analyze the competitive landscape for this business. Return JSON:
{
  "market_position": "leader|challenger|follower|nicher",
  "competitors": [
    {"name": "...", "strengths": ["..."], "weaknesses": ["..."], "threat_level": "high|medium|low"}
  ],
  "opportunities": ["...5 specific opportunities..."],
  "threats": ["...3 market threats..."],
  "differentiation_strategy": "...",
  "quick_wins": ["...3 things to do this week..."]
}

${businessContext}`
      },
      5: {
        system: "You are a content marketing auditor. Analyze and provide actionable content audit. Return valid JSON.",
        user: `Audit this business's content strategy. Return JSON:
{
  "content_score": 0-100,
  "existing_strengths": ["..."],
  "content_gaps": [
    {"gap": "...", "priority": "high|medium|low", "effort": "easy|medium|hard", "impact": "high|medium|low"}
  ],
  "content_calendar": [
    {"week": 1, "type": "...", "topic": "...", "platform": "...", "goal": "..."},
    {"week": 2, "type": "...", "topic": "...", "platform": "...", "goal": "..."},
    {"week": 3, "type": "...", "topic": "...", "platform": "...", "goal": "..."},
    {"week": 4, "type": "...", "topic": "...", "platform": "...", "goal": "..."}
  ],
  "pillar_topics": ["...3-5 core content pillars..."],
  "recommended_formats": ["..."]
}

${businessContext}`
      },
      6: {
        system: "You are a digital platform strategist. Recommend the best platforms for this business. Return valid JSON.",
        user: `Recommend the best platforms for this business. Return JSON:
{
  "primary_platform": {"name": "...", "reason": "...", "posting_frequency": "...", "content_types": ["..."]},
  "secondary_platforms": [
    {"name": "...", "reason": "...", "posting_frequency": "...", "priority": 1}
  ],
  "platforms_to_avoid": [{"name": "...", "reason": "..."}],
  "platform_strategy": "...",
  "time_investment": "...hours per week...",
  "growth_timeline": "...expected results timeline..."
}

${businessContext}`
      },
      7: {
        system: "You are an expert content scriptwriter for local businesses. Return valid JSON.",
        user: `Write 3 video/content scripts for this business. Return JSON:
{
  "scripts": [
    {
      "title": "...",
      "type": "short-form|long-form|story|reel",
      "duration": "30s|60s|90s|3min",
      "hook": "...opening hook line...",
      "body": "...main content...",
      "cta": "...call to action...",
      "platform": "...",
      "hashtags": ["..."],
      "music_suggestion": "..."
    }
  ],
  "content_tips": ["...3 general tips..."],
  "brand_voice_guide": "...how to stay on brand..."
}

${businessContext}`
      },
      8: {
        system: "You are a video production consultant for small businesses. Return valid JSON.",
        user: `Create a video production plan for this business. Return JSON:
{
  "video_strategy": "...",
  "video_ideas": [
    {"title": "...", "type": "testimonial|tutorial|behind-scenes|promo|educational", "difficulty": "easy|medium|hard", "equipment": ["..."], "estimated_views": "...", "script_outline": "..."}
  ],
  "equipment_recommendations": [
    {"item": "...", "price_range": "...", "priority": "essential|nice-to-have"}
  ],
  "filming_tips": ["..."],
  "editing_workflow": "..."
}

${businessContext}`
      },
      9: {
        system: "You are a visual content strategist. Create storyboard concepts. Return valid JSON.",
        user: `Create storyboard concepts for this business's top video ideas. Return JSON:
{
  "storyboards": [
    {
      "title": "...",
      "scenes": [
        {"scene_number": 1, "visual": "...", "audio": "...", "text_overlay": "...", "duration": "3s", "notes": "..."}
      ],
      "total_duration": "...",
      "mood": "...",
      "color_palette": ["...hex colors..."]
    }
  ],
  "visual_brand_guidelines": {
    "fonts": ["..."],
    "colors": ["..."],
    "style": "...",
    "do_list": ["..."],
    "dont_list": ["..."]
  }
}

${businessContext}`
      },
      10: {
        system: "You are a content distribution expert. Create an export and publishing plan. Return valid JSON.",
        user: `Create a content export and distribution plan. Return JSON:
{
  "distribution_plan": [
    {"platform": "...", "format": "...", "dimensions": "...", "posting_time": "...", "frequency": "...", "hashtag_strategy": "..."}
  ],
  "repurposing_ideas": [
    {"original": "...", "repurposed_to": "...", "platform": "...", "effort": "easy|medium"}
  ],
  "scheduling_recommendations": "...",
  "tools_recommended": [{"name": "...", "purpose": "...", "cost": "..."}],
  "kpis_to_track": [{"metric": "...", "target": "...", "timeframe": "..."}]
}

${businessContext}`
      },
      11: {
        system: "You are a local lead generation expert. Find referral and lead opportunities. Return valid JSON.",
        user: `Identify lead generation and referral opportunities for this business. Return JSON:
{
  "lead_sources": [
    {"source": "...", "type": "referral|partnership|online|offline|community", "potential": "high|medium|low", "action_steps": ["..."], "estimated_leads_per_month": "..."}
  ],
  "referral_partners": [
    {"business_type": "...", "partnership_idea": "...", "approach_script": "...", "mutual_benefit": "..."}
  ],
  "community_opportunities": ["..."],
  "networking_strategy": "...",
  "lead_magnet_ideas": [{"title": "...", "type": "...", "description": "..."}]
}

${businessContext}`
      },
      12: {
        system: "You are a small business grants and funding expert. Return valid JSON.",
        user: `Find grant and funding opportunities for this business. Return JSON:
{
  "grants": [
    {"name": "...", "amount": "...", "eligibility": "...", "deadline": "...", "url": "...", "difficulty": "easy|medium|competitive", "tips": "..."}
  ],
  "alternative_funding": [
    {"type": "...", "description": "...", "pros": ["..."], "cons": ["..."], "best_for": "..."}
  ],
  "funding_readiness_score": 0-100,
  "preparation_steps": ["...things to prepare before applying..."],
  "resources": [{"name": "...", "url": "...", "description": "..."}]
}

${businessContext}`
      },
    };

    const stepConfig = stepPrompts[step];
    if (!stepConfig) throw new Error(`Invalid step: ${step}`);

    // Call Lovable AI
    const aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: stepConfig.system },
          { role: "user", content: stepConfig.user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    let outputData;
    try {
      outputData = JSON.parse(content);
    } catch {
      outputData = { raw: content };
    }

    // Save to strategy_outputs
    const { error: upsertError } = await supabase
      .from("strategy_outputs")
      .upsert(
        {
          user_id: user.id,
          business_id: businessId,
          location_id: locationId || null,
          step_number: step,
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search"][step],
          output_data: outputData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,business_id,step_number", ignoreDuplicates: false }
      );

    // Need a unique constraint for upsert - just insert/update manually
    if (upsertError) {
      // Try insert
      await supabase
        .from("strategy_outputs")
        .insert({
          user_id: user.id,
          business_id: businessId,
          location_id: locationId || null,
          step_number: step,
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search"][step],
          output_data: outputData,
        });
    }

    return new Response(JSON.stringify(outputData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
