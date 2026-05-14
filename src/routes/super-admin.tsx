import * as React from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Ban,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ── Route guard ──────────────────────────────────────────────────────────────

export const Route = createFileRoute("/super-admin")({
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) throw redirect({ to: "/" });

    const { data, error } = await supabase
      .from("super_admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) throw redirect({ to: "/" });
  },
  component: SuperAdminPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_seats: number | null;
  is_active: boolean;
  created_at: string;
  trial_ends_at: string | null;
  member_count?: number;
}

interface PlanRow {
  id: string;
  name: string;
  price_ngn: number | null;
  price_usd: number | null;
  max_seats: number | null;
  features: string[] | null;
}

interface DashboardStats {
  totalWorkspaces: number;
  activeWorkspaces: number;
  inTrial: number;
  totalMembers: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function wsStatus(ws: WorkspaceRow): "active" | "trial" | "suspended" | "trial_expired" {
  if (!ws.is_active) return "suspended";
  const now = new Date();
  if (ws.trial_ends_at) {
    const trialEnd = new Date(ws.trial_ends_at);
    if (trialEnd > now) return "trial";
    if (ws.plan === "starter") return "trial_expired";
  }
  return "active";
}

function StatusBadge({ ws }: { ws: WorkspaceRow }) {
  const status = wsStatus(ws);
  const variants: Record<typeof status, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/20",
    trial: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    suspended: "bg-red-500/15 text-red-400 border-red-500/20",
    trial_expired: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  };
  const labels: Record<typeof status, string> = {
    active: "Active",
    trial: "Trial",
    suspended: "Suspended",
    trial_expired: "Trial Expired",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <Card className="flex items-center gap-4 p-5 bg-card border-border">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-foreground">
          {loading ? (
            <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />
          ) : (
            (value ?? 0).toLocaleString()
          )}
        </p>
      </div>
    </Card>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmProps) {
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void run()}
            disabled={busy}
            className={
              destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""
            }
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Workspace detail sheet ───────────────────────────────────────────────────

function WorkspaceDetailSheet({
  ws,
  onClose,
}: {
  ws: WorkspaceRow | null;
  onClose: () => void;
}) {
  if (!ws) return null;

  return (
    <Sheet open={!!ws} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="overflow-y-auto" side="right">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-400" />
            {ws.name}
          </SheetTitle>
          <SheetDescription>{ws.slug}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 text-sm">
          <InfoRow label="Workspace ID" value={ws.id} mono />
          <InfoRow label="Slug" value={ws.slug} />
          <InfoRow label="Plan" value={ws.plan} />
          <InfoRow label="Seats" value={ws.plan_seats != null ? String(ws.plan_seats) : "Unlimited"} />
          <InfoRow label="Members" value={String(ws.member_count ?? 0)} />
          <InfoRow label="Status">
            <StatusBadge ws={ws} />
          </InfoRow>
          <InfoRow label="Created" value={fmtDate(ws.created_at)} />
          <InfoRow label="Trial ends" value={fmtDate(ws.trial_ends_at)} />
          <InfoRow label="Active" value={ws.is_active ? "Yes" : "No"} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {children ?? (
        <span className={`text-right text-xs font-medium text-foreground ${mono ? "font-mono break-all" : ""}`}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString();

        const [totalRes, activeRes, trialRes, membersRes] = await Promise.all([
          supabase.from("workspaces").select("id", { count: "exact", head: true }),
          supabase
            .from("workspaces")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .or(`trial_ends_at.is.null,trial_ends_at.gt.${now}`),
          supabase
            .from("workspaces")
            .select("id", { count: "exact", head: true })
            .gt("trial_ends_at", now)
            .eq("plan", "starter"),
          supabase
            .from("workspace_members")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
        ]);

        setStats({
          totalWorkspaces: totalRes.count ?? 0,
          activeWorkspaces: activeRes.count ?? 0,
          inTrial: trialRes.count ?? 0,
          totalMembers: membersRes.count ?? 0,
        });
      } catch {
        toast.error("Failed to load dashboard stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Platform overview</h2>
        <p className="text-sm text-muted-foreground">Real-time stats across all workspaces.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total Workspaces"
          value={stats?.totalWorkspaces ?? null}
          loading={loading}
        />
        <StatCard
          icon={CheckCircle}
          label="Active Workspaces"
          value={stats?.activeWorkspaces ?? null}
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="In Trial"
          value={stats?.inTrial ?? null}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Total Members"
          value={stats?.totalMembers ?? null}
          loading={loading}
        />
      </div>
    </div>
  );
}

// ── Workspaces tab ───────────────────────────────────────────────────────────

function WorkspacesTab() {
  const [workspaces, setWorkspaces] = React.useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Detail sheet
  const [detailWs, setDetailWs] = React.useState<WorkspaceRow | null>(null);

  // Suspend / activate dialog
  const [toggleTarget, setToggleTarget] = React.useState<WorkspaceRow | null>(null);

  // Extend trial dialog
  const [extendTarget, setExtendTarget] = React.useState<WorkspaceRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch workspaces
      const { data: wsData, error: wsError } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (wsError) throw wsError;

      // Fetch member counts per workspace
      const { data: countData, error: countError } = await supabase
        .from("workspace_members")
        .select("workspace_id");

      if (countError) throw countError;

      const countMap: Record<string, number> = {};
      for (const row of countData ?? []) {
        countMap[row.workspace_id] = (countMap[row.workspace_id] ?? 0) + 1;
      }

      const rows: WorkspaceRow[] = (wsData ?? []).map((ws) => ({
        ...(ws as WorkspaceRow),
        member_count: countMap[ws.id] ?? 0,
      }));

      setWorkspaces(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function toggleActive(ws: WorkspaceRow) {
    const next = !ws.is_active;
    const { error } = await supabase
      .from("workspaces")
      .update({ is_active: next })
      .eq("id", ws.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Workspace ${next ? "activated" : "suspended"}`);
    void load();
  }

  async function extendTrial(ws: WorkspaceRow) {
    const current = ws.trial_ends_at ? new Date(ws.trial_ends_at) : new Date();
    const extended = new Date(Math.max(current.getTime(), Date.now()) + 14 * 24 * 60 * 60 * 1000);
    const { error } = await supabase
      .from("workspaces")
      .update({ trial_ends_at: extended.toISOString() })
      .eq("id", ws.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Trial extended by 14 days");
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All workspaces</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : workspaces.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No workspaces yet.
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th>Company</Th>
                <Th>Plan</Th>
                <Th>Members</Th>
                <Th>Status</Th>
                <Th>Trial ends</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => (
                <tr
                  key={ws.id}
                  className="border-b border-border/50 transition-colors hover:bg-accent/20 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{ws.name}</p>
                      <p className="text-xs text-muted-foreground">{ws.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{ws.plan}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {ws.member_count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge ws={ws} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmtDate(ws.trial_ends_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {fmtDate(ws.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* View */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => setDetailWs(ws)}
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>

                      {/* Suspend / Activate */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 gap-1.5 px-2 text-xs ${
                          ws.is_active
                            ? "text-destructive hover:text-destructive"
                            : "text-green-500 hover:text-green-400"
                        }`}
                        onClick={() => setToggleTarget(ws)}
                        title={ws.is_active ? "Suspend workspace" : "Activate workspace"}
                      >
                        {ws.is_active ? (
                          <><Ban className="h-3.5 w-3.5" /> Suspend</>
                        ) : (
                          <><CheckCircle className="h-3.5 w-3.5" /> Activate</>
                        )}
                      </Button>

                      {/* Extend trial */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs text-purple-400 hover:text-purple-300"
                        onClick={() => setExtendTarget(ws)}
                        title="Extend trial by 14 days"
                      >
                        <Clock className="h-3.5 w-3.5" /> Extend
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail sheet */}
      <WorkspaceDetailSheet ws={detailWs} onClose={() => setDetailWs(null)} />

      {/* Suspend / activate confirm */}
      {toggleTarget && (
        <ConfirmDialog
          open={!!toggleTarget}
          onOpenChange={(o) => { if (!o) setToggleTarget(null); }}
          title={toggleTarget.is_active ? `Suspend "${toggleTarget.name}"?` : `Activate "${toggleTarget.name}"?`}
          description={
            toggleTarget.is_active
              ? "Members will lose access immediately until you reactivate. This cannot be undone without a manual reactivation."
              : "This workspace will be reactivated and members will regain access."
          }
          confirmLabel={toggleTarget.is_active ? "Suspend workspace" : "Activate workspace"}
          destructive={toggleTarget.is_active}
          onConfirm={() => toggleActive(toggleTarget)}
        />
      )}

      {/* Extend trial confirm */}
      {extendTarget && (
        <ConfirmDialog
          open={!!extendTarget}
          onOpenChange={(o) => { if (!o) setExtendTarget(null); }}
          title={`Extend trial for "${extendTarget.name}"?`}
          description={`This will add 14 days to the current trial period. Current trial end: ${fmtDate(extendTarget.trial_ends_at)}.`}
          confirmLabel="Extend by 14 days"
          onConfirm={() => extendTrial(extendTarget)}
        />
      )}
    </div>
  );
}

// ── Plans tab ────────────────────────────────────────────────────────────────

const DEFAULT_PLANS = [
  {
    name: "starter",
    price_ngn: null,
    price_usd: null,
    max_seats: 5,
    features: ["Attendance tracking", "Task management", "Direct messages", "Org chart", "Company handbook"],
  },
  {
    name: "growth",
    price_ngn: 49000,
    price_usd: 49,
    max_seats: 25,
    features: ["Everything in Starter", "AI intelligence", "KPIs & OKRs", "Reports & analytics", "Client portal"],
  },
  {
    name: "business",
    price_ngn: 120000,
    price_usd: 120,
    max_seats: 100,
    features: ["Everything in Growth", "Custom branding", "SSO / SAML", "Dedicated onboarding", "SLA guarantee"],
  },
  {
    name: "enterprise",
    price_ngn: null,
    price_usd: null,
    max_seats: null,
    features: ["Everything in Business", "On-premise option", "Custom integrations", "Audit logs", "24/7 support"],
  },
];

function PlansTab() {
  const [plans, setPlans] = React.useState<PlanRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [initializing, setInitializing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("plans")
      .select("*")
      .order("price_ngn", { ascending: true, nullsFirst: true });
    if (error) {
      toast.error(error.message);
    } else {
      setPlans((data ?? []) as PlanRow[]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function initDefaultPlans() {
    setInitializing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("plans").upsert(DEFAULT_PLANS, { onConflict: "name" });
      if (error) throw error;
      toast.success("Default plans initialized");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initialize plans");
    } finally {
      setInitializing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Plans</h2>
          <p className="text-sm text-muted-foreground">Manage the platform's billing plans.</p>
        </div>
        <Button
          size="sm"
          className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
          onClick={() => void initDefaultPlans()}
          disabled={initializing || loading}
        >
          <RefreshCw className={`h-4 w-4 ${initializing ? "animate-spin" : ""}`} />
          Initialize Default Plans
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">No plans found.</p>
          <Button
            size="sm"
            className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
            onClick={() => void initDefaultPlans()}
            disabled={initializing}
          >
            Initialize Default Plans
          </Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th>Name</Th>
                <Th>Price NGN</Th>
                <Th>Price USD</Th>
                <Th>Max seats</Th>
                <Th>Features</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-b border-border/50 transition-colors hover:bg-accent/20 last:border-0"
                >
                  <td className="px-4 py-3 font-medium capitalize">{plan.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {plan.price_ngn != null ? `₦${plan.price_ngn.toLocaleString()}` : "Free / Custom"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {plan.price_usd != null ? `$${plan.price_usd}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {plan.max_seats != null ? plan.max_seats : "Unlimited"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    {(plan.features ?? []).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Skeleton helper ──────────────────────────────────────────────────────────

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-border/50 px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 animate-pulse rounded bg-muted"
              style={{ width: `${60 + ((c * 37 + r * 13) % 80)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

// ── Main page component ──────────────────────────────────────────────────────

function SuperAdminPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Purple warning banner ──────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 bg-purple-600 px-4 py-2 text-sm font-medium text-white">
        <Shield className="h-4 w-4 shrink-0" />
        <span>Super Admin Mode — Changes affect all workspaces</span>
      </div>

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-purple-400">⚡ Nexus HQ</span>
              <span className="ml-2 text-sm font-medium text-muted-foreground">— Super Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user?.email && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                {user.email}
              </span>
            )}
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-purple-500/50 hover:text-purple-400"
            >
              Exit to App <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600/15 text-purple-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Platform Administration</h1>
            <p className="text-sm text-muted-foreground">
              Manage all workspaces, members, and billing plans.
            </p>
          </div>
        </div>

        {/* Security reminder */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm text-orange-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Actions here affect real customer data. Suspend or delete with care — these operations cannot be automatically reversed.
          </span>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6 bg-muted border border-border">
            <TabsTrigger
              value="dashboard"
              className="gap-2 data-[state=active]:text-purple-400"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="workspaces"
              className="gap-2 data-[state=active]:text-purple-400"
            >
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger
              value="plans"
              className="gap-2 data-[state=active]:text-purple-400"
            >
              <CreditCard className="h-4 w-4" />
              Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>

          <TabsContent value="workspaces">
            <WorkspacesTab />
          </TabsContent>

          <TabsContent value="plans">
            <PlansTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
