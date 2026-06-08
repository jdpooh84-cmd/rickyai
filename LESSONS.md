# Project Lessons — RickyAI

Claude must read this file before planning major work.

---

## Durable Lessons

### Lesson: esm.sh imports cause EarlyDrop in Supabase Edge Functions
- **Problem**: `generate-video-v2` crashed on every cold start with EarlyDrop before handling any request.
- **Bad pattern**: `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"` — unversioned, external CDN URL requires an outbound network fetch during Deno module initialization, before `Deno.serve()` is registered. If the CDN is slow or unreachable, the process exits.
- **Better pattern**: `import { createClient } from "npm:@supabase/supabase-js@2.57.2"` — resolved by Supabase's internal Deno npm registry with no outbound fetch.
- **Applies to**: Every Supabase Edge Function import. Always use `npm:` specifiers, never `esm.sh` for core dependencies like `@supabase/supabase-js`.
- **Date added**: 2026-06-08

---

### Lesson: Stripe price IDs are account-scoped — always verify before hardcoding
- **Problem**: `src/lib/stripe.ts` had all 6 price IDs from the wrong Stripe account (`acct_1TDar...`). Every checkout call returned "No such price" from the live account (`acct_1TEumfRUytwslneZ`).
- **Bad pattern**: Copying price IDs from documentation, old code, or a different environment without checking the live Stripe dashboard for the correct account.
- **Better pattern**: Before hardcoding any price ID, call `GET /v1/prices` against the actual live Stripe account and confirm the IDs. Product IDs and price IDs must both match.
- **Applies to**: Any Stripe integration work. When copying price IDs from any source, verify via the Stripe API or dashboard for the target account.
- **Date added**: 2026-06-08

---

### Lesson: Stripe customer must be created eagerly, not lazily after payment
- **Problem**: `customer-portal` returned HTTP 500 "No Stripe customer found" even after users initiated checkout, because Stripe only creates a customer record upon payment completion, not when a checkout session is created.
- **Bad pattern**: `create-checkout` passed `customer_email` to Stripe and waited for post-payment webhooks to create the customer. `customer-portal` then couldn't find the customer for users who hadn't yet paid.
- **Better pattern**: In `create-checkout`, search for an existing Stripe customer by email first. If not found, call `stripe.customers.create()` immediately, then pass the `customer` ID to the checkout session. The customer record exists the moment checkout is initiated.
- **Applies to**: Any flow that needs `customer-portal` access, pre-payment upgrades, or customer metadata before payment completes.
- **Date added**: 2026-06-08

---

### Lesson: tax_id_collection requires name:"auto" in customer_update
- **Problem**: After eagerly creating a Stripe customer, `create-checkout` returned HTTP 500: "Tax ID collection requires updating business name on the customer."
- **Bad pattern**: `customer_update: { address: "auto" }` — only collecting address auto-update but not name.
- **Better pattern**: `customer_update: { address: "auto", name: "auto" }` — both are required when `tax_id_collection: { enabled: true }` is set on the session.
- **Applies to**: Any Stripe checkout session that uses `tax_id_collection`.
- **Date added**: 2026-06-08

---

### Lesson: Frontend was silently calling the old video function
- **Problem**: After migrating the video pipeline from `generate-video` to `generate-video-v2`, the frontend `CreateVideoFlow.tsx` was still invoking `generate-video` (the old function). No error was visible because the old function still existed and responded.
- **Bad pattern**: Renaming or replacing a backend function without searching the entire frontend codebase for all call sites.
- **Better pattern**: Before deploying a replacement function, `grep` the frontend for all invocations of the old function name and update them. Then verify the correct function is being called with a smoke test.
- **Applies to**: Any backend function rename, replacement, or migration.
- **Date added**: 2026-06-08

---

### Lesson: Supabase CLI flag syntax differs between commands
- **Problem**: `supabase db push --project-ref <ref>` fails — `--project-ref` is not a valid flag for `db push`. It works for `functions deploy` but not `db push`.
- **Better pattern**: For `db push`, use `--linked` (requires `supabase link` to have been run first) or `--db-url`. For `functions deploy`, use `--project-ref`.
- **Applies to**: Any Supabase CLI command. Always check `supabase <command> --help` before assuming flags transfer between subcommands.
- **Date added**: 2026-06-08

---

### Lesson: Supabase project ref in master prompt was wrong
- **Problem**: The master prompt referenced project ref `symbyrtzimafpxbzurjh`. The actual live project is `psmxeckstfeyxlqzzkgw`. This caused all early CLI commands to target the wrong project.
- **Better pattern**: Verify the live project ref by calling `GET https://api.supabase.com/v1/projects` before trusting any hardcoded ref from a prompt, doc, or old config.
- **Applies to**: Any multi-project Supabase setup. Always confirm the correct ref at session start.
- **Date added**: 2026-06-08

---

## Current Known Weaknesses

- `generate-video-v2` is 1,592 lines — large file makes it hard to review, test, or isolate failures. Consider splitting the pipeline into focused helper modules.
- `video-callback` handles both Creatomate and legacy Make.com webhook formats in the same function — fragile if either format changes.
- No automated test suite exists. All verification is manual smoke-testing via `verify-portal.mjs` and ad-hoc curl calls.
- `render-worker` (ElevenLabs + FFmpeg) is a separate service not currently deployed. Voiceover falls back to captions-only for most users.
- `settings.local.json` contains plaintext access tokens in the allow list — these should rotate and the file should not be committed.

---

## Repeated Mistakes To Avoid

- Do not make large rewrites when a small patch is safer.
- Do not change protected contracts without checking `CONTRACTS.md`.
- Do not add dependencies until existing tools are checked first.
- Do not claim something is fixed unless the code was actually changed, deployed, and smoke-tested.
- Do not leave final implementation only in chat — save it to the repo.
- Do not assume a Supabase project ref, Stripe account, or price ID is correct — verify it.
- Do not use `esm.sh` URLs in edge function imports — use `npm:` specifiers.
