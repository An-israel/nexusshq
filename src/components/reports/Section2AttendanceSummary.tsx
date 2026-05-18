import { useState } from "react";
import type { JSX } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays } from "date-fns";
import type {
  AttendanceStats,
  AttendanceTrendPoint,
  EmployeePunctuality,
  AttendanceMatrixRow,
  AttendanceCellStatus,
} from "@/lib/reports/use-report-data";
import type { DateRange } from "@/lib/reports/date-ranges";

// ---- Props ----

interface Props {
  stats: AttendanceStats | null;
  trend: AttendanceTrendPoint[];
  punctuality: EmployeePunctuality[];
  matrix: AttendanceMatrixRow[];
  loading: boolean;
  dateRange: DateRange;
}

// ---- Helpers ----

function punctualityBarColor(pct: number): string {
  if (pct > 90) return "bg-green-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function cellDot(status: AttendanceCellStatus): JSX.Element {
  switch (status) {
    case "present":
      return <span style={{ color: "#22c55e" }} title="Present">•</span>;
    case "late":
      return <span style={{ color: "#f59e0b" }} title="Late">•</span>;
    case "absent":
      return <span style={{ color: "#ef4444" }} title="Absent">•</span>;
    case "leave":
      return <span style={{ color: "#14b8a6" }} title="Leave">•</span>;
    case "weekend":
      return <span style={{ color: "#374151" }} title="Weekend">·</span>;
    case "future":
      return <span />;
  }
}

// ---- Custom dark tooltip ----

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
    <div className="bg-[#1A1A1A] text-white text-xs rounded-lg p-2 shadow-lg border border-[#2a2a2a]">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---- Stat card ----

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      {children}
    </div>
  );
}

// ---- Main component ----

export function Section2AttendanceSummary({
  stats,
  trend,
  punctuality,
  matrix,
  loading,
  dateRange,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  // Determine if the date range is ≤ 35 days (show matrix)
  const rangeDays = differenceInCalendarDays(dateRange.end, dateRange.start) + 1;
  const showMatrix = rangeDays <= 35;

  // Top 10 (or all) employees for punctuality
  const sorted = [...punctuality].sort((a, b) => b.onTimePct - a.onTimePct);
  const displayed = showAll ? sorted : sorted.slice(0, 10);

  // Derive unique day numbers for matrix header
  const matrixDayNums: number[] = matrix.length > 0
    ? matrix[0].days.map((d) => d.day)
    : [];

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4 mt-8">Attendance Summary</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Average attendance rate */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-36 mb-1" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Average Attendance Rate</p>
              <p className="text-2xl font-bold text-foreground">
                {stats ? stats.avgAttendanceRate.toFixed(1) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">% this period</p>
            </>
          )}
        </StatCard>

        {/* Total late arrivals */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-7 w-12" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Total Late Arrivals</p>
              <p className="text-2xl font-bold text-amber-400">
                {stats?.totalLateArrivals ?? 0}
              </p>
            </>
          )}
        </StatCard>

        {/* Total absent days */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-7 w-12" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Total Absent Days</p>
              <p className="text-2xl font-bold text-red-400">
                {stats?.totalAbsentDays ?? 0}
              </p>
            </>
          )}
        </StatCard>

        {/* Most punctual employee */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-20 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Most Punctual Employee</p>
              <p className="text-base font-bold text-foreground leading-tight">
                {stats?.mostPunctualName ?? "—"}
              </p>
              {stats?.mostPunctualName && (
                <p className="text-xs text-green-400">
                  {stats.mostPunctualPct.toFixed(0)}% on time
                </p>
              )}
            </>
          )}
        </StatCard>
      </div>

      {/* Attendance Trend Chart */}
      <div className="bg-[#111] rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-white mb-4">Attendance Rate Trend</p>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : trend.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No trend data available for this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#fff", fontSize: 11 }}
                axisLine={{ stroke: "#333" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#fff", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine
                y={80}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{
                  value: "80% target",
                  fill: "#ef4444",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                name="Attendance %"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Punctuality Breakdown */}
      <div className="bg-[#111] rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-white mb-4">Punctuality Breakdown</p>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full rounded-md" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No punctuality data available.
          </p>
        ) : (
          <div className="space-y-2.5">
            {displayed.map((emp) => (
              <div key={emp.id} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 shrink-0 truncate" title={emp.name}>
                  {emp.name}
                </span>
                <div className="flex-1 bg-[#1a1a1a] rounded-full h-2 min-w-0">
                  <div
                    className={`h-2 rounded-full transition-all ${punctualityBarColor(emp.onTimePct)}`}
                    style={{ width: `${Math.min(emp.onTimePct, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                  {emp.onTimePct.toFixed(0)}% on time
                </span>
              </div>
            ))}
            {sorted.length > 10 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1"
              >
                {showAll ? "Show less" : `Show all ${sorted.length} employees`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Attendance Matrix */}
      <div className="bg-[#111] rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-4">Monthly Attendance Matrix</p>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : !showMatrix ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Select a month or shorter range to see the matrix.
          </p>
        ) : matrix.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No attendance data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs min-w-max">
              <thead>
                <tr>
                  {/* Name column header */}
                  <th className="sticky left-0 bg-[#111] text-left text-muted-foreground font-medium pr-3 pb-1.5 z-10 min-w-[120px]">
                    Employee
                  </th>
                  {matrixDayNums.map((day) => (
                    <th
                      key={day}
                      className="w-8 text-center text-muted-foreground font-normal pb-1.5"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.employeeId}>
                    <td className="sticky left-0 bg-[#111] text-muted-foreground pr-3 py-0.5 z-10 truncate max-w-[120px]" title={row.employeeName}>
                      {row.employeeName}
                    </td>
                    {row.days.map((cell, ci) => (
                      <td key={ci} className="w-8 text-center py-0.5 text-base leading-none">
                        {cellDot(cell.status)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span style={{ color: "#22c55e" }} className="text-sm">•</span> Present
              </span>
              <span className="flex items-center gap-1">
                <span style={{ color: "#f59e0b" }} className="text-sm">•</span> Late
              </span>
              <span className="flex items-center gap-1">
                <span style={{ color: "#ef4444" }} className="text-sm">•</span> Absent
              </span>
              <span className="flex items-center gap-1">
                <span style={{ color: "#14b8a6" }} className="text-sm">•</span> Leave
              </span>
              <span className="flex items-center gap-1">
                <span style={{ color: "#374151" }} className="text-sm">·</span> Weekend
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
