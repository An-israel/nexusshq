/**
 * Best-effort in-memory sliding-window rate limiter for Cloudflare Workers.
 *
 * Limits are per-isolate and reset when the isolate is recycled. For
 * production-grade distributed rate limiting, add Cloudflare Rate Limiting
 * rules (WAF > Rate Limiting) at the infrastructure level — this layer is
 * groundwork: it prevents bursty abuse within a single isolate and provides
 * a clear server-side 429 path so clients and future distributed backends
 * can build on it.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const BUCKETS = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/**
 * Returns { ok: true } when the request is within the window quota, or
 * { ok: false, retryAfterSeconds } when it should be rejected.
 *
 * @param key      Unique rate-limit key (e.g. `ai:user:${userId}`)
 * @param limit    Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = BUCKETS.get(key);

  if (!entry || entry.resetAt <= now) {
    if (BUCKETS.size >= MAX_TRACKED_KEYS) {
      for (const [k, v] of BUCKETS) {
        if (v.resetAt <= now) BUCKETS.delete(k);
      }
    }
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/** Returns a 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "Too many requests — please wait before retrying" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/**
 * Derives a stable rate-limit key from a request.
 * Prefers authenticated user ID; falls back to the client IP extracted from
 * Cloudflare's cf-connecting-ip header (or x-forwarded-for as a fallback).
 */
export function clientKey(request: Request, prefix: string, userId?: string | null): string {
  if (userId) return `${prefix}:user:${userId}`;
  const ip =
    request.headers.get("cf-connecting-ip") ??
    ((request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown");
  return `${prefix}:ip:${ip}`;
}
