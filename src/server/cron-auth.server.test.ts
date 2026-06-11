import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyCronRequest } from "./cron-auth.server";

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("verifyCronRequest", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
  });

  it("rejects requests with no Authorization header", async () => {
    const res = verifyCronRequest(new Request("https://example.com"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("rejects requests with the wrong bearer token", async () => {
    const res = verifyCronRequest(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    );
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("accepts requests with the correct bearer token", () => {
    const res = verifyCronRequest(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer test-service-role-key" },
      }),
    );
    expect(res).toBeNull();
  });

  it("returns 500 when SUPABASE_SERVICE_ROLE_KEY is not configured", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = verifyCronRequest(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer anything" },
      }),
    );
    expect(res).not.toBeNull();
    expect(res?.status).toBe(500);
  });
});
