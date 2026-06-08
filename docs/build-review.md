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
