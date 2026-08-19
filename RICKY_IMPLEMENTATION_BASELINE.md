# RICKY_IMPLEMENTATION_BASELINE.md

**Created:** 2026-08-19  
**Branch:** `claude/rickyai-byo-creatomate-api-c9c4ka`  
**Source:** Live repository inspection + August 2026 capability dossier cross-reference  
**Authority:** Live repository beats all other sources including this document.

---

## 1. REPOSITORY STRUCTURE

```
rickyai/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── steps/          # One component per step (15 steps + sidebar sections)
│   │   │   └── shared/         # Shared dashboard sub-components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   └── auth/               # Auth forms
│   ├── contexts/               # AuthContext
│   ├── hooks/                  # useBusinessData, etc.
│   ├── integrations/supabase/  # Generated client + types
│   ├── lib/                    # Domain logic (attribution, gamification, stripe, etc.)
│   ├── pages/                  # React Router page components
│   └── test/                   # Vitest test files
├── supabase/
│   ├── functions/              # 22 Deno Edge Functions
│   ├── migrations/             # 25 SQL migrations (tracked from 2026-03-25)
│   └── config.toml             # Function JWT settings
├── docs/
│   └── build-review.md
├── public/
├── package.json
├── vite.config.ts
└── CLAUDE.md
```

---

## 2. DEPLOY TOPOLOGY

| Component | Platform | URL / Ref |
|---|---|---|
| Frontend | Vercel | rickyai.vercel.app |
| Database | Supabase Postgres | Project ref: **psmxeckstfeyxlqzzkgw** (CLAUDE.md) |
| Edge Functions | Supabase Deno runtime | Same project |
| Storage | Supabase Storage | Bucket: `media` |
| Auth | Supabase Auth (JWT) | Same project |
| Billing | Stripe | Account: `acct_1TEumfRUytwslneZ` |

**Config discrepancy:** `supabase/config.toml` still contains `project_id = "symbyrtzimafpxbzurjh"` (old/wrong ref). Live project is `psmxeckstfeyxlqzzkgw`. This does not affect runtime (config.toml is for local CLI) but is misleading. → See Phase 0 Audit.

---

## 3. FRONTEND FRAMEWORK & DEPENDENCIES

**Framework:** React 18.3.1 + Vite 5.4.19 + TypeScript 5.8.3  
**Build:** `@vitejs/plugin-react-swc` (SWC compiler)  
**Routing:** React Router DOM 6.30.1  
**State:** React Context + TanStack Query 5.83.0 + localStorage  
**Styling:** Tailwind CSS 3.4.17 + shadcn/ui (Radix UI primitives)  
**Forms:** react-hook-form 7.61.1 + zod 3.25.76  
**Charts:** recharts 2.15.4  
**Toasts:** sonner 1.7.4  
**Markdown:** react-markdown 10.1.0  
**PWA:** vite-plugin-pwa 1.2.0  
**Testing:** Vitest 3.2.4 + @testing-library/react 16 + @playwright/test 1.57.0  

### React Runtime Inventory (for migration planning)
Every UI component is React. React-specific coupling includes:
- All `src/components/**` use JSX, hooks, and React lifecycle
- All 20+ Radix UI primitives are React-only (`@radix-ui/react-*`)
- `react-hook-form`, `react-day-picker`, `react-resizable-panels`, `embla-carousel-react`, `lucide-react` are all React-bound
- `@testing-library/react` tests are React-specific
- `next-themes` is React Context-based (light/dark toggle)
- `@tanstack/react-query` has a React-specific adapter (framework-neutral core exists)

### Framework-Neutral Assets (preserved in migration)
- `src/lib/attribution.ts` — pure TypeScript, no React
- `src/lib/gamification.ts` — pure TypeScript, no React
- `src/lib/stripe.ts` — pure TypeScript, no React
- `src/lib/optimizationLayers.ts` — pure TypeScript, no React
- `src/lib/videoComposer.ts` — browser Canvas/MediaRecorder, framework-neutral
- `src/lib/persistence.ts` — pure localStorage wrapper
- `src/integrations/supabase/client.ts` — Supabase JS client, framework-neutral
- `src/integrations/supabase/types.ts` — TypeScript types, framework-neutral
- All Tailwind CSS utilities and design tokens
- All Supabase Edge Functions (Deno, framework-neutral)
- All Supabase migrations (SQL)
- Stripe integration logic

