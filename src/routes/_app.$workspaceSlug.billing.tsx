import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireAnyRole } from "@/lib/role-access";
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

// ─── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "starter",
    label: "Starter",
    price: "Free",
    seats: 5,
    colorClass: "text-muted-foreground",
    borderClass: "border-border",
    badgeClass: "bg-muted text-muted-foreground border-border",
    features: ["Tasks", "Attendance", "Standups", "5 members"],
  },
  {
    id: "growth",
    label: "Growth",
    price: "₦49,000/mo",
    seats: 25,
    colorClass: "text-blue-400",
    borderClass: "border-blue-500/40",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/40",
    features: [
      "Everything in Starter",
      "Leave management",
      "OKRs & KPIs",
      "25 members",
    ],
  },
  {
    id: "business",
    label: "Business",
    price: "₦149,000/mo",
    seats: 100,
    colorClass: "text-purple-400",
    borderClass: "border-purple-500/40",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/40",
    features: [
      "Everything in Growth",
      "Performance reviews",
      "Client projects",
      "100 members",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "Custom",
    seats: 999,
    colorClass: "text-amber-400",
    borderClass: "border-amber-500/40",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/40",
    features: [
      "Everything in Business",
      "Unlimited members",
      "Priority support",
      "Custom integrations",
    ],
  },
] as const;

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
  return `${formatDate(start)} – ${formatDate(end)}`;
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
    trialing: { label: "Trialing", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40" },
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
}: {
  plan: (typeof PLANS)[number];
  currentPlan: string;
}) {
  const isCurrent = plan.id === currentPlan;

  function handleUpgrade() {
    if (plan.id === "enterprise") {
      void navigator.clipboard?.writeText("hello@nexushq.io").catch(() => {});
      toast.info("Contact hello@nexushq.io to upgrade to Enterprise");
    } else {
      toast.info("Contact hello@nexushq.io to upgrade");
    }
  }

  return (
    <Card
      className={[
        "flex flex-col gap-4 p-5 transition-colors",
        isCurrent ? `border-2 ${plan.borderClass}` : "border border-border",
      ].join(" ")}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className={`text-base font-semibold ${plan.colorClass}`}>{plan.label}</p>
          {isCurrent && (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${plan.badgeClass}`}
            >
              Current Plan
            </span>
          )}
        </div>
        <p className="mt-1 text-xl font-bold">{plan.price}</p>
        <p className="text-xs text-muted-foreground">
          {plan.seats >= 999 ? "Unlimited" : plan.seats} members
        </p>
      </div>

      <Separator />

      {/* Features */}
      <ul className="flex flex-col gap-2 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!isCurrent && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleUpgrade}
        >
          {plan.id === "enterprise" ? (
            <>
              <Mail className="mr-2 h-3.5 w-3.5" />
              Contact Sales
            </>
          ) : (
            "Upgrade"
          )}
        </Button>
      )}
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function BillingPage() {
  const { workspace } = useWorkspace();

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
        supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", workspace.id)
          .maybeSingle(),
        supabase
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("is_active", true),
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
        <div>
          <h2 className="text-lg font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Compare plans and upgrade when you're ready.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} currentPlan={workspace.plan} />
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
          <StatCard
            icon={Users}
            label="Active members"
            value={usedSeats}
            loading={loading}
          />
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

      {/* ── Section 4: Invoice history placeholder ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Invoice history</h2>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Invoice history coming soon.</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Contact{" "}
              <a
                href="mailto:hello@nexushq.io"
                className="text-foreground underline underline-offset-4 hover:text-primary"
              >
                hello@nexushq.io
              </a>{" "}
              for billing records, receipts, or any payment-related queries.
            </p>
          </CardContent>
        </Card>
      </section>
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
                  seatLimitReached || isNearLimit
                    ? "[&>div]:bg-red-500"
                    : "[&>div]:bg-primary",
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
            {workspace.plan !== "enterprise" && (
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.info("Contact hello@nexushq.io to upgrade")
                  }
                >
                  Upgrade plan
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
