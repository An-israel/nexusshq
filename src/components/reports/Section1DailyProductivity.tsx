import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DailyProductivityStats,
  DailyChartPoint,
  HeatmapCell,
} from "@/lib/reports/use-report-data";

// ---- Types ----

interface Props {
  stats: DailyProductivityStats | null;
  chartData: DailyChartPoint[];
  heatmap: HeatmapCell[];
  loading: boolean;
}

// ---- Helpers ----

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = ["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM"];

function heatColor(count: number): string {
  if (count === 0) return "bg-[#1a1a1a]";
  if (count <= 2) return "bg-blue-950";
  if (count <= 5) return "bg-blue-800";
  if (count <= 10) return "bg-blue-600";
  return "bg-blue-400";
}

// ---- Custom dark tooltip for recharts ----

function DarkTooltip({ active, payload, label }: {
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
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">{children}</div>
  );
}

// ---- Main component ----

export function Section1DailyProductivity({ stats, chartData, heatmap, loading }: Props) {
  // Build a lookup: day x hour -> count
  const heatLookup = new Map<string, number>();
  for (const cell of heatmap) {
    heatLookup.set(`${cell.day}-${cell.hour}`, cell.count);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4 mt-8">Daily Productivity</h2>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Tasks completed */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Tasks Completed Today</p>
              <p className="text-2xl font-bold text-foreground">{stats?.completedToday ?? 0}</p>
              {stats && (
                <p
                  className={
                    stats.completedToday >= stats.completedYesterday
                      ? "text-xs text-green-400"
                      : "text-xs text-red-400"
                  }
                >
                  {stats.completedToday >= stats.completedYesterday ? "↑" : "↓"}{" "}
                  {Math.abs(stats.completedToday - stats.completedYesterday)} {stats.completedToday >= stats.completedYesterday ? "more" : "fewer"} than yesterday
                </p>
              )}
            </>
          )}
        </StatCard>

        {/* Tasks assigned */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-7 w-16" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Tasks Assigned Today</p>
              <p className="text-2xl font-bold text-foreground">{stats?.assignedToday ?? 0}</p>
            </>
          )}
        </StatCard>

        {/* Active now */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-32 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Active Right Now</p>
              <p className="text-2xl font-bold text-foreground">{stats?.activeNow ?? 0}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                {stats?.activeNow ?? 0} employees working
              </p>
            </>
          )}
        </StatCard>

        {/* Overdue */}
        <StatCard>
          {loading ? (
            <>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-28 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Overdue Tasks</p>
              <p className="text-2xl font-bold text-red-400">{stats?.overdueCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </>
          )}
        </StatCard>
      </div>

      {/* Bar chart */}
      <div className="bg-[#111] rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold text-white mb-4">Daily Output — Assigned vs Completed</p>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="date" tick={{ fill: "#fff", fontSize: 11 }} />
              <YAxis tick={{ fill: "#fff", fontSize: 11 }} />
              <Tooltip content={<DarkTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#fff" }}
              />
              <Bar dataKey="assigned" name="Assigned" fill="#374151" radius={[2, 2, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Heatmap */}
      <div className="bg-[#111] rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-4">When your team is most productive</p>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-[420px]">
              {/* Column headers */}
              <div className="flex ml-10 mb-1">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="w-9 text-center text-[10px] text-muted-foreground shrink-0"
                  >
                    {h}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center mb-1">
                  <span className="w-10 text-[10px] text-muted-foreground shrink-0">{day}</span>
                  {HOURS.map((_, hi) => {
                    const count = heatLookup.get(`${di}-${hi}`) ?? 0;
                    return (
                      <div
                        key={hi}
                        title={`${day} ${HOURS[hi]}: ${count} tasks`}
                        className={`w-9 h-7 shrink-0 rounded-sm mx-0.5 cursor-default transition-opacity hover:opacity-80 ${heatColor(count)}`}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className="text-[10px] text-muted-foreground">Less</span>
                {["bg-[#1a1a1a]", "bg-blue-950", "bg-blue-800", "bg-blue-600", "bg-blue-400"].map(
                  (cls, i) => (
                    <div key={i} className={`w-5 h-3 rounded-sm ${cls}`} />
                  ),
                )}
                <span className="text-[10px] text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
