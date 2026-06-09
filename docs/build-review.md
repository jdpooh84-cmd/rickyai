# Build Review Log — RickyAI

---

## Session: 2026-06-08 — Creatomate migration + Stripe + video pipeline fixes

### What worked
- Full Manus → Creatomate migration in `generate-video-v2` and `video-callback`
- All 6 Stripe price IDs corrected to match `acct_1TEumfRUytwslneZ`
- `create-checkout` now creates Stripe customers eagerly — portal works pre-payment
- `customer-portal` returns live `billing.stripe.com` URLs ✅
- `check-subscription` returns correct trial state ✅
- `create-checkout` returns live `checkout.stripe.com` URLs ✅
- `generate-video-v2` EarlyDrop fixed by switching to `npm:` import specifier
- Frontend updated to call `generate-video-v2` instead of `generate-video`
- Loading message updated to "2-5 minutes"

### What failed (and was fixed)
- `generate-video-v2` crashed on every cold start — root cause: `esm.sh` CDN import
- `create-checkout` returned 500 after eager customer creation — root cause: missing `name: "auto"` in `customer_update`
- `customer-portal` returned 500 for new users — root cause: Stripe customer not yet created; fixed by eager creation in `create-checkout`
- All 6 price IDs were from wrong Stripe account — fixed by querying live account

### What was weak
- No automated test suite — all verification was manual smoke tests
- `generate-video-v2` is 1,592 lines — hard to review in isolation
- `settings.local.json` contains plaintext access tokens in the allow list

### Remaining risks
- `render-worker` (ElevenLabs + FFmpeg) is not deployed — voiceover is captions-only for most users
- `video-callback` handles two different webhook formats (Creatomate + legacy Make.com) — fragile if either changes
- No e2e tests for the full video generation → callback → completion loop

### Checks run
- `npm run build` ✅ (3.73s, no errors)
- Manual smoke tests: `verify-portal.mjs` ✅ all three endpoints PASS
- Manual smoke test: `generate-video-v2` boot check → HTTP 400 "Business not found" (correct — function booted and handled the request)

### Contracts preserved
- All Stripe price IDs and product IDs intact in `src/lib/stripe.ts`
- Supabase project ref `psmxeckstfeyxlqzzkgw` used throughout
- Webhook shape unchanged in `video-callback`
- Auth token flow unchanged in all edge functions

---

## Session: 2026-06-09 — FinalVideoPlan rebuild + stale-video frontend fix

### What worked
- Full `generate-video-v2` rebuild around `FinalVideoPlan` single source of truth (commit `a82801c`)
  - `ScriptScene`, `MediaScene`, `FinalVideoPlan` interfaces replace scattered local variables
  - `buildRenderScript(plan)` replaces `buildRenderSource` — reads only from the plan object
  - `buildBgElement(ms)` helper emits `type:"video"` for mp4 clips, `type:"image"` for statics — fixes mistyped backgrounds
  - Phase ordering locked: script → media → voiceover → plan assembly → render script → Creatomate dispatch
  - Observability log `[plan] FinalVideoPlan:` emitted before every Creatomate dispatch
  - Stale `strategy_outputs` fallback removed — AI failure goes directly to `buildScriptFromProfile`
  - CTA text reads from `rawScript.cta` (not `lastScene.text_overlay`)
- Frontend stale-video restore fix (commit `d1403c1`)
  - Restore `useEffect` guard extended with `|| approvedScript || generatedVideoScript` — prevents loading old DB video when current-session script exists
  - `isRestoredVideo` state added — tracks whether displayed video came from DB restore vs current session
  - Amber warning banner shown when restored video exists alongside a current-session script

### Verification — live end-to-end
- Job `b7a89281` (created 14:48, after v31 deploy) completed successfully
- Real Creatomate render ID `81bcb02e-2d5b-43e6-8898-6729e56f5216` — real video in Supabase storage
- Webhook received 37s after dispatch
- Pipeline steps all `completed`: script, images, voiceover, creatomate
- Approved AI script used (`used_ai_script: true`, `is_fallback: false`) — TnT Tinting content, not fallback
- All 6 scene backgrounds correctly assigned as `mediaType: 'video'` (mp4 from `business_media`)

### What was weak
- `video-callback` writes `completed_at` to `result_payload` JSONB but not the dedicated `completed_at` DB column — cosmetic gap, frontend doesn't read it
- `pipeline_stage` stays `"processing"` after completion — `video-callback` doesn't update it — cosmetic gap, frontend doesn't read it
- Scene 6 reuses Scene 1's clip when business has fewer than 6 distinct video clips — expected cycling, not a bug
- Only 4 pipeline log entries in `result_payload.pipeline_logs` — most logs go to `console.log` only, not the persisted array

### Remaining risks
- No automated test for the full pipeline — all verification is manual DB inspection
- `video-callback` `completed_at` column gap may confuse future analytics queries
- Media cycling (scene duplication when library < 6 clips) is silent — no warning to user

### Checks run
- `npm run build` ✅ (clean, no errors)
- DB query: job `b7a89281` status=completed, real render ID, real video URL ✅
- Code inspection: `buildBgElement` at line 1064 — correct `type:"video"` for mp4 ✅
- Code inspection: `buildRenderScript(plan)` called at line 1647 — after full plan assembly ✅
