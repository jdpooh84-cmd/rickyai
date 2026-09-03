# Protected Project Contracts — RickyAI

Claude must read this file before major edits.

## Project Identity

- **App**: RickyAI — AI Growth & Profit Operating System for Small and Local Businesses
- **Supabase project ref**: `psmxeckstfeyxlqzzkgw`
- **Supabase URL**: `https://psmxeckstfeyxlqzzkgw.supabase.co`
- **Frontend (Vercel — canonical)**: `https://rickyai.vercel.app`
- **Frontend (Netlify — blocked)**: `https://lighthearted-crostata-834a8e.netlify.app` (build credits exhausted — do not deploy here)
- **GitHub**: `https://github.com/jdpooh84-cmd/rickyai`
- **Stripe account**: `acct_1TEumfRUytwslneZ`

---

## Protected Edge Functions

These functions are live in production. Do not rename, remove, or change their HTTP contract without approval.

| Function | Purpose |
|---|---|
| `generate-video-v2` | Main video pipeline — AI script + Creatomate render |
| `video-callback` | Webhook receiver for Creatomate render completion |
| `reconcile-renders` | Cron-driven sweep that repairs stale Creatomate jobs |
| `create-checkout` | Creates Stripe checkout session + Stripe customer |
| `customer-portal` | Creates Stripe billing portal session |
| `check-subscription` | Returns current subscription + trial state |
| `ai-strategy` | AI-powered strategy generation |
| `ricky-chat` | AI chat assistant |
| `campaign-blueprint` | Campaign planning |

**Contract**: All edge functions must return JSON. Error responses must include `{ "error": "message" }`. HTTP 200 for success, 4xx/5xx for errors.

**Contract**: All edge functions must use `npm:` import specifiers (not `esm.sh` URLs). `esm.sh` causes EarlyDrop on cold start.

---

## Protected Stripe Contracts

**Stripe account**: `acct_1TEumfRUytwslneZ`

Price IDs are account-scoped. These are the live price IDs — do not change without verifying against the Stripe dashboard.

| Plan | Price ID | Product ID | Price |
|---|---|---|---|
| Creator | `price_1TeGX2RUytwslneZ7OMOagHD` | `prod_UDep9PW3ELRa6K` | $59/mo |
| Business Starter | `price_1TeGX2RUytwslneZLs6JpyHL` | `prod_UDepZzB9GKoPnY` | $169/mo |
| Growth | `price_1TeGX1RUytwslneZpYfpkgXd` | `prod_UDepPmrMY3zOEX` | $249/mo |
| Agency | `price_1TeGX1RUytwslneZCWA5jEqx` | `prod_UDeqmytH227V3p` | $799/mo |
| Federal Contracting add-on | `price_1TeGX3RUytwslneZ98JVVxM0` | `prod_UEZOQ0OGfVdYPi` | $50/mo |
| Grant Intelligence add-on | `price_1TeGX1RUytwslneZ29hrgbs3` | `prod_UEZOL1ICzSWAnt` | $50/mo |

**Contract**: Stripe webhook verification must remain enabled in production.

**Contract**: Paid features must not unlock without confirmed payment state checked server-side.

**Contract**: Subscription status must be verified via `check-subscription` edge function, never trusted from client-side state alone.

**Contract**: `create-checkout` must create a Stripe customer eagerly (before checkout completes) so `customer-portal` works immediately after checkout is initiated.

**Contract**: `customer_update` in checkout sessions must include `{ address: "auto", name: "auto" }` when `tax_id_collection` is enabled — Stripe requires it.

---

## Protected Database Tables

These tables exist in the live Supabase project. Do not rename columns, drop tables, or change primary keys without a migration and approval.

