import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type WorkspacePlan = Database["public"]["Enums"]["workspace_plan"];

// Plans actually sold on the billing page — anything else in the metadata is
// ignored so a tampered/legacy value can't write an invalid plan.
const PLAN_SEATS: Partial<Record<WorkspacePlan, number>> = {
  basic: 7,
  enterprise: 15,
  unlimited: 999,
};

interface PaystackChargeEvent {
  event: string;
  data: {
    reference?: string;
    metadata?: {
      workspace_id?: string;
      plan?: string;
      interval?: string;
    } | null;
  };
}

function isValidSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expectedHex = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(expectedHex, "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Server-side handler: receives Paystack transaction events and activates the
// paid plan on the workspace. PAYSTACK_SECRET_KEY must be set in the server
// environment — it both authenticates outbound calls and verifies that this
// webhook genuinely came from Paystack (HMAC-SHA512 of the raw body).
export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
          console.error("PAYSTACK_SECRET_KEY not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const rawBody = await request.text();
        if (!isValidSignature(rawBody, request.headers.get("x-paystack-signature"), secretKey)) {
          console.error("Paystack webhook: invalid signature");
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        let event: PaystackChargeEvent;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        // Acknowledge every event quickly; only "charge.success" activates a plan.
        if (event.event === "charge.success") {
          await activatePlanFromCharge(event.data);
        }

        return Response.json({ received: true });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

async function activatePlanFromCharge(data: PaystackChargeEvent["data"]) {
  const metadata = data.metadata ?? {};
  const workspaceId = metadata.workspace_id;
  const planId = metadata.plan;
  const interval = metadata.interval === "annual" ? "annual" : "monthly";
  const reference = data.reference ?? null;

  if (!workspaceId || !planId || !(planId in PLAN_SEATS)) {
    console.error("Paystack webhook: missing or unrecognized metadata", metadata);
    return;
  }

  const plan = planId as WorkspacePlan;
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + (interval === "annual" ? 12 : 1));

  await supabaseAdmin
    .from("workspaces")
    .update({ plan, plan_seats: PLAN_SEATS[plan] })
    .eq("id", workspaceId);

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const subscriptionFields = {
    plan,
    status: "active",
    billing_interval: interval,
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    paystack_reference: reference,
  };

  if (existing) {
    await supabaseAdmin.from("subscriptions").update(subscriptionFields).eq("id", existing.id);
  } else {
    await supabaseAdmin
      .from("subscriptions")
      .insert({ workspace_id: workspaceId, ...subscriptionFields });
  }
}
