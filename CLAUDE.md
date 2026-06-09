# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:8080)
npm run build        # Production build → dist/
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
npm run preview      # Serve the built dist/ locally
```

**Single test:**
```bash
npx vitest run src/test/example.test.ts
```

**Deploy edge function:**
```bash
& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw
```

**Push a DB migration:**
```bash
& "C:\Users\jodan\supabase-bin\supabase.exe" db push --linked
```

**Deploy frontend:**
```bash
npx vercel --prod    # Vercel (primary fallback — rickyai.vercel.app)
```

---

## Architecture

### Stack

React 18 + Vite SPA, Supabase (Postgres + Auth + Storage + Edge Functions), Stripe billing, Tailwind + shadcn/ui, TanStack Query, React Router v6, Vitest.

### Auth and subscription gating

`AuthContext` (`src/contexts/AuthContext.tsx`) is the single source of truth for auth state and subscription. It calls `check-subscription` (edge function) on login and every 60s. `hasAccess = subscribed || trialActive` gates the entire dashboard. The component tree is: `AuthProvider → BrowserRouter → ProtectedRoute → BanCheck → TermsAcceptanceGate → Dashboard`.

### Dashboard step system

`Dashboard.tsx` renders a numbered 15-step workflow driven by `activeStep` (integer) and `activeSection` (string for non-step panels). The step/section switch lives in `renderContent()`. State is persisted to `localStorage` under key `rickyai-dashboard-state` via `src/lib/persistence.ts`. Every step receives `businessId` and `locationId` from `useBusinessData`, which reads from `localStorage` key `rickyai-business-selection`.

**Step map:** 1=Connect, 2=Profile, 3=Compete, 4=Scout, 5=Audit, 6=Platform, 7=Script, 8=VideoStudio, 9=Storyboard, 10=Export, 11=LeadScout, 12=GrantSearch, 13=SearchVisibility, 14=CampaignBlueprint, 15=OmniOptimize.

**Sections (not steps):** `score`, `performance`, `community`, `marketplace`, `ready`, `watch`, `connect-tools`, `federal-contracting`, `grant-intel`, `grant-consultant`.

### Business/location context

`useBusinessData` (`src/hooks/useBusinessData.ts`) loads businesses and locations for the authenticated user. All step components receive `businessId` / `locationId` as props. Per-business state isolation: any component that persists state to localStorage must scope the key to `businessId` (e.g. `rickyai-video-studio-state-${businessId}`). A `useRef` for previous businessId is used to detect business switches and clear stale state without firing on mount.

### Video pipeline

The pipeline is asynchronous. The HTTP response from `generate-video-v2` returns `job_id` immediately (via `EdgeRuntime.waitUntil`), and the frontend polls `video_generation_jobs` for status changes.

**Flow:** `VideoStudioStep` (step 8) → invokes `generate-video-v2` edge function → function creates a `video_generation_jobs` row, dispatches to `Creatomate /v2/renders` using inline source (no template), and exits → Creatomate calls `video-callback` webhook → `video-callback` updates the DB row with `status=completed` and `video_url`.

**Key objects in `generate-video-v2`:**
- `FinalVideoPlan` — normalized single source of truth assembled before dispatch: `{ jobId, business, script, media, voiceover, avatar }`
- `ScriptScene` — per-scene script data: `{ overlayText, voiceoverText, captionText, durationSeconds }`
- `MediaScene` — per-scene background: `{ url, mediaType: 'image'|'video', sourceType: 'upload'|'pexels'|'placeholder' }`
- `buildRenderScript(plan)` — sole function that writes the Creatomate render source; reads ONLY from `FinalVideoPlan`
- Audio: Creatomate-native TTS via ElevenLabs (`provider: "elevenlabs model_id=eleven_multilingual_v2 voice_id=21m00Tcm4TlvDq8ikWAM"`)

### Edge functions

All edge functions are Deno (Supabase). Rules that must never be violated:
- Imports must use `npm:` specifiers, never `esm.sh` (causes EarlyDrop on cold start)
- Return `{ "error": "message" }` on failure with appropriate 4xx/5xx status
- `video-callback` has `verify_jwt = false` in `supabase/config.toml` (public webhook endpoint)

### Stripe billing

`src/lib/stripe.ts` is the canonical price/product ID registry. Four self-serve plans (Creator $59, Business Starter $169, Growth $249, Agency $799) plus two $50/mo add-ons (Federal Contracting, Grant Intelligence). All IDs are scoped to Stripe account `acct_1TEumfRUytwslneZ`. Plan capabilities (step access, brand/location limits) live in the `PLANS` constant — check `steps_available` before unlocking UI.

### Supabase client

`src/integrations/supabase/client.ts` — generated file, do not edit. Import as `import { supabase } from "@/integrations/supabase/client"`. Generated TypeScript types live in `src/integrations/supabase/types.ts`.

### localStorage keys (complete list)

| Key | Owner | Contents |
|---|---|---|
| `rickyai-dashboard-state` | `Dashboard.tsx` | `{ activeStep, activeSection, completedSteps }` |
| `rickyai-business-selection` | `useBusinessData` | `{ businessId, locationId }` |
| `rickyai-video-studio-state-{businessId}` | `VideoStudioStep` | script, approvedScript, lengthMode |

### Dead/legacy code

These edge functions exist in the repo but are NOT called by any active frontend code. Do not call them from new code:
- `generate-video` — old pipeline, uses `esm.sh` imports, references Manus AI
- `create-template` — one-time Creatomate template setup utility
- `debug-template` — contains hardcoded template ID, diagnostic only

---

## Build Discipline

You are building production-ready software, not demos.

Every meaningful build, refactor, feature, fix, or architecture change must follow this loop:

1. Understand the existing system before editing.
2. Identify protected contracts before changing code.
3. Make the smallest safe change that solves the real problem.
4. Run the relevant checks.
5. Critique the work harshly.
6. Replace weak, brittle, duplicated, unclear, or unsafe code.
7. Document what changed.
8. Save durable lessons so the same mistake is less likely next time.

## Non-Negotiable Standards

- Never break existing routes, APIs, database tables, auth flows, billing flows, or user data contracts without explicit approval.
- Never remove working functionality to make implementation easier.
- Never invent files, commands, dependencies, schemas, or environment variables without checking the repo first.
- Never claim something is fixed unless the code was actually changed and checked.
- Never leave TODOs instead of implementation unless explicitly approved.
- Never expose, print, commit, or hardcode API keys, secrets, tokens, private credentials, or `.env` contents.
- Prefer boring, durable, maintainable code over clever code.
- Prefer clear names over short names.
- Prefer explicit error handling over silent failure.
- Prefer small modules over giant files.
- Prefer tests and checks over confidence.

## Required Before Any Major Change

Before editing, inspect:

- `CONTRACTS.md`
- `LESSONS.md`
- relevant source files
- package scripts
- existing patterns
- current routes, schemas, types, and interfaces

Then state:

- what you are changing
- what you are not changing
- what contracts must remain untouched
- what checks will prove the change worked

## Required After Any Major Change

After editing, run the strongest available checks:

- `npm run build` (always)
- `npm run typecheck` (if available)
- `npm run lint` (if available)
- security-sensitive review if auth, payments, files, secrets, user data, or permissions changed

If a command is unavailable, explain what was missing and use the closest available check.

## Harsh Self-Review Rule

At the end of substantial work, write or update `docs/build-review.md` with:

- What worked
- What failed
- What was weak
- What was replaced
- What risks remain
- What checks were run
- What should be remembered next time

## Learning Rule

When the same mistake, weakness, or pattern appears twice:

- Add a short durable rule to `LESSONS.md`
- Add a permanent project rule to `CLAUDE.md` only if it applies to every future build
- Add protected interfaces or invariants to `CONTRACTS.md` if breaking them would damage the app

## Contract Rule

Before changing public behavior, read `CONTRACTS.md`.

If the change touches a protected contract, stop and ask for approval unless the user explicitly requested that contract change.

Protected contracts include:

- public routes
- API response shapes
- database schemas
- auth behavior
- billing behavior
- role permissions
- file storage paths
- environment variables
- webhook payloads
- production deployment commands

## Final Response Rule

When done, always report:

- files changed
- checks run
- errors found
- errors fixed
- remaining risks
- whether `LESSONS.md`, `CONTRACTS.md`, or `docs/build-review.md` was updated

## Required Claude Code Slash Command Workflow

For serious code work, use the production-engineering-security-reviewer skill and follow this workflow:

### Before Editing
```
/plan
/diff
/context
```

### During Review and Fixing
```
/elite-review
/code-review high --fix
/simplify
/security-review
```

### For Security-Sensitive Changes
```
/secure-fix
/security-review
```
Security-sensitive means auth, authorization, billing, user data, database rules, file uploads, secrets, webhooks, API keys, permissions, or deployment configuration.

### For Runtime Proof
```
/run-skill-generator
/run
/verify
/verify-build
```

### Before Shipping
```
/ship-check
/code-review max
/security-review
/diff
```

### If Work Goes Wrong
```
/rewind
/debug
/doctor
```

### For Long Sessions
```
/context
/compact
```

Never claim production readiness unless review, security, diff inspection, and available verification steps have been completed or explicitly reported as unavailable.

---

## Project-Specific Rules

- Supabase CLI binary is at `C:\Users\jodan\supabase-bin\supabase.exe` — always use this, not `npx supabase`
- Deploy edge functions with: `& "C:\Users\jodan\supabase-bin\supabase.exe" functions deploy <name> --project-ref psmxeckstfeyxlqzzkgw`
- The live Supabase project ref is `psmxeckstfeyxlqzzkgw` — the old ref `symbyrtzimafpxbzurjh` in the master prompt was wrong
- Frontend primary: Vercel at `rickyai.vercel.app` (Netlify `lighthearted-crostata-834a8e.netlify.app` is blocked by build credit exhaustion)
- All edge function imports must use `npm:` specifiers (not `esm.sh`) to avoid cold-start EarlyDrop
- Always verify Stripe price IDs against `acct_1TEumfRUytwslneZ` before hardcoding; price IDs are account-scoped
- The active video pipeline is `generate-video-v2` — `generate-video` is the old function and must not be called by new frontend code
- Migration history was untracked until 2026-06-09; all 25 migrations are now tracked. Use `db push --linked` for new migrations
