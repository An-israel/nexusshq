import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEPARTMENTS, deptLabel, todayISO } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, Clock as ClockIcon, Download } from "lucide-react";
import { useRealtime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_app/attendance")({
  component: AttendancePage,
});

interface AttendanceRow {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "late" | "absent" | "half_day";
  total_minutes: number | null;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  present: {
    bg: "bg-success/15",
    text: "text-success",
    dot: "bg-success",
    label: "Present",
  },
  late: {
    bg: "bg-warning/15",
    text: "text-warning",
    dot: "bg-warning",
    label: "Late",
  },
  absent: {
    bg: "bg-destructive/15",
    text: "text-destructive",
    dot: "bg-destructive",
    label: "Absent",
  },
  half_day: {
    bg: "bg-primary/15",
    text: "text-primary",
    dot: "bg-primary",
    label: "Half day",
  },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(min: number | null): string {
  if (min == null) return "—";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function AttendancePage() {
  const { user, isManager } = useAuth();
  const [scope, setScope] = React.useState<"me" | "team">("me");
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<string>("");
  const [deptFilter, setDeptFilter] = React.useState<string>("all");

  // Date range — defaults to current month
  const [dateFrom, setDateFrom] = React.useState(currentMonthStart);
  const [dateTo, setDateTo] = React.useState(todayISO);

  const [rows, setRows] = React.useState<AttendanceRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  React.useEffect(() => {
    if (!isManager) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, [isManager]);

  // When dept filter changes, clear the selected employee so a valid one is picked
  React.useEffect(() => {
    setSelectedUser("");
  }, [deptFilter]);

  const filteredEmployees = React.useMemo(
    () =>
      deptFilter === "all"
        ? employees
        : employees.filter((e) => e.department === deptFilter),
    [employees, deptFilter],
  );

  const targetUserId = scope === "me" || !selectedUser ? user?.id : selectedUser;

  const load = React.useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", targetUserId)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: true });
    if (!error) setRows((data ?? []) as AttendanceRow[]);
    setLoading(false);
  }, [targetUserId, dateFrom, dateTo]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "attendance",
    filter: targetUserId ? `user_id=eq.${targetUserId}` : undefined,
    enabled: !!targetUserId,
    onChange: () => void load(),
  });

  // Derive calendar month from dateFrom
  const calendarMonth = React.useMemo(() => {
    const [y, m] = dateFrom.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }, [dateFrom]);

  const monthLabel = calendarMonth.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  function changeMonth(delta: number) {
    const [y, m] = dateFrom.split("-").map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    const ny = next.getFullYear();
    const nm = next.getMonth() + 1;
    const newFrom = `${ny}-${String(nm).padStart(2, "0")}-01`;
    const lastDay = new Date(ny, nm, 0).getDate();
    const rawTo = `${ny}-${String(nm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const today = todayISO();
    setDateFrom(newFrom);
    setDateTo(rawTo > today ? today : rawTo);
  }

  const filteredRows = React.useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  const stats = React.useMemo(() => {
    const present = rows.filter((r) => r.status === "present").length;
    const late = rows.filter((r) => r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const totalMins = rows.reduce((sum, r) => sum + (r.total_minutes ?? 0), 0);
    return { present, late, absent, totalMins, count: rows.length };
  }, [rows]);

  function exportCsv() {
    if (filteredRows.length === 0) return;
    const header = ["Date", "Status", "Clock in", "Clock out", "Total minutes"];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      const inT = r.clock_in ? new Date(r.clock_in).toISOString() : "";
      const outT = r.clock_out ? new Date(r.clock_out).toISOString() : "";
      lines.push([r.date, r.status, inT, outT, r.total_minutes ?? ""].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const who =
      scope === "team"
        ? (filteredEmployees.find((e) => e.id === selectedUser)?.full_name ?? "team-member")
        : "me";
    const rangeStr = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
    a.href = url;
    a.download = `attendance-${who}-${rangeStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "me" ? "Your attendance history." : "Team attendance overview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Tabs value={scope} onValueChange={(v) => setScope(v as "me" | "team")}>
              <TabsList>
                <TabsTrigger value="me">Me</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters row: date range + department */}
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">From</span>
          <Input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">To</span>
          <Input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayISO()}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 text-sm"
          />
        </div>
        {isManager && scope === "team" && (
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {deptLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Card>

      {/* Team employee selector */}
      {scope === "team" && isManager && (
        <Card className="p-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Employee:</span>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick an employee" />
            </SelectTrigger>
            <SelectContent>
              {filteredEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredEmployees.length === 0 && deptFilter !== "all" && (
            <span className="text-xs text-muted-foreground">
              No employees in {deptLabel(deptFilter)}.
            </span>
          )}
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          label="Present"
          value={stats.present}
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4 text-warning" />}
          label="Late"
          value={stats.late}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          label="Absent"
          value={stats.absent}
        />
        <StatCard
          icon={<ClockIcon className="h-4 w-4 text-primary" />}
          label="Total hours"
          value={`${Math.floor(stats.totalMins / 60)}h`}
        />
      </div>

      {/* Calendar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => changeMonth(-1)}
          >
            ← Prev
          </button>
          <h2 className="font-semibold">{monthLabel}</h2>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => changeMonth(1)}
          >
            Next →
          </button>
        </div>
        <CalendarGrid month={calendarMonth} rows={rows} />
      </Card>

      {/* Daily log */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold">Daily log</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1">
              {(["all", "present", "late", "absent", "half_day"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2.5 py-1 text-xs capitalize ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              className="h-8 px-3 text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records match this filter.</p>
        ) : (
          <div className="divide-y divide-border">
            {[...filteredRows].reverse().map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="font-medium">{r.date}</span>
                    <span className={`text-xs ${s.text}`}>{s.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground text-xs tabular-nums">
                    <span>In: {fmtTime(r.clock_in)}</span>
                    <span>Out: {fmtTime(r.clock_out)}</span>
                    <span className="text-foreground">{fmtDuration(r.total_minutes)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}

function CalendarGrid({ month, rows }: { month: Date; rows: AttendanceRow[] }) {
  const today = todayISO();
  const map = React.useMemo(() => {
    const m: Record<string, AttendanceRow> = {};
    rows.forEach((r) => {
      m[r.date] = r;
    });
    return m;
  }, [rows]);

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }

  const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] text-muted-foreground uppercase">
        {weekdayLabels.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const rec = map[c.iso];
          const isToday = c.iso === today;
          const isWeekend = i % 7 >= 5;
          const isFuture = c.iso > today;
          let bg = "bg-card border-border";
          let textCol = "text-foreground";
          if (rec) {
            const s = STATUS_STYLE[rec.status];
            bg = `${s.bg} border-transparent`;
            textCol = s.text;
          } else if (isFuture) {
            bg = "bg-transparent border-border/40";
            textCol = "text-muted-foreground/40";
          } else if (isWeekend) {
            bg = "bg-muted/30 border-transparent";
            textCol = "text-muted-foreground";
          }
          return (
            <div
              key={i}
              className={`aspect-square rounded border flex flex-col items-center justify-center text-xs ${bg} ${
                isToday ? "ring-2 ring-primary" : ""
              }`}
              title={rec ? `${c.iso} — ${STATUS_STYLE[rec.status].label}` : c.iso}
            >
              <span className={`font-medium ${textCol}`}>{c.day}</span>
              {rec && (
                <span className={`text-[9px] ${textCol} opacity-80`}>
                  {fmtTime(rec.clock_in)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
