# Architecture — Ricky AI

Ricky AI is a closed-loop AI growth and profit operating system for small and local businesses.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite SPA, TypeScript, Tailwind CSS, shadcn/ui |
| Routing | React Router v6 |
| Data fetching | TanStack Query (server state), React context (auth/subscription) |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase/Postgres with Row-Level Security |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (media bucket) |
| Billing | Stripe Subscriptions |
| Video rendering | Creatomate (API + webhook) |
| Voice/phone | Twilio (SMS, PSTN, SIP) + OpenAI Realtime |
| Email | SendGrid (transport adapter) |
| AI generation | OpenAI (Claude fallback) |
| Testing | Vitest |
| Deployment | Vercel (frontend), Supabase (backend) |

---

## System Boundaries

```
BROWSER (React SPA)
  └── Supabase anon client (RLS-enforced)
  └── API calls → Edge Functions (authenticated via JWT)

EDGE FUNCTIONS (Deno/Supabase)
  └── Supabase service-role client (bypasses RLS — server-side only)
  └── Provider SDKs: OpenAI, Stripe, Twilio, Creatomate, SendGrid

BACKGROUND / CRON (pg_cron + pg_net)
  └── reconcile-renders (every 10 min)
  └── Future: appointment reminders, health checks, brief generation

WEBHOOK ENDPOINTS (public, secret-authenticated)
  └── video-callback (Creatomate)
  └── clip-callback (Klap)
  └── handle-call (Twilio)
```

**Key rule**: Service-role credentials NEVER leave the server. The browser only holds the anon key (intentionally public).

---

## Frontend Architecture

### Auth flow
`AuthProvider` → `BrowserRouter` → `ProtectedRoute` → `BanCheck` → `TermsAcceptanceGate` → `Dashboard`

`AuthContext` calls `check-subscription` on login and every 60s. `hasAccess = subscribed || trialActive` gates the dashboard.

### Dashboard step system
`Dashboard.tsx` renders a 15-step business workflow plus Ricky OS sections:

**Core 15 steps**: Connect → Profile → Compete → Scout → Audit → Platform → Script → VideoStudio → Storyboard → Export → LeadScout → GrantSearch → SearchVisibility → CampaignBlueprint → OmniOptimize

**Ricky OS sections** (non-numbered, sidebar-driven): EasyStart, Knowledge, Contacts, Reception, Scheduling, Messaging, Automations, Offers, Pipeline, Retention, Approvals, Campaigns, GrowthLab, GrowthGenome, ProfitYield, Health, Brief

### State persistence
| Key | Contents |
|---|---|
| `rickyai-dashboard-state` | `{ activeStep, activeSection, completedSteps }` |
| `rickyai-business-selection` | `{ businessId, locationId }` |
| `rickyai-video-studio-state-{businessId}` | script, approvedScript, lengthMode |

---

## Database

See `DATABASE.md` for full schema reference.

Core principles:
- All tenant tables have `business_id` foreign key to `businesses`
- Row-Level Security enabled on all tables
- `user_id` in `businesses` is the ownership anchor — all RLS policies trace back to it
- Timestamps are `timestamptz` (UTC) everywhere
- Phone numbers stored as E.164

---

## Event Engine

`business_events` is an append-only immutable log of all meaningful business activities. It feeds:
- Lifecycle automation triggers
- Growth Lab outcome collection
- Analytics attribution
- Executive Brief generation
- Business Health monitoring

Events are never updated or deleted.

---

## Job System

`agent_jobs` is a durable background job queue. Statuses:
`queued` → `running` → `completed` | `retryable` → `failed` | `cancelled`

Retryable jobs have `next_attempt_at` set by exponential backoff. Workers claim jobs via UPDATE with `status = 'running'` WHERE `status = 'queued' AND next_attempt_at <= now()`.

---

## Video Pipeline

1. `VideoStudioStep` invokes `generate-video-v2` edge function
2. Function creates `video_generation_jobs` row (status: `queued`)
3. Function dispatches to Creatomate, stores `creatomate_render_id`, exits (status: `waiting_external`)
4. Creatomate POSTs to `video-callback` on completion
5. `video-callback` verifies, idempotently marks `status: completed` with `video_url`
6. `reconcile-renders` cron (every 10 min) repairs any jobs where webhook was missed

**BYO Creatomate**: Users can supply their own API key via `user_api_keys` table. `generate-video-v2` and `reconcile-renders` check this table first, falling back to the platform key.

---

## Subscription Tiers

| Plan | Price | Key capabilities |
|---|---|---|
| Creator | $59/mo | Core 15 steps, 1 business, 3 locations |
| Business Starter | $169/mo | + Ricky OS features, 3 businesses |
| Growth | $249/mo | + Growth Lab, Profit Yield, 10 businesses |
| Agency | $799/mo | Full platform, unlimited businesses |
| Federal Contracting add-on | $50/mo | Federal contracting step |
| Grant Intelligence add-on | $50/mo | Grant search + intelligence |

Entitlement checks go through `check-subscription` edge function — never trust client-side state alone.

---

## Security Model

- JWT required on all edge functions except public webhook endpoints
- Public webhooks authenticated via pre-shared secret in `?secret=` query param (constant-time comparison)
- All Postgres mutations enforced by RLS; service-role key only used server-side
- BYO API keys encrypted at rest via AES-256-GCM (`credential-service.ts`)
- Webhook idempotency via `webhook_receipts` table (UNIQUE on provider + fingerprint)
- Audit trail via `audit_logs` (immutable, append-only)

---

## Provider Adapters

Provider integrations are wrapped in server-side edge functions. No SDK credentials reach the browser:

| Provider | Edge Function(s) |
|---|---|
| Creatomate | `generate-video-v2`, `video-callback`, `reconcile-renders` |
| OpenAI | `ai-strategy`, `ricky-chat`, `research-website`, `generate-brief` |
| Stripe | `create-checkout`, `customer-portal`, `check-subscription` |
| Twilio | `handle-call`, `send-message` |
| Anthropic/Claude | `ai-strategy` (fallback) |

---

*Last updated: 2026-09-03. Always check source code — this document follows the code, not vice versa.*
