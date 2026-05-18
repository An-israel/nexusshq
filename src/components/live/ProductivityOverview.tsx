import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DeptProductivity, TimelinePoint, TaskCounters } from "@/lib/live/types";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  score: number;
  counters: TaskCounters;
  deptProductivity: DeptProductivity[];
  timelinePoints: TimelinePoint[];
  loading: boolean;
}

function scoreColor(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function DeptRow({ dept, animated }: { dept: DeptProductivity; animated: boolean }) {
  const [width, setWidth] = useState(0);
  const color = scoreColor(dept.pct);

  useEffect(() => {
    if (!animated) return;
    const timer = setTimeout(() => setWidth(dept.pct), 100);
    return () => clearTimeout(timer);
  }, [animated, dept.pct]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[#aaa] text-sm w-28 flex-shrink-0 truncate">{dept.label}</span>
      <div className="flex-1 h-2 bg-[#1f1f1f] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-white text-sm font-medium w-10 text-right flex-shrink-0">
        {dept.pct}%
      </span>
      <span className="text-[#555] text-xs w-16 text-right flex-shrink-0">
        {dept.completed}/{dept.total}
      </span>
    </div>
  );
}

export function ProductivityOverview({
  score,
  counters,
  deptProductivity,
  timelinePoints,
  loading,
}: Props) {
  const [animated, setAnimated] = useState(false);
  const color = scoreColor(score);

  useEffect(() => {
    setAnimated(false);
    const timer = setTimeout(() => setAnimated(true), 50);
    return () => clearTimeout(timer);
  }, [deptProductivity]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 bg-[#1a1a1a] rounded-xl" />
          <Skeleton className="lg:col-span-2 h-64 bg-[#1a1a1a] rounded-xl" />
        </div>
        <Skeleton className="h-48 bg-[#1a1a1a] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Parts A + B side by side */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Part A — Team Productivity Score */}
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5 flex flex-col items-center justify-center gap-4">
          <div className="relative" style={{ width: 200, height: 200 }}>
            <RadialBarChart
              width={200}
              height={200}
              cx={100}
              cy={100}
              innerRadius={70}
              outerRadius={95}
              data={[{ value: score, fill: color }]}
              startAngle={90}
              endAngle={90 - (score / 100) * 360}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: "#1a1a1a" }}
              />
            </RadialBarChart>
            {/* Center text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-white leading-none">{score}%</span>
              <span className="text-[#888] text-xs mt-1 text-center leading-tight px-4">
                Team Productivity Today
              </span>
            </div>
          </div>
          <p className="text-[#555] text-xs text-center">
            Based on {counters.completedToday}/{counters.totalToday} tasks
          </p>
        </div>

        {/* Part B — Department Breakdown */}
        <div className="lg:col-span-2 bg-[#111] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold text-sm">Department Breakdown</h3>
          {deptProductivity.length === 0 ? (
            <p className="text-[#555] text-sm text-center py-6">No task data available</p>
          ) : (
            <div className="space-y-3">
              {deptProductivity.map((dept) => (
                <DeptRow key={dept.department} dept={dept} animated={animated} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Part C — Timeline Chart */}
      <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5 space-y-4">
        <h3 className="text-white font-semibold text-sm">Tasks Completed Today — Timeline</h3>
        {timelinePoints.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-8">
            Timeline builds as tasks are completed
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timelinePoints} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#555", fontSize: 11 }}
                axisLine={{ stroke: "#1f1f1f" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#555", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2f2f2f",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#aaa" }}
                cursor={{ stroke: "#444" }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#timelineGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#6366f1" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
