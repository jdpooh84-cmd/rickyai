import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchUrl, SSRFError, FetchError } from "@/lib/retrieval/url-fetcher";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function expectSSRF(url: string) {
  try {
    await fetchUrl(url);
    expect.fail(`Expected SSRFError for "${url}" but none was thrown`);
  } catch (err) {
    expect(err, `"${url}" did not throw SSRFError`).toBeInstanceOf(SSRFError);
  }
}

async function expectFetchError(url: string, code?: string) {
  try {
    await fetchUrl(url);
    expect.fail(`Expected FetchError for "${url}" but none was thrown`);
  } catch (err) {
    expect(err, `"${url}" did not throw FetchError`).toBeInstanceOf(FetchError);
    if (code) {
      expect((err as FetchError).code).toBe(code);
    }
  }
}

// For "valid URL passes SSRF checks" cases we mock fetch to avoid real network
// calls. The tests assert only that SSRFError is NOT thrown (the mock ensures
// fetch itself resolves quickly).
function mockFetchOk() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("ok", {
      status: 200,
      headers: { "content-type": "text/plain" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Blocked private hosts ────────────────────────────────────────────────────

describe("SSRF protection — blocked private hosts", () => {
  it("blocks localhost", async () => {
    await expectSSRF("http://localhost/secret");
  });

  it("blocks 127.0.0.1", async () => {
    await expectSSRF("http://127.0.0.1/anything");
  });

  it("blocks ::1 IPv6 loopback (WHATWG bracket notation)", async () => {
    await expectSSRF("http://[::1]/anything");
  });

  it("blocks 0.0.0.0", async () => {
    await expectSSRF("http://0.0.0.0/anything");
  });

  it("blocks 169.254.169.254 AWS/GCP metadata endpoint", async () => {
    await expectSSRF("http://169.254.169.254/latest/meta-data/");
  });

  it("blocks metadata.google.internal", async () => {
    await expectSSRF("http://metadata.google.internal/computeMetadata/v1/");
  });
});

// ─── Blocked private IP ranges ───────────────────────────────────────────────

describe("SSRF protection — blocked private IP ranges", () => {
  it("blocks 10.0.0.1 RFC1918", async () => {
    await expectSSRF("http://10.0.0.1/");
  });

  it("blocks 10.255.255.255 RFC1918", async () => {
    await expectSSRF("http://10.255.255.255/");
  });

  it("blocks 172.16.0.1 RFC1918", async () => {
    await expectSSRF("http://172.16.0.1/");
  });

  it("blocks 172.31.255.255 RFC1918", async () => {
    await expectSSRF("http://172.31.255.255/");
  });

  it("blocks 192.168.1.1 RFC1918", async () => {
    await expectSSRF("http://192.168.1.1/");
  });

  it("blocks link-local 169.254.1.1", async () => {
    await expectSSRF("http://169.254.1.1/");
  });

  it("does not block 172.15.0.1 (not RFC1918)", async () => {
    mockFetchOk();
    await expect(fetchUrl("http://172.15.0.1/")).resolves.toBeDefined();
  });
});

// ─── Blocked protocols ────────────────────────────────────────────────────────

describe("SSRF protection — blocked protocols", () => {
  it("blocks file:// protocol", async () => {
    await expectSSRF("file:///etc/passwd");
  });

  it("blocks ftp:// protocol", async () => {
    await expectSSRF("ftp://example.com/file");
  });

  it("blocks javascript: protocol", async () => {
    // new URL("javascript:alert(1)").protocol === "javascript:" → SSRFError
    await expectSSRF("javascript:alert(1)");
  });
});

// ─── Blocked non-standard ports ───────────────────────────────────────────────

describe("SSRF protection — blocked non-standard ports", () => {
  it("blocks port 22 SSH", async () => {
    await expectSSRF("http://example.com:22/");
  });

  it("blocks port 3000 dev server", async () => {
    await expectSSRF("http://example.com:3000/");
  });

  it("blocks port 5432 Postgres", async () => {
    await expectSSRF("http://example.com:5432/");
  });

  it("blocks port 6379 Redis", async () => {
    await expectSSRF("http://example.com:6379/");
  });
});

// ─── Valid ports pass SSRF checks (fetch mocked) ──────────────────────────────

describe("SSRF protection — valid ports are not blocked", () => {
  it("allows port 80", async () => {
    mockFetchOk();
    await expect(fetchUrl("http://example.com:80/")).resolves.toBeDefined();
  });

  it("allows implicit port 80 (http://)", async () => {
    mockFetchOk();
    await expect(fetchUrl("http://example.com/")).resolves.toBeDefined();
  });

  it("allows port 443", async () => {
    mockFetchOk();
    await expect(fetchUrl("https://example.com:443/")).resolves.toBeDefined();
  });

  it("allows implicit port 443 (https://)", async () => {
    mockFetchOk();
    await expect(fetchUrl("https://example.com/")).resolves.toBeDefined();
  });

  it("allows port 8080", async () => {
    mockFetchOk();
    await expect(fetchUrl("http://example.com:8080/")).resolves.toBeDefined();
  });

  it("allows port 8443", async () => {
    mockFetchOk();
    await expect(fetchUrl("http://example.com:8443/")).resolves.toBeDefined();
  });
});

// ─── Malformed URLs ───────────────────────────────────────────────────────────

describe("SSRF protection — malformed URLs", () => {
  it("rejects invalid URL format", async () => {
    await expectFetchError("not-a-url", "INVALID_URL");
  });

  it("rejects empty string", async () => {
    await expectFetchError("", "INVALID_URL");
  });

  it("rejects URL with no host (http:///path)", async () => {
    // Node.js WHATWG URL parser may produce hostname="" or throw — either way,
    // fetchUrl must throw SSRFError or FetchError and never succeed.
    let threw = false;
    try {
      await fetchUrl("http:///path");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
