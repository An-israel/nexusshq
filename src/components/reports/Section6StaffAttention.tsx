import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf } from "@/lib/nexus";
import type { StaffAttentionRow } from "@/lib/reports/use-report-data";
import type { DateRange } from "@/lib/reports/date-ranges";

interface Props {
  rows: StaffAttentionRow[];
  loading: boolean;
  dateRange: DateRange;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 45) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-green-500/10 border-green-500/20";
  if (score >= 45) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

function TrendIcon({ trend }: { trend: StaffAttentionRow["trend"] }) {
  if (trend === "improving") return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (trend === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MiniBar({ value, color }: { value: number; color: "green" | "amber" | "red" }) {
  const fill = color === "green" ? "#22c55e" : color === "amber" ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: fill }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value.toFixed(0)}%</span>
    </div>
  );
}

export function Section6StaffAttention({ rows, loading, dateRange }: Props) {
  if (loading) {
    return (
      <div>
        <Skeleton className="mb-2 h-7 w-48 bg-[#1f1f1f]" />
        <Skeleton className="mb-6 h-4 w-72 bg-[#1f1f1f]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl bg-[#1f1f1f]" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Staff Attention Needed</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Employees requiring manager attention for {dateRange.label}
        </p>
        <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-10 flex flex-col items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            No employees flagged for attention in this period
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Staff Attention Needed</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Employees with low scores, overdue tasks, or active flags for {dateRange.label}
      </p>
      <p className="text-xs text-amber-400/80 mb-6">
        {rows.length} employee{rows.length !== 1 ? "s" : ""} flagged for review
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const emp = row.employee;
          return (
            <Card key={emp.id} className={cn("p-4 border bg-[#0f0f0f]", scoreBg(row.score))}>
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                {emp.avatarUrl ? (
                  <img
                    src={emp.avatarUrl}
                    alt={emp.name}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                    style={{ backgroundColor: hashColor(emp.id) }}
                  >
                    {initialsOf(emp.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{emp.name}</p>
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {emp.department.replace(/_/g, " ")}
                  </p>
                </div>
                {/* Score badge */}
                <div className="flex flex-col items-center shrink-0">
                  <span className={cn("text-xl font-bold tabular-nums", scoreColor(row.score))}>
                    {row.score}
                  </span>
                  <span className="text-[10px] text-muted-foreground">score</span>
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Task completion</span>
                  <MiniBar
                    value={row.completionPct}
                    color={
                      row.completionPct >= 70 ? "green" : row.completionPct >= 40 ? "amber" : "red"
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attendance</span>
                  <MiniBar
                    value={row.attendancePct}
                    color={
                      row.attendancePct >= 80 ? "green" : row.attendancePct >= 60 ? "amber" : "red"
                    }
                  />
                </div>
              </div>

              {/* Flags and overdue */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                {row.activeFlags > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {row.activeFlags} flag{row.activeFlags !== 1 ? "s" : ""}
                  </span>
                )}
                {row.overdueTaskCount > 0 && (
                  <span className="text-xs text-amber-400">{row.overdueTaskCount} overdue</span>
                )}
                <span className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                  <TrendIcon trend={row.trend} />
                  {row.trend}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
