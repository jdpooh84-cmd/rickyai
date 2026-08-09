import { describe, it, expect } from "vitest";
import { sanitizeForLog } from "@/lib/security/sanitizer";

describe("sanitizeForLog", () => {
  it("redacts JWT tokens", () => {
    const input = "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123def456ghi789";
    const result = sanitizeForLog(input) as string;
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("redacts Anthropic API keys", () => {
    const input = "key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
    const result = sanitizeForLog(input) as string;
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("sk-ant");
  });

  it("redacts password fields in objects", () => {
    const input = { username: "user@example.com", password: "supersecret" };
    const result = sanitizeForLog(input) as Record<string, unknown>;
    expect(result["password"]).toBe("[REDACTED]");
    expect(result["username"]).toBe("user@example.com");
  });

  it("redacts SSN pattern", () => {
    const input = "SSN: 123-45-6789";
    const result = sanitizeForLog(input) as string;
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("123-45-6789");
  });

  it("passes through safe strings unchanged", () => {
    const input = "User submitted a claim about the market size of $50 billion.";
    const result = sanitizeForLog(input) as string;
    expect(result).toBe(input);
  });

  it("recursively sanitizes nested objects", () => {
    const input = { outer: { token: "sk-realkey12345678901234567890123456" } };
    const result = sanitizeForLog(input) as Record<string, Record<string, unknown>>;
    expect(result["outer"]?.["token"]).toBe("[REDACTED]");
  });

  it("handles arrays", () => {
    const input = ["safe string", "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature"];
    const result = sanitizeForLog(input) as string[];
    expect(result[0]).toBe("safe string");
    expect(result[1]).toContain("[REDACTED]");
  });
});
