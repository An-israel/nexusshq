import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import {
  PRIORITY_BADGE,
  PRIORITY_RANK,
  STATUS_BADGE,
  deptLabel,
  endOfWeekISO,
  startOfWeekISO,
  timeAgo,
  todayISO,
} from "@/lib/nexus";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Clock, AlertCircle, LogIn, LogOut, ClipboardList, Megaphone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Announcement = Database["public"]["Tables"]["announcements"]["Row"];

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Notif = Database["public"]["Tables"]["notifications"]["Row"];
type Kpi = Database["public"]["Tables"]["kpis"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export const Route = createFileRoute("/_app/$workspaceSlug/dashboard")({
  component: DashboardPage,
});

// Clock-in constants (local time)
const LATE_AFTER_HOUR = 9;
const LATE_AFTER_MINUTE = 5;
const OVERTIME_HOUR = 17;

function overtimeMinsBetween(start: Date, end: Date): number {
  const cutoff = new Date(start);
  cutoff.setHours(OVERTIME_HOUR, 0, 0, 0);
  if (end <= cutoff) return 0;
  const from = start > cutoff ? start : cutoff;
  return Math.max(0, Math.round((end.getTime() - from.getTime()) / 60000));
}

function DashboardPage() {
  const { profile, user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [kpiCounts, setKpiCounts] = useState<Record<string, number>>({});
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [att, setAtt] = useState<Attendance | null>(null);
  const [clockBusy, setClockBusy] = useState(false);
  const [todayStandup, setTodayStandup] = useState<{ id: string } | null | undefined>(undefined);
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<Announcement | null>(null);
  const [clockedInTeam, setClockedInTeam] = useState<
    Array<{
      user_id: string;
      clock_in: string;
      full_name: string | null;
      avatar_url: string | null;
    }>
  >([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = todayISO();
    const weekStart = startOfWeekISO();
    const weekEnd = endOfWeekISO();

    const [tasksToday, tasksWeek, kpisRes, notifsRes, attRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("assigned_to", user.id)
        .eq("task_type", "daily")
        .eq("due_date", today),
      supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("assigned_to", user.id)
        .eq("task_type", "weekly")
        .gte("due_date", weekStart)
        .lte("due_date", weekEnd),
      profile?.department
        ? supabase
            .from("kpis")
            .select("*")
            .eq("workspace_id", workspace.id)
            .eq("department", profile.department as Database["public"]["Enums"]["department_type"])
        : Promise.resolve({ data: [] as Kpi[], error: null }),
      supabase
        .from("notifications")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("attendance")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
    ]);

    const tt = ((tasksToday.data as Task[]) ?? []).sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
    );
    setTodayTasks(tt);
    setWeekTasks((tasksWeek.data as Task[]) ?? []);
    const kpiList = (kpisRes.data as Kpi[]) ?? [];
    setKpis(kpiList);
    setNotifs((notifsRes.data as Notif[]) ?? []);
    setAtt((attRes.data as Attendance) ?? null);

    if (kpiList.length) {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);
      const startStr = periodStart.toISOString().slice(0, 10);
      const counts: Record<string, number> = {};
      await Promise.all(
        kpiList.map(async (k) => {
          const { count } = await supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspace.id)
            .eq("assigned_to", user.id)
            .eq("kpi_id", k.id)
            .eq("status", "completed")
            .gte("due_date", k.period === "weekly" ? startOfWeekISO() : startStr);
          counts[k.id] = count ?? 0;
        }),
      );
      setKpiCounts(counts);
    }

    setLoading(false);

    // Standup today (non-blocking)
    supabase
      .from("standups")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => setTodayStandup(data ?? null));

    // Latest pinned announcement (non-blocking)
    supabase
      .from("announcements")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPinnedAnnouncement((data as Announcement) ?? null));
  }, [user, profile?.department]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClockIn() {
    if (!user) return;
    setClockBusy(true);
    const today = todayISO();

    // Block double clock-in
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, clock_in")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace.id)
      .eq("date", today)
      .not("clock_in", "is", null)
      .maybeSingle();
    if (existing?.clock_in) {
      const t = new Date(existing.clock_in).toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Lagos",
      });
      toast.error(`Already clocked in today at ${t}`);
      setClockBusy(false);
      return;
    }

    const nowD = new Date();
    const watTime = new Date(nowD.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
    const isLate =
      watTime.getHours() > LATE_AFTER_HOUR ||
      (watTime.getHours() === LATE_AFTER_HOUR && watTime.getMinutes() > LATE_AFTER_MINUTE);
    const status: Attendance["status"] = isLate ? "late" : "present";
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      workspace_id: workspace.id,
      date: today,
      clock_in: nowD.toISOString(),
      clock_out: null,
      status,
    });
    if (error) toast.error(error.message);
    else toast.success(isLate ? "Clocked in (late)" : "Clocked in ✓");
    await load();
    setClockBusy(false);
  }

  async function handleClockOut() {
    if (!user || !att?.clock_in) return;
    setClockBusy(true);
    const startD = new Date(att.clock_in);
    const nowD = new Date();
    const sessionMins = Math.max(0, Math.round((nowD.getTime() - startD.getTime()) / 60000));
    const sessionOT = overtimeMinsBetween(startD, nowD);
    const newTotal = (att.total_minutes ?? 0) + sessionMins;
    const newOvertime = (att.overtime_minutes ?? 0) + sessionOT;
    const { error } = await supabase
      .from("attendance")
      .update({
        clock_out: nowD.toISOString(),
        total_minutes: newTotal,
        overtime_minutes: newOvertime,
      })
      .eq("id", att.id);
    if (error) toast.error(error.message);
    else {
      const h = Math.floor(sessionMins / 60);
      const m = sessionMins % 60;
      toast.success(
        `Clocked out — ${h}h ${m}m${sessionOT > 0 ? ` · ${Math.floor(sessionOT / 60)}h ${sessionOT % 60}m OT` : ""}`,
      );
    }
    await load();
    setClockBusy(false);
  }

  // Managers/admins: who's currently clocked in today
  const loadClockedInTeam = useCallback(async () => {
    if (!isManager) return;
    const today = todayISO();
    const { data } = await supabase
      .from("attendance")
      .select("user_id, clock_in")
      .eq("workspace_id", workspace.id)
      .eq("date", today)
      .not("clock_in", "is", null)
      .is("clock_out", null);
    const ids = (data ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setClockedInTeam([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", ids);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setClockedInTeam(
      (data ?? []).map((r) => ({
        user_id: r.user_id,
        clock_in: r.clock_in!,
        full_name: profMap.get(r.user_id)?.full_name ?? null,
        avatar_url: profMap.get(r.user_id)?.avatar_url ?? null,
      })),
    );
  }, [isManager, workspace.id]);

  useEffect(() => {
    void loadClockedInTeam();
    const t = setInterval(() => void loadClockedInTeam(), 60_000);
    return () => clearInterval(t);
  }, [loadClockedInTeam]);

  // Track whether the initial load has completed so we don't toast on mount
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!loading) initialLoadDone.current = true;
  }, [loading]);

  // Live updates: tasks scoped to this user, with toast on assign/warning
  useRealtime({
    table: "tasks",
    filter: user ? `assigned_to=eq.${user.id}` : undefined,
    enabled: !!user,
    shouldHandle: (payload) => {
      const row = (payload.new ?? payload.old) as Task | null;
      return row?.assigned_to === user?.id;
    },
    onChange: (payload) => {
      void load();
      if (!initialLoadDone.current) return;
      if (payload?.eventType === "INSERT") {
        toast.info("New task assigned to you");
      } else if (payload?.eventType === "UPDATE") {
        const row = payload.new as Task;
        if (row?.has_warning) toast.warning("A task has been flagged", { description: row.title });
      }
    },
  });

  // Live updates: attendance scoped to this user — silent refresh only
  useRealtime({
    table: "attendance",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    shouldHandle: (payload) => {
      const row = (payload.new ?? payload.old) as Attendance | null;
      return row?.user_id === user?.id;
    },
    onChange: () => void load(),
  });

  // Live updates: notifications scoped to this user, toast on new flag/warning/task
  useRealtime({
    table: "notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    shouldHandle: (payload) => {
      const row = (payload.new ?? payload.old) as Notif | null;
      return row?.user_id === user?.id;
    },
    onChange: (payload) => {
      void load();
      if (!initialLoadDone.current) return;
      if (payload?.eventType === "INSERT") {
        const n = payload.new as Notif;
        if (n?.type === "flag" || n?.type === "warning") {
          toast.warning(n.title, { description: n.message ?? undefined });
        } else if (
          n?.type === "task_assigned" ||
          n?.type === "task_overdue" ||
          n?.type === "task_due_soon"
        ) {
          toast.info(n.title, { description: n.message ?? undefined });
        }
      }
    },
  });

  const greeting = (() => {
    const watHour = new Date(
      new Date(now).toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
    ).getHours();
    if (watHour >= 5 && watHour < 12) return "Good morning";
    if (watHour >= 12 && watHour < 17) return "Good afternoon";
    if (watHour >= 17 && watHour < 21) return "Good evening";
    return "Good night";
  })();

  const greetingSubtitle = (() => {
    const watHour = new Date(
      new Date(now).toLocaleString("en-US", { timeZone: "Africa/Lagos" }),
    ).getHours();
    const clockedIn = !!att?.clock_in && !att?.clock_out;
    if (watHour >= 5 && watHour < 12) {
      if (!clockedIn) return "You haven't clocked in yet. Work starts at 9:00 AM.";
      return "You're clocked in. Here's what's on your plate today.";
    }
    if (watHour >= 12 && watHour < 17) return "Here's where things stand today.";
    if (watHour >= 17 && watHour < 21) {
      if (!clockedIn) return "Good work today. Here's a summary of what you accomplished.";
      return "Don't forget to clock out before you leave.";
    }
    return "Working late? Here's your current status.";
  })();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const elapsedMin = att?.clock_in
    ? Math.floor((now - new Date(att.clock_in).getTime()) / 60000)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6 px-4 py-4 md:px-6 md:py-6">
        {/* Greeting skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>

        {/* 2×2 stat card skeletons */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-8 w-16 rounded" />
            </div>
          ))}
        </div>

        {/* Task list skeleton with 4 rows */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-28 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="text-lg font-semibold md:text-2xl md:font-bold">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{greetingSubtitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/60">
          {new Date(now).toLocaleDateString("en-NG", {
            weekday: "long",
            month: "long",
            day: "numeric",
            timeZone: "Africa/Lagos",
          })}
        </p>
      </div>

      {/* Attendance widget */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {att?.clock_in && !att?.clock_out ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              </div>
              <div>
                <p className="text-sm font-medium">You're clocked in</p>
                <p className="text-xs text-muted-foreground">
                  {Math.floor(elapsedMin / 60)}h {elapsedMin % 60}m elapsed · since{" "}
                  {new Date(att.clock_in).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleClockOut()}
                disabled={clockBusy}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Clock Out
              </Button>
              <Link to="/$workspaceSlug/attendance" params={{ workspaceSlug: workspace.slug }}>
                <Button variant="ghost" size="sm">
                  View log
                </Button>
              </Link>
            </div>
          </div>
        ) : att?.clock_out ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Day complete</p>
                <p className="text-xs text-muted-foreground">
                  Clocked out at{" "}
                  {new Date(att.clock_out).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {(att.total_minutes ?? 0) > 0 && (
                    <>
                      {" "}
                      · {Math.floor((att.total_minutes ?? 0) / 60)}h {(att.total_minutes ?? 0) % 60}
                      m
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClockIn()}
              disabled={clockBusy}
            >
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              Clock In Again
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">You haven't clocked in yet</p>
                <p className="text-xs text-muted-foreground">Work starts at 9:00 AM WAT.</p>
              </div>
            </div>
            <Button
              onClick={() => void handleClockIn()}
              disabled={clockBusy}
              className="rounded-xl font-semibold"
            >
              <LogIn className="mr-1.5 h-4 w-4" />
              Clock In
            </Button>
          </div>
        )}
      </div>

      {/* Pinned announcement */}
      {pinnedAnnouncement && (
        <Link
          to="/$workspaceSlug/announcements"
          params={{ workspaceSlug: workspace.slug }}
          className="block rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 hover:bg-amber-500/10 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <Megaphone className="h-4 w-4 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-0.5">
                Pinned Announcement
              </p>
              <p className="text-sm font-semibold truncate">{pinnedAnnouncement.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {pinnedAnnouncement.body}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Standup quick-action */}
      {todayStandup === null && (
        <Link
          to="/$workspaceSlug/standups"
          params={{ workspaceSlug: workspace.slug }}
          className="block rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Submit your standup</p>
                <p className="text-xs text-muted-foreground">
                  You haven't submitted today's standup yet.
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-primary shrink-0">Do it now →</span>
          </div>
        </Link>
      )}

      {/* Manager view: who's clocked in right now */}
      {isManager && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Clocked in now · {clockedInTeam.length}
            </h2>
            <Link
              to="/$workspaceSlug/attendance"
              params={{ workspaceSlug: workspace.slug }}
              className="text-xs text-primary hover:underline"
            >
              View attendance
            </Link>
          </div>
          {clockedInTeam.length === 0 ? (
            <EmptyRow>No team members are currently clocked in.</EmptyRow>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {clockedInTeam.map((m) => {
                const elapsed = Math.floor((now - new Date(m.clock_in).getTime()) / 60000);
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-medium">
                          {(m.full_name ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(elapsed / 60)}h {elapsed % 60}m · since{" "}
                        {new Date(m.clock_in).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Tasks
            </h2>
            <Link
              to="/$workspaceSlug/tasks"
              params={{ workspaceSlug: workspace.slug }}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : todayTasks.length === 0 ? (
            <EmptyRow>No daily tasks for today. Enjoy the calm.</EmptyRow>
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </section>

        {/* This week's tasks */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              This Week
            </h2>
            <Link
              to="/$workspaceSlug/tasks"
              params={{ workspaceSlug: workspace.slug }}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : weekTasks.length === 0 ? (
            <EmptyRow>No weekly tasks scheduled.</EmptyRow>
          ) : (
            <ul className="space-y-2">
              {weekTasks.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* KPI progress */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            My KPI Progress · {deptLabel(profile?.department)}
          </h2>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : kpis.length === 0 ? (
          <EmptyRow>No KPIs configured for your department yet.</EmptyRow>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {kpis.map((k) => {
              const done = kpiCounts[k.id] ?? 0;
              const target = Number(k.target_value) || 1;
              const pct = Math.min(100, Math.round((done / target) * 100));
              const healthy = pct >= 60;
              return (
                <div key={k.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">{k.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {done}/{target} {k.unit} · {k.period}
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: healthy
                          ? "linear-gradient(90deg, oklch(0.62 0.19 259), oklch(0.72 0.16 162))"
                          : "linear-gradient(90deg, oklch(0.78 0.16 73), oklch(0.65 0.22 25))",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{pct}% of target</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent notifications */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Notifications
          </h2>
          <Link
            to="/$workspaceSlug/notifications"
            params={{ workspaceSlug: workspace.slug }}
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : notifs.length === 0 ? (
          <EmptyRow>You're all caught up.</EmptyRow>
        ) : (
          <ul className="divide-y divide-border">
            {notifs.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                  {n.type === "warning" || n.type === "flag" ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{n.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/40 p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function TaskRow({ t }: { t: Task }) {
  const { workspace } = useWorkspace();
  return (
    <Link
      to="/$workspaceSlug/tasks/$taskId"
      params={{ workspaceSlug: workspace.slug, taskId: t.id }}
      className="flex w-full min-h-[56px] items-center gap-3 rounded-lg border border-border bg-background/40 p-3 hover:border-primary/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.title}</p>
        <p className="text-xs text-muted-foreground">
          Due {new Date(t.due_date).toLocaleDateString()} · {t.progress_percent}%
        </p>
      </div>
      <Badge variant="outline" className={PRIORITY_BADGE[t.priority] ?? ""}>
        {t.priority}
      </Badge>
      <Badge variant="outline" className={STATUS_BADGE[t.status] ?? ""}>
        {t.status.replace("_", " ")}
      </Badge>
    </Link>
  );
}
