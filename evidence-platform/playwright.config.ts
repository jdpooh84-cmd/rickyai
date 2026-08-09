import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

// Supabase local dev defaults (published by Supabase as the standard local-dev placeholder
// values — intentionally non-secret, used across every default `supabase init` project).
// These are used only when real env vars are absent, allowing the server to initialize
// without crashing. Unauthenticated tests do not make network calls to these URLs.
const SUPABASE_LOCAL_URL = "http://127.0.0.1:54321";
const SUPABASE_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqh8GVzOwKkef5dF6PbkQHrYfwQFZ2m3s";
const SUPABASE_LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.results",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: [["html", { outputFolder: "tests/e2e/.report", open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the pre-installed Chromium binary rather than a version-matched download.
        // The installed build may differ from what `@playwright/test` would auto-download,
        // so we pin directly. See PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers in the env.
        launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
      },
    },
  ],

  webServer: process.env["PLAYWRIGHT_BASE_URL"]
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env["CI"],
        timeout: 120 * 1000,
        env: {
          // Always use the deterministic mock AI provider in E2E runs
          AI_PROVIDER: "mock",
          // Signal to server-side code that this is an E2E test environment
          E2E_TEST_MODE: "true",
          // Supabase: prefer real env vars; fall back to local dev placeholders.
          // Unauthenticated tests do not trigger Supabase network calls — the placeholders
          // satisfy the "non-empty URL" requirement without reaching any network.
          // Authenticated test paths require a real local Supabase instance (Docker).
          NEXT_PUBLIC_SUPABASE_URL:
            process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? SUPABASE_LOCAL_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? SUPABASE_LOCAL_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY:
            process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? SUPABASE_LOCAL_SERVICE_KEY,
          // Cron secret: fixed test value used to verify auth enforcement
          CRON_SECRET: process.env["CRON_SECRET"] ?? "e2e-test-cron-secret-32-chars-xx",
        },
      },
});
