# RICKY_NON_REACT_MIGRATION_PLAN.md

**Created:** 2026-08-19  
**Branch:** `claude/rickyai-byo-creatomate-api-c9c4ka`  
**Constraint:** The final production app must not require React, React DOM, or any React runtime.  
**Target framework:** SvelteKit + TypeScript (Vue/Nuxt is acceptable fallback if a documented repo-based reason emerges).  
**Principle:** Do not start this migration until Phase 0 BLOCKER and CRITICAL issues are resolved.

---

## 1. CURRENT REACT RUNTIME INVENTORY

### Hard React Dependencies (must be replaced)

| Package | Version | Usage |
|---|---|---|
| `react` | 18.3.1 | All components |
| `react-dom` | 18.3.1 | Rendering root |
| `react-router-dom` | 6.30.1 | All routing |
| `@vitejs/plugin-react-swc` | 3.11.0 | Vite compiler plugin |
| All `@radix-ui/react-*` (20+ packages) | various | Every UI primitive (accordion, dialog, dropdown, etc.) |
| `@tanstack/react-query` | 5.83.0 | All server state (React adapter) |
| `react-hook-form` | 7.61.1 | All forms |
| `react-day-picker` | 8.10.1 | Date picking |
| `react-resizable-panels` | 2.1.9 | Panel layouts |
| `embla-carousel-react` | 8.6.0 | Carousels |
| `lucide-react` | 0.462.0 | All icons |
| `next-themes` | 0.3.0 | Dark/light toggle (React Context) |
| `react-markdown` | 10.1.0 | Markdown rendering |
| `@testing-library/react` | 16.0.0 | All component tests |

### Dev Dependencies to Replace

| Package | Replacement |
|---|---|
| `@types/react`, `@types/react-dom` | Svelte types |
| `eslint-plugin-react-hooks` | `eslint-plugin-svelte` |
| `eslint-plugin-react-refresh` | Not needed in SvelteKit |

---

## 2. FRAMEWORK-NEUTRAL ASSETS (PRESERVED AS-IS)

These files have zero React coupling and can be copied directly into the SvelteKit project:

### Domain Logic (pure TypeScript)
- `src/lib/attribution.ts` — multi-touch attribution models and scoring
- `src/lib/gamification.ts` — points, badges, levels
- `src/lib/stripe.ts` — plan/product ID registry and helpers
- `src/lib/optimizationLayers.ts` — 12-pillar framework and industry detection
- `src/lib/persistence.ts` — localStorage wrappers
- `src/lib/videoComposer.ts` — Canvas/MediaRecorder composer (pending call-path audit)

### Supabase Integration
- `src/integrations/supabase/client.ts` — `@supabase/supabase-js` client (framework-neutral)
- `src/integrations/supabase/types.ts` — generated TypeScript types

### Styling
- All Tailwind CSS utilities and configuration (`tailwind.config.ts`, `postcss.config.js`)
- Design tokens (CSS custom properties)
- `tailwindcss-animate`, `tailwind-merge`, `clsx`, `class-variance-authority` — all framework-neutral

### Backend (no migration needed)
- All 22 Supabase Edge Functions (Deno, framework-neutral)
- All 25 SQL migrations
- Supabase storage policies and RLS rules
- Stripe webhook/checkout/portal functions

### Validation
- `zod` schemas (framework-neutral)

### Other
- `date-fns` — framework-neutral
- `recharts` — has a Svelte wrapper or can be replaced with `LayerChart` / `Chart.js`
- `sonner` — has framework-neutral usage; Svelte alternative: `svelte-sonner`

---

## 3. SVELTEKIT TARGET TOPOLOGY

