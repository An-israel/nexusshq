import { timingSafeEqual } from "node:crypto";

/**
 * Verifies that a request to a /api/public/cron/* endpoint carries the
 * project's service-role key as a bearer token — the same credential pg_cron
 * sends via `current_setting('app.service_role_key', true)` in the job
 * definitions (see 20260608160000_cron_endpoint_auth.sql). Comparison is
 * constant-time, mirroring the Paystack webhook's signature check.
 *
 * Returns a 401/500 Response when the request should be rejected, or null
 * when it's authenticated and the handler may proceed.
 */
export function verifyCronRequest(request: Request): Response | null {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expected) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not configured; refusing cron request");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  const given = match?.[1] ?? "";

  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(given, "utf8");
  const valid = expectedBuf.length === givenBuf.length && timingSafeEqual(expectedBuf, givenBuf);

  if (!valid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
