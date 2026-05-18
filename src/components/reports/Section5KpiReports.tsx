import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { KpiRow } from "@/lib/reports/use-report-data";
import type { DateRange } from "@/lib/reports/date-ranges";

// ---- Props ----

interface Props {
  kpiRows: KpiRow[];
  loading: boolean;
  dateRange: DateRange;
}

// ---- Status badge ----

function KpiStatusBadge({ status }: { status: KpiRow["status"] }) {
  const map: Record<KpiRow["status"], { label: string; cls: string }> = {
    on_track: {
      label: "On Track",
      cls: "bg-green-500/15 text-green-400 border-green-500/30",
    },
    at_risk: {
      label: "At Risk",
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    behind: {
      label: "Behind",
      cls: "bg-red-500/15 text-red-400 border-red-500/30",
    },
    complete: {
      label: "Complete",
      cls: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
  };

  const { label, cls } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

// ---- Status sort order ----

const STATUS_ORDER: Record<KpiRow["status"], number> = {
  complete: 0,
  on_track: 1,
  at_risk: 2,
  behind: 3,
};

// ---- Bar color based on pctAchieved ----

function barColor(pct: number): string {
  if (pct >= 100) return "#3b82f6"; // blue
  if (pct >= 70) return "#22c55e"; // green
  if (pct >= 40) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

// ---- Progress bar cell ----

function PctProgressBar({ pct, status }: { pct: number; status: KpiRow["status"] }) {
  const fill =
    status === "complete" || status === "on_track"
      ? "#22c55e"
      : status === "at_risk"
        ? "#f59e0b"
        : "#ef4444";

  const capped = Math.min(pct, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${capped}%`, backgroundColor: fill }}
        />
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          status === "complete" || status === "on_track"
            ? "text-green-400"
            : status === "at_risk"
              ? "text-amber-400"
              : "text-red-400",
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ---- Custom tooltip for horizontal bar chart ----

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: KpiRow; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as KpiRow;
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs shadow-lg max-w-[200px]">
      <p className="mb-1 font-medium text-white truncate">{row.title}</p>
      <p className="text-muted-foreground">
        Department: <span className="text-white">{row.department.replace(/_/g, " ")}</span>
      </p>
      <p className="text-muted-foreground">
        % Achieved:{" "}
        <span className="font-semibold" style={{ color: barColor(row.pctAchieved) }}>
          {row.pctAchieved.toFixed(1)}%
        </span>
      </p>
    </div>
  );
}

// ---- Period toggle ----

type Period = "daily" | "weekly" | "monthly";

const PERIOD_LABELS: Record<Period, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

// ---- Main component ----

export function Section5KpiReports({ kpiRows, loading, dateRange }: Props) {
  const [activePeriod, setActivePeriod] = useState<Period>("weekly");

  // Filter by period then sort
  const filteredRows = useMemo(() => {
    return kpiRows
      .filter((r) => r.period === activePeriod)
      .slice()
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [kpiRows, activePeriod]);

  // Chart data (limit to 10 for readability)
  const chartData = useMemo(() => filteredRows.slice(0, 10), [filteredRows]);

  // Loading skeleton
  if (loading) {
    return (
      <div>
        <Skeleton className="mb-2 h-7 w-48 bg-[#1f1f1f]" />
        <Skeleton className="mb-6 h-4 w-72 bg-[#1f1f1f]" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#1f1f1f]" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64 rounded-xl bg-[#1f1f1f]" />
        <Skeleton className="mt-4 h-48 rounded-xl bg-[#1f1f1f]" />
      </div>
    );
  }

  // Summary stat cards
  const total = filteredRows.length;
  const completeCount = filteredRows.filter((r) => r.status === "complete").length;
  const onTrackCount = filteredRows.filter((r) => r.status === "on_track").length;
  const atRiskCount = filteredRows.filter((r) => r.status === "at_risk").length;
  const behindCount = filteredRows.filter((r) => r.status === "behind").length;

  return (
    <div>
      {/* Section header */}
      <h2 className="text-xl font-bold text-white mb-1">KPI Reports</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Key performance indicator tracking for {dateRange.label}
      </p>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Total KPIs</p>
          <p className="text-3xl font-bold text-white">{total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">this period</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Complete</p>
          <p className="text-3xl font-bold text-blue-400">{completeCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">fully achieved</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">On Track</p>
          <p className="text-3xl font-bold text-green-400">{onTrackCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">progressing well</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">At Risk / Behind</p>
          <p className="text-3xl font-bold text-red-400">{atRiskCount + behindCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">needs attention</p>
        </Card>
      </div>

      {/* Period toggle + table */}
      <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm font-semibold text-white">KPI Overview</p>
          {/* Period toggle */}
          <div className="flex gap-1 rounded-lg bg-[#1a1a1a] p-0.5">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  activePeriod === p
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Target className="h-10 w-10 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No KPIs configured for this workspace</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  {[
                    "KPI",
                    "Department",
                    "Target",
                    "Completed Tasks",
                    "% Achieved",
                    "Period",
                    "Status",
                  ].map((col) => (
                    <th
                      key={col}
                      className="pb-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap pr-4 last:pr-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4 font-medium text-white max-w-[180px] truncate">
                      {row.title}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground capitalize">
                      {row.department.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                      {row.targetValue} {row.unit}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-white">
                      {row.completedTasks}{" "}
                      <span className="text-muted-foreground">/ {row.totalTasks}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <PctProgressBar pct={row.pctAchieved} status={row.status} />
                    </td>
                    <td className="py-3 pr-4 capitalize text-muted-foreground">{row.period}</td>
                    <td className="py-3">
                      <KpiStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Achievement bar chart */}
      <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
        <p className="text-sm font-semibold text-white mb-3">KPI Achievement — % of Target Met</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No KPI data for this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 42)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="title"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={140}
                tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar
                dataKey="pctAchieved"
                name="% Achieved"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
                label={{
                  position: "right",
                  formatter: (v: number) => `${v.toFixed(0)}%`,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              >
                {chartData.map((row, i) => (
                  <Cell key={`cell-${i}`} fill={barColor(row.pctAchieved)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
