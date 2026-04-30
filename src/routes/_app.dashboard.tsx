import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { Bell, Clock, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Notif = Database["public"]["Tables"]["notifications"]["Row"];
type Kpi = Database["public"]["Tables"]["kpis"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [kpiCounts, setKpiCounts] = useState<Record<string, number>>({});
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [att, setAtt] = useState<Attendance | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const today = todayISO();
      const weekStart = startOfWeekISO();
      const weekEnd = endOfWeekISO();

      const [tasksToday, tasksWeek, kpisRes, notifsRes, attRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", user.id)
          .eq("task_type", "daily")
          .eq("due_date", today),
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", user.id)
          .eq("task_type", "weekly")
          .gte("due_date", weekStart)
          .lte("due_date", weekEnd),
        profile?.department
          ? supabase.from("kpis").select("*").eq("department", profile.department as Database["public"]["Enums"]["department_type"])
          : Promise.resolve({ data: [] as Kpi[], error: null }),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const tt = ((tasksToday.data as Task[]) ?? []).sort(
        (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
      );
      setTodayTasks(tt);
      setWeekTasks((tasksWeek.data as Task[]) ?? []);
      const kpiList = (kpisRes.data as Kpi[]) ?? [];
      setKpis(kpiList);
      setNotifs((notifsRes.data as Notif[]) ?? []);
      setAtt((attRes.data as Attendance) ?? null);

      // KPI completed task counts: count tasks linked to each kpi for this user, completed this period
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
              .eq("assigned_to", user.id)
              .eq("kpi_id", k.id)
              .eq("status", "completed")
              .gte("due_date", k.period === "weekly" ? startOfWeekISO() : startStr);
            counts[k.id] = count ?? 0;
          }),
        );
        if (!cancelled) setKpiCounts(counts);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.department]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const elapsedMin = att?.clock_in
    ? Math.floor((now - new Date(att.clock_in).getTime()) / 60000)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {firstName}. Here's your day.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Attendance widget */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {att?.clock_in && !att?.clock_out ? (
          <div className="flex items-center justify-between">
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
            <Link to="/attendance">
              <Button variant="outline" size="sm">
                View attendance
              </Button>
            </Link>
          </div>
        ) : att?.clock_out ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Day complete</p>
                <p className="text-xs text-muted-foreground">
                  Clocked out at{" "}
                  {new Date(att.clock_out).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">You haven't clocked in yet</p>
                <p className="text-xs text-muted-foreground">Work starts at 9:00 AM WAT.</p>
              </div>
            </div>
            <Link to="/attendance">
              <Button size="sm">Clock In</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's tasks */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Today's Tasks
            </h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline">
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
            <Link to="/tasks" className="text-xs text-primary hover:underline">
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
          <Link to="/notifications" className="text-xs text-primary hover:underline">
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
  return (
    <Link
      to="/tasks"
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 hover:border-primary/40"
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
