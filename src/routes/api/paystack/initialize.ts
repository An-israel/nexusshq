import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { checkRateLimit, clientKey, tooManyRequests } from "@/server/rate-limit.server";

// Server-side handler: starts a Paystack hosted-checkout transaction for a
// workspace plan upgrade. PAYSTACK_SECRET_KEY must be set in the server
// environment — never expose it client-side. The amount is computed here
// (not trusted from the client) so the price can't be tampered with.
export const Route = createFileRoute("/api/paystack/initialize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const rl = checkRateLimit(clientKey(request, "paystack-init", user.id), 10, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
          return Response.json(
            { error: "PAYSTACK_SECRET_KEY is not configured in server environment variables." },
            { status: 500 },
          );
        }

        let body: {
          workspaceId?: string;
          workspaceSlug?: string;
          planId?: string;
          interval?: "monthly" | "annual";
          email?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { workspaceId, workspaceSlug, planId, email } = body;
        const interval = body.interval === "annual" ? "annual" : "monthly";

        const monthlyNaira = PLAN_MONTHLY_NGN[planId ?? ""];
        if (!workspaceId || !workspaceSlug || !monthlyNaira || !email) {
          return Response.json(
            { error: "workspaceId, workspaceSlug, a valid planId, and email are required" },
            { status: 400 },
          );
        }

        const effectiveMonthly =
          interval === "annual" ? Math.round(monthlyNaira * (1 - ANNUAL_DISCOUNT)) : monthlyNaira;
        const totalNaira = interval === "annual" ? effectiveMonthly * 12 : effectiveMonthly;
        const amountKobo = totalNaira * 100;

        const origin = request.headers.get("origin") ?? new URL(request.url).origin;

        let paystackResp: Response;
        try {
          paystackResp = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              amount: amountKobo,
              currency: "NGN",
              callback_url: `${origin}/${workspaceSlug}/billing`,
              metadata: { workspace_id: workspaceId, plan: planId, interval },
            }),
          });
        } catch (err) {
          console.error("Paystack initialize request failed:", err);
          return Response.json({ error: "Failed to reach Paystack" }, { status: 502 });
        }

        const data = (await paystackResp.json()) as {
          status?: boolean;
          message?: string;
          data?: { authorization_url?: string; reference?: string };
        };

        if (!paystackResp.ok || !data.status || !data.data?.authorization_url) {
          return Response.json(
            { error: data.message ?? "Failed to initialize Paystack transaction" },
            { status: 502 },
          );
        }

        return Response.json({
          authorization_url: data.data.authorization_url,
          reference: data.data.reference,
        });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

// Prices in Naira — must mirror the PLAN_MONTHLY map shown on the billing page
// (src/routes/_app.$workspaceSlug.billing.tsx) so the charge matches the UI.
const PLAN_MONTHLY_NGN: Record<string, number> = {
  basic: 15000,
  enterprise: 25000,
  unlimited: 45000,
};
const ANNUAL_DISCOUNT = 0.3;
