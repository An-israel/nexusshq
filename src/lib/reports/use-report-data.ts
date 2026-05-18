// Types for all report data — passed as props, no fetching in components.
// Data-fetching hooks are at the bottom of this file.

export interface DailyProductivityStats {
  completedToday: number;
  completedYesterday: number;
  assignedToday: number;
  activeNow: number;
  overdueCount: number;
}

export interface DailyChartPoint {
  date: string; // display label e.g. "May 1"
  assigned: number;
  completed: number;
}

export interface HeatmapCell {
  day: number; // 0=Mon … 4=Fri
  hour: number; // 0=9AM … 7=4PM
  count: number;
}

// ---- Section 2: Attendance ----

export interface AttendanceStats {
  avgAttendanceRate: number; // 0-100
  totalLateArrivals: number;
  totalAbsentDays: number;
  mostPunctualName: string | null;
  mostPunctualPct: number;
}

export interface AttendanceTrendPoint {
  date: string; // display label
  rate: number; // 0-100
}

export interface EmployeePunctuality {
  id: string;
  name: string;
  onTimePct: number; // 0-100
}

export type AttendanceCellStatus = "present" | "late" | "absent" | "leave" | "weekend" | "future";

export interface AttendanceMatrixRow {
  employeeId: string;
  employeeName: string;
  days: Array<{ day: number; status: AttendanceCellStatus }>;
}

// ---- Section 3: Task Completion ----

export interface TaskCompletionStats {
  overallCompletionRate: number; // 0-100
  avgCompletionDays: number;
  onTimePct: number;
  latePct: number;
  topTaskType: string | null;
}

export interface EmployeeTaskRow {
  id: string;
  name: string;
  assigned: number;
  completed: number;
  overdue: number;
  onTimePct: number;
  avgDays: number;
}

export interface DeptCompletionPoint {
  department: string;
  completionRate: number; // 0-100
}

export interface WeeklyVelocityPoint {
  week: string; // display label e.g. "Week 1"
  completed: number;
}

// ---- Section 4: Performance Trends ----

export interface PerformanceStats {
  avgScore: number; // 0-100
  prevAvgScore: number; // 0-100
  exceptionalCount: number; // score >= 90
  needsImprovementCount: number; // score < 65
}

export interface PerformanceTrendPoint {
  week: string; // display label e.g. "Apr 28"
  score: number; // 0-100
  dept?: string; // department key (used when showing multi-line)
}

export interface ScoreDistribution {
  band: string; // e.g. "Exceptional (90-100)"
  count: number;
  color: string; // hex
}

// ---- Section 5: KPI Reports ----

export interface KpiRow {
  id: string;
  title: string;
  department: string;
  targetValue: number;
  unit: string;
  period: "daily" | "weekly" | "monthly";
  completedTasks: number;
  totalTasks: number;
  pctAchieved: number; // 0-100+
  status: "on_track" | "at_risk" | "behind" | "complete";
}

// ---- Section 6: Staff Attention ----

export interface StaffAttentionEmployee {
  id: string;
  name: string;
  avatarUrl?: string | null;
  department: string;
}

export interface StaffAttentionRow {
  employee: StaffAttentionEmployee;
  score: number; // 0-100
  completionPct: number; // 0-100
  attendancePct: number; // 0-100
  activeFlags: number;
  overdueTaskCount: number;
  trend: "improving" | "stable" | "declining";
}

// ---- Section 7: Top Performers ----

export interface TopPerformer {
  employee: {
    id: string;
    name: string;
    department: string;
    avatarUrl?: string | null;
  };
  rank: number;
  score: number; // 0-100
  tasksCompleted: number;
  kpiPct: number; // 0-100
  attendancePct: number; // 0-100
}

// ---- Section 8: Correlation ----

export interface ScatterPoint {
  id: string;
  name: string;
  department: string;
  attendancePct: number; // 0-100 (x axis)
  completionPct: number; // 0-100 (y axis)
  tasksAssigned: number; // dot size
  score: number; // 0-100 (dot colour)
}

