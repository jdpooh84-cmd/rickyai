# DATABASE.md — RickyAI Schema Reference

Generated from `supabase/migrations/`. Every table in the public schema is documented here.

---

## Table of Contents

1. [profiles](#profiles)
2. [businesses](#businesses)
3. [locations](#locations)
4. [user_api_keys](#user_api_keys)
5. [strategy_outputs](#strategy_outputs)
6. [user_points](#user_points)
7. [user_badges](#user_badges)
8. [point_history](#point_history)
9. [forum_posts](#forum_posts)
10. [forum_replies](#forum_replies)
11. [forum_upvotes](#forum_upvotes)
12. [winning_strategies](#winning_strategies)
13. [strategy_purchases](#strategy_purchases)
14. [advertiser_accounts](#advertiser_accounts)
15. [ad_campaigns](#ad_campaigns)
16. [ad_placements](#ad_placements)
17. [ad_events](#ad_events)
18. [trial_used_emails](#trial_used_emails)
19. [referral_codes](#referral_codes)
20. [referral_conversions](#referral_conversions)
21. [affiliate_payouts](#affiliate_payouts)
22. [user_roles](#user_roles)
23. [admin_activity_log](#admin_activity_log)
24. [tos_acceptances](#tos_acceptances)
25. [user_bans](#user_bans)
26. [content_flags](#content_flags)
27. [usage_tracking](#usage_tracking)
28. [webhook_config](#webhook_config)
29. [video_generation_jobs](#video_generation_jobs)
30. [content_posts](#content_posts)
31. [user_tool_defaults](#user_tool_defaults)
32. [business_media](#business_media)
33. [campaign_outcomes](#campaign_outcomes)
34. [attribution_touchpoints](#attribution_touchpoints)
35. [clip_generation_jobs](#clip_generation_jobs)
36. [webhook_receipts](#webhook_receipts)
37. [business_events](#business_events)
38. [agent_jobs](#agent_jobs)
39. [contacts](#contacts)
40. [leads](#leads)
41. [customer_memory](#customer_memory)
42. [business_knowledge](#business_knowledge)
43. [website_research_jobs](#website_research_jobs)
44. [appointment_types](#appointment_types)
45. [availability_rules](#availability_rules)
46. [appointments](#appointments)
47. [appointment_holds](#appointment_holds)
48. [calendar_connections](#calendar_connections)
49. [phone_calls](#phone_calls)
50. [phone_settings](#phone_settings)
51. [lifecycle_automations](#lifecycle_automations)
52. [lifecycle_steps](#lifecycle_steps)
53. [automation_enrollments](#automation_enrollments)
54. [automation_step_executions](#automation_step_executions)
55. [messages](#messages)
56. [offers](#offers)
57. [offer_redemptions](#offer_redemptions)
58. [opportunities](#opportunities)
59. [review_requests](#review_requests)
60. [reactivation_campaigns](#reactivation_campaigns)
61. [approvals](#approvals)
62. [campaign_executions](#campaign_executions)
63. [landing_pages](#landing_pages)
64. [growth_experiments](#growth_experiments)
65. [growth_experiment_variants](#growth_experiment_variants)
66. [growth_experiment_exposures](#growth_experiment_exposures)
67. [growth_experiment_outcomes](#growth_experiment_outcomes)
68. [growth_findings](#growth_findings)
69. [growth_genome_settings](#growth_genome_settings)
70. [genome_contributions](#genome_contributions)
71. [genome_aggregate_findings](#genome_aggregate_findings)
72. [service_economics](#service_economics)
73. [resource_capacity](#resource_capacity)
74. [yield_decisions](#yield_decisions)
75. [health_alerts](#health_alerts)
76. [executive_briefs](#executive_briefs)
77. [audit_logs](#audit_logs)
78. [business_integrations](#business_integrations)
79. [feature_flags](#feature_flags)

---

## ASCII ER Diagram (Core Entities)

```
auth.users
  |
  +-- profiles (1:1 via user_id)
  +-- businesses (1:N via user_id)
        |
        +-- locations (1:N via business_id)
        |
        +-- strategy_outputs (1:N)
        +-- video_generation_jobs (1:N)
        +-- content_posts (1:N)
        +-- business_media (1:N)
        +-- campaign_outcomes (1:N)
        |
        +-- contacts (1:N)
        |     +-- leads (1:N via contact_id)
        |     +-- customer_memory (1:1 via contact_id)
        |     +-- messages (1:N)
        |     +-- appointments (1:N)
        |
        +-- business_events (1:N)       [append-only log]
        +-- agent_jobs (1:N)            [durable job queue]
        +-- audit_logs (1:N)            [append-only log]
        |
        +-- growth_experiments (1:N)
        |     +-- growth_experiment_variants (1:N)
        |     +-- growth_experiment_exposures (1:N)
        |     +-- growth_experiment_outcomes (1:N)
        |
        +-- lifecycle_automations (1:N)
        |     +-- lifecycle_steps (1:N)
        |     +-- automation_enrollments (1:N)
        |
        +-- appointments (1:N)
        +-- appointment_types (1:N)
        +-- service_economics (1:N)
        +-- resource_capacity (1:N)
        +-- yield_decisions (1:N)
        +-- business_integrations (1:N)
        +-- business_knowledge (1:N)

auth.users
  +-- user_api_keys (1:N via user_id)
  +-- user_points (1:1 via user_id)
  +-- user_badges (1:N via user_id)
  +-- user_roles (1:N via user_id)
  +-- referral_codes (1:N via user_id)
  +-- tos_acceptances (1:N via user_id)
  +-- usage_tracking (1:N via user_id)

webhook_receipts        [service-role only; idempotency store]
feature_flags           [platform admin; no per-user RLS]
genome_aggregate_findings [public read; cross-business aggregates]
```

---

## profiles

**Purpose**: One-to-one extension of `auth.users` — stores display info, trial timestamps, and UI preferences.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK → auth.users(id) ON DELETE CASCADE; UNIQUE |
| display_name | text | YES | — | Shown in UI |
| avatar_url | text | YES | — | |
| onboarding_completed | boolean | NOT NULL | false | |
| trial_started_at | timestamptz | YES | — | Set on signup trigger |
| trial_ends_at | timestamptz | YES | — | trial_started_at + 7 days |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | Auto-updated by trigger |
| email_marketing_opt_in | boolean | NOT NULL | true | Added in migration 20260325165402 |
| ricky_question_count | integer | NOT NULL | 0 | Added in 20260327053107 |
| ricky_limit_reached | boolean | NOT NULL | false | Added in 20260327053107 |
| is_test_account | boolean | NOT NULL | false | Added in 20260731000000 |

**Foreign keys**: user_id → auth.users(id) ON DELETE CASCADE

**RLS**: SELECT/UPDATE/INSERT scoped to `auth.uid() = user_id`

**Triggers**: `on_auth_user_created` — creates row on new auth.user signup. `update_profiles_updated_at` — keeps `updated_at` current.

---

## businesses

**Purpose**: Core business profile owned by a user — the root entity for all operational data.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK → auth.users(id) ON DELETE CASCADE |
| owner_name | text | YES | — | |
| business_name | text | NOT NULL | — | |
| business_category | text | YES | — | |
| niche | text | YES | — | |
| website_url | text | YES | — | |
| google_business_profile | text | YES | — | |
| facebook_url | text | YES | — | |
| instagram_url | text | YES | — | |
| tiktok_url | text | YES | — | |
| youtube_url | text | YES | — | |
| linkedin_url | text | YES | — | |
| target_audience | text | YES | — | |
| brand_tone | text | YES | — | |
| services | text | YES | — | |
| competitors | text | YES | — | |
| content_goals | text | YES | — | |
| referral_goals | text | YES | — | |
| funding_goals | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |
| timezone | text | NOT NULL | 'America/New_York' | Added in 20260903000014 |
| easystart_completed | boolean | YES | false | Added in 20260903000013 |
| easystart_step | integer | YES | 0 | Added in 20260903000013 |

**Foreign keys**: user_id → auth.users(id) ON DELETE CASCADE

**RLS**: SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`

**Triggers**: `update_businesses_updated_at`

---

## locations

**Purpose**: A physical or service-area location belonging to a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| user_id | uuid | NOT NULL | — | FK → auth.users(id) ON DELETE CASCADE |
| location_name | text | NOT NULL | — | |
| city | text | NOT NULL | — | |
| state | text | YES | — | |
| country | text | YES | 'US' | |
| service_area | text | YES | — | |
| is_primary | boolean | NOT NULL | false | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |
| timezone | text | YES | — | Added in 20260903000014 |

**Foreign keys**: business_id → businesses(id) ON DELETE CASCADE; user_id → auth.users(id) ON DELETE CASCADE

**RLS**: SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`

**Triggers**: `update_locations_updated_at`

---

## user_api_keys

**Purpose**: Encrypted BYO API keys for external providers (Creatomate, OpenAI, etc.) stored per user.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| provider | text | NOT NULL | — | e.g. 'creatomate', 'openai' |
| api_key_encrypted | text | NOT NULL | — | Column-level SELECT revoked from browser roles |
| is_valid | boolean | YES | true | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |
| key_iv | text | YES | — | Encryption IV; SELECT revoked from browser |
| key_version | text | NOT NULL | 'v0-plaintext' | 'v0-plaintext' for legacy, 'v1' for encrypted |
| api_key_masked | text | YES | — | Last 4 chars shown in UI |

**Unique**: (user_id, provider)

**RLS**: SELECT (safe columns only)/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`. `api_key_encrypted` and `key_iv` SELECT/INSERT/UPDATE revoked from authenticated/anon; only service_role can read ciphertext.

---

## strategy_outputs

**Purpose**: Stores AI-generated step output for each business/step combination.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| step_number | integer | NOT NULL | — | 1–15 matching Dashboard step map |
| step_name | text | NOT NULL | — | |
| output_data | jsonb | NOT NULL | {} | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Unique index**: `strategy_outputs_user_business_step_key` on (user_id, business_id, step_number)

**RLS**: SELECT/INSERT/UPDATE/DELETE scoped to `auth.uid() = user_id`

---

## user_points

**Purpose**: Gamification — tracks cumulative points, level, and streak for a user.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | UNIQUE |
| points | integer | NOT NULL | 0 | Current points balance |
| level | integer | NOT NULL | 1 | |
| streak_days | integer | NOT NULL | 0 | |
| last_activity_date | date | YES | — | |
| total_points_earned | integer | NOT NULL | 0 | Cumulative |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for own row (plus a public leaderboard SELECT for all authenticated users); INSERT/UPDATE scoped to own user_id.

---

## user_badges

**Purpose**: Records which gamification badges a user has earned.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| badge_id | text | NOT NULL | — | Identifier for the badge |
| earned_at | timestamptz | NOT NULL | now() | |

**Unique**: (user_id, badge_id)

**RLS**: SELECT/INSERT scoped to `auth.uid() = user_id`

---

## point_history

**Purpose**: Append-only ledger of point events for a user.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| points | integer | NOT NULL | — | Delta (positive or negative) |
| action | text | NOT NULL | — | Event type |
| description | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT/INSERT scoped to `auth.uid() = user_id`

---

## forum_posts

**Purpose**: Community forum posts visible to all authenticated users.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| title | text | NOT NULL | — | |
| body | text | NOT NULL | — | |
| category | text | NOT NULL | 'general' | |
| upvotes | integer | NOT NULL | 0 | |
| reply_count | integer | NOT NULL | 0 | |
| is_pinned | boolean | NOT NULL | false | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for all authenticated users; INSERT/UPDATE/DELETE scoped to own user_id

---

## forum_replies

**Purpose**: Replies to forum posts.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| post_id | uuid | NOT NULL | — | FK → forum_posts(id) ON DELETE CASCADE |
| user_id | uuid | NOT NULL | — | |
| body | text | NOT NULL | — | |
| upvotes | integer | NOT NULL | 0 | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for all authenticated; INSERT/UPDATE/DELETE scoped to own user_id

---

## forum_upvotes

**Purpose**: Tracks upvotes on forum posts and replies (one per user per item).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| post_id | uuid | YES | — | FK → forum_posts(id) ON DELETE CASCADE |
| reply_id | uuid | YES | — | FK → forum_replies(id) ON DELETE CASCADE |
| created_at | timestamptz | NOT NULL | now() | |

**Unique**: (user_id, post_id), (user_id, reply_id)

**RLS**: SELECT for all authenticated; INSERT/DELETE scoped to own user_id

---

## winning_strategies

**Purpose**: Marketplace of shared growth strategies that users can buy or browse.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| seller_user_id | uuid | NOT NULL | — | |
| title | text | NOT NULL | — | |
| description | text | NOT NULL | — | |
| category | text | NOT NULL | — | |
| industry | text | NOT NULL | — | |
| location | text | YES | — | |
| results_summary | text | NOT NULL | — | |
| strategy_data | jsonb | NOT NULL | {} | |
| price_cents | integer | NOT NULL | 0 | |
| is_free | boolean | NOT NULL | false | |
| upvotes | integer | NOT NULL | 0 | |
| purchase_count | integer | NOT NULL | 0 | |
| platform | text | YES | — | |
| metrics | jsonb | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for all authenticated; INSERT/UPDATE scoped to `auth.uid() = seller_user_id`

---

## strategy_purchases

**Purpose**: Records when a user purchases a strategy from the marketplace.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| buyer_user_id | uuid | NOT NULL | — | |
| strategy_id | uuid | NOT NULL | — | FK → winning_strategies(id) |
| purchased_at | timestamptz | NOT NULL | now() | |

**Unique**: (buyer_user_id, strategy_id)

**RLS**: SELECT/INSERT scoped to `auth.uid() = buyer_user_id`

---

## advertiser_accounts

**Purpose**: Advertiser organizations that run ad campaigns against the RickyAI user base.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| company_name | text | NOT NULL | — | |
| contact_email | text | NOT NULL | — | |
| contact_name | text | YES | — | |
| industry | text | NOT NULL | — | |
| website_url | text | YES | — | |
| logo_url | text | YES | — | |
| status | text | NOT NULL | 'pending' | CHECK: pending/active/paused/suspended |
| balance_cents | integer | NOT NULL | 0 | |
| total_spent_cents | integer | NOT NULL | 0 | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: Service role only (USING false for all client roles)

---

## ad_campaigns

**Purpose**: Ad campaigns created by advertiser accounts with targeting rules.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| advertiser_id | uuid | NOT NULL | — | FK → advertiser_accounts(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | |
| description | text | YES | — | |
| target_industries | text[] | YES | {} | |
| target_niches | text[] | YES | {} | |
| target_locations | text[] | YES | {} | |
| budget_cents | integer | NOT NULL | 0 | |
| spent_cents | integer | NOT NULL | 0 | |
| cpc_cents | integer | NOT NULL | 10 | Cost per click |
| status | text | NOT NULL | 'draft' | CHECK: draft/active/paused/completed/archived |
| start_date | timestamptz | YES | — | |
| end_date | timestamptz | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: Service role only

---

## ad_placements

**Purpose**: Individual ad creatives shown to users.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| campaign_id | uuid | NOT NULL | — | FK → ad_campaigns(id) ON DELETE CASCADE |
| placement_type | text | NOT NULL | 'banner' | CHECK: banner/sidebar/inline/sponsored_tip/featured_strategy |
| headline | text | NOT NULL | — | |
| body_text | text | YES | — | |
| image_url | text | YES | — | |
| cta_text | text | YES | 'Learn More' | |
| cta_url | text | NOT NULL | — | |
| impressions | integer | NOT NULL | 0 | |
| clicks | integer | NOT NULL | 0 | |
| is_active | boolean | NOT NULL | true | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for authenticated users when `is_active = true`

---

## ad_events

**Purpose**: Tracks impressions and clicks on ad placements for billing and analytics.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| placement_id | uuid | NOT NULL | — | FK → ad_placements(id) ON DELETE CASCADE |
| event_type | text | NOT NULL | — | CHECK: impression/click |
| user_id | uuid | YES | — | |
| user_industry | text | YES | — | |
| user_niche | text | YES | — | |
| user_location | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: INSERT/SELECT scoped to `auth.uid() = user_id`

---

## trial_used_emails

**Purpose**: Prevents re-registration abuse by recording emails that have used the free trial.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| email | text | NOT NULL | — | UNIQUE |
| used_at | timestamptz | NOT NULL | now() | |

**RLS**: Service role only (USING false)

**Triggers**: `on_auth_user_created_record_trial` — fires on new user creation

---

## referral_codes

**Purpose**: Affiliate referral codes owned by users.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| code | text | NOT NULL | — | UNIQUE |
| is_active | boolean | NOT NULL | true | |
| clicks | integer | NOT NULL | 0 | |
| conversions | integer | NOT NULL | 0 | |
| commission_rate_percent | numeric(5,2) | NOT NULL | 10.00 | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT/INSERT/UPDATE scoped to `auth.uid() = user_id`

---

## referral_conversions

**Purpose**: Records when a referred user converts (subscribes).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| referral_code_id | uuid | NOT NULL | — | FK → referral_codes(id) ON DELETE CASCADE |
| referred_user_id | uuid | NOT NULL | — | |
| referrer_user_id | uuid | NOT NULL | — | |
| status | text | NOT NULL | 'pending' | |
| commission_cents | integer | NOT NULL | 0 | |
| converted_at | timestamptz | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT scoped to `auth.uid() = referrer_user_id`; INSERT scoped to `auth.uid() = referred_user_id`

---

## affiliate_payouts

**Purpose**: Tracks payout records for affiliate commissions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| amount_cents | integer | NOT NULL | — | |
| status | text | NOT NULL | 'pending' | |
| payout_method | text | YES | 'stripe' | |
| notes | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| paid_at | timestamptz | YES | — | |

**RLS**: SELECT scoped to `auth.uid() = user_id`

---

## user_roles

**Purpose**: Assigns application roles (admin, moderator, etc.) to users.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK → auth.users(id) ON DELETE CASCADE |
| role | app_role | NOT NULL | — | ENUM: admin/moderator/user/developer/finance/marketing |

**Unique**: (user_id, role)

**RLS**: SELECT scoped to own user or admin; manage scoped to admin

---

## admin_activity_log

**Purpose**: Audit trail of administrative events.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| event_type | text | NOT NULL | — | |
| event_data | jsonb | YES | {} | |
| user_id | uuid | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT for admins only; INSERT for authenticated users

---

## tos_acceptances

**Purpose**: Records when a user accepted a specific version of the Terms of Service.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| tos_version | text | NOT NULL | '1.0' | |
| accepted_at | timestamptz | NOT NULL | now() | |
| ip_address | text | YES | — | |
| user_agent | text | YES | — | |

**RLS**: SELECT/INSERT scoped to `auth.uid() = user_id`

---

## user_bans

**Purpose**: Records content-moderation bans applied to users.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| offense_number | integer | NOT NULL | 1 | |
| reason | text | NOT NULL | — | |
| banned_at | timestamptz | NOT NULL | now() | |
| ban_expires_at | timestamptz | YES | — | |
| is_permanent | boolean | NOT NULL | false | |
| issued_by | uuid | YES | — | |
| notes | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: SELECT scoped to own user; ALL for admins

---

## content_flags

**Purpose**: User-submitted reports of content violations for admin review.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| reported_user_id | uuid | NOT NULL | — | |
| reported_by | uuid | YES | — | |
| content_type | text | NOT NULL | — | |
| content_id | uuid | YES | — | |
| reason | text | NOT NULL | — | |
| status | text | NOT NULL | 'pending' | |
| reviewed_by | uuid | YES | — | |
| reviewed_at | timestamptz | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL for admins; INSERT for own reported_by

---

## usage_tracking

**Purpose**: Tracks per-user monthly resource consumption (tokens, renders, storage).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| period_start | timestamptz | NOT NULL | date_trunc('month', now()) | |
| period_end | timestamptz | NOT NULL | +1 month | |
| llm_tokens_used | bigint | NOT NULL | 0 | |
| render_jobs_used | integer | NOT NULL | 0 | |
| storage_bytes_used | bigint | NOT NULL | 0 | |
| seats_used | integer | NOT NULL | 1 | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Unique**: (user_id, period_start) — enables atomic upserts

**RLS**: SELECT for own user or admin. INSERT/UPDATE removed from browser clients — service role only via `check_and_increment_render_usage()`.

**Functions**: `check_and_increment_render_usage(p_user_id, p_period_start, p_period_end, p_limit)` — atomically checks and increments render_jobs_used with a row-level lock.

---

## webhook_config

**Purpose**: Admin-managed registry of external webhook URLs per scenario type.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| scenario_type | text | NOT NULL | — | UNIQUE |
| webhook_url | text | NOT NULL | — | |
| is_active | boolean | NOT NULL | true | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL for admins; SELECT for authenticated when `is_active = true`

---

## video_generation_jobs

**Purpose**: Tracks the lifecycle of each Creatomate video render from queued to completed.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| provider | text | NOT NULL | 'built_in_ai' | |
| status | text | NOT NULL | 'queued' | Values: queued/generating_script/generating_images/generating_voiceover/rendering_video/processing/completed/failed |
| request_payload | jsonb | NOT NULL | {} | |
| result_payload | jsonb | YES | — | |
| video_url | text | YES | — | |
| error_message | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |
| storage_path | text | YES | — | Added in 20260526000000 |
| creatomate_render_id | text | YES | — | Added in 20260608000000 |
| pipeline_stage | text | YES | — | Added in 20260608000000 |

**Indexes**: (user_id, created_at DESC); (business_id, status, created_at DESC)

**RLS**: SELECT/INSERT/UPDATE scoped to `auth.uid() = user_id`

---

## content_posts

**Purpose**: Draft-to-published content workflow for social media posts.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) |
| title | text | NOT NULL | — | |
| caption | text | YES | — | |
| hashtags | text[] | YES | — | |
| cta | text | YES | — | |
| video_script | text | YES | — | |
| voiceover_script | text | YES | — | |
| shot_list | jsonb | YES | — | |
| platform | text | NOT NULL | 'tiktok' | |
| platform_version | jsonb | YES | — | |
| media_url | text | YES | — | |
| thumbnail_url | text | YES | — | |
| media_type | text | YES | 'video' | |
| status | text | NOT NULL | 'idea' | |
| scheduled_at | timestamptz | YES | — | |
| posted_at | timestamptz | YES | — | |
| production_tool | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## user_tool_defaults

**Purpose**: Stores the user's preferred provider/tool per tool type.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| tool_type | text | NOT NULL | — | e.g. 'video', 'image' |
| default_provider | text | NOT NULL | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Unique**: (user_id, tool_type)

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## business_media

**Purpose**: Uploaded images and videos for a business, used as raw footage in video scenes.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | |
| user_id | uuid | NOT NULL | — | |
| file_type | text | NOT NULL | 'image' | |
| shot_type | text | NOT NULL | 'environment' | |
| tags | text[] | YES | {} | |
| file_name | text | NOT NULL | — | |
| storage_path | text | NOT NULL | — | |
| public_url | text | NOT NULL | — | |
| file_size_bytes | bigint | YES | 0 | |
| mime_type | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Indexes**: (business_id); (business_id, shot_type)

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## campaign_outcomes

**Purpose**: Links campaign assets (posts, videos) to real business results (revenue, leads, bookings).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| business_id | uuid | NOT NULL | — | |
| location_id | uuid | YES | — | FK → locations(id) |
| content_post_id | uuid | YES | — | FK → content_posts(id) |
| video_job_id | uuid | YES | — | FK → video_generation_jobs(id) |
| strategy_output_id | uuid | YES | — | FK → strategy_outputs(id) |
| campaign_name | text | NOT NULL | — | |
| campaign_type | text | NOT NULL | 'general' | |
| campaign_goal | text | YES | — | |
| offer | text | YES | — | |
| cta_used | text | YES | — | |
| target_audience | text | YES | — | |
| content_format | text | YES | — | |
| platform | text | YES | — | |
| launched_at | timestamptz | YES | — | |
| views | integer | YES | 0 | |
| clicks | integer | YES | 0 | |
| replies | integer | YES | 0 | |
| form_submissions | integer | YES | 0 | |
| lead_captures | integer | YES | 0 | |
| appointment_requests | integer | YES | 0 | |
| bookings | integer | YES | 0 | |
| purchases | integer | YES | 0 | |
| repeat_purchases | integer | YES | 0 | |
| revenue_cents | integer | YES | 0 | |
| calls_received | integer | YES | 0 | |
| customer_feedback | text | YES | — | |
| what_customers_mentioned | text | YES | — | |
| felt_successful | boolean | YES | — | |
| manual_notes | text | YES | — | |
| attribution_model | text | YES | 'last_touch' | |
| attribution_score | numeric(5,2) | YES | 0 | |
| what_worked | jsonb | YES | [] | |
| what_failed | jsonb | YES | [] | |
| optimization_signals | jsonb | YES | {} | |
| status | text | NOT NULL | 'active' | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## attribution_touchpoints

**Purpose**: Multi-touch attribution — records each interaction in the customer journey.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | |
| business_id | uuid | NOT NULL | — | |
| outcome_id | uuid | YES | — | FK → campaign_outcomes(id) ON DELETE CASCADE |
| touchpoint_type | text | NOT NULL | — | |
| touchpoint_source | text | YES | — | |
| touchpoint_content | text | YES | — | |
| position_in_journey | integer | YES | 1 | |
| credit_first_touch | numeric(5,4) | YES | 0 | |
| credit_last_touch | numeric(5,4) | YES | 0 | |
| credit_linear | numeric(5,4) | YES | 0 | |
| credit_time_decay | numeric(5,4) | YES | 0 | |
| credit_owner_confirmed | numeric(5,4) | YES | 0 | |
| occurred_at | timestamptz | YES | now() | |
| created_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## clip_generation_jobs

**Purpose**: Tracks Klap-based short-clip generation from raw video footage.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| user_id | uuid | NOT NULL | — | FK → auth.users(id) ON DELETE CASCADE |
| business_id | uuid | NOT NULL | — | |
| source_video_url | text | NOT NULL | — | |
| source_storage_path | text | YES | — | |
| provider | text | NOT NULL | 'klap' | |
| external_job_id | text | YES | — | |
| status | text | NOT NULL | 'queued' | CHECK: queued/processing/completed/failed |
| clip_urls | text[] | NOT NULL | {} | |
| clip_count | integer | YES | — | |
| result_payload | jsonb | YES | — | |
| error_message | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: ALL scoped to `auth.uid() = user_id`

---

## webhook_receipts

**Purpose**: Idempotency store for external webhook callbacks — prevents duplicate state changes.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| provider | text | NOT NULL | — | e.g. 'creatomate', 'klap' |
| event_fingerprint | text | NOT NULL | — | Hash of event content |
| received_at | timestamptz | NOT NULL | now() | |
| payload_summary | text | YES | — | |

**Unique**: (provider, event_fingerprint)

**RLS**: Service role only (REVOKE ALL from PUBLIC; GRANT ALL to service_role)

**Functions**: `purge_old_webhook_receipts()` — deletes receipts older than 30 days

---

## business_events

**Purpose**: Unified, append-only event log for the Ricky closed-loop growth system. Every meaningful business lifecycle event is recorded here.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| contact_id | uuid | YES | — | Future FK to contacts |
| lead_id | uuid | YES | — | Future FK to leads |
| appointment_id | uuid | YES | — | Future FK to appointments |
| campaign_id | uuid | YES | — | Future FK to campaigns |
| experiment_id | uuid | YES | — | Future FK to growth_experiments |
| type | text | NOT NULL | — | e.g. 'lead.created', 'appointment.booked' |
| source | text | NOT NULL | 'ricky' | |
| payload | jsonb | NOT NULL | {} | |
| idempotency_key | text | YES | — | |
| occurred_at | timestamptz | NOT NULL | now() | |
| created_at | timestamptz | NOT NULL | now() | |

**Indexes**: (business_id, occurred_at DESC); (business_id, type, occurred_at DESC); (contact_id) partial; (lead_id) partial; (business_id, idempotency_key) unique partial

**RLS**: SELECT for business owner; no application-level UPDATE/DELETE — immutable append-only log

---

## agent_jobs

**Purpose**: Durable job queue for all background work Ricky performs on behalf of a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| job_type | text | NOT NULL | — | e.g. 'video_render', 'sms_send' |
| status | agent_job_status | NOT NULL | 'queued' | ENUM: queued/running/waiting_external/completed/retryable/failed/cancelled |
| priority | integer | NOT NULL | 5 | 1=highest, 10=lowest |
| input_json | jsonb | NOT NULL | {} | |
| output_json | jsonb | YES | — | |
| provider | text | YES | — | e.g. 'creatomate', 'twilio' |
| provider_job_id | text | YES | — | External reference |
| attempt_count | integer | NOT NULL | 0 | |
| max_attempts | integer | NOT NULL | 3 | |
| next_attempt_at | timestamptz | YES | — | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| last_error | text | YES | — | |
| idempotency_key | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Indexes**: queue worker index on (status, priority, next_attempt_at); stale index on (status, provider, updated_at); (business_id, status, created_at DESC); (provider, provider_job_id) partial; (business_id, idempotency_key) unique partial

**RLS**: SELECT for business owner

**Triggers**: `agent_jobs_updated_at` — keeps updated_at current

---

## contacts

**Purpose**: Customer/prospect contact records owned by a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| first_name | text | YES | — | |
| last_name | text | YES | — | |
| phone_e164 | text | YES | — | E.164 format |
| email | text | YES | — | |
| preferred_channel | text | YES | 'sms' | CHECK: sms/email/phone |
| sms_consent_status | text | YES | 'unknown' | CHECK: unknown/granted/revoked |
| email_consent_status | text | YES | 'unknown' | CHECK: unknown/granted/revoked |
| do_not_contact | boolean | YES | false | Hard stop on all outreach |
| customer_status | text | YES | 'prospect' | CHECK: prospect/lead/customer/inactive/lost |
| first_seen_at | timestamptz | YES | now() | |
| last_seen_at | timestamptz | YES | now() | |
| tags | text[] | YES | {} | |
| notes | text | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## leads

**Purpose**: Sales pipeline records linking contacts to specific business opportunities.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| source | text | YES | — | |
| campaign_id | uuid | YES | — | |
| status | text | YES | 'new' | CHECK: new/contacted/qualified/disqualified/converted/lost |
| service_interest | text | YES | — | |
| urgency | text | YES | 'medium' | CHECK: low/medium/high/emergency |
| qualification_status | text | YES | — | |
| estimated_value | numeric | YES | — | |
| lost_reason | text | YES | — | |
| created_at | timestamptz | YES | now() | |
| converted_at | timestamptz | YES | — | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## customer_memory

**Purpose**: AI-maintained memory of each contact's preferences and interaction history.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| contact_id | uuid | NOT NULL | — | PK + FK → contacts(id) ON DELETE CASCADE |
| summary | text | YES | — | AI-generated summary |
| known_preferences | jsonb | YES | {} | |
| prior_services | text[] | YES | {} | |
| open_issues | text[] | YES | {} | |
| last_interaction_summary | text | YES | — | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner (via contacts → businesses chain)

---

## business_knowledge

**Purpose**: Extracted facts about a business (services, hours, FAQs, policies) with confidence tracking.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| type | text | YES | 'general' | CHECK: service/hour/faq/policy/service_area/general |
| subject | text | NOT NULL | — | |
| value | jsonb | YES | {} | |
| source_url | text | YES | — | |
| confidence | numeric | YES | 0.5 | 0–1 |
| verification_status | text | YES | 'unverified' | CHECK: unverified/owner_verified/owner_corrected/owner_supplied/deprecated |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## website_research_jobs

**Purpose**: Tracks asynchronous website crawl-and-extract jobs that populate business_knowledge.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| url | text | NOT NULL | — | |
| status | text | YES | 'queued' | CHECK: queued/running/completed/failed |
| pages_found | integer | YES | 0 | |
| facts_extracted | integer | YES | 0 | |
| error | text | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## appointment_types

**Purpose**: Configurable appointment types for a business (service templates with duration and price).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | |
| duration_minutes | integer | YES | 60 | |
| buffer_minutes | integer | YES | 0 | |
| price_cents | integer | YES | 0 | |
| description | text | YES | — | |
| color | text | YES | '#6366f1' | |
| active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## availability_rules

**Purpose**: Weekly recurring availability slots for a business or location.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| day_of_week | integer | YES | — | CHECK: 0–6 (0=Sunday) |
| start_time | time | NOT NULL | — | |
| end_time | time | NOT NULL | — | |
| active | boolean | YES | true | |

**RLS**: ALL for business owner

---

## appointments

**Purpose**: Individual scheduled appointments between a business and a contact.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| lead_id | uuid | YES | — | FK → leads(id) ON DELETE SET NULL |
| appointment_type_id | uuid | YES | — | FK → appointment_types(id) ON DELETE SET NULL |
| staff_name | text | YES | — | |
| status | text | YES | 'requested' | CHECK: requested/confirmed/rescheduled/cancelled/completed/no_show |
| start_at | timestamptz | NOT NULL | — | |
| end_at | timestamptz | NOT NULL | — | |
| external_calendar_event_id | text | YES | — | |
| notes | text | YES | — | |
| reminder_sent_at | timestamptz | YES | — | |
| confirmation_sent_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## appointment_holds

**Purpose**: Temporary locks on time slots while a booking is in progress.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| appointment_type_id | uuid | YES | — | FK → appointment_types(id) ON DELETE SET NULL |
| start_at | timestamptz | NOT NULL | — | |
| end_at | timestamptz | NOT NULL | — | |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| expires_at | timestamptz | NOT NULL | — | |
| converted | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## calendar_connections

**Purpose**: OAuth connections to external calendars (Google Calendar, Outlook).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| provider | text | YES | — | CHECK: google/outlook |
| access_token_encrypted | text | YES | — | |
| refresh_token_encrypted | text | YES | — | |
| token_expiry | timestamptz | YES | — | |
| calendar_id | text | YES | — | |
| sync_enabled | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## phone_calls

**Purpose**: Records of inbound/outbound phone calls handled by Ricky Reception AI.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| lead_id | uuid | YES | — | FK → leads(id) ON DELETE SET NULL |
| call_sid | text | YES | — | Twilio call SID |
| from_number | text | YES | — | |
| to_number | text | YES | — | |
| direction | text | YES | 'inbound' | CHECK: inbound/outbound |
| status | text | YES | 'ringing' | CHECK: ringing/in_progress/completed/missed/failed |
| duration_seconds | integer | YES | 0 | |
| recording_url | text | YES | — | |
| transcript | text | YES | — | |
| summary | text | YES | — | AI-generated |
| outcome | text | YES | — | CHECK: appointment_booked/callback_requested/info_provided/escalated/no_action/spam |
| started_at | timestamptz | YES | — | |
| ended_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## phone_settings

**Purpose**: Per-business AI phone reception configuration (mode, voice, greeting).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | UNIQUE FK → businesses(id) ON DELETE CASCADE |
| phone_mode | text | YES | 'disabled' | CHECK: always_ai/after_hours/overflow/disabled |
| ai_number | text | YES | — | Twilio number assigned to Ricky |
| fallback_number | text | YES | — | |
| after_hours_start | time | YES | — | |
| after_hours_end | time | YES | — | |
| greeting_message | text | YES | — | |
| business_personality | text | YES | 'friendly' | CHECK: professional/friendly/formal/casual |
| voice_id | text | YES | — | ElevenLabs voice ID |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## lifecycle_automations

**Purpose**: Trigger-based automation sequences that send messages at defined intervals.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | |
| trigger_event | text | NOT NULL | — | e.g. 'lead.created', 'appointment.completed' |
| trigger_conditions | jsonb | YES | {} | |
| active | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## lifecycle_steps

**Purpose**: Individual steps within a lifecycle automation (delay, channel, template).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| automation_id | uuid | NOT NULL | — | FK → lifecycle_automations(id) ON DELETE CASCADE |
| step_order | integer | NOT NULL | — | |
| delay_minutes | integer | YES | 0 | Delay from previous step |
| channel | text | YES | 'sms' | CHECK: sms/email/internal |
| template | text | YES | — | Message template with variable interpolation |
| active | boolean | YES | true | |

**RLS**: ALL for business owner (via automation → businesses chain)

---

## automation_enrollments

**Purpose**: Tracks which contacts are enrolled in which automation sequences.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| automation_id | uuid | NOT NULL | — | FK → lifecycle_automations(id) ON DELETE CASCADE |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| lead_id | uuid | YES | — | FK → leads(id) ON DELETE SET NULL |
| status | text | YES | 'active' | CHECK: active/completed/exited |
| enrolled_at | timestamptz | YES | now() | |
| exited_at | timestamptz | YES | — | |
| exit_reason | text | YES | — | |

**RLS**: ALL for business owner

---

## automation_step_executions

**Purpose**: Records the execution state of each step for each enrolled contact.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| enrollment_id | uuid | NOT NULL | — | FK → automation_enrollments(id) ON DELETE CASCADE |
| step_id | uuid | NOT NULL | — | FK → lifecycle_steps(id) ON DELETE CASCADE |
| status | text | YES | 'pending' | CHECK: pending/sent/failed/skipped |
| scheduled_at | timestamptz | YES | — | |
| executed_at | timestamptz | YES | — | |
| provider_message_id | text | YES | — | |
| error | text | YES | — | |

**RLS**: ALL for business owner (via enrollment → businesses chain)

---

## messages

**Purpose**: All outbound and inbound SMS/email messages for a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| channel | text | YES | 'sms' | CHECK: sms/email |
| direction | text | YES | 'outbound' | CHECK: inbound/outbound |
| body | text | YES | — | |
| subject | text | YES | — | Email subject line |
| status | text | YES | 'queued' | CHECK: queued/sent/delivered/failed/replied/bounced |
| provider_message_id | text | YES | — | Twilio SID or SendGrid ID |
| automation_id | uuid | YES | — | FK → lifecycle_automations(id) ON DELETE SET NULL |
| campaign_id | uuid | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## offers

**Purpose**: Promotional offers (discounts, free estimates) created by a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | |
| type | text | YES | — | CHECK: percentage/fixed_amount/free_estimate/free_addon/priority_booking |
| value | numeric | YES | 0 | |
| minimum_purchase_cents | integer | YES | 0 | |
| service_ids | text[] | YES | {} | |
| valid_from | timestamptz | YES | — | |
| valid_until | timestamptz | YES | — | |
| redemption_limit | integer | YES | — | |
| per_customer_limit | integer | YES | 1 | |
| approval_status | text | YES | 'pending' | CHECK: pending/approved/rejected |
| active | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## offer_redemptions

**Purpose**: Records when a contact redeems an offer.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| offer_id | uuid | NOT NULL | — | FK → offers(id) ON DELETE CASCADE |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| lead_id | uuid | YES | — | FK → leads(id) ON DELETE SET NULL |
| redeemed_at | timestamptz | YES | now() | |
| value_applied | numeric | YES | 0 | |

**RLS**: ALL for business owner

---

## opportunities

**Purpose**: Estimates, quotes, and proposals sent to contacts with outcome tracking.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| lead_id | uuid | YES | — | FK → leads(id) ON DELETE SET NULL |
| type | text | YES | 'estimate' | CHECK: estimate/quote/proposal |
| value_cents | integer | YES | 0 | |
| status | text | YES | 'draft' | CHECK: draft/sent/viewed/accepted/declined/expired |
| external_reference | text | YES | — | |
| notes | text | YES | — | |
| sent_at | timestamptz | YES | — | |
| viewed_at | timestamptz | YES | — | |
| closed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## review_requests

**Purpose**: Post-appointment review request campaigns tracking status and sentiment.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| contact_id | uuid | YES | — | FK → contacts(id) ON DELETE SET NULL |
| appointment_id | uuid | YES | — | FK → appointments(id) ON DELETE SET NULL |
| status | text | YES | 'pending' | CHECK: pending/sent/responded/skipped |
| sent_at | timestamptz | YES | — | |
| response_sentiment | text | YES | — | CHECK: positive/neutral/negative |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## reactivation_campaigns

**Purpose**: Bulk reactivation campaigns targeting inactive customer segments.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| segment_type | text | YES | — | CHECK: inactive_90/inactive_180/maintenance_due/seasonal |
| status | text | YES | 'draft' | CHECK: draft/active/completed |
| contacts_targeted | integer | YES | 0 | |
| contacts_responded | integer | YES | 0 | |
| appointments_booked | integer | YES | 0 | |
| revenue_attributed_cents | bigint | YES | 0 | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## approvals

**Purpose**: Human-in-the-loop approval queue for high-risk AI-generated actions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| action_type | text | NOT NULL | — | |
| risk_level | text | YES | 'medium' | CHECK: low/medium/high |
| payload | jsonb | YES | {} | Full action details for review |
| human_summary | text | YES | — | |
| status | text | YES | 'pending' | CHECK: pending/approved/rejected/expired |
| expires_at | timestamptz | YES | — | |
| requested_at | timestamptz | YES | now() | |
| resolved_at | timestamptz | YES | — | |
| resolved_by | uuid | YES | — | FK → profiles(user_id) ON DELETE SET NULL |

**RLS**: ALL for business owner

---

## campaign_executions

**Purpose**: Tracks the execution metrics of a live campaign.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| campaign_id | uuid | YES | — | |
| status | text | YES | 'draft' | CHECK: draft/review/approved/scheduled/live/completed/paused |
| budget_cents | integer | YES | 0 | |
| spend_cents | integer | YES | 0 | |
| impressions | integer | YES | 0 | |
| clicks | integer | YES | 0 | |
| leads_generated | integer | YES | 0 | |
| appointments_booked | integer | YES | 0 | |
| revenue_attributed_cents | bigint | YES | 0 | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## landing_pages

**Purpose**: AI-generated campaign landing pages with submission tracking.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| campaign_id | uuid | YES | — | |
| slug | text | NOT NULL | — | URL slug |
| title | text | YES | — | |
| headline | text | YES | — | |
| offer_text | text | YES | — | |
| cta_text | text | YES | 'Get Started' | |
| active | boolean | YES | true | |
| views | integer | YES | 0 | |
| submissions | integer | YES | 0 | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## growth_experiments

**Purpose**: A/B experiments tracking hypothesis, variants, guardrails, and results.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | |
| hypothesis | text | YES | — | |
| experiment_family | text | YES | — | Cluster key for genome |
| status | text | YES | 'draft' | CHECK: draft/running/paused/completed/abandoned |
| control_description | text | YES | — | |
| treatment_description | text | YES | — | |
| metric | text | YES | — | e.g. 'conversion', 'booking_rate' |
| minimum_sample | integer | YES | 100 | |
| minimum_runtime_days | integer | YES | 7 | |
| guardrails | jsonb | YES | {} | |
| started_at | timestamptz | YES | — | |
| completed_at | timestamptz | YES | — | |
| winner | text | YES | — | CHECK: control/treatment/inconclusive/too_early |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## growth_experiment_variants

**Purpose**: Control and treatment variant definitions for a growth experiment.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| experiment_id | uuid | NOT NULL | — | FK → growth_experiments(id) ON DELETE CASCADE |
| name | text | NOT NULL | — | 'control' or 'treatment' |
| allocation_start | integer | NOT NULL | — | 0–9999 bucket range start |
| allocation_end | integer | NOT NULL | — | 0–9999 bucket range end |

**RLS**: ALL for business owner (via experiments chain)

---

## growth_experiment_exposures

**Purpose**: Records that a subject was assigned to a variant — one row per (subject, experiment).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| experiment_id | uuid | NOT NULL | — | FK → growth_experiments(id) ON DELETE CASCADE |
| variant_id | uuid | NOT NULL | — | FK → growth_experiment_variants(id) ON DELETE CASCADE |
| subject_id | text | NOT NULL | — | Any string ID (contact, session, etc.) |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| exposed_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## growth_experiment_outcomes

**Purpose**: Metric outcomes associated with a variant for statistical analysis.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| experiment_id | uuid | NOT NULL | — | FK → growth_experiments(id) ON DELETE CASCADE |
| variant_id | uuid | NOT NULL | — | FK → growth_experiment_variants(id) ON DELETE CASCADE |
| subject_id | text | NOT NULL | — | |
| metric_value | numeric | YES | — | |
| converted | boolean | YES | false | |
| occurred_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner (via experiments chain)

---

## growth_findings

**Purpose**: Distilled learnings from completed experiments for a business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| experiment_id | uuid | YES | — | FK → growth_experiments(id) ON DELETE SET NULL |
| finding_text | text | NOT NULL | — | |
| effect_estimate | numeric | YES | — | |
| confidence_level | text | YES | 'low' | CHECK: low/moderate/high |
| applicable_context | jsonb | YES | {} | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## growth_genome_settings

**Purpose**: Per-business settings for Growth Genome participation and data sharing.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | UNIQUE FK → businesses(id) ON DELETE CASCADE |
| participation_status | text | YES | 'disabled' | CHECK: disabled/read_only/contribute |
| use_network_insights | boolean | YES | false | |
| contribute_anonymized | boolean | YES | false | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## genome_contributions

**Purpose**: Anonymized, aggregated experiment data contributed to the cross-business network.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | Blinded before publication |
| experiment_family | text | YES | — | |
| context_industry | text | YES | — | |
| context_size_bucket | text | YES | — | e.g. 'solo', 'small' |
| context_geo_type | text | YES | — | e.g. 'urban', 'suburban' |
| metric | text | YES | — | |
| control_exposures | integer | YES | 0 | |
| control_conversions | integer | YES | 0 | |
| treatment_exposures | integer | YES | 0 | |
| treatment_conversions | integer | YES | 0 | |
| effect_estimate | numeric | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## genome_aggregate_findings

**Purpose**: Platform-wide aggregated findings from genome contributions — publicly readable.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| experiment_family | text | YES | — | |
| context_hash | text | YES | — | Hashed context for grouping |
| similar_businesses | integer | YES | 0 | |
| total_observations | integer | YES | 0 | |
| effect_estimate | numeric | YES | — | |
| uncertainty | numeric | YES | — | |
| evidence_level | text | YES | 'anecdotal' | CHECK: anecdotal/weak/moderate/strong |
| updated_at | timestamptz | YES | now() | |

**RLS**: SELECT for all (public leaderboard-style data)

---

## service_economics

**Purpose**: Expected revenue and cost metrics per service type for profit yield optimization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| service_name | text | NOT NULL | — | |
| expected_revenue_cents | integer | YES | 0 | |
| expected_direct_cost_cents | integer | YES | 0 | |
| expected_labor_hours | numeric | YES | 0 | |
| expected_labor_cost_cents | integer | YES | 0 | |
| expected_travel_cost_cents | integer | YES | 0 | |
| expected_gross_contribution_cents | integer | YES | 0 | |
| data_confidence | numeric | YES | 0.5 | |
| sample_size | integer | YES | 0 | |
| updated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## resource_capacity

**Purpose**: Tracks staff/equipment availability by date for scheduling and yield optimization.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| location_id | uuid | YES | — | FK → locations(id) ON DELETE SET NULL |
| resource_name | text | NOT NULL | — | |
| resource_type | text | YES | — | CHECK: technician/crew/chair/vehicle/room |
| date | date | NOT NULL | — | |
| available_minutes | integer | YES | 480 | Default: 8 hours |
| skills | text[] | YES | {} | |
| status | text | YES | 'available' | CHECK: available/booked/unavailable |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## yield_decisions

**Purpose**: Records each profit-yield engine decision with expected value and actual results.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| decision_time | timestamptz | YES | now() | |
| planning_horizon_start | date | YES | — | |
| planning_horizon_end | date | YES | — | |
| objective | text | YES | 'profit' | CHECK: profit/contribution/revenue |
| selected_actions | jsonb | YES | [] | |
| expected_value_cents | bigint | YES | 0 | |
| confidence | numeric | YES | 0.5 | |
| actual_result | jsonb | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## health_alerts

**Purpose**: Business health warnings and critical alerts surfaced by the monitoring system.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| type | text | NOT NULL | — | Alert type identifier |
| severity | text | YES | 'info' | CHECK: info/warning/critical |
| title | text | NOT NULL | — | |
| message | text | YES | — | |
| data | jsonb | YES | {} | |
| acknowledged | boolean | YES | false | |
| acknowledged_at | timestamptz | YES | — | |
| created_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## executive_briefs

**Purpose**: Periodic AI-generated executive summaries of business performance for owners.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| period_start | date | YES | — | |
| period_end | date | YES | — | |
| revenue_attributed_cents | bigint | YES | 0 | |
| appointments_booked | integer | YES | 0 | |
| leads_recovered | integer | YES | 0 | |
| top_campaign | text | YES | — | |
| hours_saved_estimate | numeric | YES | 0 | |
| pending_approvals | integer | YES | 0 | |
| current_experiment | text | YES | — | |
| next_recommended_action | text | YES | — | |
| generated_at | timestamptz | YES | now() | |

**RLS**: ALL for business owner

---

## audit_logs

**Purpose**: Immutable, append-only audit trail of all significant actions across the system. Never update or delete rows.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | YES | — | FK → businesses(id) ON DELETE SET NULL |
| actor_id | uuid | YES | — | auth.uid() of acting user or service |
| actor_type | text | NOT NULL | 'user' | CHECK: user/system/edge_function/webhook |
| action | text | NOT NULL | — | e.g. 'automation.updated', 'offer.approved' |
| target_type | text | YES | — | e.g. 'lifecycle_automation', 'offer' |
| target_id | uuid | YES | — | ID of the affected entity |
| metadata | jsonb | YES | {} | |
| ip_address | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |

**Indexes**: (business_id, created_at DESC); (actor_id, created_at DESC); (action, created_at DESC)

**RLS**: SELECT for business owner; INSERT via service role only — no application-level UPDATE/DELETE.

---

## business_integrations

**Purpose**: Registry of external service integrations (Google Calendar, Twilio, etc.) per business.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| business_id | uuid | NOT NULL | — | FK → businesses(id) ON DELETE CASCADE |
| provider | text | NOT NULL | — | e.g. 'google_calendar', 'twilio', 'sendgrid' |
| integration_type | text | NOT NULL | — | e.g. 'calendar', 'voice', 'email', 'sms' |
| status | text | NOT NULL | 'disconnected' | CHECK: connected/degraded/disconnected/reconnect_required |
| display_label | text | YES | — | User-visible name |
| configuration | jsonb | YES | {} | Non-secret config (scopes, IDs) |
| credential_reference | text | YES | — | Opaque reference to server-side secret |
| last_checked_at | timestamptz | YES | — | |
| last_success_at | timestamptz | YES | — | |
| last_error_code | text | YES | — | |
| last_error_detail | text | YES | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Unique**: (business_id, provider, integration_type)

**Indexes**: (status, last_checked_at)

**RLS**: ALL for business owner

**Triggers**: `trg_integration_updated_at`

---

## feature_flags

**Purpose**: Platform-level feature flag registry controlling rollout stages per feature.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| flag_key | text | NOT NULL | — | UNIQUE; e.g. 'growth_lab', 'ricky_reception' |
| description | text | YES | — | |
| stage | text | NOT NULL | 'disabled' | CHECK: disabled/internal/beta/ga |
| enabled_for_all | boolean | NOT NULL | false | Platform-wide override |
| overrides | jsonb | NOT NULL | {} | Per-business overrides: {"business_id": true/false} |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**RLS**: No client-facing RLS — read by edge functions via service role only

**Triggers**: `trg_feature_flag_updated_at`

**Seeded flags**: ricky_reception, ricky_email, growth_lab, growth_genome, profit_yield, easystart_v2, ricky_chat_action, website_research
