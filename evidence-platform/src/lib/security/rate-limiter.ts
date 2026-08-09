interface RateLimitEntry {
  requests: number[];
}

const store = new Map<string, RateLimitEntry>();

const MAX_REQUESTS = parseInt(process.env["RATE_LIMIT_MAX_REQUESTS"] ?? "50", 10);
const WINDOW_MS = parseInt(process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000", 10);

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key) ?? { requests: [] };

  entry.requests = entry.requests.filter((ts) => now - ts < WINDOW_MS);
  entry.requests.push(now);
  store.set(key, entry);

  const remaining = Math.max(0, MAX_REQUESTS - entry.requests.length);
  return { allowed: entry.requests.length <= MAX_REQUESTS, remaining };
}

export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : "unknown";
  return `ip:${ip ?? "unknown"}`;
}
