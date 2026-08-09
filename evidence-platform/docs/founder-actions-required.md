# Founder Actions Required

These items cannot be completed by automated build — they require your credentials, accounts, or explicit decisions.

---

## 1. Environment Variables

### Vercel — Production Environment Variables (required before deployment)

Set these in the Vercel project dashboard under **Settings → Environment Variables** with scope `Production` (and optionally `Preview`):

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project REST API URL | Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe to expose) | Supabase dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key **(secret — server only)** | Supabase dashboard → Settings → API → service_role |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | console.anthropic.com → API Keys |
| `AI_PROVIDER` | Set to `anthropic` in production | Literal string |
| `CRON_SECRET` | Random secret to authenticate the cron endpoint | Generate: `openssl rand -base64 32` |

> **WARNING:** `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` must never appear in any `NEXT_PUBLIC_` variable. The platform enforces this — they are referenced only via server-side `process.env["..."]`.

### Local Development (.env.local)

Create `evidence-platform/.env.local` with the same variables above. This file is git-ignored; never commit it.

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=anthropic
CRON_SECRET=your-random-secret
```

Optional tuning variables (defaults shown):
```
FETCH_TIMEOUT_MS=10000
FETCH_MAX_BYTES=2097152
FETCH_MAX_REDIRECTS=3
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_WINDOW_MS=60000
MAX_FILE_SIZE_BYTES=15728640
```

---

## 2. Supabase Database Setup

### 2a. Run migrations

The following migrations must be applied to your Supabase project before the application works:

```bash
# From evidence-platform/ directory
npx supabase db push --linked
```

Or apply manually via Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql` — creates all 14 tables, RLS policies, indexes
2. `supabase/migrations/002_extend_evidence_relationship.sql` — extends evidence_matches relationship CHECK constraint

### 2b. Verify RLS is enabled

All 14 tables have RLS enabled in the migration. Confirm in Supabase dashboard:
- Table Editor → select each table → check that "RLS Enabled" shows a green checkmark

Tables: `organizations`, `profiles`, `verification_cases`, `extracted_claims`, `evidence_sources`, `evidence_matches`, `prosecutor_reviews`, `scoring_results`, `verification_reports`, `verification_jobs`, `audit_events`, `commitments`, `commitment_evaluations`, `benchmark_runs`

### 2c. Create Supabase Storage bucket for file uploads

The file upload pipeline stores case files in Supabase Storage. You must create the bucket before any file upload case can be processed:

1. Supabase dashboard → Storage → New bucket
2. Bucket name: **`case-uploads`** (exact name — the code references this literal)
3. **Public access: OFF** (private bucket; files are accessed via service role key)
4. File size limit: 15 MB (matches `MAX_FILE_SIZE_BYTES` env var default)

Files are stored at path: `orgs/{orgId}/cases/{caseId}/{filename}`

> **Note:** Without this bucket, `/api/cases/upload` will fail with a storage error on every file submission.

### 2d. Confirm Auth is enabled

Supabase Auth must be enabled with Email/Password provider:
- Authentication → Providers → Email: **Enabled**
- Email confirmation: your choice (recommend disabled for early MVP, enabled for production)

---

## 3. Vercel Deployment

### 3a. Deploy the project

```bash
# From evidence-platform/ directory
npx vercel --prod
```

Or link via Vercel dashboard by importing the GitHub repository.

**Framework preset:** Next.js  
**Root directory:** `evidence-platform`  
**Build command:** `npm run build`  
**Output directory:** `.next`

### 3b. Verify Vercel Cron is active

After deployment, check that the cron job is registered:
- Vercel dashboard → your project → Settings → Crons
- You should see: `/api/cron/process-jobs` scheduled at `* * * * *` (every minute)

The cron sends `Authorization: Bearer <CRON_SECRET>` — set `CRON_SECRET` in Vercel env vars before the cron fires.

### 3c. Add Vercel domains

Configure your custom domain in Vercel → Settings → Domains if applicable.

---

## 4. Rate Limiting — Production Caveat

The current rate limiter uses an **in-memory Map** that resets on every Vercel cold start. This means:
- Rate limit state is not shared across serverless function instances
- After a cold start, the rate limit window resets for all keys

**For low-traffic MVP this is acceptable.** For production at scale, replace with Redis/Upstash:
1. Add `@upstash/ratelimit` and `@upstash/redis`
2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel
3. Rewrite `src/lib/security/rate-limiter.ts` to use sliding window Redis rate limiter

This is tracked as a known risk but not a blocker for MVP launch.

---

## 5. DOI Resolution — Crossref API

DOI metadata is fetched from `https://api.crossref.org/works/{doi}`. Crossref's Polite Pool is free but rate-limited. For higher volume, register for the Crossref Plus API:
- https://www.crossref.org/documentation/retrieve-metadata/rest-api/
- Set a contact email in the User-Agent header (already done: `EvidencePlatform/0.1`)

---

## 6. File Upload Scanning (Optional — Post-MVP)

The platform accepts PDF and DOCX uploads but does not currently scan them for malware. For production with untrusted uploads, integrate a scanning service:
- **Option A:** ClamAV via a Supabase Edge Function
- **Option B:** VirusTotal API (requires API key in `VIRUSTOTAL_API_KEY`)
- **Option C:** Cloudflare Zero Trust Gateway

This is a post-MVP concern — the current MIME type and size validation provides basic protection.

---

## 7. Benchmark Runs

The benchmarking system at `/api/benchmarks/run` is protected by the same auth as the rest of the API. Run it once after deployment to establish a baseline:

```bash
curl -X POST https://your-domain.com/api/benchmarks/run \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"suite": "scoring"}'
```

---

## Summary Checklist

- [ ] Set 6 required environment variables in Vercel
- [ ] Create `.env.local` for local development
- [ ] Run database migrations (001 and 002)
- [ ] Verify RLS is enabled on all 14 tables
- [ ] **Create `case-uploads` Storage bucket in Supabase (private, 15 MB limit)**
- [ ] Confirm Supabase Auth is configured
- [ ] Deploy to Vercel (`npx vercel --prod`)
- [ ] Verify cron job appears in Vercel dashboard
- [ ] Generate and set `CRON_SECRET`
- [ ] Verify `/api/health` returns `{"ok": true, "version": "0.1.0"}`
- [ ] Optionally: plan Redis rate limiter upgrade
