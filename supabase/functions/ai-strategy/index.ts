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

    const { step, businessId, locationId, productionMode, workflowMode, postFrequency, postSchedule, insightReport } = await req.json();

    // --- Tier enforcement ---
    // Check subscription to determine which steps the user can access
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let allowedSteps: number[] = [1, 2, 6, 7, 8, 9, 10, 13]; // Creator default
    
    if (stripeKey && user.email) {
      try {
        const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        
        if (customers.data.length > 0) {
          const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "active", limit: 1 });
          if (subs.data.length > 0) {
            const productId = subs.data[0].items.data[0].price.product;
            // Map product IDs to allowed steps
            const tierSteps: Record<string, number[]> = {
              "prod_UDep9PW3ELRa6K": [1, 2, 6, 7, 8, 9, 10, 13], // Creator
              "prod_UDepZzB9GKoPnY": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], // Business
              "prod_UDepPmrMY3zOEX": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], // Growth
              "prod_UDeqmytH227V3p": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], // Agency
            };
            allowedSteps = tierSteps[productId as string] || allowedSteps;
          }
        }
      } catch (e) {
        console.error("Tier check failed, using default:", e);
      }
    }

    // Also allow access during trial
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .single();
    const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

    if (!trialActive && !allowedSteps.includes(step)) {
      throw new Error(`Step ${step} is not available on your current plan. Please upgrade to access this feature.`);
    }

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
        system: `You are a video production consultant for small businesses. You provide workflows and ready-to-use prompts for 11 video/media creation platforms. ${productionMode === "quick" ? "Focus on 15-30 second social-first clips for TikTok, Reels, Shorts." : productionMode === "longform" ? "Focus on 5-15 minute deep-dive content for YouTube, webinars, courses." : "Focus on 1-3 minute balanced videos for YouTube, Facebook, LinkedIn."} ${workflowMode === "auto" ? `This is FULL AUTO mode — generate a complete production plan with posting schedule (${postFrequency?.replace("x", "")} posts per day, ${postSchedule} plan) and ready-to-execute video production packages. Include a posting_schedule object and produced_videos array with complete prompts for every platform.` : "Generate DIY prompts the user can copy-paste into their tools."} ${insightReport ? "Generate insight reports with daily_insights (metrics array with label/value pairs, summary) and weekly_insights (summary, recommendations array)." : ""} Return valid JSON.`,
        user: `Create a comprehensive video production plan for this business. Return JSON:
{
  "video_strategy": "...overall video strategy tailored to this specific business...",
  ${workflowMode === "auto" ? `"posting_schedule": {
    "daily_posts": ${postFrequency?.replace("x", "") || "1"},
    "weekly_total": ${(parseInt(postFrequency?.replace("x", "") || "1")) * 7},
    "best_times": ["9:00 AM", "12:00 PM", "6:00 PM"],
    "platforms_count": "3+",
    "schedule_details": [
      {"day": "Monday", "time": "9:00 AM", "content_type": "Educational", "platform": "YouTube"},
      {"day": "Monday", "time": "12:00 PM", "content_type": "Behind-the-scenes", "platform": "Instagram"},
      {"day": "Tuesday", "time": "9:00 AM", "content_type": "Tips & Tricks", "platform": "TikTok"}
    ]
  },
  "produced_videos": [
    {
      "title": "...ready-to-produce video title...",
      "duration": "${productionMode === "quick" ? "30s" : productionMode === "longform" ? "8 min" : "2 min"}",
      "description": "...what this video covers...",
      "platform": "...primary platform...",
      "format": "${productionMode === "quick" ? "9:16 vertical" : "16:9 horizontal"}",
      "production_prompts": {
        "heygen_prompt": "...exact paste-ready prompt...",
        "invideo_prompt": "...exact paste-ready prompt...",
        "capcut_prompt": "...exact editing workflow...",
        "canva_prompt": "...exact template instructions..."
      }
    }
  ],` : ""}
  ${insightReport ? `"daily_insights": {
    "metrics": [
      {"label": "Est. Reach", "value": "2.5K"},
      {"label": "Engagement Rate", "value": "4.2%"},
      {"label": "Best Content", "value": "Tutorial"}
    ],
    "summary": "...daily performance analysis based on content strategy..."
  },
  "weekly_insights": {
    "summary": "...weekly growth analysis and trends...",
    "recommendations": ["...actionable recommendation 1...", "...actionable recommendation 2...", "...actionable recommendation 3..."]
  },` : ""}
  "video_ideas": [
    {
      "title": "...specific to this business...",
      "type": "testimonial|tutorial|behind-scenes|promo|educational",
      "difficulty": "easy|medium|hard",
      "equipment": ["..."],
      "estimated_views": "...",
      "script_outline": "...detailed script with specific dialogue for this business...",
      "heygen_prompt": "...exact prompt to paste into HeyGen...",
      "invideo_prompt": "...exact prompt to paste into InVideo AI...",
      "canva_prompt": "...exact instructions for Canva video editor...",
      "pixelbin_prompt": "...exact workflow for PixelBin...",
      "easemate_prompt": "...exact prompt for EaseMate AI...",
      "virbo_prompt": "...exact prompt for Virbo...",
      "capcut_prompt": "...exact editing workflow for CapCut...",
      "detail_prompt": "...exact workflow for Detail app...",
      "elevenlabs_prompt": "...exact prompt for ElevenLabs...",
      "nvidia_prompt": "...exact workflow for Nvidia Broadcast...",
      "free_production_guide": {
        "tool": "Phone Camera + Free Editor",
        "step_by_step": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
        "prompt_for_tool": "...exact text/prompt to use...",
        "tips": "...tips for professional results..."
      }
    }
  ],
  "equipment_recommendations": [
    {"item": "...", "price_range": "...", "priority": "essential|nice-to-have"}
  ],
  "filming_tips": ["..."],
  "editing_workflow": "...",
  "ai_tool_comparison": {
    "heygen": {"best_for": "AI avatar/spokesperson videos", "cost": "$24/mo+", "signup_url": "https://www.heygen.com", "workflow_tip": "..."},
    "invideo": {"best_for": "YouTube automation", "cost": "$25/mo+", "signup_url": "https://invideo.io", "workflow_tip": "..."},
    "canva": {"best_for": "Template-based branded videos", "cost": "Free / $12.99/mo", "signup_url": "https://www.canva.com/video-editor", "workflow_tip": "..."},
    "pixelbin": {"best_for": "API-driven media pipelines", "cost": "Free tier", "signup_url": "https://www.pixelbin.io", "workflow_tip": "..."},
    "easemate": {"best_for": "Quick AI-generated videos", "cost": "Free with watermark", "signup_url": "https://www.easemate.com", "workflow_tip": "..."},
    "virbo": {"best_for": "Talking-head marketing videos", "cost": "$19.99/mo+", "signup_url": "https://virbo.wondershare.com", "workflow_tip": "..."},
    "capcut": {"best_for": "Free professional editing", "cost": "Free / Pro $7.99/mo", "signup_url": "https://www.capcut.com", "workflow_tip": "..."},
    "detail": {"best_for": "Screen recording", "cost": "Free / $12/mo", "signup_url": "https://detail.co", "workflow_tip": "..."},
    "elevenlabs": {"best_for": "AI voiceovers", "cost": "Free tier / $5/mo+", "signup_url": "https://elevenlabs.io", "workflow_tip": "..."},
    "nvidia": {"best_for": "AI-enhanced streaming", "cost": "Free (Nvidia GPU)", "signup_url": "https://www.nvidia.com/en-us/geforce/broadcasting/broadcast-app", "workflow_tip": "..."},
    "free_alternatives": [
      {"name": "CapCut", "best_for": "Mobile/desktop editing", "url": "https://www.capcut.com"},
      {"name": "DaVinci Resolve", "best_for": "Professional editing (free)", "url": "https://www.blackmagicdesign.com/products/davinciresolve"},
      {"name": "Clipchamp", "best_for": "Browser-based editing", "url": "https://clipchamp.com"}
    ]
  }
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
      13: {
        system: "You are a search visibility expert specializing in SEO, Answer Engine Optimization (AEO), Generative Engine Optimization (GEO), and AI Overview presence. You help businesses understand how findable, answerable, and citable they are online. Explain insights in simple terms that Ricky (a friendly AI assistant) would use. Return valid JSON.",
        user: `Analyze this business's search visibility across all modern search dimensions. Return JSON:
{
  "overall_score": 0-100,
  "overall_summary": "One paragraph summary of their total search visibility",
  "seo": {
    "grade": "A-F",
    "summary": "How well optimized they are for traditional search",
    "factors": [
      {"name": "Title Tags & Meta Descriptions", "score": 0-100, "finding": "..."},
      {"name": "Content Quality & Depth", "score": 0-100, "finding": "..."},
      {"name": "Local SEO Signals", "score": 0-100, "finding": "..."},
      {"name": "Mobile Optimization", "score": 0-100, "finding": "..."},
      {"name": "Backlink Profile", "score": 0-100, "finding": "..."},
      {"name": "Technical SEO", "score": 0-100, "finding": "..."}
    ],
    "recommendations": ["...3-5 quick wins..."]
  },
  "aeo": {
    "grade": "A-F",
    "summary": "How well positioned they are to appear as answers in voice/AI assistants",
    "ricky_explanation": "Simple explanation of AEO as if Ricky is explaining to a friend",
    "questions_your_business_should_answer": [
      {"question": "...", "suggested_answer": "...optimized answer for featured snippets..."}
    ],
    "optimized_faqs": [
      {"question": "...", "answer": "...structured answer optimized for answer engines..."}
    ]
  },
  "geo": {
    "grade": "A-F",
    "summary": "How well the business content is structured to be cited by generative AI",
    "ricky_explanation": "Simple explanation of GEO and why being cited by AI matters",
    "citation_readiness": {
      "structured_data": 0-100,
      "authority_signals": 0-100,
      "content_clarity": 0-100,
      "source_diversity": 0-100
    },
    "optimized_summaries": [
      {"use_case": "About page", "text": "...AI-optimized summary..."},
      {"use_case": "Google Business", "text": "...AI-optimized description..."},
      {"use_case": "Social media bio", "text": "...AI-optimized bio..."}
    ]
  },
  "ai_overviews": {
    "grade": "A-F",
    "summary": "Likelihood of appearing in Google AI Overviews and similar",
    "ricky_explanation": "Simple explanation of AI Overviews and what they mean for visibility",
    "visibility_gaps": [
      {"gap": "...", "fix": "...actionable fix..."}
    ],
    "scripts_for_visibility": [
      {"title": "...", "script": "...short content script to improve AI visibility...", "platform": "YouTube|TikTok|Blog"}
    ]
  },
  "action_plan": [
    {"action": "...", "impact": "high|medium|low", "timeframe": "this week|this month|next quarter"}
  ]
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
      const friendlyMessage = aiResponse.status === 402
        ? "AI credits are unavailable right now. Your step and business selections were preserved, so you can retry without restarting."
        : `AI error: ${aiResponse.status} ${errText}`;
      throw new Error(friendlyMessage);
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
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility"][step],
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
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility"][step],
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
