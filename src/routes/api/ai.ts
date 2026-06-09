import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { checkRateLimit, clientKey, tooManyRequests } from "@/server/rate-limit.server";
import { callAI } from "@/server/ai.server";

// Browser-facing gateway: verifies the caller is a signed-in user and applies
// per-user rate limiting before proxying to the shared callAI() helper.
// ANTHROPIC_API_KEY must be set in Cloudflare Workers environment variables.
export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const rl = checkRateLimit(clientKey(request, "ai", user.id), 30, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

        let body: { action: string; context?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const outcome = await callAI(body.action, body.context ?? {});
        if ("error" in outcome) {
          return Response.json({ error: outcome.error }, { status: outcome.status });
        }
        return Response.json({ result: outcome.result });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