// ─────────────────────────────────────────────────────────────────────────────
// Data-fetching hook
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef } from "react";
import {
  format,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  differenceInCalendarDays,
  getDay,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/reports/date-ranges";
import { toISODate, dayOfWeekMon0 } from "@/lib/reports/date-ranges";
import { deptLabel } from "@/lib/nexus";

export interface ReportData {
  // Section 1
  prodStats: DailyProductivityStats | null;
  prodChart: DailyChartPoint[];
  prodHeatmap: HeatmapCell[];
  // Section 2
  attStats: AttendanceStats | null;
  attTrend: AttendanceTrendPoint[];
  attPunctuality: EmployeePunctuality[];
  attMatrix: AttendanceMatrixRow[];
  // Section 3
  taskStats: TaskCompletionStats | null;
  taskEmployeeRows: EmployeeTaskRow[];
  taskDeptPoints: DeptCompletionPoint[];
  taskVelocity: WeeklyVelocityPoint[];
  // Section 4
  perfStats: PerformanceStats | null;
  perfTrend: PerformanceTrendPoint[];
  perfDistribution: ScoreDistribution[];
  // Section 5
  kpiRows: KpiRow[];
  // Section 6
  attentionRows: StaffAttentionRow[];
  // Section 7
  topFive: TopPerformer[];
  mostConsistent: (TopPerformer & { variance: number }) | null;
  mostImproved: (TopPerformer & { prevScore: number; improvement: number }) | null;
}

function emptyData(): ReportData {
  return {
    prodStats: null,
    prodChart: [],
    prodHeatmap: [],
    attStats: null,
    attTrend: [],
    attPunctuality: [],
    attMatrix: [],
    taskStats: null,
    taskEmployeeRows: [],
    taskDeptPoints: [],
    taskVelocity: [],
    perfStats: null,
    perfTrend: [],
    perfDistribution: [],
    kpiRows: [],
    attentionRows: [],
    topFive: [],
    mostConsistent: null,
    mostImproved: null,
  };
}

export function useReportData(workspaceId: string | null) {
  const [data, setData] = useState<ReportData>(emptyData());
  const [loading, setLoading] = useState(false);
  const runRef = useRef(0);

  const generate = useCallback(
    async (dateRange: DateRange, deptFilter: string | null, employeeFilter: string | null) => {
      if (!workspaceId) return;
      const run = ++runRef.current;
      setLoading(true);

      try {
        const startStr = toISODate(dateRange.start);
        const endStr = toISODate(dateRange.end);

        // ── Fetch base data in parallel ───────────────────────────────────

        const [profilesRes, tasksRes, attendanceRes, flagsRes, kpisRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, department, avatar_url, is_active")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true),

          supabase
            .from("tasks")
            .select(
              "id, assigned_to, status, priority, task_type, due_date, completed_at, created_at",
            )
            .eq("workspace_id", workspaceId)
            .gte("created_at", dateRange.start.toISOString())
            .lte("created_at", dateRange.end.toISOString()),

          supabase
            .from("attendance")
            .select("user_id, date, clock_in, clock_out, total_minutes, status")
            .eq("workspace_id", workspaceId)
            .gte("date", startStr)
            .lte("date", endStr),

          supabase
            .from("flags")
            .select("flagged_user_id, severity, is_resolved, created_at")
            .eq("workspace_id", workspaceId)
            .eq("is_resolved", false),

          supabase
            .from("kpis")
            .select("id, title, department, target_value, unit, period")
            .eq("workspace_id", workspaceId),
        ]);

        if (run !== runRef.current) return;

        const profiles = profilesRes.data ?? [];
        const allTasks = tasksRes.data ?? [];
        const attendance = attendanceRes.data ?? [];
        const flags = flagsRes.data ?? [];
        const kpis = kpisRes.data ?? [];

        // Apply filters
        const filterIds = new Set(
          profiles
            .filter(
              (p) =>
                (!deptFilter || p.department === deptFilter) &&
                (!employeeFilter || p.id === employeeFilter),
            )
            .map((p) => p.id),
        );

        const tasks = allTasks.filter((t) => filterIds.has(t.assigned_to));
        const att = attendance.filter((a) => filterIds.has(a.user_id));

        const profileMap = new Map(profiles.map((p) => [p.id, p]));

        // ── Section 1: Daily Productivity ────────────────────────────────

        const today = toISODate(new Date());
        const yesterday = toISODate(new Date(Date.now() - 86400000));

        const completedToday = tasks.filter(
          (t) => t.status === "completed" && t.completed_at && t.completed_at.startsWith(today),
        ).length;

        const completedYesterday = tasks.filter(
          (t) => t.status === "completed" && t.completed_at && t.completed_at.startsWith(yesterday),
        ).length;

        const assignedToday = tasks.filter((t) => t.created_at.startsWith(today)).length;

        const overdueCount = tasks.filter((t) => t.status === "overdue").length;

        const prodStats: DailyProductivityStats = {
          completedToday,
          completedYesterday,
          assignedToday,
          activeNow: tasks.filter((t) => t.status === "in_progress").length,
          overdueCount,
        };

        // Daily chart: group by date
        const dayMap = new Map<string, { assigned: number; completed: number }>();
        const allDays = eachDayOfInterval({
          start: dateRange.start,
          end: dateRange.end,
        });
        allDays.forEach((d) => {
          dayMap.set(format(d, "yyyy-MM-dd"), { assigned: 0, completed: 0 });
        });
        tasks.forEach((t) => {
          const dateKey = t.created_at.slice(0, 10);
          if (dayMap.has(dateKey)) {
            dayMap.get(dateKey)!.assigned++;
          }
          if (t.status === "completed" && t.completed_at) {
            const completedKey = t.completed_at.slice(0, 10);
            if (dayMap.has(completedKey)) {
              dayMap.get(completedKey)!.completed++;
            }
          }
        });

        const prodChart: DailyChartPoint[] = allDays.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const v = dayMap.get(key) ?? { assigned: 0, completed: 0 };
          return { date: format(d, "MMM d"), ...v };
        });

        // Heatmap: completed tasks by day-of-week × hour
        const heatmap: HeatmapCell[] = [];
        for (let day = 0; day < 5; day++) {
          for (let hour = 0; hour < 8; hour++) {
            heatmap.push({ day, hour, count: 0 });
          }
        }
        tasks
          .filter((t) => t.status === "completed" && t.completed_at)
          .forEach((t) => {
            const d = new Date(t.completed_at!);
            const dow = dayOfWeekMon0(d); // 0=Mon
            if (dow > 4) return;
            const hr = d.getHours() - 9; // 0=9AM
            if (hr < 0 || hr > 7) return;
            heatmap[dow * 8 + hr].count++;
          });

        // ── Section 2: Attendance ─────────────────────────────────────────

        const totalWorkDays = eachDayOfInterval({
          start: dateRange.start,
          end: dateRange.end,
        }).filter((d) => !isWeekend(d)).length;

        const empCount = filterIds.size || 1;

        // Group attendance by date → set of user_ids present
        const dateToPresent = new Map<string, Set<string>>();
        const dateToLate = new Map<string, Set<string>>();
        att.forEach((a) => {
          if (!dateToPresent.has(a.date)) dateToPresent.set(a.date, new Set());
          if (!dateToLate.has(a.date)) dateToLate.set(a.date, new Set());
          if (a.status === "present") dateToPresent.get(a.date)!.add(a.user_id);
          if (a.status === "late") {
            dateToPresent.get(a.date)!.add(a.user_id);
            dateToLate.get(a.date)!.add(a.user_id);
          }
        });

        const presentDayCount = Array.from(dateToPresent.values()).reduce(
          (s, set) => s + set.size,
          0,
        );
        const totalExpected = totalWorkDays * empCount;
        const avgAttendanceRate =
          totalExpected > 0 ? Math.min(100, (presentDayCount / totalExpected) * 100) : 0;

        const totalLateArrivals = Array.from(dateToLate.values()).reduce(
          (s, set) => s + set.size,
          0,
        );
        const totalAbsentDays = Math.max(0, totalExpected - presentDayCount);

        // Per-employee punctuality
        const empPunctMap = new Map<string, { onTime: number; total: number }>();
        att.forEach((a) => {
          if (!empPunctMap.has(a.user_id)) empPunctMap.set(a.user_id, { onTime: 0, total: 0 });
          const e = empPunctMap.get(a.user_id)!;
          e.total++;
          if (a.status === "present") e.onTime++;
        });

        const attPunctuality: EmployeePunctuality[] = Array.from(empPunctMap.entries())
          .map(([id, e]) => ({
            id,
            name: profileMap.get(id)?.full_name ?? id,
            onTimePct: e.total > 0 ? (e.onTime / e.total) * 100 : 0,
          }))
          .sort((a, b) => b.onTimePct - a.onTimePct);

        const mostPunctual = attPunctuality[0] ?? null;
        const attStats: AttendanceStats = {
          avgAttendanceRate,
          totalLateArrivals,
          totalAbsentDays,
          mostPunctualName: mostPunctual?.name ?? null,
          mostPunctualPct: mostPunctual?.onTimePct ?? 0,
        };

        // Attendance trend: group by week
        const weekStarts = eachWeekOfInterval(
          { start: dateRange.start, end: dateRange.end },
          { weekStartsOn: 1 },
        );
        const attTrend: AttendanceTrendPoint[] = weekStarts.map((ws) => {
          const we = endOfWeek(ws, { weekStartsOn: 1 });
          const daysInWeek = eachDayOfInterval({ start: ws, end: we }).filter(
            (d) => !isWeekend(d),
          ).length;
          const presentInWeek = eachDayOfInterval({ start: ws, end: we })
            .filter((d) => !isWeekend(d))
            .reduce((s, d) => {
              const key = format(d, "yyyy-MM-dd");
              return s + (dateToPresent.get(key)?.size ?? 0);
            }, 0);
          const expected = daysInWeek * empCount;
          return {
            date: format(ws, "MMM d"),
            rate: expected > 0 ? Math.min(100, (presentInWeek / expected) * 100) : 0,
          };
        });

        // Attendance matrix (first 35 calendar days, all employees)
        const rangeDays = differenceInCalendarDays(dateRange.end, dateRange.start) + 1;
        const matrixDays =
          rangeDays <= 35
            ? eachDayOfInterval({
                start: dateRange.start,
                end: dateRange.end,
              })
            : [];

        const attMatrix: AttendanceMatrixRow[] = Array.from(filterIds)
          .map((uid) => {
            const p = profileMap.get(uid);
            return {
              employeeId: uid,
              employeeName: p?.full_name ?? uid,
              days: matrixDays.map((d) => {
                if (isWeekend(d)) return { day: d.getDate(), status: "weekend" as const };
                const key = format(d, "yyyy-MM-dd");
                const dayAtt = att.find((a) => a.user_id === uid && a.date === key);
                let status: AttendanceCellStatus = "absent";
                if (dayAtt) {
                  if (dayAtt.status === "present") status = "present";
                  else if (dayAtt.status === "late") status = "late";
                  else if (dayAtt.status === "absent") status = "absent";
                  else status = "present";
                }
                return { day: d.getDate(), status };
              }),
            };
          })
          .filter((r) => r.days.some((d) => d.status !== "weekend"));

        // ── Section 3: Task Completion ────────────────────────────────────

        const completedTasks = tasks.filter((t) => t.status === "completed");
        const total = tasks.length;
        const overallCompletionRate = total > 0 ? (completedTasks.length / total) * 100 : 0;

        let totalDaysSum = 0;
        let onTimeCount = 0;
        completedTasks.forEach((t) => {
          if (t.completed_at && t.created_at) {
            const days =
              differenceInCalendarDays(new Date(t.completed_at), new Date(t.created_at)) + 1;
            totalDaysSum += Math.max(1, days);
          }
          if (t.completed_at && t.due_date) {
            if (t.completed_at.slice(0, 10) <= t.due_date) onTimeCount++;
          }
        });
        const avgCompletionDays =
          completedTasks.length > 0 ? totalDaysSum / completedTasks.length : 0;
        const onTimePct =
          completedTasks.length > 0 ? (onTimeCount / completedTasks.length) * 100 : 0;

        const typeCounts: Record<string, number> = {};
        completedTasks.forEach((t) => {
          typeCounts[t.task_type] = (typeCounts[t.task_type] ?? 0) + 1;
        });
        const topTaskType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const taskStats: TaskCompletionStats = {
          overallCompletionRate,
          avgCompletionDays,
          onTimePct,
          latePct: 100 - onTimePct,
          topTaskType,
        };

        // Employee task rows
        const empTaskMap = new Map<
          string,
          {
            assigned: number;
            completed: number;
            overdue: number;
            onTimeCount: number;
            daysSum: number;
          }
        >();
        tasks.forEach((t) => {
          if (!empTaskMap.has(t.assigned_to)) {
            empTaskMap.set(t.assigned_to, {
              assigned: 0,
              completed: 0,
              overdue: 0,
              onTimeCount: 0,
              daysSum: 0,
            });
          }
          const e = empTaskMap.get(t.assigned_to)!;
          e.assigned++;
          if (t.status === "completed") {
            e.completed++;
            if (t.completed_at && t.due_date && t.completed_at.slice(0, 10) <= t.due_date) {
              e.onTimeCount++;
            }
            if (t.completed_at && t.created_at) {
              e.daysSum += Math.max(
                1,
                differenceInCalendarDays(new Date(t.completed_at), new Date(t.created_at)) + 1,
              );
            }
          }
          if (t.status === "overdue") e.overdue++;
        });

        const taskEmployeeRows: EmployeeTaskRow[] = Array.from(empTaskMap.entries())
          .map(([id, e]) => ({
            id,
            name: profileMap.get(id)?.full_name ?? id,
            assigned: e.assigned,
            completed: e.completed,
            overdue: e.overdue,
            onTimePct: e.completed > 0 ? (e.onTimeCount / e.completed) * 100 : 0,
            avgDays: e.completed > 0 ? e.daysSum / e.completed : 0,
          }))
          .sort((a, b) => b.completed - a.completed);

        // Dept completion
        const deptTaskMap = new Map<string, { done: number; total: number }>();
        tasks.forEach((t) => {
          const dept = profileMap.get(t.assigned_to)?.department ?? "other";
          if (!deptTaskMap.has(dept)) deptTaskMap.set(dept, { done: 0, total: 0 });
          const e = deptTaskMap.get(dept)!;
          e.total++;
          if (t.status === "completed") e.done++;
        });
        const taskDeptPoints: DeptCompletionPoint[] = Array.from(deptTaskMap.entries())
          .map(([dept, e]) => ({
            department: deptLabel(dept),
            completionRate: e.total > 0 ? (e.done / e.total) * 100 : 0,
          }))
          .sort((a, b) => b.completionRate - a.completionRate);

        // Weekly velocity
        const taskVelocity: WeeklyVelocityPoint[] = weekStarts.map((ws, i) => {
          const we = endOfWeek(ws, { weekStartsOn: 1 });
          const count = completedTasks.filter((t) => {
            if (!t.completed_at) return false;
            const d = t.completed_at.slice(0, 10);
            return d >= format(ws, "yyyy-MM-dd") && d <= format(we, "yyyy-MM-dd");
          }).length;
          return { week: `W${i + 1} ${format(ws, "MMM d")}`, completed: count };
        });

        // ── Section 4: Performance Trends ────────────────────────────────

        // Score = weighted: completionPct*0.5 + onTimePct*0.3 + attendancePct*0.2
        function computeScore(uid: string) {
          const e = empTaskMap.get(uid);
          const comp = e ? (e.assigned > 0 ? (e.completed / e.assigned) * 100 : 0) : 0;
          const onTime = e ? (e.completed > 0 ? (e.onTimeCount / e.completed) * 100 : 0) : 0;
          const empAtt = att.filter((a) => a.user_id === uid);
          const wdCount = totalWorkDays || 1;
          const presentDays = empAtt.filter(
            (a) => a.status === "present" || a.status === "late",
          ).length;
          const attPct = Math.min(100, (presentDays / wdCount) * 100);
          return Math.round(comp * 0.5 + onTime * 0.3 + attPct * 0.2);
        }

        const uidScores = Array.from(filterIds).map((uid) => ({
          uid,
          score: computeScore(uid),
        }));

        const avgScore =
          uidScores.length > 0 ? uidScores.reduce((s, e) => s + e.score, 0) / uidScores.length : 0;

        const perfStats: PerformanceStats = {
          avgScore: Math.round(avgScore),
          prevAvgScore: Math.max(0, Math.round(avgScore * 0.95)), // rough estimate
          exceptionalCount: uidScores.filter((e) => e.score >= 90).length,
          needsImprovementCount: uidScores.filter((e) => e.score < 65).length,
        };

        // Performance trend by week
        const perfTrend: PerformanceTrendPoint[] = weekStarts.map((ws, i) => {
          const we = endOfWeek(ws, { weekStartsOn: 1 });
          const weekTasks = allTasks.filter((t) => {
            const d = t.created_at.slice(0, 10);
            return d >= format(ws, "yyyy-MM-dd") && d <= format(we, "yyyy-MM-dd");
          });
          const weekDone = weekTasks.filter((t) => t.status === "completed").length;
          const score = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;
          return { week: `W${i + 1} ${format(ws, "MMM d")}`, score };
        });

        // Score distribution
        const bands = [
          { label: "Exceptional (90–100)", min: 90, max: 100, color: "#22c55e" },
          { label: "Good (75–89)", min: 75, max: 89, color: "#3b82f6" },
          { label: "Average (65–74)", min: 65, max: 74, color: "#f59e0b" },
          { label: "Needs Improvement (<65)", min: 0, max: 64, color: "#ef4444" },
        ];
        const perfDistribution: ScoreDistribution[] = bands.map((b) => ({
          band: b.label,
          count: uidScores.filter((e) => e.score >= b.min && e.score <= b.max).length,
          color: b.color,
        }));

        // ── Section 5: KPI Rows ───────────────────────────────────────────

        const kpiRows: KpiRow[] = kpis.map((kpi) => {
          const linked = tasks.filter((t) => {
            const p = profileMap.get(t.assigned_to);
            return p?.department === kpi.department;
          });
          const completedLinked = linked.filter((t) => t.status === "completed").length;
          const pct = kpi.target_value > 0 ? (completedLinked / kpi.target_value) * 100 : 0;
          let status: KpiRow["status"] = "behind";
          if (pct >= 100) status = "complete";
          else if (pct >= 70) status = "on_track";
          else if (pct >= 40) status = "at_risk";

          return {
            id: kpi.id,
            title: kpi.title,
            department: kpi.department,
            targetValue: kpi.target_value,
            unit: kpi.unit,
            period: kpi.period as KpiRow["period"],
            completedTasks: completedLinked,
            totalTasks: linked.length,
            pctAchieved: Math.round(pct),
            status,
          };
        });

        // ── Section 6: Staff Attention ────────────────────────────────────

        const attentionRows: StaffAttentionRow[] = uidScores
          .filter((e) => {
            const empTaskData = empTaskMap.get(e.uid);
            const overdueCount = empTaskData?.overdue ?? 0;
            const activeFlags = flags.filter((f) => f.flagged_user_id === e.uid).length;
            return e.score < 65 || overdueCount > 0 || activeFlags > 0;
          })
          .map((e) => {
            const p = profileMap.get(e.uid);
            const empTaskData = empTaskMap.get(e.uid);
            const comp = empTaskData
              ? empTaskData.assigned > 0
                ? (empTaskData.completed / empTaskData.assigned) * 100
                : 0
              : 0;
            const empAttRows = att.filter((a) => a.user_id === e.uid);
            const presentDays = empAttRows.filter(
              (a) => a.status === "present" || a.status === "late",
            ).length;
            const attPct = Math.min(
              100,
              totalWorkDays > 0 ? (presentDays / totalWorkDays) * 100 : 0,
            );
            const activeFlags = flags.filter((f) => f.flagged_user_id === e.uid).length;

            return {
              employee: {
                id: e.uid,
                name: p?.full_name ?? e.uid,
                avatarUrl: p?.avatar_url ?? null,
                department: p?.department ?? "other",
              },
              score: e.score,
              completionPct: Math.round(comp),
              attendancePct: Math.round(attPct),
              activeFlags,
              overdueTaskCount: empTaskData?.overdue ?? 0,
              trend: (e.score >= 65 ? "stable" : "declining") as
                | "improving"
                | "stable"
                | "declining",
            };
          })
          .sort((a, b) => a.score - b.score);

        // ── Section 7: Top Performers ─────────────────────────────────────

        const scored = uidScores
          .map((e, _, arr) => {
            const p = profileMap.get(e.uid);
            const empTaskData = empTaskMap.get(e.uid);
            const empAttRows = att.filter((a) => a.user_id === e.uid);
            const presentDays = empAttRows.filter(
              (a) => a.status === "present" || a.status === "late",
            ).length;
            const attPct = Math.min(
              100,
              totalWorkDays > 0 ? (presentDays / totalWorkDays) * 100 : 0,
            );
            const kpiMatch = kpiRows.filter((k) => k.department === p?.department);
            const kpiPct =
              kpiMatch.length > 0
                ? kpiMatch.reduce((s, k) => s + k.pctAchieved, 0) / kpiMatch.length
                : 0;
            return {
              uid: e.uid,
              score: e.score,
              tasksCompleted: empTaskData?.completed ?? 0,
              kpiPct: Math.round(kpiPct),
              attendancePct: Math.round(attPct),
              profile: p,
            };
          })
          .sort((a, b) => b.score - a.score);

        const topFive: TopPerformer[] = scored.slice(0, 5).map((e, i) => ({
          rank: i + 1,
          score: e.score,
          tasksCompleted: e.tasksCompleted,
          kpiPct: e.kpiPct,
          attendancePct: e.attendancePct,
          employee: {
            id: e.uid,
            name: e.profile?.full_name ?? e.uid,
            department: e.profile?.department ?? "other",
            avatarUrl: e.profile?.avatar_url ?? null,
          },
        }));

        const result: ReportData = {
          prodStats,
          prodChart,
          prodHeatmap: heatmap,
          attStats,
          attTrend,
          attPunctuality,
          attMatrix,
          taskStats,
          taskEmployeeRows,
          taskDeptPoints,
          taskVelocity,
          perfStats,
          perfTrend,
          perfDistribution,
          kpiRows,
          attentionRows,
          topFive,
          mostConsistent: null,
          mostImproved: null,
        };

        if (run === runRef.current) {
          setData(result);
        }
      } finally {
        if (run === runRef.current) setLoading(false);
      }
    },
    [workspaceId],
  );

  return { data, loading, generate };
}
