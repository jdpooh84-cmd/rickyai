import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/security/rate-limiter";

describe("checkRateLimit", () => {
  it("allows requests within the limit", () => {
    const key = `test-${Date.now()}-1`;
    const result = checkRateLimit(key);
    expect(result.allowed).toBe(true);
  });

  it("blocks requests after exceeding the limit", () => {
    const key = `test-${Date.now()}-2`;
    const MAX = parseInt(process.env["RATE_LIMIT_MAX_REQUESTS"] ?? "50", 10);

    for (let i = 0; i < MAX; i++) {
      checkRateLimit(key);
    }

    const result = checkRateLimit(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("different keys have independent limits", () => {
    const key1 = `test-${Date.now()}-3`;
    const key2 = `test-${Date.now()}-4`;

    const result1 = checkRateLimit(key1);
    const result2 = checkRateLimit(key2);

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
  });
});