---

## 4. EDGE FUNCTIONS (22 TOTAL)

### Confirmed Active (called by frontend or webhooks)

| Function | JWT | Purpose |
|---|---|---|
| `generate-video-v2` | required | Full video pipeline (BYO Creatomate key) |
| `video-callback` | **false** | Creatomate render completion webhook |
| `clip-video` | required | Submit footage to Klap |
| `clip-callback` | **false** | Klap clip completion webhook |
| `check-subscription` | required | Validates Stripe sub every 60s |
| `ricky-chat` | required | AI chat (25-question cap) |
| `ai-strategy` | required | Steps 3–15 AI content |
| `campaign-blueprint` | required | Step 14 campaign planning |
| `rewrite-script` | required | Script rewrite/variation |
| `webhook-proxy` | required | Make.com dispatch |
| `stripe-webhook` | **false** (Stripe signs) | Stripe payment events |
| `create-checkout` | required | Stripe checkout session |
| `customer-portal` | required | Stripe customer portal |
| `grant-intel` | required | Grant intelligence content |
| `grant-consultant` | required | Grant consultant AI |
| `federal-contracting` | required | Federal contracting AI |
| `admin-stats` | required | Admin analytics (platform-level) |
| `admin-users` | required | Admin user management |
| `get-signed-video-url` | required | Signed storage URL for private video |
| `track-referral` | required | Referral tracking |

### Confirmed Dead / Legacy

| Function | Reason |
|---|---|
| `generate-video` | Uses `esm.sh` imports (EarlyDrop on cold start), references Manus AI + Make.com pipeline |
| `create-template` | One-time Creatomate template setup utility, never called from frontend |
| `debug-template` | Hardcoded template ID, diagnostic only |

**Import rule:** All active functions use `npm:` specifiers. `generate-video` violates this.

---

## 5. SUPABASE SCHEMA (KEY TABLES)

25 migrations spanning 2026-03-25 → 2026-07-31. RLS enabled on all public tables (migration `20260609000000_enable_rls_all_public_tables.sql`).

| Table | RLS | Key Columns |
|---|---|---|
| `profiles` | yes | user_id, is_test_account, is_banned, ricky_question_count, ricky_limit_reached |
| `businesses` | yes | user_id, name, industry, description, tone, target_audience |
| `locations` | yes | business_id, address, city, state |
| `user_api_keys` | yes | user_id, provider, api_key_encrypted, is_valid, updated_at |
| `video_generation_jobs` | yes | user_id, business_id, status, job_id, video_url, error_message, creatomate_render_id |
| `clip_generation_jobs` | yes | user_id, business_id, status, clip_urls (jsonb), error_message, is_test_account |
| `subscriptions` | yes | user_id, stripe_customer_id, stripe_subscription_id, product_id, status |
| `campaign_outcomes` | yes | business_id, attribution model fields, outcome metrics |
| `user_points` | yes | user_id, balance |
| `point_history` | yes | user_id, event_type, points, created_at |
| `user_badges` | yes | user_id, badge_id, earned_at |
| `community_posts` | yes | user_id, business_id, content |
| `marketplace_listings` | yes | user_id, business_id |

Storage bucket `media`: stores raw-footage uploads and business media library files.

---

## 6. STRIPE PLANS & BILLING

Source of truth: `src/lib/stripe.ts`  
Stripe account: `acct_1TEumfRUytwslneZ`

| Plan | Monthly | Steps | Brands | Locations |
|---|---|---|---|---|
| Creator | $59 | 1–8 | 1 | 1 |
| Business Starter | $169 | 1–12 | 3 | 3 |
| Growth | $249 | 1–14 | 10 | 10 |
| Agency | $799 | 1–15 | Unlimited | Unlimited |
| Federal Contracting add-on | +$50 | — | — | — |
| Grant Intelligence add-on | +$50 | — | — | — |
| Enterprise | $1,500–$5,000 | All | Custom | Custom |