| Table | Key columns | Notes |
|---|---|---|
| `businesses` | `id`, `user_id`, `business_name`, `business_category` | Core business profile |
| `locations` | `id`, `business_id`, `user_id`, `city`, `state` | Per-business locations |
| `video_generation_jobs` | `id`, `user_id`, `business_id`, `status`, `pipeline_stage`, `result_payload`, `creatomate_render_id` | Video job tracking |
| `content_posts` | `id`, `user_id`, `business_id`, `production_tool` | Published content |
| `business_media` | `id`, `business_id`, `public_url`, `file_type`, `shot_type` | Uploaded assets |
| `strategy_outputs` | `id`, `business_id`, `user_id`, `step_number`, `output_data` | Strategy step results |
| `user_api_keys` | `id`, `user_id`, `provider`, `api_key_encrypted`, `is_valid` | BYOLLM keys |
| `user_tool_defaults` | `id`, `user_id`, `tool_type`, `default_provider` | User preferences |
| `business_events` | `id`, `business_id`, `type`, `source`, `payload`, `occurred_at` | Immutable event log — never update/delete |
| `agent_jobs` | `id`, `business_id`, `job_type`, `status`, `provider_job_id` | Durable background job queue |
| `webhook_receipts` | `provider`, `event_fingerprint` | Idempotency store for webhook callbacks |

**Contract**: `users.id` (from Supabase auth) is the primary user identifier throughout the app.

**Contract**: Row-level security must remain enabled. Never bypass RLS.

**Contract**: `video_generation_jobs.status` values: `queued`, `generating_script`, `generating_images`, `generating_voiceover`, `rendering_video`, `processing`, `completed`, `failed`.

---

## Protected Storage Contracts

- Bucket: `media` (public)
- Voiceover path: `voiceovers/{user_id}/{job_id}.mp3`
- Scene images: `scenes/{user_id}/{job_id}/scene-{n}.png`
- Output video: `videos/{user_id}/{job_id}/output.mp4`

Do not change storage paths without updating all references in `generate-video-v2`, `video-callback`, and the render worker.

---

## Protected Auth Rules

- No admin route may be accessible without an authenticated admin user.
- Never bypass row-level security.
- Never trust client-side role claims alone.
- Auth token is always passed as `Authorization: Bearer <token>` header.

---

## Protected Webhook Contracts

- `video-callback` receives Creatomate webhooks in this shape: array of render objects where `renders[0].status` is `"succeeded"` or `"failed"`, `renders[0].url` is the video URL, and `renders[0].metadata` is a JSON string containing `{ "job_id": "..." }`.
- Webhook must also handle legacy Make.com format: `{ job_id, status: "completed", video_url }`.
- Never require webhook signature verification to be the only gate — also validate job_id exists in DB.

---

## Protected Frontend Routes

- `/` — landing page
- `/login` — auth
- `/signup` — onboarding + checkout
- `/app` — main dashboard (authenticated)
- `/app?checkout=success` — post-checkout redirect
- `/signup?checkout=cancelled` — cancelled checkout redirect

---

## Protected Deployment Rules

- Do not change the Netlify deploy without approval.
- Do not change production build command (`npm run build`) without approval.
- Do not rename environment variables without updating Supabase secrets and Netlify env vars.
- The Supabase CLI binary lives at `C:\Users\jodan\supabase-bin\supabase.exe` — do not use `npx supabase` for deploys.

---

## Protected Security Rules

- Never read or print `.env` files unless explicitly requested.
- Never commit secrets, tokens, or API keys.
- Never hardcode API keys in source files.
- Never weaken validation to make a test pass.
- Never disable auth, RLS, CORS protections, or webhook verification without approval.
- `settings.local.json` contains allowed shell commands — do not add secrets to it.

---

## Protected Data Integrity Contracts

- `audit_logs` table is **append-only** — no UPDATE or DELETE is permitted at the application level. Only service_role may INSERT. RLS enforces SELECT for business owner only.
- `business_events` table is **append-only** — no UPDATE or DELETE is permitted at the application level. Edge functions use service_role to insert. The table comment explicitly states immutability.

---

## Protected Shared Validation API

`supabase/functions/_shared/validate.ts` exports the following stable interface. Do not change these signatures without updating every edge function that imports them.

```typescript
requireUuid(value: unknown, field: string): string
requireString(value: unknown, field: string, maxLen?: number): string
requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T
validate<T>(fn: () => T): T | Response
```

Additional helpers (`optionalString`, `optionalInt`, `requirePositiveInt`, `badRequest`) are also exported and must not change signatures without auditing all callers.

---

## Protected Growth Intelligence Return Type

`getGrowthIntelligence(businessId: string): Promise<GrowthIntelligence>` in `src/lib/growth-intelligence.ts` must return a stable `GrowthIntelligence` type. Adding new optional fields is acceptable. Removing or renaming existing fields (`available`, `compete`, `scout`, `lastUpdatedAt`) is a breaking change requiring a codebase-wide audit of all callers.
