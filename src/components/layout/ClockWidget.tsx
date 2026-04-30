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
}

// 9:00 local — anything later is "late"
const LATE_AFTER_HOUR = 9;

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
  const done = !!today?.clock_in && !!today?.clock_out;

  async function clockIn() {
    if (!user) return;
    setBusy(true);
    const nowD = new Date();
    const status: AttendanceRow["status"] = nowD.getHours() >= LATE_AFTER_HOUR ? "late" : "present";
    const { error } = await supabase.from("attendance").upsert(
      {
        user_id: user.id,
        date: todayISO(),
        clock_in: nowD.toISOString(),
        status,
      },
      { onConflict: "user_id,date" },
    );
    if (error) toast.error(error.message);
    else toast.success(status === "late" ? "Clocked in (late)" : "Clocked in");
    await load();
    setBusy(false);
  }

  async function clockOut() {
    if (!user || !today?.clock_in) return;
    setBusy(true);
    const nowD = new Date();
    const minutes = Math.round((nowD.getTime() - new Date(today.clock_in).getTime()) / 60000);
    const { error } = await supabase
      .from("attendance")
      .update({ clock_out: nowD.toISOString(), total_minutes: minutes })
      .eq("id", today.id);
    if (error) toast.error(error.message);
    else toast.success(`Clocked out — ${Math.floor(minutes / 60)}h ${minutes % 60}m`);
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
      {!done && !clockedIn && (
        <Button size="sm" onClick={clockIn} disabled={busy}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" /> Clock In
        </Button>
      )}
      {clockedIn && (
        <Button size="sm" variant="outline" onClick={clockOut} disabled={busy}>
          <LogOut className="mr-1.5 h-3.5 w-3.5" /> Clock Out
        </Button>
      )}
      {done && <span className="text-xs text-muted-foreground">Done for the day</span>}
    </div>
  );
}
