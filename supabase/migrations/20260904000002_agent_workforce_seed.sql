-- =============================================================================
-- Agent Workforce — Idempotent Seed Data
-- Departments, agent definitions, capabilities, tool definitions, grants,
-- delegation policies, handoff contracts, escalation policies.
-- All inserts use ON CONFLICT DO NOTHING — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DEPARTMENTS
-- ---------------------------------------------------------------------------
insert into agent_departments (slug, display_name, description) values
  ('executive',               'Executive Orchestration',           'Top-level orchestration and objective decomposition'),
  ('growth_strategy',         'Growth Strategy',                   'Market research, competitive intelligence, brand and campaign strategy'),
  ('content_studio',          'Content Studio',                    'Content planning, copywriting, scripting, creative QA, and local SEO'),
  ('video_production',        'Video Production',                  'Video planning, voiceover, B-roll, rendering, and quality review'),
  ('distribution_optimization','Distribution & Optimization',      'Channel strategy, publishing readiness, analytics, and performance optimization'),
  ('opportunity_intelligence','Opportunity Intelligence',           'Federal contracting, grant intelligence, and opportunity qualification'),
  ('trust_operations',        'Trust, Safety & Operations',        'Workflow quality, policy compliance, customer approvals, and incident triage')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- AGENT DEFINITIONS
-- ---------------------------------------------------------------------------
insert into agent_definitions (
  slug, display_name, description, department_id, parent_slug, role_type,
  semantic_version, default_requires_human_approval, concurrency_limit, timeout_seconds, retry_max,
  required_plan, required_addon, active
) values

-- Executive
(
  'chief_orchestrator',
  'Chief Orchestrator',
  'Sole top-level Ricky AI orchestration agent. Interprets objectives, decomposes goals, coordinates departments, detects policy conflicts, handles failed subordinates, and produces customer-facing progress summaries.',
  (select id from agent_departments where slug = 'executive'),
  null, 'orchestrator', '1.0.0', false, 1, 600, 2, null, null, true
),

-- Growth Strategy
(
  'growth_strategy_manager',
  'Growth Strategy Manager',
  'Manages growth strategy department. Coordinates market research, competitor intelligence, brand strategy, web presence audit, and campaign planning.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'market_research_specialist',
  'Market Research Specialist',
  'Researches market size, trends, customer demographics, and growth opportunities relevant to the business.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'growth_strategy_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'competitor_intelligence_specialist',
  'Competitor Intelligence Specialist',
  'Analyzes competitors — positioning, offerings, weaknesses, and differentiation opportunities.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'growth_strategy_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'brand_strategy_specialist',
  'Brand Strategy Specialist',
  'Develops brand positioning, messaging frameworks, and value proposition recommendations.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'growth_strategy_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'web_presence_audit_specialist',
  'Web Presence Audit Specialist',
  'Audits the business web presence including Google Business Profile completeness, review sentiment, and online visibility gaps.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'growth_strategy_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'campaign_strategy_specialist',
  'Campaign Strategy Specialist',
  'Designs campaign blueprints — audience targeting, channel mix, offer structure, and success metrics.',
  (select id from agent_departments where slug = 'growth_strategy'),
  'growth_strategy_manager', 'specialist', '1.0.0', false, 5, 180, 3, 'business', null, true
),

