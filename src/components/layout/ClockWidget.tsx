import * as React from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { todayISO } from "@/lib/nexus";

interface AttendanceRow {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "present" | "late" | "absent" | "half_day";
  total_minutes: number | null;
  overtime_minutes: number | null;
}

// Late if clocked in after 9:05 local time
const LATE_AFTER_HOUR = 9;
const LATE_AFTER_MINUTE = 5;
// Anything worked past 17:00 (5pm) local counts as overtime
const OVERTIME_HOUR = 17;

function overtimeMinutesBetween(start: Date, end: Date): number {
  const cutoff = new Date(start);
  cutoff.setHours(OVERTIME_HOUR, 0, 0, 0);
  if (end <= cutoff) return 0;
  const from = start > cutoff ? start : cutoff;
  return Math.max(0, Math.round((end.getTime() - from.getTime()) / 60000));
}

export function ClockWidget() {
  const { user } = useAuth();
  const [now, setNow] = React.useState(() => new Date());
  const [today, setToday] = React.useState<AttendanceRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayISO())
      .maybeSingle();
    setToday((data as AttendanceRow) ?? null);
  }, [user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const clockedIn = !!today?.clock_in && !today?.clock_out;
  const completedSession = !!today?.clock_in && !!today?.clock_out;

  async function clockIn() {
    if (!user) return;
    setBusy(true);
    const nowD = new Date();
    const isLate =
      nowD.getHours() > LATE_AFTER_HOUR ||
      (nowD.getHours() === LATE_AFTER_HOUR && nowD.getMinutes() > LATE_AFTER_MINUTE);
    // If a row exists from an earlier session today, start a new session by
    // clearing clock_out and setting a fresh clock_in. Accumulated total/overtime
    // minutes are preserved on the row.
    const status: AttendanceRow["status"] = today?.status === "late" || isLate ? "late" : "present";
    const { error } = await supabase.from("attendance").upsert(
      {
        user_id: user.id,
        date: todayISO(),
        clock_in: nowD.toISOString(),
        clock_out: null,
        status,
      },
      { onConflict: "user_id,date" },
    );
    if (error) toast.error(error.message);
    else toast.success(isLate && !today ? "Clocked in (late)" : "Clocked in");
    await load();
    setBusy(false);
  }

  async function clockOut() {
    if (!user || !today?.clock_in) return;
    setBusy(true);
    const startD = new Date(today.clock_in);
    const nowD = new Date();
    const sessionMins = Math.max(0, Math.round((nowD.getTime() - startD.getTime()) / 60000));
    const sessionOvertime = overtimeMinutesBetween(startD, nowD);
    const newTotal = (today.total_minutes ?? 0) + sessionMins;
    const newOvertime = (today.overtime_minutes ?? 0) + sessionOvertime;
    const { error } = await supabase
      .from("attendance")
      .update({
        clock_out: nowD.toISOString(),
        total_minutes: newTotal,
        overtime_minutes: newOvertime,
      })
      .eq("id", today.id);
    if (error) toast.error(error.message);
    else {
      const h = Math.floor(sessionMins / 60);
      const m = sessionMins % 60;
      const otNote =
        sessionOvertime > 0
          ? ` · ${Math.floor(sessionOvertime / 60)}h ${sessionOvertime % 60}m overtime`
          : "";
      toast.success(`Clocked out — ${h}h ${m}m${otNote}`);
    }
    await load();
    setBusy(false);
  }

  let elapsed = "";
  if (clockedIn && today?.clock_in) {
    const ms = now.getTime() - new Date(today.clock_in).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    elapsed = `${h}h ${m}m`;
  }

  const showClockInButton = !clockedIn; // allow re-clock-in after a clock-out (overtime)

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm tabular-nums">
        {clockedIn ? (
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-foreground">{time}</span>
        <span className="text-xs text-muted-foreground">WAT</span>
        {clockedIn && elapsed && (
          <span className="text-xs text-success border-l border-border pl-2">{elapsed}</span>
        )}
      </div>
      {showClockInButton && (
        <Button size="sm" onClick={clockIn} disabled={busy}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          {completedSession ? "Clock In Again" : "Clock In"}
        </Button>
      )}
      {clockedIn && (
        <Button size="sm" variant="outline" onClick={clockOut} disabled={busy}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Clock Out
        </Button>
      )}
      {completedSession && !clockedIn && (today.overtime_minutes ?? 0) > 0 && (
        <span className="text-xs text-muted-foreground">
          OT: {Math.floor((today.overtime_minutes ?? 0) / 60)}h {(today.overtime_minutes ?? 0) % 60}
          m
        </span>
      )}
    </div>
  );
}
