const REDACT = "[REDACTED]";

const PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "jwt", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  {
    name: "api_key",
    pattern: /\b(sk-[A-Za-z0-9]{32,}|sk-ant-[A-Za-z0-9_-]{32,}|anth_[A-Za-z0-9]{32,})\b/g,
  },
  { name: "supabase_key", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    name: "credit_card",
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6011[0-9]{12})\b/g,
  },
  { name: "password_field", pattern: /"password"\s*:\s*"[^"]*"/gi },
  { name: "token_field", pattern: /"(?:token|secret|key|api_key)"\s*:\s*"[^"]*"/gi },
  { name: "bearer", pattern: /Bearer [A-Za-z0-9_\-\.]+/g },
];

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const { pattern } of PATTERNS) {
      result = result.replace(pattern, REDACT);
    }
    return result;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeForLog);
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const sensitiveKeys = new Set([
        "password",
        "token",
        "secret",
        "api_key",
        "apiKey",
        "service_role_key",
        "authorization",
        "cookie",
      ]);
      if (sensitiveKeys.has(k.toLowerCase())) {
        sanitized[k] = REDACT;
      } else {
        sanitized[k] = sanitizeForLog(v);
      }
    }
    return sanitized;
  }

  return value;
}

export function safeLog(level: "info" | "warn" | "error", message: string, data?: unknown) {
  const entry = {
    level,
    message,
    ...(data !== undefined ? { data: sanitizeForLog(data) } : {}),
    timestamp: new Date().toISOString(),
  };
  const str = JSON.stringify(entry);

  if (level === "error") {
    console.error(str);
  } else if (level === "warn") {
    console.warn(str);
  } else {
    console.log(str);
  }
}
