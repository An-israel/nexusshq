import { useState } from "react";
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
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  TaskCompletionStats,
  EmployeeTaskRow,
  DeptCompletionPoint,
  WeeklyVelocityPoint,
} from "@/lib/reports/use-report-data";
import type { DateRange } from "@/lib/reports/date-ranges";

interface Props {
  stats: TaskCompletionStats | null;
  employeeRows: EmployeeTaskRow[];
  deptPoints: DeptCompletionPoint[];
  velocityPoints: WeeklyVelocityPoint[];
  loading: boolean;
  dateRange: DateRange;
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function rateColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

type SortKey = "name" | "completed" | "overdue" | "onTimePct" | "avgDays";

export function Section3TaskCompletion({
  stats,
  employeeRows,
  deptPoints,
  velocityPoints,
  loading,
  dateRange,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("completed");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortedRows = [...employeeRows].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    if (sortKey === "name") return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortKey] as number) - (b[sortKey] as number));
  });

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

  const SortHeader = ({
    col,
    children,
  }: {
    col: SortKey;
    children: React.ReactNode;
  }) => (
    <th
      className="pb-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap pr-4 cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(col)}
    >
      {children}
      {sortKey === col && (
        <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
      )}
    </th>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">Task Completion</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Completion metrics and velocity for {dateRange.label}
      </p>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Overall Completion Rate</p>
          <p
            className="text-3xl font-bold"
            style={{ color: rateColor(stats?.overallCompletionRate ?? 0) }}
          >
            {stats ? `${stats.overallCompletionRate.toFixed(0)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">of assigned tasks</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Avg Completion Time</p>
          <p className="text-3xl font-bold text-white">
            {stats ? `${stats.avgCompletionDays.toFixed(1)}d` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">per task</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">On Time %</p>
          <p className="text-3xl font-bold text-green-400">
            {stats ? `${stats.onTimePct.toFixed(0)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">completed before due</p>
        </Card>

        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Top Task Type</p>
          <p className="text-2xl font-bold text-white capitalize">
            {stats?.topTaskType?.replace(/_/g, " ") ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">most completed</p>
        </Card>
      </div>

      {/* Weekly velocity trend */}
      {velocityPoints.length > 0 && (
        <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
          <p className="text-sm font-semibold text-white mb-3">Weekly Completion Velocity</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={velocityPoints}
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip content={<DarkTooltip />} />
              <Line
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Department completion rates */}
      {deptPoints.length > 0 && (
        <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
          <p className="text-sm font-semibold text-white mb-3">Completion Rate by Department</p>
          <ResponsiveContainer width="100%" height={Math.max(160, deptPoints.length * 42)}>
            <BarChart
              data={deptPoints}
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
                dataKey="department"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={120}
                tickFormatter={(v: string) =>
                  v.length > 16 ? v.slice(0, 15) + "…" : v
                }
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(0)}%`, "Completion"]}
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#9ca3af" }}
              />
              <Bar
                dataKey="completionRate"
                name="Completion %"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
                label={{
                  position: "right",
                  formatter: (v: number) => `${v.toFixed(0)}%`,
                  fill: "#6b7280",
                  fontSize: 11,
                }}
              >
                {deptPoints.map((pt, i) => (
                  <Cell key={i} fill={rateColor(pt.completionRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Employee breakdown table */}
      <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
        <p className="text-sm font-semibold text-white mb-3">Employee Breakdown</p>
        {sortedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No task data for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  <SortHeader col="name">Employee</SortHeader>
                  <SortHeader col="completed">Completed</SortHeader>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground pr-4 whitespace-nowrap">
                    Assigned
                  </th>
                  <SortHeader col="overdue">Overdue</SortHeader>
                  <SortHeader col="onTimePct">On Time %</SortHeader>
                  <SortHeader col="avgDays">Avg Days</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-white max-w-[160px] truncate">
                      {row.name}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-green-400 font-semibold">
                      {row.completed}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-muted-foreground">
                      {row.assigned}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      <span
                        className={cn(
                          "font-semibold",
                          row.overdue > 0 ? "text-red-400" : "text-muted-foreground",
                        )}
                      >
                        {row.overdue}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(row.onTimePct, 100)}%`,
                              backgroundColor: rateColor(row.onTimePct),
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-medium tabular-nums"
                          style={{ color: rateColor(row.onTimePct) }}
                        >
                          {row.onTimePct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 tabular-nums text-muted-foreground">
                      {row.avgDays > 0 ? `${row.avgDays.toFixed(1)}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
