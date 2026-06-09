import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireAnyRole } from "@/lib/role-access";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2,
  Users,
  MessageSquare,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Mail,
  CreditCard,
  Download,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/billing")({
  beforeLoad: () => requireAnyRole(["admin"]),
  component: BillingPage,
});

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  workspace_id: string;
  plan: string;
  status: "trialing" | "active" | "past_due" | "cancelled" | string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean | null;
}

interface UsageStats {
  usedSeats: number;
  messagesThisMonth: number;
  tasksThisMonth: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  plan: string;
  billing_interval: string;
  amount_ngn: number;
  vat_ngn: number;
  status: string;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  customer_email: string | null;
  customer_name: string | null;
  paystack_reference: string | null;
}

// ─── Plan definitions ──────────────────────────────────────────────────────────

const PLAN_MONTHLY: Record<string, number> = {
  basic: 15000,
  enterprise: 25000,
  unlimited: 45000,
};
const ANNUAL_DISCOUNT = 0.3;

function planPrice(id: string, billing: "monthly" | "annual"): string {
  const monthly = PLAN_MONTHLY[id];
  if (!monthly) return "—";
  const price = billing === "annual" ? Math.round(monthly * (1 - ANNUAL_DISCOUNT)) : monthly;
  return "₦" + price.toLocaleString("en-NG") + "/mo";
}

const PLANS = [
  {
    id: "basic",
    label: "Basic",
    seats: 7,
    support: "Email support",
    colorClass: "text-muted-foreground",
    borderClass: "border-border",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    seats: 15,
    support: "Priority support",
    colorClass: "text-blue-400",
    borderClass: "border-blue-500/40",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/40",
  },
  {
    id: "unlimited",
    label: "Unlimited",
    seats: 999,
    support: "Dedicated account manager",
    colorClass: "text-amber-400",
    borderClass: "border-amber-500/40",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/40",
  },
] as const;

const SUPPORT_EMAIL = "nexxoshq@gmail.com";
const SUPPORT_WHATSAPP = "https://wa.me/2349000000000";

function openUpgradeEmail(planLabel?: string) {
  const subject = encodeURIComponent(`Nexxos HQ — Upgrade to ${planLabel ?? "a higher"} plan`);
  const body = encodeURIComponent(
    `Hi Nexxos HQ team,\n\nI'd like to upgrade my workspace plan.\n\nPlease get in touch to discuss options.\n\nThanks`,
  );
  window.open(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`, "_blank");
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  // BUG 4: if period end is >2 years from start, cap at start+1yr for display
  let displayEnd = end;
  if (start && end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    if (endMs - startMs > twoYearsMs) {
      const corrected = new Date(startMs);
      corrected.setFullYear(corrected.getFullYear() + 1);
      displayEnd = corrected.toISOString();
    }
  }
  return `${formatDate(start)} – ${formatDate(displayEnd)}`;
}

function daysUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    trialing: {
      label: "Trialing",
      className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
    },
    active: { label: "Active", className: "bg-green-500/10 text-green-400 border-green-500/40" },
    past_due: { label: "Past Due", className: "bg-red-500/10 text-red-400 border-red-500/40" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
  };
  const config = map[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

// ─── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const found = PLANS.find((p) => p.id === plan);
  const label = found?.label ?? plan;
  const cls = found?.badgeClass ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-1 h-6 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentPlan,
  billing,
  onUpgrade,
  checkoutKey,
}: {
  plan: (typeof PLANS)[number];
  currentPlan: string;
  billing: "monthly" | "annual";
  onUpgrade: (planId: string, interval: "monthly" | "annual") => void;
  checkoutKey: string | null;
}) {
  const isCurrent = plan.id === currentPlan;
  const isCheckingOut = checkoutKey === `${plan.id}-${billing}`;
  const monthly = PLAN_MONTHLY[plan.id] ?? 0;
  const annualMonthly = Math.round(monthly * (1 - ANNUAL_DISCOUNT));
  const price = billing === "annual" ? annualMonthly : monthly;
  const annualTotal = annualMonthly * 12;
  const annualSavings = (monthly - annualMonthly) * 12;

  return (
    <Card
      className={[
        "flex flex-col gap-4 p-5 transition-colors",
        isCurrent ? `border-2 ${plan.borderClass}` : "border border-border",
      ].join(" ")}
    >
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={`text-base font-semibold ${plan.colorClass}`}>{plan.label}</p>
          {isCurrent && (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${plan.badgeClass}`}
            >
              Current Plan
            </span>
          )}
        </div>
        <p className="mt-1 text-xl font-bold">
          ₦{price.toLocaleString("en-NG")}
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </p>
        {billing === "annual" && (
          <div className="flex flex-col gap-0.5 mt-0.5">
            <p className="text-xs text-muted-foreground">
              ₦{annualTotal.toLocaleString("en-NG")}/yr · ₦{annualMonthly.toLocaleString("en-NG")}
              /mo equivalent
            </p>
            <p className="text-xs text-green-500 font-medium">
              Save ₦{annualSavings.toLocaleString("en-NG")} vs monthly
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Seat + support */}
      <ul className="flex flex-col gap-2 flex-1">
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <span className="text-muted-foreground">
            {plan.seats >= 999 ? "Unlimited" : `Up to ${plan.seats}`} members
          </span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <span className="text-muted-foreground">{plan.support}</span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <span className="text-muted-foreground">All features included</span>
        </li>
        <li className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
          <span className="text-muted-foreground">7-day free trial</span>
        </li>
      </ul>

      {/* CTA */}
      {!isCurrent && (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            className="w-full"
            disabled={checkoutKey !== null}
            onClick={() => onUpgrade(plan.id, billing)}
          >
            {isCheckingOut ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            )}
            Pay with Paystack
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => openUpgradeEmail(plan.label)}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              Email us
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10"
              onClick={() => window.open(SUPPORT_WHATSAPP, "_blank")}
            >
              WhatsApp
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Invoice HTML generator ────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  enterprise: "Enterprise",
  unlimited: "Unlimited",
};
const VAT_DISPLAY = "7.5%";
const COMPANY_NAME = "Nexxos HQ";
const COMPANY_EMAIL = "hello@nexxoshq.io";

