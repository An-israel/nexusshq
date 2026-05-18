import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  PerformanceStats,
  PerformanceTrendPoint,
  ScoreDistribution,
} from "@/lib/reports/use-report-data";

// ---- Department colour palette ----
const DEPT_COLORS: Record<string, string> = {
  management: "#8b5cf6",
  customer_success: "#3b82f6",
  growth: "#22c55e",
  marketing: "#f59e0b",
  design: "#ec4899",
  video_editing: "#14b8a6",
  operations: "#f97316",
  other: "#6b7280",
};

const DEFAULT_LINE_COLOR = "#8b5cf6";

// ---- Props ----
interface Props {
  stats: PerformanceStats | null;
  trend: PerformanceTrendPoint[];
  distribution: ScoreDistribution[];
  departmentFilter: string | null;
  loading: boolean;
}

// ---- Custom tooltip for the trend chart ----
function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-white">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---- Main component ----
export function Section4PerformanceTrends({
  stats,
  trend,
  distribution,
  departmentFilter,
  loading,
}: Props) {
  // Derive department keys that have data
  const depts = Array.from(new Set(trend.map((p) => p.dept).filter(Boolean) as string[]));

  // When a department filter is active, flatten the data so each week has a single `score`.
  // When no filter, group by week into { week, [dept]: score } objects for multi-line chart.
  const trendData = (() => {
    if (departmentFilter) {
      return trend.filter((p) => !p.dept || p.dept === departmentFilter);
    }
    if (depts.length === 0) {
      // Plain array — no dept dimension
      return trend;
    }
    // Group into one object per week
    const map: Record<string, Record<string, number>> = {};
    for (const p of trend) {
      if (!map[p.week]) map[p.week] = {};
      if (p.dept) {
        map[p.week][p.dept] = p.score;
      } else {
        map[p.week]["score"] = p.score;
      }
    }
    return Object.entries(map).map(([week, vals]) => ({ week, ...vals }));
  })();

  // Lines to render
  const lines: Array<{ key: string; color: string; label: string }> =
    departmentFilter || depts.length === 0
      ? [
          {
            key: "score",
            color: departmentFilter
              ? (DEPT_COLORS[departmentFilter] ?? DEFAULT_LINE_COLOR)
              : DEFAULT_LINE_COLOR,
            label: departmentFilter ?? "Score",
          },
        ]
      : depts.map((d) => ({
          key: d,
          color: DEPT_COLORS[d] ?? DEFAULT_LINE_COLOR,
          label: d.replace(/_/g, " "),
        }));

  // Stat delta
  const delta = stats ? stats.avgScore - stats.prevAvgScore : 0;
  const deltaLabel = delta >= 0 ? `+${delta.toFixed(1)} pts ↑` : `${delta.toFixed(1)} pts ↓`;
  const deltaColor = delta >= 0 ? "text-green-400" : "text-red-400";

  // Loading skeleton
  if (loading) {
    return (
      <div>
        <Skeleton className="mb-2 h-7 w-56 bg-[#1f1f1f]" />
        <Skeleton className="mb-6 h-4 w-80 bg-[#1f1f1f]" />
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

  return (
    <div>
      {/* Section header */}
      <h2 className="text-xl font-bold text-white mb-1">Performance Trends</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Team performance scores over time
        {departmentFilter ? ` — ${departmentFilter.replace(/_/g, " ")}` : ""}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Average score */}
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Average Team Score</p>
          <p className="text-3xl font-bold text-white">{stats ? stats.avgScore.toFixed(1) : "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">out of 100</p>
        </Card>

        {/* vs previous period */}
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">vs Previous Period</p>
          <p className={cn("text-2xl font-bold", stats ? deltaColor : "text-muted-foreground")}>
            {stats ? deltaLabel : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            prev {stats ? stats.prevAvgScore.toFixed(1) : "—"}
          </p>
        </Card>

        {/* Exceptional */}
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Rated Exceptional</p>
          <p className="text-3xl font-bold text-green-400">{stats?.exceptionalCount ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">score ≥ 90</p>
        </Card>

        {/* Needs improvement */}
        <Card className="p-4 bg-[#111] border-[#1f1f1f]">
          <p className="text-xs text-muted-foreground mb-1">Needs Improvement</p>
          <p className="text-3xl font-bold text-red-400">{stats?.needsImprovementCount ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">score &lt; 65</p>
        </Card>
      </div>

      {/* Performance trend chart */}
      <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
        <p className="text-sm font-semibold text-white mb-3">Performance Trend</p>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No trend data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis
                dataKey="week"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine
                y={75}
                stroke="#3b3b3b"
                strokeDasharray="4 4"
                label={{
                  value: "Baseline 75",
                  position: "insideTopRight",
                  fill: "#6b7280",
                  fontSize: 10,
                }}
              />
              {lines.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={l.label}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: l.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Score distribution chart */}
      <div className="bg-[#111] rounded-xl border border-[#1f1f1f] p-4 mt-4">
        <p className="text-sm font-semibold text-white mb-3">Score Distribution This Period</p>
        {distribution.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No distribution data available.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis
                dataKey="band"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#aaa" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={72}>
                <LabelList
                  dataKey="count"
                  position="top"
                  style={{ fill: "#9ca3af", fontSize: 11 }}
                />
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
