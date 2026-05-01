import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deptLabel, initialsOf, todayISO } from "@/lib/nexus";
import { requireAnyRole } from "@/lib/role-access";
import { useAuth } from "@/lib/auth-context";
import { InviteEmployeeDialog } from "@/components/team/InviteEmployeeDialog";
import { ManageRoleDialog } from "@/components/team/ManageRoleDialog";
import { Users, CheckCircle2, AlertTriangle, Clock, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = "admin" | "manager" | "employee";

export const Route = createFileRoute("/_app/team")({
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
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<MemberRow[]>([]);
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

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("full_name");
      const profiles = (profilesData as Profile[]) ?? [];

      const userIds = profiles.map((p) => p.id);
      const [tasksRes, attRes, flagsRes, overdueRes, completedTodayRes, rolesRes] = await Promise.all([
        userIds.length
          ? supabase.from("tasks").select("id, assigned_to, status, due_date, task_type")
              .in("assigned_to", userIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase.from("attendance").select("user_id, clock_in, clock_out").eq("date", today)
              .in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? supabase.from("flags").select("flagged_user_id, is_resolved").eq("is_resolved", false)
              .in("flagged_user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("tasks").select("id", { count: "exact", head: true })
          .lt("due_date", today).neq("status", "completed"),
        supabase.from("tasks").select("id", { count: "exact", head: true })
          .eq("status", "completed").gte("completed_at", `${today}T00:00:00`),
        userIds.length
          ? supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      const tasks = (tasksRes.data as Array<{
        id: string; assigned_to: string; status: string; due_date: string; task_type: string;
      }>) ?? [];
      const att = (attRes.data as Array<{ user_id: string; clock_in: string | null; clock_out: string | null }>) ?? [];
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
        const weeks = userTasks.filter((t) => t.due_date >= weekStartStr && t.due_date <= weekEndStr);
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
        activeCount: profiles.length,
        completedToday: completedTodayRes.count ?? 0,
        overdueNow: overdueRes.count ?? 0,
        clockedInToday: att.filter((a) => a.clock_in).length,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live snapshot of every active employee.</p>
        </div>
        {isManager && <InviteEmployeeDialog onInvited={() => setReloadKey((k) => k + 1)} isAdmin={isAdmin} />}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Active employees" value={stats.activeCount} />
        <StatCard icon={CheckCircle2} label="Completed today" value={stats.completedToday} />
        <StatCard icon={AlertTriangle} label="Overdue right now" value={stats.overdueNow} tone="danger" />
        <StatCard icon={Clock} label="Clocked in today" value={stats.clockedInToday} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No active employees yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard
              key={m.profile.id}
              m={m}
              isAdmin={isAdmin}
              isManager={isManager}
              onRoleChanged={() => setReloadKey((k) => k + 1)}
            />
          ))}
        </div>
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
        <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}>
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
}: {
  m: MemberRow;
  isAdmin: boolean;
  isManager: boolean;
  onRoleChanged: () => void;
}) {
  const todayPct = m.todayTotal ? Math.round((m.todayDone / m.todayTotal) * 100) : 0;
  const roleStyle =
    m.role === "admin"
      ? "border-primary/50 text-primary"
      : m.role === "manager"
        ? "border-warning/50 text-warning"
        : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <Link
        to="/team/$userId"
        params={{ userId: m.profile.id }}
        className="block"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {initialsOf(m.profile.full_name ?? m.profile.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{m.profile.full_name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{m.profile.job_title ?? "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{deptLabel(m.profile.department)}</Badge>
              {m.role && (
                <Badge variant="outline" className={`text-[10px] ${roleStyle}`}>
                  {m.role}
                </Badge>
              )}
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${m.clockedIn ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`} />
                {m.clockedIn ? "In" : "Not clocked in"}
              </span>
            </div>
          </div>
          {m.flagsCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">{m.flagsCount}</Badge>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Today's tasks</span>
              <span className="font-medium">{m.todayDone}/{m.todayTotal}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${todayPct}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>This week</span>
            <span className="font-medium text-foreground">{m.weekDone}/{m.weekTotal}</span>
          </div>
        </div>
      </Link>

      {isManager && (
        <div className="mt-4 flex justify-end border-t border-border pt-3">
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
        </div>
      )}
    </div>
  );
}
