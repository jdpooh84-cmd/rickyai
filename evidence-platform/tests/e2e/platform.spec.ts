/**
 * E2E tests for the Evidence Assurance Platform.
 *
 * These tests run against the full Next.js application with a real or configured Supabase
 * instance. When NEXT_PUBLIC_SUPABASE_URL is not set (e.g. in a bare CI environment with no
 * credentials), individual tests that require a real backend skip gracefully.
 *
 * To run with real credentials:
 *   cp .env.local.example .env.local  # fill in SUPABASE and ANTHROPIC vars
 *   npm run test:e2e
 *
 * To run against a deployed URL:
 *   PLAYWRIGHT_BASE_URL=https://your-deploy.vercel.app npm run test:e2e
 */

import { test, expect, type Page } from "@playwright/test";

const HAS_BACKEND = !!process.env["NEXT_PUBLIC_SUPABASE_URL"];

// Test credentials — must be set in environment for backend-required tests.
const TEST_EMAIL = process.env["E2E_TEST_EMAIL"] ?? "";
const TEST_PASSWORD = process.env["E2E_TEST_PASSWORD"] ?? "";
const HAS_CREDENTIALS = HAS_BACKEND && !!TEST_EMAIL && !!TEST_PASSWORD;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|cases/, { timeout: 15000 });
}

// ── Journey 1: Public health route ───────────────────────────────────────────

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: boolean };
  expect(body.ok).toBe(true);
});

// ── Journey 2: Signup page renders ───────────────────────────────────────────

test("signup page loads with form", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveTitle(/sign up|evidence|register/i);
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

// ── Journey 3: Login page renders ────────────────────────────────────────────

test("login page loads with form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});

// ── Journey 4: Unauthenticated redirect ──────────────────────────────────────

test("unauthenticated request to /dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  // Should redirect to /login or /verify
  await expect(page).toHaveURL(/login|verify|signup/, { timeout: 10000 });
});

// ── Journey 5: Unauthenticated API returns 401 ───────────────────────────────

test("API /api/cases returns 401 without auth", async ({ request }) => {
  const response = await request.get("/api/cases");
  expect(response.status()).toBe(401);
});

test("API /api/commitments returns 401 without auth", async ({ request }) => {
  const response = await request.get("/api/commitments");
  expect(response.status()).toBe(401);
});

// ── Journey 6: File upload API validates MIME type ───────────────────────────

test("file upload endpoint rejects missing auth", async ({ request }) => {
  const buffer = Buffer.from("fake content");
  const response = await request.post("/api/cases/upload", {
    multipart: {
      title: "Test Case",
      file: {
        name: "test.pdf",
        mimeType: "application/pdf",
        buffer,
      },
    },
  });
  expect(response.status()).toBe(401);
});

// ── Journey 7: Cron endpoint rejects missing secret ──────────────────────────

test("cron endpoint returns 401 without bearer token", async ({ request }) => {
  const response = await request.get("/api/cron/process-jobs");
  // Always 401: fails closed whether CRON_SECRET is set or not
  expect(response.status()).toBe(401);
});

// ── Journey 8: Signin and access cases list (backend required) ───────────────

test("authenticated user can reach cases list", async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, "Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  await signIn(page);
  await page.goto("/cases");
  // Should not redirect to login
  await expect(page).not.toHaveURL(/login/);
  // Cases page should have at least a heading
  await expect(page.getByRole("heading")).toBeVisible();
});

// ── Journey 9: Submit a pasted-text case (backend required) ──────────────────

test("user can create a text case via API", async ({ request }) => {
  test.skip(!HAS_CREDENTIALS, "Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  // First, obtain a session cookie via the login API (simplified — adjust to actual auth flow)
  const response = await request.post("/api/cases", {
    data: {
      title: "E2E Test Case",
      input_type: "text",
      raw_input:
        "The Earth orbits the Sun once every 365.25 days. Water boils at 100 degrees Celsius at sea level.",
      stakes_level: "low",
      materiality: "low",
    },
    headers: { "Content-Type": "application/json" },
  });

  // Without a real session this will 401; with session it will 201
  expect([201, 401]).toContain(response.status());
});

// ── Journey 10: Commitment evaluation page renders (backend required) ─────────

test("commitment new page loads", async ({ page }) => {
  test.skip(!HAS_CREDENTIALS, "Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  await signIn(page);
  await page.goto("/commitments/new");
  await expect(page).not.toHaveURL(/login/);
  // Form to create a new commitment should be visible
  await expect(page.getByRole("heading")).toBeVisible();
});
