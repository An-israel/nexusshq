import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deptLabel, initialsOf, todayISO } from "@/lib/nexus";
import { requireAnyRole } from "@/lib/role-access";
import { useAuth } from "@/lib/auth-context";
import { removeWorkspaceMemberFn, setEmployeeActiveFn } from "@/lib/admin.functions";
import { InviteEmployeeDialog } from "@/components/team/InviteEmployeeDialog";
import { ManageRoleDialog } from "@/components/team/ManageRoleDialog";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  UserX,
  UserCheck,
  ClipboardList,
  Trash2,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = "admin" | "manager" | "employee";

export const Route = createFileRoute("/_app/$workspaceSlug/team")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: TeamPage,
});

interface MemberRow {
  profile: Profile;
  role: AppRole | null;
  todayDone: number;
  todayTotal: number;
  weekDone: number;
  weekTotal: number;
  flagsCount: number;
  clockedIn: boolean;
}

function TeamPage() {
  const { workspaceSlug } = Route.useParams();
  const { workspace, isWorkspaceAdmin, isWorkspaceManager } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [stats, setStats] = useState({
    activeCount: 0,
    completedToday: 0,
    overdueNow: 0,
    clockedInToday: 0,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = todayISO();

      // Scope to current workspace members only
      const { data: memberRows } = await supabase
        .from("workspace_members")
        .select("user_id, profiles:user_id(*)")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true);
      const profiles = (
        (memberRows ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r.profiles)
          .filter(Boolean) as Profile[]
      ).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));

      const userIds = profiles.map((p) => p.id);
      const [tasksRes, attRes, flagsRes, overdueRes, completedTodayRes, rolesRes] =
        await Promise.all([
          userIds.length
            ? supabase
                .from("tasks")
                .select("id, assigned_to, status, due_date, task_type")
                .eq("workspace_id", workspace.id)
                .in("assigned_to", userIds)
            : Promise.resolve({ data: [], error: null }),
          userIds.length
            ? supabase
                .from("attendance")
                .select("user_id, clock_in, clock_out")
                .eq("date", today)
                .in("user_id", userIds)
            : Promise.resolve({ data: [], error: null }),
          userIds.length
            ? supabase
                .from("flags")
                .select("flagged_user_id, is_resolved")
                .eq("is_resolved", false)
                .eq("workspace_id", workspace.id)
                .in("flagged_user_id", userIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id)
            .lt("due_date", today)
            .neq("status", "completed"),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id)
            .eq("status", "completed")
            .gte("completed_at", `${today}T00:00:00`),
          userIds.length
            ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (cancelled) return;

      const tasks =
        (tasksRes.data as Array<{
          id: string;
          assigned_to: string;
          status: string;
          due_date: string;
          task_type: string;
        }>) ?? [];
      const att =
        (attRes.data as Array<{
          user_id: string;
          clock_in: string | null;
          clock_out: string | null;
        }>) ?? [];
      const flags = (flagsRes.data as Array<{ flagged_user_id: string }>) ?? [];
      const roles = (rolesRes.data as Array<{ user_id: string; role: AppRole }>) ?? [];
      const roleMap = new Map<string, AppRole>();
      // Pick highest privilege if multiple
      const rank = { admin: 1, manager: 2, employee: 3 } as const;
      roles.forEach((r) => {
        const cur = roleMap.get(r.user_id);
        if (!cur || rank[r.role] < rank[cur]) roleMap.set(r.user_id, r.role);
      });

      const weekStart = new Date();
      const day = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const rows: MemberRow[] = profiles.map((p) => {
        const userTasks = tasks.filter((t) => t.assigned_to === p.id);
        const todays = userTasks.filter((t) => t.due_date === today);
        const weeks = userTasks.filter(
          (t) => t.due_date >= weekStartStr && t.due_date <= weekEndStr,
        );
        const a = att.find((x) => x.user_id === p.id);
        return {
          profile: p,
          role: roleMap.get(p.id) ?? null,
          todayTotal: todays.length,
          todayDone: todays.filter((t) => t.status === "completed").length,
          weekTotal: weeks.length,
          weekDone: weeks.filter((t) => t.status === "completed").length,
          flagsCount: flags.filter((f) => f.flagged_user_id === p.id).length,
          clockedIn: !!a?.clock_in && !a?.clock_out,
        };
      });

      setMembers(rows);
      setStats({
        activeCount: profiles.filter((p) => p.is_active).length,
        completedToday: completedTodayRes.count ?? 0,
        overdueNow: overdueRes.count ?? 0,
        clockedInToday: att.filter((a) => a.clock_in).length,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, workspace.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot of every active employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isWorkspaceManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs"
            >
              {showInactive ? "Hide deactivated" : "Show deactivated"}
            </Button>
          )}
          {isWorkspaceManager && (
            <Button variant="outline" size="sm" asChild className="text-xs">
              <Link to="/$workspaceSlug/tasks/assign" params={{ workspaceSlug }}>
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" /> Assign Task
              </Link>
            </Button>
          )}
          {isWorkspaceManager && (
            <InviteEmployeeDialog
              onInvited={() => setReloadKey((k) => k + 1)}
              isAdmin={isWorkspaceAdmin}
            />
          )}
        </div>
      </div>

      {isWorkspaceManager && <PendingInvitations reloadKey={reloadKey} />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Active employees" value={stats.activeCount} />
        <StatCard icon={CheckCircle2} label="Completed today" value={stats.completedToday} />
        <StatCard
          icon={AlertTriangle}
          label="Overdue right now"
          value={stats.overdueNow}
          tone="danger"
        />
        <StatCard icon={Clock} label="Clocked in today" value={stats.clockedInToday} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {members
              .filter((m) => m.profile.is_active)
              .map((m) => (
                <MemberCard
                  key={m.profile.id}
                  m={m}
                  isAdmin={isWorkspaceAdmin}
                  isManager={isWorkspaceManager}
                  onRoleChanged={() => setReloadKey((k) => k + 1)}
                  onActivationChanged={() => setReloadKey((k) => k + 1)}
                />
              ))}
            {members.filter((m) => m.profile.is_active).length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                No active employees yet.
              </div>
            )}
          </div>

          {showInactive && members.filter((m) => !m.profile.is_active).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deactivated accounts
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 opacity-60">
                {members
                  .filter((m) => !m.profile.is_active)
                  .map((m) => (
                    <MemberCard
                      key={m.profile.id}
                      m={m}
                      isAdmin={isWorkspaceAdmin}
                      isManager={isWorkspaceManager}
                      onRoleChanged={() => setReloadKey((k) => k + 1)}
                      onActivationChanged={() => setReloadKey((k) => k + 1)}
                    />
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon
          className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`}
        />
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function MemberCard({
  m,
  isAdmin,
  isManager,
  onRoleChanged,
  onActivationChanged,
}: {
  m: MemberRow;
  isAdmin: boolean;
  isManager: boolean;
  onRoleChanged: () => void;
  onActivationChanged: () => void;
}) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const removeMember = useServerFn(removeWorkspaceMemberFn);
  const setActive = useServerFn(setEmployeeActiveFn);
  const [toggling, setToggling] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function toggleActive() {
    setToggling(true);
    const nextActive = !m.profile.is_active;
    try {
      await setActive({ data: { userId: m.profile.id, isActive: nextActive } });
      toast.success(nextActive ? "Account reactivated" : "Account deactivated");
      onActivationChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account status");
    } finally {
      setToggling(false);
    }
  }

  async function removeFromWorkspace() {
    const name = m.profile.full_name ?? m.profile.email ?? "this employee";
    if (!confirm(`Remove ${name} from this workspace? They will lose access immediately.`)) return;
    setRemoving(true);
    try {
      await removeMember({ data: { workspaceId: workspace.id, userId: m.profile.id } });
      toast.success(`${name} removed from workspace`);
      onActivationChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemoving(false);
    }
  }

  const todayPct = m.todayTotal ? Math.round((m.todayDone / m.todayTotal) * 100) : 0;
  const roleStyle =
    m.role === "admin"
      ? "border-primary/50 text-primary"
      : m.role === "manager"
        ? "border-warning/50 text-warning"
        : "text-muted-foreground";

  const { workspaceSlug } = Route.useParams();
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <Link
        to="/$workspaceSlug/team/$userId"
        params={{ workspaceSlug, userId: m.profile.id }}
        className="block"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {initialsOf(m.profile.full_name ?? m.profile.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{m.profile.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${roleStyle}`}>
                {m.role}
              </span>
              {m.profile.department && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {m.profile.department}
                </span>
              )}
              {!m.profile.is_active && (
                <span className="rounded border border-destructive/40 px-1.5 py-0.5 text-[10px] uppercase text-destructive">
                  inactive
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Today</span>
                <span className="font-medium text-foreground">
                  {m.todayDone}/{m.todayTotal} ({todayPct}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>This week</span>
                <span className="font-medium text-foreground">
                  {m.weekDone}/{m.weekTotal}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>

      {isManager && (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs ${m.profile.is_active ? "text-destructive hover:text-destructive" : "text-success hover:text-success"}`}
            onClick={toggleActive}
            disabled={toggling}
          >
            {m.profile.is_active ? (
              <>
                <UserX className="mr-1.5 h-3 w-3" />
                Deactivate
              </>
            ) : (
              <>
                <UserCheck className="mr-1.5 h-3 w-3" />
                Reactivate
              </>
            )}
          </Button>
          {m.profile.is_active && (
            <ManageRoleDialog
              userId={m.profile.id}
              userName={m.profile.full_name ?? m.profile.email ?? undefined}
              currentRole={m.role}
              onChanged={onRoleChanged}
              isAdmin={isAdmin}
              trigger={
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Shield className="mr-1.5 h-3 w-3" /> Change role
                </Button>
              }
            />
          )}
          {isAdmin && m.profile.id !== user?.id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={removeFromWorkspace}
              disabled={removing}
              title="Remove from workspace (terminate employment)"
            >
              <Trash2 className="mr-1.5 h-3 w-3" /> Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