```
rickyai-svelte/ (or migrate in-place)
├── src/
│   ├── routes/
│   │   ├── +layout.svelte          # Root layout (theme, auth guard)
│   │   ├── +layout.server.ts       # Auth session validation (SSR)
│   │   ├── (public)/               # Marketing/landing pages (SSR/SSG)
│   │   │   ├── +page.svelte
│   │   │   └── pricing/+page.svelte
│   │   ├── auth/                   # Login, signup, magic-link
│   │   │   └── +page.svelte
│   │   └── dashboard/              # Authenticated shell
│   │       ├── +layout.svelte      # Dashboard shell (sidebar, step nav)
│   │       ├── +layout.server.ts   # Server-side auth + subscription check
│   │       └── [step]/             # Per-step route or param-based
│   ├── lib/
│   │   ├── server/                 # Server-only code (secrets, service role)
│   │   │   ├── supabase.ts         # Service-role client (never in browser)
│   │   │   └── stripe.ts           # Stripe server helpers
│   │   ├── client/                 # Browser-safe code
│   │   │   ├── supabase.ts         # Anon/user-scoped Supabase client
│   │   │   └── attribution.ts      # (preserved from React codebase)
│   │   ├── components/             # Svelte components
│   │   │   ├── ui/                 # Svelte port of shadcn/ui primitives (shadcn-svelte)
│   │   │   ├── dashboard/          # Step components
│   │   │   └── shared/
│   │   └── stores/                 # Svelte stores (replaces Context + useState)
│   │       ├── auth.ts             # Auth state store
│   │       ├── business.ts         # businessId/locationId store
│   │       └── dashboard.ts        # activeStep, completedSteps store
├── static/
├── svelte.config.js
├── vite.config.ts
└── package.json
```

### Why SvelteKit

- SSR support for public/marketing pages without a separate SSR framework
- Form Actions provide server-side form handling without client JS (progressive enhancement)
- Svelte stores replace React Context + useState with less boilerplate
- `shadcn-svelte` (bits-ui) provides equivalent accessible UI primitives
- Smaller runtime bundle; no virtual DOM overhead
- `@supabase/ssr` has first-class SvelteKit support for cookie-based auth sessions
- TypeScript support is first-class

### Auth/Session Pattern (SvelteKit + Supabase)
Use `@supabase/ssr` with cookie-based sessions:
- `src/hooks.server.ts` validates the session and sets `locals.supabase` and `locals.session` on every request
- `+layout.server.ts` returns session to the client via `load()`
- The service-role client (`SUPABASE_SERVICE_ROLE_KEY`) lives only in `src/lib/server/` — never bundled to the browser
- RLS is the primary data access guard; service-role is used only in Edge Functions or SvelteKit server routes for operations that require elevated access

---

## 4. KEY MIGRATION APPROACHES

### Routing
React Router nested routes → SvelteKit file-system routing. The 15-step dashboard can be either:
- A single `/dashboard` route with client-side step state (closest to current behavior)
- Separate `/dashboard/[step]` routes (better URL shareability, SSR-able per step)

Recommend: `/dashboard/[step]` for shareability; persist `completedSteps` in the same `localStorage` key format to avoid losing user progress during migration.

### State Management
| Current (React) | SvelteKit replacement |
|---|---|
| `AuthContext` (React Context) | Svelte auth store + `+layout.server.ts` session |
| `useBusinessData` (TanStack Query + localStorage) | Svelte derived store + server `load()` |
| `activeStep` (useState) | Svelte writable store persisted to localStorage |
| TanStack Query for server state | `@tanstack/svelte-query` (same library, Svelte adapter) |

### UI Components (shadcn/ui → shadcn-svelte / bits-ui)
`shadcn-svelte` (built on `bits-ui` and `melt-ui`) provides equivalent accessible headless components. The migration is component-by-component; both can coexist if needed via iframe or separate routes (not recommended — use feature flags).

### Forms
`react-hook-form` + `zod` → SvelteKit Form Actions + `zod`. Server-side validation in Form Actions eliminates the need for client-side form state management in most cases. Complex multi-step forms can use a Svelte store.

### Video Player / Upload
`<video>` element is framework-neutral HTML. Upload dropzone: replace `fileInputRef` pattern with Svelte `bind:this` and standard input events.

### Polling (video/clip job status)
Replace `setInterval` in `useEffect` with a Svelte `onMount`/`onDestroy` lifecycle or a Svelte store that wraps the interval. Pattern is identical; only syntax changes.

### Charts
`recharts` → `LayerChart` (Svelte-native) or keep recharts via `@dimfeld/svelte-recharts` wrapper. Evaluate based on chart types used.

### Toast Notifications
`sonner` → `svelte-sonner` (maintained port with identical API).

### Icons
`lucide-react` → `lucide-svelte` (same icon set, Svelte components).

### Dark/Light Theme
`next-themes` (React Context) → `mode-watcher` (Svelte equivalent, from shadcn-svelte ecosystem) or a simple Svelte store + `document.documentElement.classList`.

### PWA
`vite-plugin-pwa` is framework-neutral; works with SvelteKit.

---

## 5. MIGRATION SEQUENCE

