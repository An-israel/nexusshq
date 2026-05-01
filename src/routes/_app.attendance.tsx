import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { todayISO } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, Clock as ClockIcon, Download } from "lucide-react";

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

function AttendancePage() {
  const { user, isManager } = useAuth();
  const [scope, setScope] = React.useState<"me" | "team">("me");
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<string>("");
  const [month, setMonth] = React.useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [rows, setRows] = React.useState<AttendanceRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isManager) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, [isManager]);

  const targetUserId = scope === "me" || !selectedUser ? user?.id : selectedUser;

  const load = React.useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", targetUserId)
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10))
      .order("date", { ascending: true });
    if (!error) setRows((data ?? []) as AttendanceRow[]);
    setLoading(false);
  }, [targetUserId, month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const stats = React.useMemo(() => {
    const present = rows.filter((r) => r.status === "present").length;
    const late = rows.filter((r) => r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    const totalMins = rows.reduce((sum, r) => sum + (r.total_minutes ?? 0), 0);
    return { present, late, absent, totalMins, count: rows.length };
  }, [rows]);

  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });

  function changeMonth(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  function exportCsv() {
    if (rows.length === 0) {
      return;
    }
    const header = ["Date", "Status", "Clock in", "Clock out", "Total minutes"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const inT = r.clock_in ? new Date(r.clock_in).toISOString() : "";
      const outT = r.clock_out ? new Date(r.clock_out).toISOString() : "";
      lines.push([r.date, r.status, inT, outT, r.total_minutes ?? ""].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const who =
      scope === "team"
        ? employees.find((e) => e.id === selectedUser)?.full_name ?? "team-member"
        : "me";
    a.href = url;
    a.download = `attendance-${who}-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {scope === "me" ? "Your attendance history." : "Team attendance overview."}
          </p>
        </div>
        {isManager && (
          <Tabs value={scope} onValueChange={(v) => setScope(v as "me" | "team")}>
            <TabsList>
              <TabsTrigger value="me">Me</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {scope === "team" && isManager && (
        <Card className="p-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Employee:</span>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Pick an employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name ?? e.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

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
        <CalendarGrid month={month} rows={rows} />
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Daily log</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attendance records this month.</p>
        ) : (
          <div className="divide-y divide-border">
            {[...rows].reverse().map((r) => {
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
  // Monday-first: shift Sun=0 to 6
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
          const isWeekend = (i % 7) >= 5;
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
