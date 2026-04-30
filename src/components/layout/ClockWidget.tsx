import * as React from "react";
import { Clock } from "lucide-react";

/**
 * Phase 1 stub of the clock-in/out widget.
 * Shows live time only; the full clock-in/out logic ships in Phase 4.
 */
export function ClockWidget() {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm tabular-nums">
      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground">{time}</span>
      <span className="text-xs text-muted-foreground">WAT</span>
    </div>
  );
}
