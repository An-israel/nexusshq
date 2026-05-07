import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { requireAnyRole } from "@/lib/role-access";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Download, BarChart3, Users, Clock, CheckSquare } from "lucide-react";
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";

export const Route = createFileRoute("/_app/$workspaceSlug/reports")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: ReportsPage,
});

// ─── Colour palette ───────────────────────────────────────────────────────────

const CHART_COLOURS = [
  "hsl(var(--primary))",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
];

// ─── CSV helper ───────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card className="p-5 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReportsPage() {
  const { workspace } = useWorkspace();
  const [loading, setLoading] = React.useState(true);

  // Task stats
  const [tasksByStatus, setTasksByStatus] = React.useState<{ name: string; value: number }[]>([]);
  const [tasksByDept, setTasksByDept] = React.useState<{ dept: string; completed: number; open: number }[]>([]);
  const [tasksByPriority, setTasksByPriority] = React.useState<{ name: string; value: number }[]>([]);
  const [taskTotals, setTaskTotals] = React.useState({ total: 0, completed: 0, overdue: 0, completionRate: 0 });

  // Attendance stats
  const [attendanceByDay, setAttendanceByDay] = React.useState<{ day: string; present: number; absent: number }[]>([]);
  const [attendanceTotals, setAttendanceTotals] = React.useState({ avgMinutes: 0, totalDays: 0, uniqueEmployees: 0 });

  // Team stats
  const [teamByDept, setTeamByDept] = React.useState<{ name: string; value: number }[]>([]);
  const [teamTotal, setTeamTotal] = React.useState(0);

  React.useEffect(() => {
    void loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadTaskStats(), loadAttendanceStats(), loadTeamStats()]);
    setLoading(false);
  }

  async function loadTaskStats() {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("status, priority, assigned_to")
      .eq("workspace_id", workspace.id);

    const rows = tasks ?? [];

    // By status
    const statusCount: Record<string, number> = {};
    rows.forEach((t) => { statusCount[t.status] = (statusCount[t.status] ?? 0) + 1; });
    setTasksByStatus(
      Object.entries(statusCount).map(([name, value]) => ({
        name: name.replace("_", " "),
        value,
      }))
    );

    // By priority
    const priCount: Record<string, number> = {};
    rows.forEach((t) => { priCount[t.priority] = (priCount[t.priority] ?? 0) + 1; });
    setTasksByPriority(
      ["urgent", "high", "medium", "low"].map((p) => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        value: priCount[p] ?? 0,
      }))
    );

    const total = rows.length;
    const completed = rows.filter((t) => t.status === "completed").length;
    const overdue = rows.filter((t) => t.status === "overdue").length;
    setTaskTotals({
      total,
      completed,
      overdue,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    });

    // By department — need profile join
    const { data: profiles } = await supabase.from("profiles").select("id, department");
    const deptMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.department ?? "other"]));

    const deptStats: Record<string, { completed: number; open: number }> = {};
    DEPARTMENTS.forEach((d) => { deptStats[d] = { completed: 0, open: 0 }; });

    rows.forEach((t) => {
      const dept = deptMap[t.assigned_to] ?? "other";
      if (!deptStats[dept]) deptStats[dept] = { completed: 0, open: 0 };
      if (t.status === "completed") deptStats[dept].completed++;
      else deptStats[dept].open++;
    });

    setTasksByDept(
      Object.entries(deptStats)
        .filter(([, v]) => v.completed + v.open > 0)
        .map(([dept, v]) => ({ dept: deptLabel(dept), ...v }))
        .sort((a, b) => b.completed + b.open - (a.completed + a.open))
        .slice(0, 8)
    );
  }

  async function loadAttendanceStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().slice(0, 10);

    const { data: att } = await supabase
      .from("attendance")
      .select("date, user_id, clock_out, total_minutes")
      .eq("workspace_id", workspace.id)
      .gte("date", since)
      .order("date");

    const rows = att ?? [];

    // Group by day-of-week for attendance pattern
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayPresent: Record<string, Set<string>> = {};
    dayNames.forEach((d) => { dayPresent[d] = new Set(); });

    // Unique employees per day
    const datePresent: Record<string, Set<string>> = {};
    rows.forEach((r) => {
      if (!r.clock_out) return;
      const dow = dayNames[new Date(r.date).getDay()];
      dayPresent[dow].add(r.user_id);
      if (!datePresent[r.date]) datePresent[r.date] = new Set();
      datePresent[r.date].add(r.user_id);
    });

    const { count: totalEmployees } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    const emp = totalEmployees ?? 1;

    setAttendanceByDay(
      dayNames.map((d) => ({
        day: d,
        present: dayPresent[d].size,
        absent: Math.max(0, emp - dayPresent[d].size),
      }))
    );

    const totalMins = rows.reduce((s, r) => s + (r.total_minutes ?? 0), 0);
    const avgMinutes = rows.length ? Math.round(totalMins / rows.length) : 0;
    setAttendanceTotals({
      avgMinutes,
      totalDays: Object.keys(datePresent).length,
      uniqueEmployees: new Set(rows.map((r) => r.user_id)).size,
    });
  }

  async function loadTeamStats() {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("department")
      .eq("is_active", true);

    const rows = profiles ?? [];
    setTeamTotal(rows.length);

    const byDept: Record<string, number> = {};
    rows.forEach((p) => {
      const d = p.department ?? "other";
      byDept[d] = (byDept[d] ?? 0) + 1;
    });
    setTeamByDept(
      Object.entries(byDept)
        .map(([name, value]) => ({ name: deptLabel(name), value }))
        .sort((a, b) => b.value - a.value)
    );
  }

  function exportTasks() {
    const rows = tasksByStatus.map((s) => ({ status: s.name, count: s.value }));
    downloadCSV("nexus-task-report.csv", rows);
  }

  function exportAttendance() {
    const rows = attendanceByDay.map((d) => ({
      day: d.day,
      present: d.present,
      absent: d.absent,
    }));
    downloadCSV("nexus-attendance-report.csv", rows);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Company-wide insights across tasks, attendance, and team composition.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Team
            </TabsTrigger>
          </TabsList>

          {/* ── Tasks tab ───────────────────────────────────────────────── */}
          <TabsContent value="tasks" className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportTasks}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>

            {/* KPI row */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total tasks" value={taskTotals.total} icon={BarChart3} />
              <StatCard label="Completed" value={taskTotals.completed} icon={CheckSquare} sub={`${taskTotals.completionRate}% completion rate`} />
              <StatCard label="Overdue" value={taskTotals.overdue} icon={Clock} />
              <StatCard label="Completion rate" value={`${taskTotals.completionRate}%`} icon={BarChart3} />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">Tasks by status</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={tasksByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                      {tasksByStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <h3 className="mb-4 text-sm font-semibold">Tasks by priority</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tasksByPriority} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <h3 className="mb-4 text-sm font-semibold">Tasks by department</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tasksByDept} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="open" name="Open" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          {/* ── Attendance tab ───────────────────────────────────────────── */}
          <TabsContent value="attendance" className="mt-6 space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportAttendance}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Avg hours/session"
                value={`${Math.floor(attendanceTotals.avgMinutes / 60)}h ${attendanceTotals.avgMinutes % 60}m`}
                icon={Clock}
                sub="Last 30 days"
              />
              <StatCard
                label="Active days tracked"
                value={attendanceTotals.totalDays}
                icon={BarChart3}
                sub="Last 30 days"
              />
              <StatCard
                label="Employees tracked"
                value={attendanceTotals.uniqueEmployees}
                icon={Users}
                sub="Last 30 days"
              />
            </div>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold">Attendance by day of week (last 30 days)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceByDay} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="present" name="Present" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="absent" name="Absent" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* ── Team tab ─────────────────────────────────────────────────── */}
          <TabsContent value="team" className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Total employees" value={teamTotal} icon={Users} sub="Active only" />
              <StatCard label="Departments" value={teamByDept.length} icon={BarChart3} />
            </div>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold">Team composition by department</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={teamByDept}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ name, value }) => `${name}: ${value as number}`}
                  >
                    {teamByDept.map((_, i) => (
                      <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
