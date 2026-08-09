import "server-only";
import crypto from "crypto";

const TIMEOUT_MS = parseInt(process.env["FETCH_TIMEOUT_MS"] ?? "10000", 10);
const MAX_BYTES = parseInt(process.env["FETCH_MAX_BYTES"] ?? "2097152", 10);
const MAX_REDIRECTS = parseInt(process.env["FETCH_MAX_REDIRECTS"] ?? "3", 10);

const ALLOWED_CONTENT_TYPES = new Set([
  "text/html",
  "text/plain",
  "application/pdf",
]);

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254",
  "metadata.google.internal",
]);

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
  /^::1$/,
];

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFError";
  }
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

function normalizeHostname(hostname: string): string {
  // WHATWG URL preserves brackets on IPv6: "[::1]" → strip them
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname.toLowerCase();
}

function isPrivateAddress(rawHostname: string): boolean {
  if (!rawHostname) return true; // empty host is never safe
  const hostname = normalizeHostname(rawHostname);
  if (BLOCKED_HOSTS.has(hostname)) return true;
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

function validateUrl(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new FetchError("Invalid URL format", "INVALID_URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SSRFError(`Protocol ${url.protocol} is not allowed`);
  }

  if (!url.hostname) {
    throw new SSRFError("URL has no host");
  }

  const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
  const standardPorts = new Set([80, 443, 8080, 8443]);
  if (!standardPorts.has(port)) {
    throw new SSRFError(`Non-standard port ${port} is not allowed`);
  }

  if (isPrivateAddress(url.hostname)) {
    throw new SSRFError(`Host ${url.hostname} is a private or reserved address`);
  }

  return url;
}

function extractContentType(headers: Headers): string {
  return (headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export interface FetchResult {
  url: string;
  canonicalUrl: string;
  statusCode: number;
  contentType: string;
  text: string;
  contentHash: string;
  retrievedAt: string;
  size: number;
}

export async function fetchUrl(rawUrl: string): Promise<FetchResult> {
  validateUrl(rawUrl);

  let currentUrl = rawUrl;
  let redirectCount = 0;
  let response: Response | null = null;

  while (redirectCount <= MAX_REDIRECTS) {
    validateUrl(currentUrl);

    response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "User-Agent": "EvidencePlatform/0.1 (evidence verification; +https://evidenceplatform.app)",
        Accept: "text/html,text/plain,application/pdf",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) break;

      const next = new URL(location, currentUrl).toString();
      validateUrl(next);
      currentUrl = next;
      redirectCount++;
      continue;
    }

    break;
  }

  if (!response) {
    throw new FetchError("No response received", "NO_RESPONSE");
  }

  if (redirectCount > MAX_REDIRECTS) {
    throw new FetchError("Too many redirects", "TOO_MANY_REDIRECTS");
  }

  if (!response.ok) {
    throw new FetchError(`HTTP ${response.status}`, "HTTP_ERROR");
  }

  const contentType = extractContentType(response.headers);
  const baseContentType = contentType.split(";")[0]?.trim() ?? "";

  if (!ALLOWED_CONTENT_TYPES.has(baseContentType)) {
    throw new FetchError(`Content type ${contentType} is not allowed`, "DISALLOWED_CONTENT_TYPE");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    throw new FetchError(`Response exceeds ${MAX_BYTES} byte limit`, "SIZE_LIMIT");
  }

  const buffer = Buffer.from(arrayBuffer);
  const raw = buffer.toString("utf-8");
  const text = baseContentType === "text/html" ? htmlToText(raw) : raw;
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  return {
    url: rawUrl,
    canonicalUrl: currentUrl,
    statusCode: response.status,
    contentType,
    text,
    contentHash,
    retrievedAt: new Date().toISOString(),
    size: arrayBuffer.byteLength,
  };
}