Nonprofit discount: 15%.  
Bypass mechanisms: `profiles.is_test_account = true` (full Agency access, skips Stripe); `product_id = "admin_bypass"` (Agency access without payment).  
`check-subscription` polls every 60 seconds from `AuthContext`.

---

## 7. AI PROVIDERS & PROMPTS

| Provider | Used By | Model | Key Source |
|---|---|---|---|
| Anthropic (Claude) | `generate-video-v2`, `ricky-chat`, `ai-strategy`, `rewrite-script`, `campaign-blueprint`, `grant-intel`, `federal-contracting`, `grant-consultant` | `claude-sonnet-4-20250514` | Platform env var `ANTHROPIC_API_KEY` |
| Creatomate | `generate-video-v2` (render), `video-callback` | API v2 | User BYO key (`user_api_keys.provider = "creatomate"`) |
| ElevenLabs | Via Creatomate TTS (not direct call) | multilingual_v2, voice 21m00Tcm4TlvDq8ikWAM | Included in Creatomate render spec |
| Pexels | `generate-video-v2` (stock footage fallback) | Search API | Platform env var |
| Klap | `clip-video` | Klap API | User BYO key (`provider = "klap"`) |
| Gemini | Listed in UI, BYO key saved | Not observed in any active edge function | User BYO key only |

Script generation in `generate-video-v2`:
- Business DNA analysis → AI prompt construction → Claude structured output
- Self-correction: 3 attempts, 9 detectable issue types, `applyScriptFixes()` patches
- Deterministic fallback: `buildScriptFromProfile()` always succeeds
- AI image generation: permanently disabled (`if (false && ...)`)

---

## 8. EXISTING FEATURE MAP (15 STEPS)

| Step | Component | Edge Function(s) | Status |
|---|---|---|---|
| 1 | Connect | none | Informational links only |
| 2 | Profile | none | Form → `businesses` table |
| 3 | Compete | `ai-strategy` | Active |
| 4 | Scout | `ai-strategy` | Active |
| 5 | Audit | `ai-strategy` | Active |
| 6 | Platform | none | Informational |
| 7 | Script | `ai-strategy` | Active |
| 8 | VideoStudio | `generate-video-v2`, `rewrite-script` | Active (core product) |
| 9 | Storyboard | none | Client-side review |
| 10 | Export | none | Download from `video_url` |
| 11 | LeadScout | `ai-strategy` | Active |
| 12 | GrantSearch | `ai-strategy` / `grant-intel` | Active |
| 13 | SearchVisibility | `ai-strategy` | Active |
| 14 | CampaignBlueprint | `campaign-blueprint` | Active |
| 15 | OmniOptimize | `ai-strategy` | Active (all 12 pillars) |

**Sidebar sections:** `score`, `performance`, `community`, `marketplace`, `ready`, `watch`, `connect-tools`, `federal-contracting`, `grant-intel`, `grant-consultant`

---

## 9. DOSSIER CROSS-REFERENCE