**Pre-condition:** Phase 0 BLOCKER and CRITICAL issues resolved. Baseline test suite passing.

### Stage 0 — Extract and verify domain modules (no UI change)
- Confirm all `src/lib/` files are React-free (they are)
- Confirm Supabase client and types are React-free (they are)
- Add unit tests to cover attribution, gamification, stripe, optimizationLayers
- Establish the test commands that will prove parity

### Stage 1 — SvelteKit scaffold in monorepo
- Add SvelteKit as a second app in the repository (`apps/web-svelte/` or root replacement)
- Configure shared TypeScript, Tailwind, and domain lib packages
- Deploy to a preview URL (separate Vercel project); do not replace production yet
- Implement auth (login/signup/logout) and basic session validation
- Verify: authenticated user can log in, session is valid, logout works

### Stage 2 — Business profile and navigation shell
- Implement the 15-step sidebar navigation
- Implement Step 2 (Profile) as the first real step (highest data-entry importance)
- Wire to the existing Supabase tables and Edge Functions (they don't change)
- Implement `localStorage` state persistence using the same key format
- Verify: user can create/edit their business profile, state survives reload

### Stage 3 — Video Studio (Step 8) and core pipeline
- This is the highest-value step; parity here proves the migration is viable
- Implement VideoStudio, RawFootageClipper, polling, video playback, download
- Wire to `generate-video-v2` and `clip-video` Edge Functions unchanged
- Verify: user can generate a video end-to-end in the Svelte app

### Stage 4 — Remaining steps and sidebar sections
- Migrate Steps 1, 3–7, 9–15 one at a time
- Migrate sidebar sections (score, performance, community, marketplace, etc.)
- Each step is independently migratable; prioritize by plan tier (Creator steps first)

### Stage 5 — Billing flows
- Migrate create-checkout, customer-portal, subscription state display
- Verify: upgrade/downgrade works, entitlements update correctly, trial banner correct

### Stage 6 — Public pages and landing
- Migrate any public marketing pages (if present in the React app)
- These benefit most from SvelteKit SSR

### Stage 7 — Cutover
- Run E2E parity tests across both apps (same user account, same data)
- Switch production Vercel deployment from React build to SvelteKit build
- Keep React app build in repository for one sprint as rollback option
- Monitor error rates, Core Web Vitals, and user-reported issues

### Stage 8 — React removal
- Remove React packages only after: 2+ weeks of stable production on SvelteKit with no regressions
- Delete `src/` React code, remove React devDependencies
- Update `RICKY_IMPLEMENTATION_BASELINE.md`

---

## 6. FEATURE FLAGS / CUTOVER MECHANISM

Do not run two concurrent frontends serving the same authenticated session simultaneously (session/cookie conflicts). Instead:

- Use a Vercel preview deployment for the SvelteKit app during development
- Use a DNS-level or Vercel configuration cutover for production switch (not a dual-write)
- Keep feature flags only for individual step rollouts within the SvelteKit app itself

---

## 7. E2E PARITY TESTS

Before cutover, the following flows must pass in the SvelteKit app via Playwright:

1. Sign up → receive confirmation → log in
2. Create business profile → verify persisted
3. Generate video (Step 8) → polling → download
4. Upload raw footage → Klap clipping → download clip
5. Add Creatomate API key → verified saved (never readable in browser)
6. Subscription check → correct plan limits enforced
7. Campaign outcome recorded → attribution calculated
8. Admin functions inaccessible to regular user
9. User A cannot access User B's data (cross-tenant RLS test)
10. Keyboard-only navigation through all 15 steps
11. Screen-reader: all interactive elements have accessible labels

---

## 8. RISKS

| Risk | Likelihood | Mitigation |
|---|---|---|
| shadcn-svelte component gaps vs shadcn/ui | Medium | Audit required components before Stage 1; build missing ones |
| Supabase SSR cookie auth complexity | Low | `@supabase/ssr` is well-documented for SvelteKit |
| recharts Svelte compat | Medium | Evaluate LayerChart; recharts has a Svelte wrapper |
| Loss of PWA behavior during migration | Low | vite-plugin-pwa works with SvelteKit |
| Longer migration than estimated | High | Stage 3 (VideoStudio) is the true complexity test |
| RLS tests not caught until cutover | High | Write RLS tests in Stage 0 before any migration starts |

---

_Last updated: 2026-08-19. Update as migration progresses. Each stage completion should be logged in `RICKY_IMPLEMENTATION_PROGRESS.md`._