function generateInvoiceHTML(inv: Invoice): string {
  const netNgn = inv.amount_ngn - inv.vat_ngn;
  const planLabel = PLAN_LABELS[inv.plan] ?? inv.plan;
  const intervalLabel = inv.billing_interval === "annual" ? "Annual" : "Monthly";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${inv.invoice_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;color:#111;background:#fff;padding:40px}
  .wrap{max-width:680px;margin:auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px}
  .logo span{color:#6366f1}
  .meta{text-align:right;font-size:13px;color:#555}
  .meta strong{color:#111;font-size:16px;display:block;margin-bottom:2px}
  h2{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:12px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
  .party p{font-size:13px;color:#555;line-height:1.6}
  .party strong{font-size:13px;color:#111}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead th{background:#f5f5f7;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#888;padding:8px 12px;text-align:left}
  td{font-size:13px;padding:10px 12px;border-bottom:1px solid #eee}
  .totals{max-width:280px;margin-left:auto}
  .totals tr td{border:none;padding:4px 0}
  .totals tr td:last-child{text-align:right}
  .totals .total td{font-weight:700;font-size:15px;padding-top:8px;border-top:2px solid #111}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#dcfce7;color:#166534}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}
  @media print{body{padding:0}.wrap{max-width:100%}}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div>
      <div class="logo">${COMPANY_NAME.replace("Nexxos", "<span>Nexxos</span>")}</div>
      <p style="font-size:12px;color:#888;margin-top:4px">${COMPANY_EMAIL}</p>
    </div>
    <div class="meta">
      <strong>INVOICE</strong>
      <span>${inv.invoice_number}</span><br>
      <span>Issued: ${new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h2>From</h2>
      <strong>${COMPANY_NAME}</strong>
      <p>${COMPANY_EMAIL}</p>
    </div>
    <div class="party">
      <h2>Bill To</h2>
      <strong>${inv.customer_name ?? "—"}</strong>
      <p>${inv.customer_email ?? "—"}</p>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Period</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>${planLabel} Plan (${intervalLabel})</td>
        <td style="color:#555">${inv.period_start ? new Date(inv.period_start).toLocaleDateString("en-GB") : "—"} – ${inv.period_end ? new Date(inv.period_end).toLocaleDateString("en-GB") : "—"}</td>
        <td style="text-align:right">₦${netNgn.toLocaleString("en-NG")}</td>
      </tr>
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>₦${netNgn.toLocaleString("en-NG")}</td></tr>
    <tr><td>VAT (${VAT_DISPLAY})</td><td>₦${inv.vat_ngn.toLocaleString("en-NG")}</td></tr>
    <tr class="total"><td>Total</td><td>₦${inv.amount_ngn.toLocaleString("en-NG")}</td></tr>
  </table>

  ${inv.paystack_reference ? `<p style="font-size:11px;color:#aaa;margin-top:8px">Payment ref: ${inv.paystack_reference}</p>` : ""}
  <p style="margin-top:8px"><span class="badge">PAID</span></p>

  <div class="footer">Thank you for using ${COMPANY_NAME}. This is a VAT invoice under Nigerian tax regulations.</div>
</div>
</body>
</html>`;
}

function downloadInvoice(inv: Invoice) {
  const html = generateInvoiceHTML(inv);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.invoice_number}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Invoice history section ────────────────────────────────────────────────────

function InvoiceHistory({ workspaceId }: { workspaceId: string }) {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("issued_at", { ascending: false })
        .limit(50);
      setInvoices((data ?? []) as Invoice[]);
      setLoading(false);
    })();
  }, [workspaceId]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Invoice history</h2>
        <p className="text-sm text-muted-foreground">Download VAT invoices for all payments.</p>
      </div>
      <Card>
        {loading ? (
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        ) : invoices.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No invoices yet.</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Invoices will appear here after your first payment.
            </p>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {invoices.map((inv) => {
              const planLabel = PLAN_LABELS[inv.plan] ?? inv.plan;
              const intervalLabel = inv.billing_interval === "annual" ? "Annual" : "Monthly";
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {inv.invoice_number}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {planLabel} ({intervalLabel})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.issued_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}{" "}
                      · ₦{inv.amount_ngn.toLocaleString("en-NG")} (incl. VAT)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadInvoice(inv)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function BillingPage() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();

  const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("monthly");
  const [checkoutKey, setCheckoutKey] = React.useState<string | null>(null);
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [usage, setUsage] = React.useState<UsageStats>({
    usedSeats: 0,
    messagesThisMonth: 0,
    tasksThisMonth: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [usageLoading, setUsageLoading] = React.useState(true);

  // Fetch subscription + seat count
  React.useEffect(() => {
    async function fetchBillingData() {
      setLoading(true);
      const [subRes, seatsRes] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("workspace_id", workspace.id).maybeSingle(),
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id),
      ]);

      if (subRes.error) {
        toast.error("Could not load subscription: " + subRes.error.message);
      } else {
        setSub(subRes.data as Subscription | null);
      }

      setUsage((prev) => ({
        ...prev,
        usedSeats: seatsRes.count ?? 0,
      }));
      setLoading(false);
    }

    void fetchBillingData();
  }, [workspace.id]);

  // Fetch message + task counts separately (non-blocking)
  React.useEffect(() => {
    async function fetchUsage() {
      setUsageLoading(true);
      const monthStart = startOfMonthISO();

      const [msgRes, taskRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .gte("created_at", monthStart),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .gte("created_at", monthStart),
      ]);

      setUsage((prev) => ({
        ...prev,
        messagesThisMonth: msgRes.count ?? 0,
        tasksThisMonth: taskRes.count ?? 0,
      }));
      setUsageLoading(false);
    }

    void fetchUsage();
  }, [workspace.id]);

  async function startCheckout(planId: string, interval: "monthly" | "annual") {
    if (!user?.email || checkoutKey) return;
    const key = `${planId}-${interval}`;
    setCheckoutKey(key);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
          planId,
          interval,
          email: user.email,
        }),
      });
      const data = (await res.json()) as { authorization_url?: string; error?: string };
      if (!res.ok || !data.authorization_url) {
        throw new Error(data.error ?? "Failed to start checkout");
      }
      window.location.href = data.authorization_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutKey(null);
    }
  }

  const planSeats = workspace.plan_seats ?? 5;
  const usedSeats = usage.usedSeats;
  const seatPct = planSeats > 0 ? Math.min(100, Math.round((usedSeats / planSeats) * 100)) : 0;
  const seatLimitReached = usedSeats >= planSeats;
  const isNearLimit = seatPct >= 80;

  const trialEnd = workspace.trial_ends_at ?? sub?.trial_end ?? null;
  const trialDaysLeft = daysUntil(trialEnd);
  const isTrialing = sub?.status === "trialing" || (trialEnd && trialDaysLeft > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace subscription and monitor usage.
        </p>
      </div>

      {/* ── Section 1: Current Plan ── */}
      <CurrentPlanCard
        workspace={workspace}
        sub={sub}
        loading={loading}
        usedSeats={usedSeats}
        planSeats={planSeats}
        seatPct={seatPct}
        seatLimitReached={seatLimitReached}
        isNearLimit={isNearLimit}
        isTrialing={!!isTrialing}
        trialEnd={trialEnd}
        trialDaysLeft={trialDaysLeft}
      />

      {/* ── Section 2: Plan comparison ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Plans</h2>
            <p className="text-sm text-muted-foreground">
              All plans include every feature. Upgrade when you're ready.
            </p>
          </div>
          {/* Billing cycle toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span
                className={`rounded-full px-1 text-[9px] font-bold ${
                  billingCycle === "annual"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-green-500/15 text-green-500"
                }`}
              >
                –30%
              </span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={workspace.plan}
              billing={billingCycle}
              onUpgrade={startCheckout}
              checkoutKey={checkoutKey}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: Usage stats ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Usage this month</h2>
          <p className="text-sm text-muted-foreground">
            Activity metrics for your workspace in the current billing month.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Active members" value={usedSeats} loading={loading} />
          <StatCard
            icon={MessageSquare}
            label="Messages this month"
            value={usage.messagesThisMonth}
            loading={usageLoading}
          />
          <StatCard
            icon={CheckSquare}
            label="Tasks this month"
            value={usage.tasksThisMonth}
            loading={usageLoading}
          />
        </div>
      </section>

      {/* ── Section 4: Invoice history ── */}
      <InvoiceHistory workspaceId={workspace.id} />
    </div>
  );
}

// ─── Current plan card (extracted for readability) ─────────────────────────────

function CurrentPlanCard({
  workspace,
  sub,
  loading,
  usedSeats,
  planSeats,
  seatPct,
  seatLimitReached,
  isNearLimit,
  isTrialing,
  trialEnd,
  trialDaysLeft,
}: {
  workspace: ReturnType<typeof useWorkspace>["workspace"];
  sub: Subscription | null;
  loading: boolean;
  usedSeats: number;
  planSeats: number;
  seatPct: number;
  seatLimitReached: boolean;
  isNearLimit: boolean;
  isTrialing: boolean;
  trialEnd: string | null;
  trialDaysLeft: number;
}) {
  const currentPlanDef = PLANS.find((p) => p.id === workspace.plan);
  const accentBorder = currentPlanDef?.borderClass ?? "border-border";

  return (
    <Card className={`border-2 ${accentBorder}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Current Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-3">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            {/* Plan name + status row */}
            <div className="flex flex-wrap items-center gap-3">
              <PlanBadge plan={workspace.plan} />
              {sub && <StatusBadge status={sub.status} />}
              {isTrialing && trialEnd && (
                <span className="text-xs text-yellow-400">
                  Trial ends {formatDate(trialEnd)}
                  {trialDaysLeft > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left)
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Billing period */}
            {sub && (sub.current_period_start || sub.current_period_end) && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Billing period</p>
                <p className="text-sm">
                  {formatDateRange(sub.current_period_start, sub.current_period_end)}
                </p>
              </div>
            )}

            <Separator />

            {/* Seat usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Seats used</span>
                <span
                  className={
                    seatLimitReached
                      ? "font-semibold text-red-400"
                      : isNearLimit
                        ? "font-semibold text-yellow-400"
                        : "text-muted-foreground"
                  }
                >
                  {usedSeats} / {planSeats}
                </span>
              </div>

              <Progress
                value={seatPct}
                className={[
                  "h-2",
                  seatLimitReached || isNearLimit ? "[&>div]:bg-red-500" : "[&>div]:bg-primary",
                ].join(" ")}
              />

              {seatLimitReached && (
                <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-xs text-red-400 font-medium">
                    Seat limit reached. Upgrade your plan to add more members.
                  </p>
                </div>
              )}
            </div>

            {/* Upgrade CTA */}
            {(workspace.plan as string) !== "unlimited" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => openUpgradeEmail()}>
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  Email us
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500/40 text-green-400 hover:bg-green-500/10"
                  onClick={() => window.open(SUPPORT_WHATSAPP, "_blank")}
                >
                  WhatsApp
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
