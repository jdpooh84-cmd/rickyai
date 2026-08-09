# E2E Testing Guide

## Overview

The E2E test suite runs browser-level and HTTP-level tests against a live Next.js dev server. Tests are organized into two tiers based on infrastructure requirements.

## Running Tests

```bash
# Tier A only (no credentials or Docker required):
npm run test:e2e

# Tier A + Tier B (requires local Supabase + test account):
npx supabase start   # Docker required
E2E_TEST_EMAIL=test@example.com \
E2E_TEST_PASSWORD=your-password \
npm run test:e2e

# Against a deployed URL (skips webServer startup):
PLAYWRIGHT_BASE_URL=https://your-deploy.vercel.app npm run test:e2e
```

## Test Architecture

### Tier A — No-auth tests (19 tests)

Run without any credentials or Docker. The Next.js dev server starts with Supabase placeholder values. Supabase SSR's `getUser()` returns `null` without a session cookie and makes **no network call**, so no real Supabase is needed for these tests.

Covers:
- Health endpoint response shape (`ok: true`, `status: "ok"`)
- Login and signup page rendering
- Unauthenticated redirect for 5 protected routes (`/dashboard`, `/cases`, `/verify`, `/commitments`, `/commitments/new`)
- API 401 enforcement for all protected endpoints
- Cron endpoint auth: no bearer → 401, wrong bearer → 401, correct bearer → not 401

### Tier B — Auth-required tests (9 tests, skipped as `E2E_BLOCKED_DOCKER_UNAVAILABLE`)

Require a running local Supabase instance (Docker) and valid test credentials (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`).

Covers:
- Authenticated case list access
- Text case submission via API
- Report export fields
- Commitment pages (new, list)
- Benchmark authorization (regular user blocked)
- Organization isolation (RLS enforcement via cross-org case access)
- File upload (valid PDF → 201)
- File extraction failure (zero-byte → 400/422)

Tier B tests use `test.describe`-level `test.skip()` so the browser is never launched when credentials are absent — they appear as skipped (`-`) not failed (`✘`).

## Environment Variables

| Variable | Used by | Default in tests |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All server routes | `http://127.0.0.1:54321` (placeholder) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth, SSR | Supabase standard local-dev placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | Service operations | Supabase standard local-dev placeholder |
| `AI_PROVIDER` | AI calls | `mock` |
| `E2E_TEST_MODE` | Server-side test detection | `true` |
| `CRON_SECRET` | Cron auth tests | `e2e-test-cron-secret-32-chars-xx` |
| `E2E_TEST_EMAIL` | Tier B sign-in | — (required for Tier B) |
| `E2E_TEST_PASSWORD` | Tier B sign-in | — (required for Tier B) |
| `E2E_ORG_B_EMAIL` | Org isolation test | — (required for B-7) |
| `E2E_ORG_B_PASSWORD` | Org isolation test | — (required for B-7) |

The Supabase local dev placeholder values are the standard defaults published by Supabase for `supabase init` projects — they are intentionally non-secret and widely documented.

## Browser Configuration

The project uses `@playwright/test` with a pre-installed Chromium binary:

```
executablePath: /opt/pw-browsers/chromium
```

This symlinks to the full Chrome binary rather than the headless shell, avoiding build-number mismatches when the installed Playwright version differs from what the environment provides. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` prevents postinstall from fetching a different version.

## Cron Auth Test Logic

The correct-bearer cron test (`A-5`) asserts `status !== 401` rather than `=== 200` because:

1. With the correct bearer, auth passes
2. The handler then attempts `pollAndProcessJobs()`, which calls the Supabase DB
3. Without a real Supabase, the DB call returns 500
4. A 500 response proves auth succeeded (it would have been 401 otherwise)

This is the correct assertion in a no-Docker environment.

## Artifacts

- Test results: `tests/e2e/.results/` (traces, screenshots, videos on failure)
- HTML report: `tests/e2e/.report/` (run `npx playwright show-report tests/e2e/.report`)

Both paths are `.gitignore`d.

## Reproducing a Failure

```bash
# Run with trace on all tests (not just failures):
PLAYWRIGHT_TRACE=on npm run test:e2e

# View trace for a specific test:
npx playwright show-trace tests/e2e/.results/<test-name>/trace.zip

# Run a single test:
npx playwright test --grep "health endpoint"
```