| Dossier Claim | Verdict | Notes |
|---|---|---|
| React 18 + Vite SPA | `DOSSIER ACCURATE` | Confirmed: react 18.3.1, vite 5.4.19 |
| Supabase Postgres + Auth + Storage + Deno | `DOSSIER ACCURATE` | Confirmed |
| Stripe billing with 4 plans + 2 add-ons | `DOSSIER ACCURATE` | Confirmed via package.json + stripe.ts |
| 15-step dashboard driven by activeStep | `DOSSIER ACCURATE` | Confirmed |
| generate-video-v2 async job pattern | `DOSSIER ACCURATE` | Confirmed |
| claude-sonnet-4-20250514 for scripts | `DOSSIER ACCURATE` | Confirmed |
| Self-correction loop, 3 attempts, 9 types | `DOSSIER ACCURATE` | Confirmed |
| Deterministic fallback buildScriptFromProfile | `DOSSIER ACCURATE` | Confirmed |
| AI image generation permanently disabled | `DOSSIER ACCURATE` | Confirmed (if false guard) |
| BYO key table user_api_keys | `DOSSIER ACCURATE` | Confirmed |
| api_key_encrypted stored as plaintext | `DOSSIER ACCURATE` | No vault/decrypt call found |
| video-callback + clip-callback: verify_jwt=false | `DOSSIER ACCURATE` | Confirmed in config.toml |
| No webhook HMAC verification | `DOSSIER ACCURATE` | Confirmed by source inspection |
| Race condition in webhook-proxy | `DOSSIER ACCURATE` | select-then-update pattern confirmed |
| rewrite-script const reassignment bug | `DOSSIER ACCURATE` | Confirmed |
| Social auto-posting: UI only, no pipeline | `DOSSIER ACCURATE` | Zero OAuth flows for social platforms |
| Klap clipping pipeline (clip-video/clip-callback) | `DOSSIER ACCURATE` | Confirmed; clip_generation_jobs table exists |
| 22 edge functions | `REPOSITORY HAS MORE` | Dossier listed ~15; repo has 22. Additional confirmed: admin-stats, admin-users, federal-contracting, get-signed-video-url, grant-consultant, grant-intel, track-referral |
| Ricky chat 25-question cap | `DOSSIER ACCURATE` | Confirmed QUESTION_LIMIT = 25 |
| Gamification: 10 levels, 11 badges, 7 point events | `DOSSIER ACCURATE` | Confirmed |
| 12-pillar optimization framework | `DOSSIER ACCURATE` | Confirmed in optimizationLayers.ts |
| 5 attribution models | `DOSSIER ACCURATE` | Confirmed in attribution.ts |
| supabase/config.toml project_id = symbyrtzimafpxbzurjh | `IMPLEMENTATION CHANGED` | Old project ref still in config.toml; live project is psmxeckstfeyxlqzzkgw |
| Netlify blocked by build credits | `DOSSIER ACCURATE` | CLAUDE.md confirms |
| Dead code: generate-video, create-template, debug-template | `DOSSIER ACCURATE` | Confirmed |
| vite-plugin-pwa present | `REPOSITORY HAS MORE` | PWA capability exists; not mentioned in dossier |
| @playwright/test in devDeps | `REPOSITORY HAS MORE` | E2E test tooling present but unknown coverage |
| Gemini key saved but not used in pipeline | `DOSSIER ACCURATE` | No Gemini API call found in active functions |

---

## 10. KNOWN DEAD CODE & TECHNICAL DEBT

- `generate-video` — esm.sh imports, Manus AI references, Make.com-based old pipeline
- `create-template` — one-time utility, never safe to call in production
- `debug-template` — hardcoded template ID
- AI image generation block in `generate-video-v2` (`if (false && ...)`)
- `supabase/config.toml` has stale project ref
- `api_key_encrypted` column name misleads; values are plaintext
- `webhook-proxy` non-atomic usage increment
- `rewrite-script` `const providerUsed` reassignment in catch block

---

## 11. TEST COVERAGE

- Test framework: Vitest + @testing-library/react + @playwright/test
- `src/test/` directory exists; coverage of domain logic unknown from inspection
- No CI configuration file observed (no `.github/workflows/`, no `vercel.json` CI step visible)
- `npm run test` runs Vitest once; `npm run test:watch` watches

---

## 12. OBSERVABILITY

- No structured logging/tracing framework observed in frontend or edge functions
- No error tracking integration observed (no Sentry, Datadog, etc.)
- Toast notifications provide user-visible errors only
- Console logging in edge functions for debug

---

## 13. ACCESSIBILITY BASELINE

- shadcn/ui (Radix UI) provides ARIA primitives for interactive components
- No formal WCAG audit performed
- No `prefers-reduced-motion` hooks observed in video/animation components
- keyboard navigation: inherited from Radix UI for standard components
- Custom dashboard step navigation: unknown keyboard path

---

_Last updated: 2026-08-19. Update this document whenever a verified fact changes._