-- Content Studio
(
  'content_studio_manager',
  'Content Studio Manager',
  'Manages content studio department. Coordinates content planning, copy, scripts, creative QA, and local SEO.',
  (select id from agent_departments where slug = 'content_studio'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'content_planning_specialist',
  'Content Planning Specialist',
  'Plans content calendars, topic clusters, and content mix for the business.',
  (select id from agent_departments where slug = 'content_studio'),
  'content_studio_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'copywriting_specialist',
  'Copywriting Specialist',
  'Writes marketing copy — headlines, descriptions, CTAs, and promotional text.',
  (select id from agent_departments where slug = 'content_studio'),
  'content_studio_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'scriptwriting_specialist',
  'Scriptwriting Specialist',
  'Writes structured video scripts with scenes, voiceover text, and visual direction.',
  (select id from agent_departments where slug = 'content_studio'),
  'content_studio_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'creative_quality_specialist',
  'Creative Quality Specialist',
  'Reviews copy and scripts for brand alignment, clarity, accuracy, and quality before handoff to production.',
  (select id from agent_departments where slug = 'content_studio'),
  'content_studio_manager', 'specialist', '1.0.0', false, 5, 120, 2, null, null, true
),
(
  'seo_local_discovery_specialist',
  'SEO & Local Discovery Specialist',
  'Optimizes content for local search visibility, Google Business Profile keywords, and organic discovery.',
  (select id from agent_departments where slug = 'content_studio'),
  'content_studio_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),

-- Video Production
(
  'video_production_manager',
  'Video Production Manager',
  'Manages video production department. Coordinates video planning, voiceover, B-roll, rendering, and QA.',
  (select id from agent_departments where slug = 'video_production'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'video_plan_specialist',
  'Video Plan Specialist',
  'Translates approved scripts into structured video plans with scene timing, text overlays, and production notes.',
  (select id from agent_departments where slug = 'video_production'),
  'video_production_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'voiceover_specialist',
  'Voiceover Specialist',
  'Selects voice profiles and prepares voiceover configuration for video production.',
  (select id from agent_departments where slug = 'video_production'),
  'video_production_manager', 'specialist', '1.0.0', false, 5, 120, 3, null, null, true
),
(
  'broll_asset_specialist',
  'B-Roll Asset Specialist',
  'Sources and selects B-roll footage and imagery from approved asset libraries for each video scene.',
  (select id from agent_departments where slug = 'video_production'),
  'video_production_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'video_render_specialist',
  'Video Render Specialist',
  'Dispatches render jobs to Creatomate using the customer''s BYO Creatomate API key. Monitors job status.',
  (select id from agent_departments where slug = 'video_production'),
  'video_production_manager', 'specialist', '1.0.0', true, 3, 600, 2, null, null, true
),
(
  'video_quality_specialist',
  'Video Quality Specialist',
  'Reviews completed video renders for technical quality and brand alignment before distribution readiness.',
  (select id from agent_departments where slug = 'video_production'),
  'video_production_manager', 'specialist', '1.0.0', false, 5, 120, 2, null, null, true
),

-- Distribution & Optimization
(
  'distribution_manager',
  'Distribution Manager',
  'Manages distribution and optimization department. Coordinates channel strategy, publishing readiness, analytics, and optimization.',
  (select id from agent_departments where slug = 'distribution_optimization'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'channel_strategy_specialist',
  'Channel Strategy Specialist',
  'Recommends optimal distribution channels based on audience, content type, and business objectives.',
  (select id from agent_departments where slug = 'distribution_optimization'),
  'distribution_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'publishing_readiness_specialist',
  'Publishing Readiness Specialist',
  'Prepares content packages for distribution — formats, captions, hashtags, scheduled timing. Does NOT publish autonomously.',
  (select id from agent_departments where slug = 'distribution_optimization'),
  'distribution_manager', 'specialist', '1.0.0', true, 5, 180, 3, null, null, true
),
(
  'performance_analytics_specialist',
  'Performance Analytics Specialist',
  'Analyzes content and campaign performance data to surface actionable insights.',
  (select id from agent_departments where slug = 'distribution_optimization'),
  'distribution_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),
(
  'optimization_specialist',
  'Optimization Specialist',
  'Recommends content, campaign, and channel optimizations based on performance data.',
  (select id from agent_departments where slug = 'distribution_optimization'),
  'distribution_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),

-- Opportunity Intelligence
(
  'opportunity_intelligence_manager',
  'Opportunity Intelligence Manager',
  'Manages opportunity intelligence department. Coordinates federal contracting, grant intelligence, and opportunity qualification.',
  (select id from agent_departments where slug = 'opportunity_intelligence'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'federal_contracting_specialist',
  'Federal Contracting Specialist',
  'Researches and qualifies federal contracting opportunities for the business. Requires Federal Contracting add-on.',
  (select id from agent_departments where slug = 'opportunity_intelligence'),
  'opportunity_intelligence_manager', 'specialist', '1.0.0', false, 3, 240, 3, null, 'federal_contracting', true
),
(
  'grant_intelligence_specialist',
  'Grant Intelligence Specialist',
  'Researches and qualifies grant opportunities for the business. Requires Grant Intelligence add-on.',
  (select id from agent_departments where slug = 'opportunity_intelligence'),
  'opportunity_intelligence_manager', 'specialist', '1.0.0', false, 3, 240, 3, null, 'grant_intelligence', true
),
(
  'opportunity_qualification_specialist',
  'Opportunity Qualification Specialist',
  'Evaluates and scores opportunities for fit, feasibility, and priority before recommending pursuit.',
  (select id from agent_departments where slug = 'opportunity_intelligence'),
  'opportunity_intelligence_manager', 'specialist', '1.0.0', false, 5, 180, 3, null, null, true
),

-- Trust, Safety & Operations
(
  'trust_operations_manager',
  'Trust, Safety & Operations Manager',
  'Manages trust and operations department. Coordinates quality review, policy compliance, approvals, and incident triage.',
  (select id from agent_departments where slug = 'trust_operations'),
  'chief_orchestrator', 'manager', '1.0.0', false, 3, 300, 3, null, null, true
),
(
  'workflow_quality_specialist',
  'Workflow Quality Specialist',
  'Reviews workflow outputs for quality, completeness, and alignment with the original business goal.',
  (select id from agent_departments where slug = 'trust_operations'),
  'trust_operations_manager', 'specialist', '1.0.0', false, 5, 120, 2, null, null, true
),
(
  'policy_compliance_specialist',
  'Policy Compliance Specialist',
  'Reviews planned actions against platform policy, tool grants, and entitlement requirements before execution.',
  (select id from agent_departments where slug = 'trust_operations'),
  'trust_operations_manager', 'specialist', '1.0.0', false, 5, 60, 2, null, null, true
),
(
  'customer_approval_specialist',
  'Customer Approval Specialist',
  'Manages customer approval requests — creates approval records, monitors expiry, and routes decisions.',
  (select id from agent_departments where slug = 'trust_operations'),
  'trust_operations_manager', 'specialist', '1.0.0', false, 5, 120, 2, null, null, true
),
(
  'incident_triage_specialist',
  'Incident Triage Specialist',
  'Handles escalations, repeated failures, policy denials, and blocked workflows. Routes to human when required.',
  (select id from agent_departments where slug = 'trust_operations'),
  'trust_operations_manager', 'specialist', '1.0.0', false, 5, 120, 2, null, null, true
)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- CAPABILITIES
-- ---------------------------------------------------------------------------
insert into agent_capabilities (slug, display_name, description, category) values
  ('business_knowledge',        'Business Knowledge',         'Read business profile, settings, and context',              'data'),
  ('strategy_outputs',          'Strategy Outputs',           'Read and write strategy and growth intelligence records',   'data'),
  ('content_generation',        'Content Generation',         'Generate marketing copy, scripts, and content',             'ai'),
  ('web_research',              'Web Research',               'Fetch and analyze external web content',                    'network'),
  ('competitor_research',       'Competitor Research',        'Research competitor positioning and offerings',              'network'),
  ('pexels_search',             'Pexels B-Roll Search',       'Search and retrieve stock video/image assets from Pexels',  'network'),
  ('elevenlabs_tts',            'ElevenLabs TTS',             'Generate voiceover via ElevenLabs API',                     'provider'),
  ('creatomate_render',         'Creatomate Render',          'Dispatch video render jobs to Creatomate (BYO key required)', 'provider'),
  ('video_job_status',          'Video Job Status',           'Read video generation job status from database',            'data'),
  ('send_message',              'Send Message',               'Send approved messages via SMS or email',                   'side_effect'),
  ('distribution_prep',         'Distribution Prep',          'Prepare content packages for customer review and distribution', 'data'),
  ('stripe_entitlement',        'Stripe Entitlement Check',   'Check plan entitlement and subscription status',            'data'),
  ('approval_management',       'Approval Management',        'Create and route customer approval requests',               'workflow'),
  ('escalation_routing',        'Escalation Routing',         'Create and route escalations to appropriate handlers',      'workflow'),
  ('federal_contracting_intel', 'Federal Contracting Intel',  'Research and qualify federal contracting opportunities',    'data'),
  ('grant_intelligence',        'Grant Intelligence',         'Research and qualify grant opportunities',                  'data')
on conflict (slug) do nothing;

-- Assign capabilities to agents
insert into agent_definition_capabilities (agent_slug, capability_slug) values
  ('chief_orchestrator',                'business_knowledge'),
  ('chief_orchestrator',                'escalation_routing'),
  ('chief_orchestrator',                'approval_management'),
  ('growth_strategy_manager',           'business_knowledge'),
  ('growth_strategy_manager',           'strategy_outputs'),
  ('market_research_specialist',        'web_research'),
  ('market_research_specialist',        'business_knowledge'),
  ('competitor_intelligence_specialist','competitor_research'),
  ('competitor_intelligence_specialist','web_research'),
  ('brand_strategy_specialist',         'strategy_outputs'),
  ('brand_strategy_specialist',         'content_generation'),
  ('web_presence_audit_specialist',     'web_research'),
  ('web_presence_audit_specialist',     'business_knowledge'),
  ('campaign_strategy_specialist',      'strategy_outputs'),
  ('campaign_strategy_specialist',      'content_generation'),
  ('content_studio_manager',            'content_generation'),
  ('content_planning_specialist',       'content_generation'),
  ('content_planning_specialist',       'strategy_outputs'),
  ('copywriting_specialist',            'content_generation'),
  ('scriptwriting_specialist',          'content_generation'),
  ('creative_quality_specialist',       'content_generation'),
  ('seo_local_discovery_specialist',    'web_research'),
  ('seo_local_discovery_specialist',    'content_generation'),
  ('video_production_manager',          'video_job_status'),
  ('video_plan_specialist',             'content_generation'),
  ('voiceover_specialist',              'elevenlabs_tts'),
  ('broll_asset_specialist',            'pexels_search'),
  ('video_render_specialist',           'creatomate_render'),
  ('video_render_specialist',           'video_job_status'),
  ('video_quality_specialist',          'video_job_status'),
  ('distribution_manager',              'distribution_prep'),
  ('channel_strategy_specialist',       'strategy_outputs'),
  ('publishing_readiness_specialist',   'distribution_prep'),
  ('performance_analytics_specialist',  'business_knowledge'),
  ('optimization_specialist',           'strategy_outputs'),
  ('opportunity_intelligence_manager',  'business_knowledge'),
  ('federal_contracting_specialist',    'federal_contracting_intel'),
  ('grant_intelligence_specialist',     'grant_intelligence'),
  ('opportunity_qualification_specialist','strategy_outputs'),
  ('trust_operations_manager',          'approval_management'),
  ('trust_operations_manager',          'escalation_routing'),
  ('workflow_quality_specialist',       'business_knowledge'),
  ('policy_compliance_specialist',      'stripe_entitlement'),
  ('customer_approval_specialist',      'approval_management'),
  ('incident_triage_specialist',        'escalation_routing')
on conflict (agent_slug, capability_slug) do nothing;

-- ---------------------------------------------------------------------------
-- TOOL DEFINITIONS
-- ---------------------------------------------------------------------------
insert into agent_tool_definitions (slug, display_name, description, provider, action_type, is_read_only, risk_level) values
  ('read_business_profile',     'Read Business Profile',     'Read business profile data',                       'supabase',    'read',          true,  'low'),
  ('read_strategy_outputs',     'Read Strategy Outputs',     'Read growth intelligence and strategy records',    'supabase',    'read',          true,  'low'),
  ('write_strategy_outputs',    'Write Strategy Outputs',    'Write growth intelligence records',                'supabase',    'write',         false, 'low'),
  ('read_video_job_status',     'Read Video Job Status',     'Read video_generation_jobs table',                 'supabase',    'read',          true,  'low'),
  ('fetch_webpage',             'Fetch Webpage',             'Fetch and parse external web content',             'http',        'fetch',         true,  'medium'),
  ('search_pexels',             'Search Pexels',             'Search Pexels for stock video/images',             'pexels',      'search',        true,  'low'),
  ('elevenlabs_generate',       'ElevenLabs Generate',       'Generate voiceover audio via ElevenLabs',          'elevenlabs',  'generate',      false, 'medium'),
  ('creatomate_render',         'Creatomate Render',         'Dispatch render job to Creatomate (BYO key)',       'creatomate',  'render',        false, 'high'),
  ('send_sms',                  'Send SMS',                  'Send SMS via Twilio (approved messages only)',     'twilio',      'send',          false, 'high'),
  ('send_email',                'Send Email',                'Send email via SendGrid (approved messages only)', 'sendgrid',    'send',          false, 'high'),
  ('generate_content',          'Generate Content',          'Call Claude API for content generation',           'anthropic',   'generate',      false, 'medium'),
  ('read_stripe_entitlement',   'Read Stripe Entitlement',   'Check subscription plan and add-on status',        'supabase',    'read',          true,  'low'),
  ('create_approval',           'Create Approval',           'Create customer approval record in database',      'supabase',    'write',         false, 'low'),
  ('create_escalation',         'Create Escalation',         'Create escalation record in database',             'supabase',    'write',         false, 'low'),
  ('search_sam_gov',            'Search SAM.gov',            'Search SAM.gov for federal contracting opportunities','http',     'fetch',         true,  'medium'),
  ('search_grants',             'Search Grants',             'Search grant databases for opportunities',         'http',        'fetch',         true,  'medium')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- TOOL GRANTS
-- Chief orchestrator gets read tools and workflow management tools only
-- ---------------------------------------------------------------------------
insert into agent_tool_grants (agent_slug, tool_slug, action_scope, approval_policy) values
  ('chief_orchestrator',                'read_business_profile',   '{"scope":"read"}', 'none'),
  ('chief_orchestrator',                'read_stripe_entitlement', '{"scope":"read"}', 'none'),
  ('chief_orchestrator',                'create_escalation',       '{"scope":"write"}', 'none'),
  ('chief_orchestrator',                'create_approval',         '{"scope":"write"}', 'none'),

  ('growth_strategy_manager',           'read_business_profile',   '{"scope":"read"}', 'none'),
  ('growth_strategy_manager',           'read_strategy_outputs',   '{"scope":"read"}', 'none'),

  ('market_research_specialist',        'fetch_webpage',           '{"scope":"research"}', 'none'),
  ('market_research_specialist',        'read_business_profile',   '{"scope":"read"}', 'none'),
  ('market_research_specialist',        'write_strategy_outputs',  '{"scope":"market_research"}', 'none'),
  ('market_research_specialist',        'generate_content',        '{"scope":"analysis"}', 'none'),

  ('competitor_intelligence_specialist','fetch_webpage',           '{"scope":"research"}', 'none'),
  ('competitor_intelligence_specialist','write_strategy_outputs',  '{"scope":"competitor"}', 'none'),
  ('competitor_intelligence_specialist','generate_content',        '{"scope":"analysis"}', 'none'),

  ('brand_strategy_specialist',         'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('brand_strategy_specialist',         'write_strategy_outputs',  '{"scope":"brand"}', 'none'),
  ('brand_strategy_specialist',         'generate_content',        '{"scope":"brand_strategy"}', 'none'),

  ('web_presence_audit_specialist',     'fetch_webpage',           '{"scope":"audit"}', 'none'),
  ('web_presence_audit_specialist',     'read_business_profile',   '{"scope":"read"}', 'none'),
  ('web_presence_audit_specialist',     'write_strategy_outputs',  '{"scope":"web_audit"}', 'none'),
  ('web_presence_audit_specialist',     'generate_content',        '{"scope":"audit"}', 'none'),

  ('campaign_strategy_specialist',      'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('campaign_strategy_specialist',      'write_strategy_outputs',  '{"scope":"campaign"}', 'none'),
  ('campaign_strategy_specialist',      'generate_content',        '{"scope":"campaign_strategy"}', 'none'),

  ('content_studio_manager',            'read_strategy_outputs',   '{"scope":"read"}', 'none'),

  ('content_planning_specialist',       'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('content_planning_specialist',       'generate_content',        '{"scope":"content_plan"}', 'none'),

  ('copywriting_specialist',            'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('copywriting_specialist',            'generate_content',        '{"scope":"copy"}', 'none'),

  ('scriptwriting_specialist',          'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('scriptwriting_specialist',          'generate_content',        '{"scope":"script"}', 'none'),

  ('creative_quality_specialist',       'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('creative_quality_specialist',       'generate_content',        '{"scope":"qa_review"}', 'none'),

  ('seo_local_discovery_specialist',    'fetch_webpage',           '{"scope":"seo_research"}', 'none'),
  ('seo_local_discovery_specialist',    'generate_content',        '{"scope":"seo"}', 'none'),

  ('video_production_manager',          'read_video_job_status',   '{"scope":"read"}', 'none'),

  ('video_plan_specialist',             'generate_content',        '{"scope":"video_plan"}', 'none'),

  ('voiceover_specialist',              'elevenlabs_generate',     '{"scope":"tts"}', 'none'),

  ('broll_asset_specialist',            'search_pexels',           '{"scope":"broll_search"}', 'none'),

  ('video_render_specialist',           'creatomate_render',       '{"scope":"render"}', 'always'),
  ('video_render_specialist',           'read_video_job_status',   '{"scope":"read"}', 'none'),

  ('video_quality_specialist',          'read_video_job_status',   '{"scope":"read"}', 'none'),

  ('distribution_manager',              'read_strategy_outputs',   '{"scope":"read"}', 'none'),

  ('channel_strategy_specialist',       'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('channel_strategy_specialist',       'generate_content',        '{"scope":"channel"}', 'none'),

  ('publishing_readiness_specialist',   'generate_content',        '{"scope":"publishing_prep"}', 'none'),
  ('publishing_readiness_specialist',   'create_approval',         '{"scope":"publish_approval"}', 'always'),

  ('performance_analytics_specialist',  'read_business_profile',   '{"scope":"read"}', 'none'),
  ('performance_analytics_specialist',  'read_strategy_outputs',   '{"scope":"read"}', 'none'),

  ('optimization_specialist',           'read_strategy_outputs',   '{"scope":"read"}', 'none'),
  ('optimization_specialist',           'generate_content',        '{"scope":"optimization"}', 'none'),

  ('opportunity_intelligence_manager',  'read_business_profile',   '{"scope":"read"}', 'none'),
  ('opportunity_intelligence_manager',  'read_stripe_entitlement', '{"scope":"read"}', 'none'),

  ('federal_contracting_specialist',    'search_sam_gov',          '{"scope":"contracting_research"}', 'none'),
  ('federal_contracting_specialist',    'generate_content',        '{"scope":"contracting_analysis"}', 'none'),
  ('federal_contracting_specialist',    'read_stripe_entitlement', '{"scope":"read"}', 'none'),

  ('grant_intelligence_specialist',     'search_grants',           '{"scope":"grant_research"}', 'none'),
  ('grant_intelligence_specialist',     'generate_content',        '{"scope":"grant_analysis"}', 'none'),
  ('grant_intelligence_specialist',     'read_stripe_entitlement', '{"scope":"read"}', 'none'),

  ('opportunity_qualification_specialist','generate_content',      '{"scope":"qualification"}', 'none'),

  ('trust_operations_manager',          'create_approval',         '{"scope":"write"}', 'none'),
  ('trust_operations_manager',          'create_escalation',       '{"scope":"write"}', 'none'),
  ('trust_operations_manager',          'read_stripe_entitlement', '{"scope":"read"}', 'none'),

  ('workflow_quality_specialist',       'read_business_profile',   '{"scope":"read"}', 'none'),
  ('workflow_quality_specialist',       'generate_content',        '{"scope":"qa"}', 'none'),

  ('policy_compliance_specialist',      'read_stripe_entitlement', '{"scope":"read"}', 'none'),

  ('customer_approval_specialist',      'create_approval',         '{"scope":"write"}', 'none'),

  ('incident_triage_specialist',        'create_escalation',       '{"scope":"write"}', 'none'),
  ('incident_triage_specialist',        'create_approval',         '{"scope":"triage"}', 'none')

on conflict (agent_slug, tool_slug) do nothing;

-- ---------------------------------------------------------------------------
-- DELEGATION POLICIES
-- chief_orchestrator → managers
-- managers → their specialists
-- ---------------------------------------------------------------------------
insert into agent_delegation_policies (manager_slug, subordinate_slug, permitted_task_categories, max_depth, requires_approval) values
  -- Chief → managers
  ('chief_orchestrator', 'growth_strategy_manager',          '{"growth_strategy","market_research","competitor_analysis","brand_strategy","web_audit","campaign_planning"}', 3, false),
  ('chief_orchestrator', 'content_studio_manager',           '{"content_studio","content_planning","copywriting","scriptwriting","creative_qa","seo"}', 3, false),
  ('chief_orchestrator', 'video_production_manager',         '{"video_production","video_planning","voiceover","broll","rendering","video_qa"}', 3, false),
  ('chief_orchestrator', 'distribution_manager',             '{"distribution","channel_strategy","publishing","analytics","optimization"}', 3, false),
  ('chief_orchestrator', 'opportunity_intelligence_manager', '{"opportunity_intelligence","federal_contracting","grant_intelligence","qualification"}', 3, false),
  ('chief_orchestrator', 'trust_operations_manager',         '{"trust_operations","quality_review","policy_compliance","approval_management","incident_triage"}', 3, false),

  -- Growth Strategy Manager → specialists
  ('growth_strategy_manager', 'market_research_specialist',        '{"market_research"}',     2, false),
  ('growth_strategy_manager', 'competitor_intelligence_specialist', '{"competitor_analysis"}', 2, false),
  ('growth_strategy_manager', 'brand_strategy_specialist',         '{"brand_strategy"}',      2, false),
  ('growth_strategy_manager', 'web_presence_audit_specialist',     '{"web_audit"}',           2, false),
  ('growth_strategy_manager', 'campaign_strategy_specialist',      '{"campaign_planning"}',   2, false),

  -- Content Studio Manager → specialists
  ('content_studio_manager', 'content_planning_specialist',  '{"content_planning"}', 2, false),
  ('content_studio_manager', 'copywriting_specialist',       '{"copywriting"}',      2, false),
  ('content_studio_manager', 'scriptwriting_specialist',     '{"scriptwriting"}',    2, false),
  ('content_studio_manager', 'creative_quality_specialist',  '{"creative_qa"}',      2, false),
  ('content_studio_manager', 'seo_local_discovery_specialist','{"seo"}',             2, false),

  -- Video Production Manager → specialists
  ('video_production_manager', 'video_plan_specialist',    '{"video_planning"}', 2, false),
  ('video_production_manager', 'voiceover_specialist',     '{"voiceover"}',      2, false),
  ('video_production_manager', 'broll_asset_specialist',   '{"broll"}',          2, false),
  ('video_production_manager', 'video_render_specialist',  '{"rendering"}',      2, true),
  ('video_production_manager', 'video_quality_specialist', '{"video_qa"}',       2, false),

  -- Distribution Manager → specialists
  ('distribution_manager', 'channel_strategy_specialist',      '{"channel_strategy"}', 2, false),
  ('distribution_manager', 'publishing_readiness_specialist',  '{"publishing"}',       2, true),
  ('distribution_manager', 'performance_analytics_specialist', '{"analytics"}',        2, false),
  ('distribution_manager', 'optimization_specialist',          '{"optimization"}',     2, false),

  -- Opportunity Intelligence Manager → specialists
  ('opportunity_intelligence_manager', 'federal_contracting_specialist',    '{"federal_contracting"}',   2, false),
  ('opportunity_intelligence_manager', 'grant_intelligence_specialist',     '{"grant_intelligence"}',    2, false),
  ('opportunity_intelligence_manager', 'opportunity_qualification_specialist','{"qualification"}',        2, false),

  -- Trust Operations Manager → specialists
  ('trust_operations_manager', 'workflow_quality_specialist',   '{"quality_review"}',       2, false),
  ('trust_operations_manager', 'policy_compliance_specialist',  '{"policy_compliance"}',    2, false),
  ('trust_operations_manager', 'customer_approval_specialist',  '{"approval_management"}',  2, false),
  ('trust_operations_manager', 'incident_triage_specialist',    '{"incident_triage"}',      2, false)

on conflict (manager_slug, subordinate_slug) do nothing;

-- ---------------------------------------------------------------------------
-- HANDOFF CONTRACTS
-- Key cross-department handoffs
-- ---------------------------------------------------------------------------
insert into agent_handoff_contracts (
  source_slug, destination_slug, task_category,
  required_context_keys, required_artifact_types, requires_approval, rejection_policy
) values
  -- Strategy → Content: after strategy is complete, content studio picks it up
  ('growth_strategy_manager', 'content_studio_manager', 'strategy_to_content',
   '{"business_id","strategy_summary","brand_positioning"}', '{"strategy_report"}', false, 'escalate'),

  -- Content → Video: after script is approved, video production picks it up
  ('creative_quality_specialist', 'video_production_manager', 'content_to_video',
   '{"business_id","approved_script","scene_count"}', '{"approved_script"}', false, 'escalate'),

  -- Video → Distribution: after video is QA-passed, distribution prepares it
  ('video_quality_specialist', 'distribution_manager', 'video_to_distribution',
   '{"business_id","video_url","job_id"}', '{"completed_video"}', false, 'escalate'),

  -- Distribution → Customer: publishing readiness requires customer approval
  ('publishing_readiness_specialist', 'customer_approval_specialist', 'publish_approval_request',
   '{"business_id","content_package","channels"}', '{"content_package"}', true, 'notify'),

  -- Any agent → Trust Operations: escalation path for quality failures
  ('workflow_quality_specialist', 'incident_triage_specialist', 'quality_failure',
   '{"business_id","workflow_id","failure_reason"}', '{}', false, 'escalate'),

  -- Creative QA rejection → scriptwriting for revision
  ('creative_quality_specialist', 'scriptwriting_specialist', 'script_revision',
   '{"business_id","script_draft","qa_feedback"}', '{"script_draft"}', false, 'fail'),

  -- Federal contracting → qualification
  ('federal_contracting_specialist', 'opportunity_qualification_specialist', 'contracting_qualification',
   '{"business_id","opportunities"}', '{"opportunity_list"}', false, 'escalate'),

  -- Grant intelligence → qualification
  ('grant_intelligence_specialist', 'opportunity_qualification_specialist', 'grant_qualification',
   '{"business_id","grants"}', '{"grant_list"}', false, 'escalate')

on conflict (source_slug, destination_slug, task_category) do nothing;

-- ---------------------------------------------------------------------------
-- ESCALATION POLICIES
-- ---------------------------------------------------------------------------
insert into agent_escalation_policies (
  originating_slug, trigger_type, severity, destination_slug, customer_notify
) values
  -- Missing business context
  ('chief_orchestrator',              'missing_business_context',        'high',     'incident_triage_specialist',   true),
  -- Low confidence output
  ('creative_quality_specialist',     'low_confidence_output',           'medium',   'trust_operations_manager',     false),
  ('workflow_quality_specialist',     'low_confidence_output',           'medium',   'incident_triage_specialist',   false),
  -- Handoff rejected
  ('video_production_manager',        'handoff_rejected',                'medium',   'trust_operations_manager',     false),
  ('content_studio_manager',          'handoff_rejected',                'medium',   'trust_operations_manager',     false),
  -- Provider failure (Creatomate)
  ('video_render_specialist',         'provider_failure',                'high',     'incident_triage_specialist',   true),
  ('video_render_specialist',         'provider_configuration_missing',  'high',     'incident_triage_specialist',   true),
  -- Missing BYO credential
  ('video_render_specialist',         'missing_byo_credential',          'high',     'incident_triage_specialist',   true),
  -- Missing entitlement
  ('federal_contracting_specialist',  'missing_entitlement',             'medium',   'trust_operations_manager',     true),
  ('grant_intelligence_specialist',   'missing_entitlement',             'medium',   'trust_operations_manager',     true),
  -- Approval expired
  ('customer_approval_specialist',    'approval_expired',                'medium',   'incident_triage_specialist',   true),
  -- Policy denial
  ('policy_compliance_specialist',    'policy_denial',                   'high',     'incident_triage_specialist',   false),
  -- Repeated failure
  ('incident_triage_specialist',      'repeated_failure',                'critical', 'trust_operations_manager',     true),
  -- Chief orchestrator escalation of last resort
  ('trust_operations_manager',        'unresolvable',                    'critical', 'chief_orchestrator',           true)

on conflict do nothing;
