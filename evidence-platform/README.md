# Evidence Assurance and Accountability Platform

An MVP that automatically performs verification work on AI-generated text, documents, URLs, citations, DOIs, and commitments. Built on the "Turning Over the Rock" principle: no material claim is trusted from surface presentation.

## What It Does

- Extracts checkable factual claims from submitted text or documents
- Validates DOI and citation metadata against Crossref and DataCite
- Fetches and checks supporting source passages for direct entailment
- Runs an adversarial skeptical review designed to reject weak claims
- Applies deterministic policy rules and produces a plain-language verdict
- Tracks commitments and compares them against later evidence

## What It Does NOT Claim

- Does not scrape the entire internet
- Does not determine real-world identities
- Does not monitor private communications
- Does not guarantee objective truth
- Does not give medical, legal, investment, tax, or safety advice
- Does not replace qualified professionals

## Verdict Scale

| Verdict | Meaning |
|---|---|
| VERIFIED_ENOUGH_TO_ACT | Strong direct evidence, passed adversarial review |
| PARTIALLY_SUPPORTED | Some evidence, scope or recency limits apply |
| MIXED_OR_UNCERTAIN | Conflicting credible sources or insufficient data |
| UNVERIFIABLE | Source inaccessible or claim too vague to check |
| CONTRADICTED | Credible contrary evidence found |
| REQUIRES_QUALIFIED_REVIEW | High-stakes; professional review needed |

## Local Development

### Prerequisites

- Node.js 22+
- Supabase CLI
- A Supabase project (or local Supabase via `supabase start`)

### Setup

```bash
cd evidence-platform
npm install
cp .env.example .env.local
# Fill in .env.local with your Supabase URL, anon key, and optional Anthropic key
npm run dev
```

### Running Tests

```bash
npm run test          # unit + integration
npm run test:e2e      # Playwright end-to-end
npm run test:coverage # coverage report
```

### Type Check and Lint

```bash
npm run typecheck
npm run lint
npm run format:check
```

### Database Migrations

```bash
supabase db push --linked   # push migrations to linked project
```

## Environment Variables

See `.env.example` for all required and optional variables.

**Required for production:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `ANTHROPIC_API_KEY` (server-only; omit to use mock provider)

## Deployment

The app is Vercel-compatible. Connect your repository and set environment variables in Vercel dashboard. Run Supabase migrations separately via `supabase db push --linked`.

## Architecture

See `docs/architecture.md` for system design details.
