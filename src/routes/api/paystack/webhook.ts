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

// Nigerian VAT rate (7.5%, inclusive in the charged amount)
const VAT_RATE = 0.075;

interface PaystackEvent {
  event: string;
  data: {
    reference?: string;
    amount?: number; // in kobo
    customer?: { email?: string };
    metadata?: {
      workspace_id?: string;
      plan?: string;
      interval?: string;
    } | null;
    subscription?: {
      metadata?: { workspace_id?: string } | null;
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

        let event: PaystackEvent;
        try {
          event = JSON.parse(rawBody);
        } catch {
          return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        switch (event.event) {
          case "charge.success":
            await activatePlanFromCharge(event.data);
            break;
          case "invoice.payment_failed":
            await handlePaymentFailed(event.data);
            break;
          case "subscription.disable":
            await handleSubscriptionDisable(event.data);
            break;
        }

        return Response.json({ received: true });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

async function activatePlanFromCharge(data: PaystackEvent["data"]) {
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

  let subscriptionId: string | null = null;
  if (existing) {
    await supabaseAdmin.from("subscriptions").update(subscriptionFields).eq("id", existing.id);
    subscriptionId = existing.id;
  } else {
    const { data: inserted } = await supabaseAdmin
      .from("subscriptions")
      .insert({ workspace_id: workspaceId, ...subscriptionFields })
      .select("id")
      .single();
    subscriptionId = inserted?.id ?? null;
  }

  // Create invoice record
  await createInvoice({
    workspaceId,
    subscriptionId,
    reference,
    plan,
    interval,
    amountKobo: data.amount ?? 0,
    customerEmail: data.customer?.email ?? null,
    periodStart,
    periodEnd,
  });
}

async function createInvoice({
  workspaceId,
  subscriptionId,
  reference,
  plan,
  interval,
  amountKobo,
  customerEmail,
  periodStart,
  periodEnd,
}: {
  workspaceId: string;
  subscriptionId: string | null;
  reference: string | null;
  plan: string;
  interval: string;
  amountKobo: number;
  customerEmail: string | null;
  periodStart: Date;
  periodEnd: Date;
}) {
  const amountNgn = Math.round(amountKobo / 100);
  // Nigerian VAT is inclusive: vat = total - total/1.075
  const vatNgn = Math.round(amountNgn - amountNgn / (1 + VAT_RATE));

  // Generate sequential invoice number (best-effort — low-traffic billing endpoint)
  const { count } = await supabaseAdmin
    .from("invoices")
    .select("*", { count: "exact", head: true });
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Fetch workspace name for the invoice customer_name field
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  await supabaseAdmin.from("invoices").insert({
    workspace_id: workspaceId,
    subscription_id: subscriptionId,
    paystack_reference: reference,
    invoice_number: invoiceNumber,
    plan,
    billing_interval: interval,
    amount_ngn: amountNgn,
    vat_ngn: vatNgn,
    status: "paid",
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    customer_email: customerEmail,
    customer_name: ws?.name ?? null,
  });
}

async function handlePaymentFailed(data: PaystackEvent["data"]) {
  const workspaceId = data.metadata?.workspace_id ?? data.subscription?.metadata?.workspace_id;
  if (!workspaceId) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  await notifyAdmins(workspaceId, {
    type: "warning" as const,
    title: "Payment failed",
    message:
      "A payment for your workspace subscription failed. Please update your payment method to avoid service interruption.",
  });
}

async function handleSubscriptionDisable(data: PaystackEvent["data"]) {
  const workspaceId = data.metadata?.workspace_id ?? data.subscription?.metadata?.workspace_id;
  if (!workspaceId) return;

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "past_due"]);

  await notifyAdmins(workspaceId, {
    type: "warning" as const,
    title: "Subscription cancelled",
    message: "Your workspace subscription has been cancelled. Upgrade to restore full access.",
  });
}

async function notifyAdmins(
  workspaceId: string,
  notif: { type: "warning"; title: string; message: string },
) {
  // Get admin members for this workspace
  const { data: wm } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (!wm?.length) return;

  const memberIds = wm.map((m) => m.user_id);
  const { data: adminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .in("user_id", memberIds);

  const notifs = (adminRoles ?? []).map((r) => ({
    user_id: r.user_id,
    ...notif,
  }));
  if (notifs.length) await supabaseAdmin.from("notifications").insert(notifs);
}
