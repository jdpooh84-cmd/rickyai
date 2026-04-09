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

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // ── BYOLLM enforcement: platform keys are admin-only ──
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });

    // Check user's own API keys
    const { data: userKeys } = await supabase
      .from("user_api_keys")
      .select("provider, api_key_encrypted")
      .eq("user_id", user.id)
      .eq("is_valid", true);

    const userOpenaiKey = userKeys?.find(k => k.provider === "openai");
    const userClaudeKey = userKeys?.find(k => k.provider === "claude" || k.provider === "anthropic");
    const userGeminiKey = userKeys?.find(k => k.provider === "gemini");
    const hasUserKey = !!(userOpenaiKey || userClaudeKey || userGeminiKey);

    let aiUrl = AI_URL;
    let aiModel = AI_MODEL;
    let aiHeaders: Record<string, string> = {};

    if (userOpenaiKey) {
      aiUrl = "https://api.openai.com/v1/chat/completions";
      aiModel = "gpt-4o";
      aiHeaders = { "Authorization": `Bearer ${userOpenaiKey.api_key_encrypted}`, "Content-Type": "application/json" };
    } else if (userClaudeKey || userGeminiKey) {
      // Users with Claude or Gemini keys: route through Lovable AI gateway
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("AI gateway not configured. Please contact support.");
      aiHeaders = { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" };
      console.log(`[ai-strategy] BYOLLM: user ${user.id} has ${userClaudeKey ? "claude" : "gemini"} key, routing via gateway`);
    } else if (isAdmin) {
      // Admin can use platform keys
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("Platform AI key not configured.");
      aiHeaders = { "Authorization": `Bearer ${lovableKey}`, "Content-Type": "application/json" };
    } else {
      throw new Error("No AI provider connected. Go to Settings → Connect and add your API key for ChatGPT, Claude, or Gemini to use this feature.");
    }

    const { step, businessId, locationId, productionMode, workflowMode, postFrequency, postSchedule, insightReport, customPrompt, mode } = await req.json();

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
              "prod_UDepZzB9GKoPnY": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Business
              "prod_UDepPmrMY3zOEX": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Growth
              "prod_UDeqmytH227V3p": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Agency
            };
            allowedSteps = tierSteps[productId as string] || allowedSteps;
          }
        }
      } catch (e) {
        console.error("Tier check failed, using default:", e);
      }
    }

    // ── ADMIN BYPASS: admins get access to ALL steps ──
    if (isAdmin) {
      allowedSteps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
      console.log(`[ai-strategy] Admin bypass — granting access to all steps for user ${user.id}`);
    }

    // Also allow access during trial
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_ends_at")
      .eq("user_id", user.id)
      .single();
    const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();

    if (step === 99) { /* Video script generation — always allowed */ }
    else if (!isAdmin && !trialActive && !allowedSteps.includes(step)) {
      console.log(`[ai-strategy] Access denied: user=${user.id}, step=${step}, allowedSteps=${allowedSteps}, trialActive=${trialActive}`);
      throw new Error(`Step ${step} is not available on your current plan. Please upgrade to access this feature.`);
    }
    console.log(`[ai-strategy] Access granted: user=${user.id}, step=${step}, isAdmin=${isAdmin}, trialActive=${trialActive}`);

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

    // Auto-detect industry mode
    const bizCat = (business.business_category || "").toLowerCase();
    const bizNiche = (business.niche || "").toLowerCase();
    const bizServices = (business.services || "").toLowerCase();
    const combined = `${bizCat} ${bizNiche} ${bizServices}`;
    let industryMode = "general";
    const industryKeywords: Record<string, string[]> = {
      finance: ["bank", "fintech", "investment", "insurance", "accounting", "financial", "tax", "wealth"],
      healthcare: ["health", "medical", "dental", "pharma", "hospital", "clinic", "therapy", "wellness"],
      software: ["saas", "software", "tech", "api", "cloud", "app", "digital"],
      ecommerce: ["shop", "store", "retail", "ecommerce", "marketplace", "fashion", "boutique"],
      media: ["media", "streaming", "entertainment", "podcast", "video", "music", "film"],
      manufacturing: ["manufactur", "industrial", "factory", "oem", "construction", "contractor"],
    };
    for (const [mode, kws] of Object.entries(industryKeywords)) {
      if (kws.some(k => combined.includes(k))) { industryMode = mode; break; }
    }

    const industryContext = `Industry mode: ${industryMode}. Tailor all advice to this industry's norms, compliance needs, and audience expectations.`;

    const stepPrompts: Record<number, { system: string; user: string }> = {
      3: {
        system: `You are a visibility strategist applying the Omni Search & Conversion Optimizer 12-pillar framework. Your analysis MUST cover these 4 pillars in depth:
- SEO (Search Engine Optimization): technical health, on-page, backlinks, site speed, mobile-friendliness
- GEO (Generative Engine Optimization): how well this business's content would be cited/referenced by AI models like ChatGPT, Gemini, Perplexity
- AEO (Answer Engine Optimization): does the site answer the questions customers actually ask? FAQ schema, featured-snippet readiness
- SGE (AI Overview Visibility): likelihood of appearing in Google AI Overviews, entity authority signals, structured data

CRITICAL LOCAL COMPETITOR RULES:
- When analyzing competitive landscape, ONLY reference competitors with PHYSICAL LOCATIONS in the SAME CITY.
- For chains/franchises: reference the LOCAL branch (e.g. "Domino's on Shore Dr, Virginia Beach") not corporate HQ.
- All local SEO analysis must use the business's actual city, neighborhood, and street-level geography.
- "Near me" keywords and local pack analysis must be scoped to the business's actual metro area.

For LOCAL businesses: emphasize Google Business Profile completeness, local pack rankings, NAP consistency, review velocity, and neighborhood-level search terms.
For ENTERPRISE businesses: emphasize domain authority, topical authority clusters, programmatic SEO, and brand SERP ownership.
${industryContext} Return valid JSON only.`,
        user: `Perform a full Omni Compete analysis for this business across SEO, GEO, AEO, and SGE pillars. Identify what makes this business UNIQUE — signature products, preparation methods, presentation styles, local reputation. These differentiators should inform every recommendation. All competitor references must be LOCAL to the same city — not corporate headquarters in other states.

Return JSON:
{
  "overall_grade": "A-F",
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
  "competitive_edge": "What makes this business truly different — specific products, methods, or reputation signals",
  "unique_details": ["...3-5 signature details that set this business apart (e.g. 'proprietary method since 1963', 'hand-crafted signature product', 'award-winning customer service')..."],
  "seo_health": {"grade": "A-F", "key_issues": ["..."], "quick_wins": ["..."], "local_pack_status": "appearing|not-appearing|unknown", "nap_consistent": true},
  "geo_readiness": {"grade": "A-F", "citation_hooks": ["...content that AI would cite..."], "entity_signals": ["...missing authority signals..."], "ai_citation_score": 0-100},
  "aeo_coverage": {"grade": "A-F", "questions_to_answer": ["...top 5 customer questions this business should answer on their site..."], "schema_status": "has-faq|needs-faq|none"},
  "sge_visibility": {"grade": "A-F", "ai_overview_likelihood": "high|medium|low", "improvement_tips": ["..."], "entity_authority": "strong|moderate|weak"}
}

${businessContext}`
      },
      4: {
        system: `You are a local market intelligence analyst applying the Omni Search & Conversion Optimizer framework. Your analysis MUST cover these 3 pillars:
- LMO (Local Market Optimization): local search landscape, Google Maps presence, neighborhood trends, community conversations, local events and partnerships
- CAO (Content Asset Optimization): what content assets competitors have that this business lacks — videos, blogs, guides, case studies, testimonials
- AEO (Answer Engine Optimization): what questions local customers are asking that nobody is answering well

CRITICAL COMPETITOR RULES:
- ONLY list competitors that have a PHYSICAL STOREFRONT or OFFICE in the SAME CITY as this business.
- For franchise/chain businesses: list the LOCAL franchise location (e.g. "Papa John's - Kempsville Rd, Virginia Beach") NOT the corporate headquarters.
- For independent local businesses: list them by their local name and approximate neighborhood/street.
- NEVER list a competitor by corporate HQ address if their HQ is in a different city. Only the LOCAL branch matters.
- Prioritize independent, locally-owned competitors first, then local franchise locations of chains.
- Include the approximate street/neighborhood for each competitor so the business owner recognizes them as actual nearby rivals.

For LOCAL businesses: focus on hyperlocal signals — neighborhood Facebook groups, local review sites, community events, seasonal trends, "near me" search patterns.
For ENTERPRISE businesses: focus on market share signals, industry publications, analyst coverage, and competitive content moats.
${industryContext} Return valid JSON only.`,
        user: `Perform a full Omni Scout analysis for this business covering LMO, CAO, and AEO pillars. Scout the local market landscape. Identify what makes this business's PRODUCTS and SERVICES unique — specific ingredients, preparation methods, signature items, presentation styles.

IMPORTANT: Every competitor you list MUST have a physical location in the SAME CITY as this business. Use the business address and location data below to identify the exact city and neighborhood. Do NOT list businesses headquartered in other cities — only list competitors the owner would actually drive past on their way to work.

Return JSON:
{
  "market_position": "leader|challenger|follower|nicher",
  "competitors": [
    {"name": "...", "local_address": "...street or neighborhood in the SAME city...", "strengths": ["..."], "weaknesses": ["..."], "threat_level": "high|medium|low", "content_gap": "what content they have that this business lacks", "is_independent": true}
  ],
  "opportunities": ["...5 specific opportunities based on local market gaps..."],
  "threats": ["...3 market threats..."],
  "differentiation_strategy": "...",
  "unique_selling_details": ["...3-5 specific product/service details that make this business stand out (e.g. 'edge-to-edge toppings', 'hand-tossed daily', 'family-owned since 1963')..."],
  "quick_wins": ["...3 things to do this week..."],
  "lmo_analysis": {
    "local_search_strength": "strong|moderate|weak",
    "google_maps_optimized": true,
    "community_signals": ["...local groups, events, partnerships to leverage..."],
    "neighborhood_keywords": ["...hyperlocal search terms to target..."],
    "review_velocity": "healthy|needs-improvement|critical",
    "local_content_ideas": ["...3 content pieces based on local trends..."]
  },
  "cao_analysis": {
    "content_assets_score": 0-100,
    "missing_assets": ["...content types competitors have that this business lacks..."],
    "top_performing_formats": ["...what content formats work best in this niche locally..."],
    "repurpose_opportunities": ["...ways to turn one piece of content into 5+..."]
  },
  "aeo_analysis": {
    "unanswered_questions": ["...5 questions local customers are asking that nobody answers well..."],
    "faq_opportunities": ["...questions to add to website FAQ..."],
    "voice_search_phrases": ["...how people ask about this type of business verbally..."]
  }
}

${businessContext}`
      },
      5: {
        system: `You are a reputation and content auditor applying the Omni Search & Conversion Optimizer framework. Your analysis MUST cover these 4 pillars:
- RMO (Reputation Management Optimization): online reviews, ratings, review response rate, sentiment analysis, reputation signals across platforms
- SEO (Search Engine Optimization): on-page content quality, keyword coverage, internal linking, technical SEO gaps
- CRO (Conversion Rate Optimization): does the website/content actually convert visitors? CTAs, landing pages, trust signals, social proof
- CAO (Content Asset Optimization): inventory of existing content assets, quality assessment, gaps in the content library

For LOCAL businesses: emphasize Google reviews, Yelp, Facebook recommendations, local blog mentions, and community trust signals.
For ENTERPRISE businesses: emphasize G2/Capterra reviews, case studies, whitepapers, thought leadership, and analyst relations.
${industryContext} Return valid JSON only.`,
        user: `Perform a full Omni Audit for this business covering RMO, SEO, CRO, and CAO pillars. Identify what makes this business UNIQUE — signature products, customer experience details, community reputation.

Return JSON:
{
  "content_score": 0-100,
  "existing_strengths": ["..."],
  "unique_brand_signals": ["...3-5 specific things customers love about this business (e.g. 'generous toppings', 'fast delivery', 'friendly staff')..."],
  "content_gaps": [
    {"gap": "...", "priority": "high|medium|low", "effort": "easy|medium|hard", "impact": "high|medium|low", "pillar": "RMO|SEO|CRO|CAO"}
  ],
  "content_calendar": [
    {"week": 1, "type": "...", "topic": "...", "platform": "...", "goal": "...", "pillar": "RMO|SEO|CRO|CAO"},
    {"week": 2, "type": "...", "topic": "...", "platform": "...", "goal": "...", "pillar": "RMO|SEO|CRO|CAO"},
    {"week": 3, "type": "...", "topic": "...", "platform": "...", "goal": "...", "pillar": "RMO|SEO|CRO|CAO"},
    {"week": 4, "type": "...", "topic": "...", "platform": "...", "goal": "...", "pillar": "RMO|SEO|CRO|CAO"}
  ],
  "pillar_topics": ["...3-5 core content pillars..."],
  "recommended_formats": ["..."],
  "rmo_analysis": {
    "reputation_score": 0-100,
    "avg_rating": 4.5,
    "review_count_estimate": "low|moderate|high",
    "response_rate": "good|needs-improvement|poor",
    "sentiment": "positive|mixed|negative",
    "reputation_gaps": ["...issues to address..."],
    "review_generation_tactics": ["...3 ways to get more positive reviews..."]
  },
  "seo_audit": {
    "on_page_score": 0-100,
    "keyword_coverage": "comprehensive|partial|minimal",
    "technical_issues": ["...top 3 technical SEO problems..."],
    "content_quality": "excellent|good|needs-work|poor",
    "internal_linking": "strong|weak|none"
  },
  "cro_analysis": {
    "conversion_readiness": 0-100,
    "cta_effectiveness": "strong|weak|missing",
    "trust_signals": ["...existing trust signals found..."],
    "missing_trust_signals": ["...trust signals to add..."],
    "landing_page_issues": ["...conversion blockers..."],
    "quick_cro_wins": ["...3 things to improve conversion this week..."]
  },
  "cao_analysis": {
    "asset_inventory": {"videos": 0, "blogs": 0, "testimonials": 0, "case_studies": 0, "guides": 0},
    "quality_assessment": "professional|adequate|needs-upgrade",
    "missing_assets": ["...content types to create..."],
    "repurpose_plan": ["...how to maximize existing content..."]
  }
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
      15: {
        system: `You are an enterprise-grade Omni Search & Conversion Optimizer consultant. ${industryContext} You analyze digital assets across 12 pillars: SEO, GEO, AEO, SGE, LLMO, LMO, RMO, CRO, DMO, CAO, PAO, and Measurement/Governance. Provide a 4-axis diagnostic, pillar scores, a 90-day roadmap, quick wins, and a plain-English summary. Return valid JSON.`,
        user: `Run a full 12-pillar Omni optimization diagnostic for this business. Return JSON:
{
  "industry_mode": "${industryMode}",
  "industry_mode_label": "...",
  "executive_brief": "250-word max executive summary in plain English",
  "diagnostic": {
    "discoverability": {"rating": "Strong|Adequate|Weak", "bullets": ["...2-3 reasons..."], "top_fix": "...single most important fix..."},
    "comprehension": {"rating": "Strong|Adequate|Weak", "bullets": ["...2-3 reasons..."], "top_fix": "..."},
    "conversion": {"rating": "Strong|Adequate|Weak", "bullets": ["...2-3 reasons..."], "top_fix": "..."},
    "orchestration": {"rating": "Strong|Adequate|Weak", "bullets": ["...2-3 reasons..."], "top_fix": "..."}
  },
  "pillar_scores": {
    "SEO": {"grade": "A-F", "summary": "..."},
    "GEO": {"grade": "A-F", "summary": "..."},
    "AEO": {"grade": "A-F", "summary": "..."},
    "SGE": {"grade": "A-F", "summary": "..."},
    "LLMO": {"grade": "A-F", "summary": "..."},
    "LMO": {"grade": "A-F", "summary": "..."},
    "RMO": {"grade": "A-F", "summary": "..."},
    "CRO": {"grade": "A-F", "summary": "..."},
    "DMO": {"grade": "A-F", "summary": "..."},
    "CAO": {"grade": "A-F", "summary": "..."},
    "PAO": {"grade": "A-F", "summary": "..."},
    "MGV": {"grade": "A-F", "summary": "..."}
  },
  "roadmap": {
    "phase1": {"focus": "Foundation & Stabilization", "actions": ["...3-5 actions..."], "kpis": ["..."]},
    "phase2": {"focus": "Structure & Authority", "actions": ["...3-5 actions..."], "kpis": ["..."]},
    "phase3": {"focus": "Expansion & Scaling", "actions": ["...3-5 actions..."], "kpis": ["..."]}
  },
  "quick_wins": ["...3-5 things doable in 24-72 hours..."],
  "simple_summary": "One paragraph in very plain English explaining what this all means for the business owner"
}

${businessContext}`
      },
    };

    const stepConfig = stepPrompts[step];
    if (!stepConfig) throw new Error(`Invalid step: ${step}`);

    // Call AI using BYOLLM-resolved provider
    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: stepConfig.system },
          { role: "user", content: stepConfig.user },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      
      // ═══ FALLBACK FOR ALL STEPS when AI credits exhausted (402) ═══
      if (aiResponse.status === 402) {
        console.log(`[ai-strategy] AI credits exhausted for step ${step}, using saved-data fallback`);
        
        // Try to load last saved output for this step
        const { data: lastSaved } = await supabase.from("strategy_outputs").select("output_data")
          .eq("business_id", businessId).eq("user_id", user.id).eq("step_number", step)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle();
        
        if (lastSaved?.output_data && !lastSaved.output_data._fallback) {
          // Return previously saved real output
          console.log(`[ai-strategy] Returning last saved output for step ${step}`);
          return new Response(JSON.stringify({
            ...lastSaved.output_data,
            _usedSavedData: true,
            _savedDataNote: "AI credits were temporarily unavailable. Showing your last saved results — retry later for fresh analysis."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Build a template fallback based on step
        const bName = business.business_name || "Your Business";
        const bCategory = business.business_category || "business";
        const bCity = location?.city || "your city";
        const bServices = business.services || "our products and services";
        
        const fallbackOutputs: Record<number, any> = {
          3: { overall_grade: "N/A", overall_score: 0, categories: [], top_priorities: ["Retry when AI credits are available for a full visibility audit"], competitive_edge: `${bName} in ${bCity}`, _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          4: { market_position: "unknown", competitors: [], opportunities: [`Analyze ${bName}'s competitive landscape when credits are available`], threats: [], differentiation_strategy: `${bName} serves ${bServices}`, quick_wins: ["Retry later for personalized insights"], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          5: { content_score: 0, existing_strengths: [], content_gaps: [], content_calendar: [], pillar_topics: [], recommended_formats: [], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          6: { primary_platform: { name: "Instagram", reason: "Good default for most businesses", posting_frequency: "3-5x/week", content_types: ["Reels", "Stories"] }, secondary_platforms: [], platforms_to_avoid: [], platform_strategy: `Default strategy for ${bName}`, time_investment: "5-10 hours/week", growth_timeline: "3-6 months", _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          7: { scripts: [{ title: `${bName} Promo`, type: "short-form", duration: "60s", hook: `Looking for the best ${bCategory} in ${bCity}?`, body: `${bName} offers ${bServices}. Visit us today!`, cta: `Visit ${bName}`, platform: "Instagram", hashtags: [bName.replace(/\s+/g, "")], music_suggestion: "Upbeat corporate" }], content_tips: ["Be authentic", "Show your team", "Highlight your best work"], brand_voice_guide: `Friendly and ${business.brand_tone || "professional"}`, _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          8: {
            video_strategy: `Template-based video strategy for ${bName}. AI credits were temporarily unavailable.`,
            video_ideas: [{ title: `${bName} — Your Local ${bCategory} Promo`, type: "promo", difficulty: "easy", equipment: ["Smartphone", "Tripod", "Good lighting"], estimated_views: "500-2000", script_outline: `Opening: 'Looking for the best ${bCategory} in ${bCity}?' Show the business. Highlight ${bServices}. Close with: 'Visit ${bName} today!'`, heygen_prompt: `Create a 60-second promo for ${bName}, a ${bCategory} in ${bCity}.`, invideo_prompt: `Create a 1-minute promo for ${bName} in ${bCity}. Highlight: ${bServices}.`, canva_prompt: `Design a 60-second promo video for ${bName}.`, capcut_prompt: `Project: ${bName} Promo. Add text overlays for ${bServices}.`, free_production_guide: { tool: "Phone Camera + CapCut (Free)", step_by_step: ["Film exterior/interior shots", "Capture product close-ups", "Record owner intro", "Edit in CapCut", "Export at 1080p"], tips: "Use natural lighting" } }],
            equipment_recommendations: [{ item: "Smartphone", price_range: "Already owned", priority: "essential" }],
            filming_tips: ["Film during golden hour", "Keep clips under 5 seconds each"],
            editing_workflow: "Import → Trim → Text overlays → Music → Export",
            _fallback: true, _fallback_reason: "AI credits temporarily unavailable."
          },
          9: { storyboards: [], visual_brand_guidelines: { fonts: [], colors: [], style: business.brand_tone || "professional", do_list: [], dont_list: [] }, _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          10: { distribution_plan: [], repurposing_ideas: [], scheduling_recommendations: "Post consistently 3-5x/week", tools_recommended: [], kpis_to_track: [], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          11: { lead_sources: [], referral_partners: [], community_opportunities: [], networking_strategy: "", lead_magnet_ideas: [], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          12: { grants: [], alternative_funding: [], funding_readiness_score: 0, preparation_steps: [], resources: [], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          13: { overall_score: 0, overall_summary: "AI credits unavailable — retry later for a full search visibility analysis.", seo: { grade: "N/A", summary: "Unavailable", factors: [], recommendations: [] }, aeo: { grade: "N/A", summary: "Unavailable", ricky_explanation: "", questions_your_business_should_answer: [], optimized_faqs: [] }, geo: { grade: "N/A", summary: "Unavailable", ricky_explanation: "", citation_readiness: {}, optimized_summaries: [] }, ai_overviews: { grade: "N/A", summary: "Unavailable", ricky_explanation: "", visibility_gaps: [], scripts_for_visibility: [] }, action_plan: [], _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
          15: { industry_mode: "general", industry_mode_label: "Local Business", executive_brief: "AI credits temporarily unavailable. Retry later for a full 12-pillar diagnostic.", diagnostic: { discoverability: { rating: "Weak", bullets: ["Analysis unavailable"], top_fix: "Retry when credits are available" }, comprehension: { rating: "Weak", bullets: ["Analysis unavailable"], top_fix: "Retry" }, conversion: { rating: "Weak", bullets: ["Analysis unavailable"], top_fix: "Retry" }, orchestration: { rating: "Weak", bullets: ["Analysis unavailable"], top_fix: "Retry" } }, pillar_scores: {}, roadmap: { phase1: { focus: "Run full diagnostic", actions: ["Retry Omni Optimize"], kpis: [] }, phase2: { focus: "TBD", actions: [], kpis: [] }, phase3: { focus: "TBD", actions: [], kpis: [] } }, quick_wins: ["Retry this step when AI credits are available"], simple_summary: "We couldn't run the full analysis right now. Please try again soon.", _fallback: true, _fallback_reason: "AI credits temporarily unavailable." },
        };
        
        const fallbackOutput = fallbackOutputs[step] || { _fallback: true, _fallback_reason: "AI credits temporarily unavailable. Please retry later." };
        
        // Save fallback
        await supabase.from("strategy_outputs").upsert({
          user_id: user.id, business_id: businessId, location_id: locationId || null,
          step_number: step, step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility", "Campaign Blueprint", "Omni Optimize"][step] || `Step ${step}`,
          output_data: fallbackOutput,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,business_id,step_number", ignoreDuplicates: false }).then(async ({ error: ue }) => {
          if (ue) await supabase.from("strategy_outputs").insert({
            user_id: user.id, business_id: businessId, location_id: locationId || null,
            step_number: step, step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility", "Campaign Blueprint", "Omni Optimize"][step] || `Step ${step}`,
            output_data: fallbackOutput,
          });
        });
        
        return new Response(JSON.stringify(fallbackOutput), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
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
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility", "Campaign Blueprint", "Omni Optimize"][step],
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
          step_name: ["", "Connect", "Profile", "Compete", "Scout", "Audit", "Platform", "Script", "Video Studio", "Storyboard", "Export", "Lead Scout", "Grant Search", "Search Visibility", "Campaign Blueprint", "Omni Optimize"][step],
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
