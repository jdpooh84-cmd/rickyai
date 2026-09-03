/**
 * Lightweight runtime validation for Supabase Edge Functions.
 * Uses a subset of Zod-style schema composition without the npm:zod package
 * to keep cold-start time minimal. For complex schemas import npm:zod directly.
 */

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/.test(value)) {
    throw new ValidationError(field, `${field} must be a valid UUID`);
  }
  return value;
}

export function requireString(
  value: unknown,
  field: string,
  maxLen = 1000,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(field, `${field} is required`);
  }
  if (value.length > maxLen) {
    throw new ValidationError(
      field,
      `${field} must be ≤ ${maxLen} characters`,
    );
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  field: string,
  maxLen = 1000,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ValidationError(field, `${field} must be a string`);
  }
  if (value.length > maxLen) {
    throw new ValidationError(
      field,
      `${field} must be ≤ ${maxLen} characters`,
    );
  }
  return value.trim();
}

export function requireOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (!allowed.includes(value as T)) {
    throw new ValidationError(
      field,
      `${field} must be one of: ${allowed.join(", ")}`,
    );
  }
  return value as T;
}

export function requirePositiveInt(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(field, `${field} must be a positive integer`);
  }
  return n;
}

export function optionalInt(
  value: unknown,
  field: string,
  defaultValue: number,
): number {
  if (value === undefined || value === null) return defaultValue;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new ValidationError(field, `${field} must be an integer`);
  }
  return n;
}

/**
 * Wraps a validation block so ValidationError becomes a 400 response.
 * Usage:
 *   const result = validate(() => {
 *     return {
 *       businessId: requireUuid(body.businessId, "businessId"),
 *       channel: requireOneOf(body.channel, "channel", ["sms","email"]),
 *     };
 *   });
 *   if (result instanceof Response) return result;
 */
export function validate<T>(fn: () => T): T | Response {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ValidationError) {
      return badRequest(`${err.field}: ${err.message}`);
    }
    throw err;
  }
}
