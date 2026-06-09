# PROJECT_SUMMARY.md — RickyAI Reconnaissance Report
Generated: 2026-06-09

---

## Framework and Version

| Item | Value |
|---|---|
| Framework | React 18.3.1 + Vite 5.4.19 |
| Language | TypeScript 5.8.3 |
| UI | Tailwind CSS 3.4 + shadcn/ui (Radix primitives) |
| Routing | React Router v6.30 |
| State / Data | TanStack Query v5.83 |
| Testing | Vitest 3.2.4 |
| PWA | vite-plugin-pwa 1.2.0 |

---

## Package Manager

**npm** (lockfile: `package-lock.json`)

---

## Database and ORM

- **Database**: Supabase Postgres (`psmxeckstfeyxlqzzkgw`)
- **Client**: `@supabase/supabase-js` v2.100.0 — no ORM layer
- **Migrations**: tracked in `supabase/migrations/` (25 migrations as of 2026-06-09)
- **Generated types**: `src/integrations/supabase/types.ts` — do not edit manually

---

## Auth System

- **Provider**: Supabase Auth (magic link + email/password)
- **Session management**: `AuthContext` (`src/contexts/AuthContext.tsx`)
- **Subscription gating**: `check-subscription` edge function polled on login + every 60s
- **Gate hierarchy**: `AuthProvider → BrowserRouter → ProtectedRoute → BanCheck → TermsAcceptanceGate → Dashboard`
- **Billing**: Stripe (4 plans + 2 add-ons via `create-checkout` / `customer-portal`)

---

## Required Environment Variables

### Frontend (Vite — must be prefixed `VITE_`)

| Variable | Source | Present in .env |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref | ✅ |

> **Note**: `.env` also contains `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` without the `VITE_` prefix — these are unused by the frontend but harmless.

### Edge Functions (set in Supabase dashboard, not in `.env`)

| Variable | Used by |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | All edge functions |
| `ANTHROPIC_API_KEY` | `ai-strategy`, `campaign-blueprint`, `generate-video-v2`, `federal-contracting`, `grant-intel`, `grant-consultant`, `ricky-chat` |
| `STRIPE_SECRET_KEY` | `check-subscription`, `create-checkout`, `customer-portal` |
| `STRIPE_WEBHOOK_SECRET` | `create-checkout` (webhook validation) |
| `CREATOMATE_API_KEY` | `generate-video-v2` |
| `CREATOMATE_WEBHOOK_URL` | `generate-video-v2` |
| `GOOGLE_TTS_API_KEY` | `generate-video-v2` |
| `ELEVENLABS_API_KEY` | `generate-video-v2` |
| `PEXELS_API_KEY` | `generate-video-v2` |
| `HEYGEN_API_KEY` | `generate-video-v2` |

---

## Deployment Target

**Vercel** — primary and only deployment target
- URL: `https://rickyai.vercel.app`
- Config: `vercel.json` (buildCommand: `npm run build`, outputDirectory: `dist`, framework: `vite`, SPA rewrites)
- Netlify: blocked (build credit exhaustion) — do not use

---

## Supabase Edge Functions

**Project ref**: `psmxeckstfeyxlqzzkgw`
**CLI binary**: `C:\Users\jodan\supabase-bin\supabase.exe`
**Deploy command**: `& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw`

### Active functions (called from frontend)

| Function | Import style | Status |
|---|---|---|
| `check-subscription` | ⚠️ esm.sh (Stripe) | Active — needs import fix |
| `create-checkout` | ⚠️ esm.sh (Stripe) | Active — needs import fix |
| `customer-portal` | ⚠️ esm.sh (Stripe) | Active — needs import fix |
| `ai-strategy` | ⚠️ esm.sh (supabase-js) | Active — needs import fix |
| `ricky-chat` | ⚠️ esm.sh (supabase-js) | Active — needs import fix |
| `campaign-blueprint` | ⚠️ esm.sh (supabase-js) | Active — needs import fix |
| `rewrite-script` | ⚠️ esm.sh (supabase-js) | Active — needs import fix |
| `get-signed-video-url` | ⚠️ esm.sh (supabase-js) | Active — needs import fix |
| `admin-users` | ✅ npm: | Active — deploy ready |
| `admin-stats` | ✅ npm: | Active — deploy ready |
| `generate-video-v2` | ✅ npm: | Active — deploy ready |
| `video-callback` | ✅ npm: | Active — deploy ready |
| `federal-contracting` | ✅ npm: | Active — deploy ready |
| `grant-intel` | ✅ npm: | Active — deploy ready |
| `grant-consultant` | ✅ npm: | Active — deploy ready |
| `track-referral` | ✅ npm: (deno.land/std serve) | Active (backend webhook) — deploy ready |

### Dead / legacy (skip deployment)

| Function | Reason |
|---|---|
| `generate-video` | Old pipeline; esm.sh imports; not called by any active frontend code |
| `create-template` | One-time Creatomate template setup utility — per CLAUDE.md |
| `debug-template` | Diagnostic only; hardcoded template ID — per CLAUDE.md |
| `webhook-proxy` | esm.sh imports; no active frontend caller found |

---

## Exact Commands

```powershell
# Install
npm install

# Type check
npx tsc --noEmit

# Production build
npm run build

# Dev server
npm run dev   # → http://localhost:8080

# Single test
npx vitest run src/test/example.test.ts

# All tests
npm run test

# Deploy edge function
& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw

# Vercel production deploy
npx vercel --prod
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/contexts/AuthContext.tsx` | Auth + subscription source of truth |
| `src/pages/Dashboard.tsx` | 15-step workflow, `activeStep` / `activeSection` routing |
| `src/integrations/supabase/client.ts` | Generated — do not edit |
| `src/lib/stripe.ts` | Canonical Stripe price/product ID registry |
| `src/lib/persistence.ts` | localStorage persistence |
| `CONTRACTS.md` | Protected interfaces — read before any major change |
| `LESSONS.md` | Durable lessons from prior sessions |
| `vercel.json` | Vercel SPA config |
