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
    // Use getUser() for a verified server-round-trip auth check
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw redirect({ to: "/login" });

    const { data, error } = await supabase
      .from("super_admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    // Return context so the component can show a diagnostic UI instead of silently redirecting
    return { superAdminOk: !!data && !error, userId, accessError: error?.message ?? null };
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
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
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
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Workspace detail sheet (with members + invites) ────────────────────────

interface MemberRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  is_active: boolean;
  profiles?: { full_name: string | null; email: string | null } | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: "owner" | "admin" | "manager" | "employee";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

function WorkspaceDetailSheet({
  ws,
  onClose,
  onChanged,
}: {
  ws: WorkspaceRow | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [invites, setInvites] = React.useState<InviteRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"employee" | "manager" | "admin" | "owner">(
    "employee",
  );
  const [creatingInvite, setCreatingInvite] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const { data: mem } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, is_active, profiles(full_name, email)")
        .eq("workspace_id", ws.id);
      setMembers((mem ?? []) as unknown as MemberRow[]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inv } = await (supabase as any)
        .from("workspace_invites")
        .select("*")
        .eq("workspace_id", ws.id)
        .order("created_at", { ascending: false });
      setInvites((inv ?? []) as InviteRow[]);
    } finally {
      setLoading(false);
    }
  }, [ws]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Realtime: auto-refresh members + invites when they change
  React.useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`ws-detail-${ws.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${ws.id}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${ws.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ws, load]);

  // Periodic refetch fallback (every 30s) so invite status stays accurate
  // even if a realtime event is missed (offline, dropped socket, expiry tick).
  React.useEffect(() => {
    if (!ws) return;
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [ws, load]);

  if (!ws) return null;

  async function changeRole(m: MemberRow, role: MemberRow["role"]) {
    const { error } = await supabase.from("workspace_members").update({ role }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    void load();
  }

  async function toggleMemberActive(m: MemberRow) {
    const { error } = await supabase
      .from("workspace_members")
      .update({ is_active: !m.is_active })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success(m.is_active ? "Member deactivated" : "Member reactivated");
    void load();
  }

  async function removeMember(m: MemberRow) {
    if (!confirm(`Remove ${m.profiles?.email ?? "this member"} from ${ws!.name}?`)) return;
    const { error } = await supabase.from("workspace_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    void load();
    onChanged?.();
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setCreatingInvite(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("workspace_invites").insert({
        workspace_id: ws!.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invited_by: user?.id ?? null,
      });
      if (error) throw error;
      setInviteEmail("");
      toast.success("Invite created");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function revokeInvite(inv: InviteRow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("workspace_invites").delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    void load();
  }

  function copyInviteUrl(inv: InviteRow) {
    const url = `${window.location.origin}/accept-invite?token=${inv.token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invite URL copied");
  }

  return (
    <Sheet
      open={!!ws}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-2xl" side="right">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-400" />
            {ws.name}
          </SheetTitle>
          <SheetDescription>{ws.slug}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 text-sm">
          <InfoRow label="Workspace ID" value={ws.id} mono />
          <InfoRow label="Plan" value={ws.plan} />
          <InfoRow label="Members" value={String(members.length)} />
          <InfoRow label="Status">
            <StatusBadge ws={ws} />
          </InfoRow>
          <InfoRow label="Created" value={fmtDate(ws.created_at)} />
          <InfoRow label="Trial ends" value={fmtDate(ws.trial_ends_at)} />
        </div>

        {/* Members */}
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Members
          </h3>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-xs text-muted-foreground">No members yet.</div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {m.profiles?.full_name || m.profiles?.email || m.user_id}
                    </p>
                    {m.profiles?.email && (
                      <p className="text-muted-foreground truncate">{m.profiles.email}</p>
                    )}
                  </div>
                  <select
                    value={m.role}
                    onChange={(e) => void changeRole(m, e.target.value as MemberRow["role"])}
                    className="bg-input border border-border rounded px-2 py-1 text-xs"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="employee">Employee</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => void toggleMemberActive(m)}
                  >
                    {m.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive"
                    onClick={() => void removeMember(m)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invites */}
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold">Invite a user</h3>
          <form onSubmit={createInvite} className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              placeholder="user@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 bg-input border border-border rounded px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="bg-input border border-border rounded px-2 py-2 text-sm"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
            <Button type="submit" size="sm" disabled={creatingInvite}>
              {creatingInvite ? "…" : "Invite"}
            </Button>
          </form>

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Invites</p>
              {invites.map((inv) => {
                const now = Date.now();
                const isUsed = !!inv.accepted_at;
                const isExpired = !isUsed && new Date(inv.expires_at).getTime() < now;
                const status: "used" | "expired" | "pending" = isUsed
                  ? "used"
                  : isExpired
                    ? "expired"
                    : "pending";
                const statusClass =
                  status === "used"
                    ? "bg-success/15 text-success border-success/30"
                    : status === "expired"
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : "bg-warning/15 text-warning border-warning/30";
                const disabled = isUsed || isExpired;
                return (
                  <div
                    key={inv.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs ${disabled ? "opacity-60" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{inv.email}</p>
                      <p className="text-muted-foreground">
                        {inv.role} ·{" "}
                        {isUsed
                          ? `accepted ${fmtDate(inv.accepted_at)}`
                          : isExpired
                            ? `expired ${fmtDate(inv.expires_at)}`
                            : `expires ${fmtDate(inv.expires_at)}`}
                      </p>
                    </div>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}
                    >
                      {status}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => copyInviteUrl(inv)}
                      disabled={disabled}
                    >
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive"
                      onClick={() => void revokeInvite(inv)}
                      disabled={isUsed}
                    >
                      {isExpired ? "Delete" : "Revoke"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
        <span
          className={`text-right text-xs font-medium text-foreground ${mono ? "font-mono break-all" : ""}`}
        >
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
        <StatCard icon={Clock} label="In Trial" value={stats?.inTrial ?? null} loading={loading} />
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

  // Create workspace dialog
  const [createOpen, setCreateOpen] = React.useState(false);

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

  React.useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(ws: WorkspaceRow) {
    const next = !ws.is_active;
    const { error } = await supabase.from("workspaces").update({ is_active: next }).eq("id", ws.id);

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
            {loading
              ? "Loading…"
              : `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
            onClick={() => setCreateOpen(true)}
          >
            <Building2 className="h-4 w-4" /> Create workspace
          </Button>
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
      </div>
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void load()}
      />

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : workspaces.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No workspaces yet.</Card>
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
                  <td className="px-4 py-3 tabular-nums">{ws.member_count ?? 0}</td>
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
                          <>
                            <Ban className="h-3.5 w-3.5" /> Suspend
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" /> Activate
                          </>
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
          onOpenChange={(o) => {
            if (!o) setToggleTarget(null);
          }}
          title={
            toggleTarget.is_active
              ? `Suspend "${toggleTarget.name}"?`
              : `Activate "${toggleTarget.name}"?`
          }
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
          onOpenChange={(o) => {
            if (!o) setExtendTarget(null);
          }}
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
    features: [
      "Attendance tracking",
      "Task management",
      "Direct messages",
      "Org chart",
      "Company handbook",
    ],
  },
  {
    name: "growth",
    price_ngn: 49000,
    price_usd: 49,
    max_seats: 25,
    features: [
      "Everything in Starter",
      "AI intelligence",
      "KPIs & OKRs",
      "Reports & analytics",
      "Client portal",
    ],
  },
  {
    name: "business",
    price_ngn: 120000,
    price_usd: 120,
    max_seats: 100,
    features: [
      "Everything in Growth",
      "Custom branding",
      "SSO / SAML",
      "Dedicated onboarding",
      "SLA guarantee",
    ],
  },
  {
    name: "enterprise",
    price_ngn: null,
    price_usd: null,
    max_seats: null,
    features: [
      "Everything in Business",
      "On-premise option",
      "Custom integrations",
      "Audit logs",
      "24/7 support",
    ],
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

  React.useEffect(() => {
    void load();
  }, [load]);

  async function initDefaultPlans() {
    setInitializing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("plans")
        .upsert(DEFAULT_PLANS, { onConflict: "name" });
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
                    {plan.price_ngn != null
                      ? `₦${plan.price_ngn.toLocaleString()}`
                      : "Free / Custom"}
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

// ── Create workspace dialog ──────────────────────────────────────────────────

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [plan, setPlan] = React.useState<"starter" | "growth" | "business" | "enterprise">(
    "business",
  );
  const [ownerEmail, setOwnerEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!slug && name) {
      setSlug(
        name
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 30),
      );
    }
  }, [name, slug]);

  async function submit() {
    if (!name.trim() || !slug.trim()) return toast.error("Name and slug required");
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("super_admin_create_workspace", {
        _name: name.trim(),
        _slug: slug.trim().toLowerCase(),
        _plan: plan,
        _owner_email: ownerEmail.trim() || null,
      });
      if (error) throw error;
      toast.success("Workspace created");
      setName("");
      setSlug("");
      setOwnerEmail("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new workspace</DialogTitle>
          <DialogDescription>
            Provision a workspace and optionally assign an owner by email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Company name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm"
            >
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Owner email (optional)</label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="user must already exist"
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-6 border-b border-border/50 px-4 py-3 last:border-0"
        >
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
  const { superAdminOk, userId, accessError } = Route.useRouteContext();

  if (!superAdminOk) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-8">
          <Shield className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="text-xl font-bold">Super-admin access denied</h1>
          <p className="text-sm text-muted-foreground">
            Your user ID is not in the{" "}
            <code className="rounded bg-muted px-1">super_admin_users</code> table, or the row could
            not be read.
          </p>
          {userId && (
            <div className="rounded-lg bg-muted px-4 py-3 text-left">
              <p className="text-xs text-muted-foreground mb-1">Your user ID (copy this):</p>
              <p className="font-mono text-xs break-all select-all text-foreground">{userId}</p>
            </div>
          )}
          {accessError && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-left">
              <p className="text-xs text-muted-foreground mb-1">Error from Supabase:</p>
              <p className="font-mono text-xs break-all text-destructive">{accessError}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Run this in the <strong>Supabase SQL editor</strong> (replace the UUID if it differs):
          </p>
          <pre className="rounded-lg bg-muted px-4 py-3 text-left text-xs text-foreground overflow-x-auto whitespace-pre-wrap select-all">
            {`INSERT INTO public.super_admin_users (user_id)
VALUES ('${userId ?? "<your-user-id>"}')
ON CONFLICT (user_id) DO NOTHING;`}
          </pre>
          <p className="text-xs text-muted-foreground">
            After running that, hard-refresh this page (Ctrl+Shift+R).
          </p>
        </div>
      </div>
    );
  }

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
              <span className="font-bold text-purple-400">⚡ Nexxos HQ</span>
              <span className="ml-2 text-sm font-medium text-muted-foreground">— Super Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user?.email && (
              <span className="hidden text-xs text-muted-foreground sm:block">{user.email}</span>
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
            Actions here affect real customer data. Suspend or delete with care — these operations
            cannot be automatically reversed.
          </span>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6 bg-muted border border-border">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:text-purple-400">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="gap-2 data-[state=active]:text-purple-400">
              <Building2 className="h-4 w-4" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2 data-[state=active]:text-purple-400">
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
