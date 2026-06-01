# RickyAI Build Progress

## Phase 1: Remove Lovable ✅ COMPLETE
- Removed `lovable-tagger` from `vite.config.ts` and `package.json`
- Replaced Lovable OG image URLs in `index.html` with local `/pwa-icon-512.png`
- All 10 edge functions cleaned of `lovable.dev` gateway URLs and `LOVABLE_API_KEY` references

## Phase 2: Fix All Edge Functions (Anthropic Direct) ✅ COMPLETE
All functions now call `https://api.anthropic.com/v1/messages` with `claude-sonnet-4-20250514`.
Functions fixed:
1. `ai-strategy` — all users can now run strategy steps (admin gate removed)
2. `campaign-blueprint` — direct Anthropic call, all users
3. `federal-contracting` — direct Anthropic call, non-streaming
4. `grant-consultant` — direct Anthropic call, non-streaming
5. `grant-intel` — direct Anthropic call, non-streaming
6. `ricky-chat` — direct Anthropic call, all users
7. `rewrite-script` — direct Anthropic call with template fallback
8. `webhook-proxy` — direct Anthropic call for built-in AI fallback
9. `generate-video` — Anthropic for script gen, Pexels for images
10. `generate-video-v2` — Anthropic for script gen, Pexels for images

## Phase 3: Video Pipeline ✅ (Existing — Make.com webhook still configured)
- generate-script → Make.com webhook → render-worker → FFmpeg → Pexels → delivered video
- Webhook: hook.us2.make.com/qji4ef373dnn4gajoynwgg1yevy3kdgj

## Phase 4: ANTHROPIC_API_KEY in Supabase Secrets 🔲 PENDING
- Must set `ANTHROPIC_API_KEY` in Supabase project `symbyrtzimafpxbzurjh` edge function secrets
- Run: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` or set via Supabase dashboard

## Phase 5: Deploy Frontend and Render-Worker 🔲 PENDING

## Phase 6: End-to-End Test 🔲 PENDING
