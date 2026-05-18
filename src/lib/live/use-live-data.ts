import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { deptLabel, todayISO } from '@/lib/nexus';
import type {
  LiveEmployee,
  AttendanceEvent,
  TaskActivityEvent,
  ActivityLogEntry,
  TaskCounters,
  DeptProductivity,
  TimelinePoint,
  PendingDeliverable,
  OverdueTaskRow,
} from './types';

export type { OverdueTaskRow };

interface RawProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  avatar_url: string | null;
}

interface RawPresence {
  user_id: string;
  status: 'active' | 'away' | 'dnd' | 'offline';
  last_seen_at: string | null;
  status_emoji: string | null;
  status_text: string | null;
}

interface RawAttendance {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  total_minutes: number | null;
  status: string;
}

interface RawTask {
  id: string;
  title: string;
  assigned_to: string | null;
  status: string;
  priority: string;
  progress_percent: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

interface RawTaskUpdate {
  id: string;
  task_id: string;
  updated_by: string | null;
  old_status: string | null;
  new_status: string | null;
  old_progress: number | null;
  new_progress: number | null;
  note: string | null;
  created_at: string;
}

interface RawDeliverable {
  id: string;
  task_id: string | null;
  user_id: string;
  file_name: string;
  file_size_bytes: number | null;
  status: string;
  created_at: string;
}

const STATUS_ORDER: Record<string, number> = { active: 0, away: 1, dnd: 2, offline: 3 };

function buildEmployees(
  profiles: RawProfile[],
  presenceMap: Map<string, RawPresence>,
  attendanceMap: Map<string, RawAttendance>,
): LiveEmployee[] {
  return profiles.map((p) => {
    const pres = presenceMap.get(p.id);
    const att = attendanceMap.get(p.id);
    const clockIn = att?.clock_in ?? null;
    const clockOut = att?.clock_out ?? null;
    const onlineDurationMs =
      clockIn && !clockOut ? Math.max(0, Date.now() - new Date(clockIn).getTime()) : 0;
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      department: p.department,
      job_title: p.job_title,
      avatar_url: p.avatar_url,
      status: pres?.status ?? 'offline',
      last_seen_at: pres?.last_seen_at ?? null,
      status_emoji: pres?.status_emoji ?? null,
      status_text: pres?.status_text ?? null,
      clock_in: clockIn,
      clock_out: clockOut,
      onlineDurationMs,
    };
  });
}

function buildTaskCounters(tasks: RawTask[], today: string): TaskCounters {
  const completedToday = tasks.filter(
    (t) => t.status === 'completed' && t.completed_at?.startsWith(today),
  ).length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const overdue = tasks.filter((t) => t.status === 'overdue').length;
  return { totalToday: tasks.length, completedToday, inProgress, overdue };
}

function buildDeptProductivity(
  tasks: RawTask[],
  profileMap: Map<string, RawProfile>,
): DeptProductivity[] {
  const deptMap = new Map<string, { completed: number; total: number }>();
  for (const task of tasks) {
    const profile = task.assigned_to ? profileMap.get(task.assigned_to) : null;
    const dept = profile?.department ?? 'other';
    const entry = deptMap.get(dept) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (task.status === 'completed') entry.completed += 1;
    deptMap.set(dept, entry);
  }
  return Array.from(deptMap.entries()).map(([department, { completed, total }]) => ({
    department,
    label: deptLabel(department),
    completed,
    total,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  }));
}

function buildTimeline(tasks: RawTask[], today: string): TimelinePoint[] {
  const completedTimes = tasks
    .filter((t) => t.status === 'completed' && t.completed_at?.startsWith(today))
    .map((t) => new Date(t.completed_at!).getHours())
    .sort((a, b) => a - b);

  const points: TimelinePoint[] = [];
  let cumulative = 0;
  for (let h = 6; h <= 22; h++) {
    cumulative += completedTimes.filter((hr) => hr === h).length;
    const suffix = h < 12 ? 'AM' : 'PM';
    const display = h === 12 ? 12 : h > 12 ? h - 12 : h;
    points.push({ hour: `${display}${suffix}`, cumulative });
  }
  return points;
}

function buildOverdueTasks(
  tasks: RawTask[],
  profileMap: Map<string, RawProfile>,
): OverdueTaskRow[] {
  return tasks
    .filter((t) => t.status === 'overdue' && t.assigned_to)
    .map((t) => {
      const profile = profileMap.get(t.assigned_to!);
      const dueDate = t.due_date ? new Date(t.due_date) : null;
      const daysOverdue = dueDate
        ? Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000))
        : 0;
      return {
        taskId: t.id,
        title: t.title,
        daysOverdue,
        priority: t.priority,
        kpiId: null,
        employee: {
          id: t.assigned_to!,
          name: profile?.full_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        },
      };
    });
}

function buildActivityLog(
  attendanceEvents: AttendanceEvent[],
  taskActivity: TaskActivityEvent[],
): ActivityLogEntry[] {
  const entries: ActivityLogEntry[] = [
    ...attendanceEvents.map((e): ActivityLogEntry => ({
      id: e.id,
      icon: e.action === 'clock_in' ? '🟢' : '🔴',
      description:
        e.action === 'clock_in'
          ? `${e.userName} clocked in${e.isLate ? ' (late)' : ''}`
          : `${e.userName} clocked out`,
      time: e.time,
      type: e.action,
    })),
    ...taskActivity.map((e): ActivityLogEntry => ({
      id: e.id,
      icon: e.action === 'completed' ? '✅' : e.action === 'started' ? '▶️' : '📝',
      description:
        e.action === 'completed'
          ? `${e.userName} completed "${e.taskTitle}"`
          : e.action === 'started'
          ? `${e.userName} started "${e.taskTitle}"`
          : `${e.userName} updated "${e.taskTitle}"`,
      time: e.time,
      type: e.action === 'completed' ? 'task_complete' : 'task_update',
    })),
  ];
  return entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function computeProductivityScore(
  counters: TaskCounters,
  employees: LiveEmployee[],
): number {
  const activeCount = employees.filter((e) => e.status === 'active').length;
  const totalCount = employees.length;
  if (totalCount === 0) return 0;

  const attendanceScore = (employees.filter((e) => e.clock_in !== null).length / totalCount) * 40;
  const completionScore =
    counters.totalToday > 0 ? (counters.completedToday / counters.totalToday) * 40 : 0;
  const presenceScore = (activeCount / totalCount) * 20;

  return Math.round(attendanceScore + completionScore + presenceScore);
}

export interface ActiveTaskRow {
  id: string;
  title: string;
  assignedTo: string;
  assigneeName: string;
  assigneeAvatarUrl: string | null;
  progress: number;
  priority: string;
  dueDate: string;
}

export function useLiveData(workspaceId: string | null): {
  employees: LiveEmployee[];
  attendanceEvents: AttendanceEvent[];
  taskActivity: TaskActivityEvent[];
  activityLog: ActivityLogEntry[];
  taskCounters: TaskCounters;
  deptProductivity: DeptProductivity[];
  timelinePoints: TimelinePoint[];
  overdueTasksWithEmployee: OverdueTaskRow[];
  pendingDeliverables: PendingDeliverable[];
  activeTasks: ActiveTaskRow[];
  productivityScore: number;
  isConnected: boolean;
  lastUpdated: Date;
  refetch: () => Promise<void>;
} {
  const [employees, setEmployees] = React.useState<LiveEmployee[]>([]);
  const [attendanceEvents, setAttendanceEvents] = React.useState<AttendanceEvent[]>([]);
  const [taskActivity, setTaskActivity] = React.useState<TaskActivityEvent[]>([]);
  const [taskCounters, setTaskCounters] = React.useState<TaskCounters>({
    totalToday: 0,
    completedToday: 0,
    inProgress: 0,
    overdue: 0,
  });
  const [deptProductivity, setDeptProductivity] = React.useState<DeptProductivity[]>([]);
  const [timelinePoints, setTimelinePoints] = React.useState<TimelinePoint[]>([]);
  const [overdueTasksWithEmployee, setOverdueTasksWithEmployee] = React.useState<OverdueTaskRow[]>([]);
  const [pendingDeliverables, setPendingDeliverables] = React.useState<PendingDeliverable[]>([]);
  const [activeTasks, setActiveTasks] = React.useState<ActiveTaskRow[]>([]);
  const [productivityScore, setProductivityScore] = React.useState(0);
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState(new Date());

  const profileMapRef = React.useRef<Map<string, RawProfile>>(new Map());
  const presenceMapRef = React.useRef<Map<string, RawPresence>>(new Map());
  const attendanceMapRef = React.useRef<Map<string, RawAttendance>>(new Map());
  const tasksRef = React.useRef<Map<string, RawTask>>(new Map());
  const batchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = React.useRef<(() => void)[]>([]);
  const mountedRef = React.useRef(true);
  const hiddenSinceRef = React.useRef<number | null>(null);
  const myUserIdRef = React.useRef<string | null>(null);

  const flushUpdates = React.useCallback(() => {
    if (!mountedRef.current) return;
    const updates = pendingUpdatesRef.current.splice(0);
    for (const fn of updates) fn();
    setLastUpdated(new Date());
  }, []);

  const scheduleBatch = React.useCallback(
    (fn: () => void) => {
      pendingUpdatesRef.current.push(fn);
      if (batchTimerRef.current) return;
      batchTimerRef.current = setTimeout(() => {
        batchTimerRef.current = null;
        flushUpdates();
      }, 500);
    },
    [flushUpdates],
  );

  const rebuildDerived = React.useCallback(() => {
    const today = todayISO();
    const profiles = Array.from(profileMapRef.current.values());
    const tasks = Array.from(tasksRef.current.values());

    const newEmployees = buildEmployees(
      profiles,
      presenceMapRef.current,
      attendanceMapRef.current,
    ).sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3),
    );
    const newCounters = buildTaskCounters(tasks, today);
    const newDept = buildDeptProductivity(tasks, profileMapRef.current);
    const newTimeline = buildTimeline(tasks, today);
    const newOverdue = buildOverdueTasks(tasks, profileMapRef.current);
    const newScore = computeProductivityScore(newCounters, newEmployees);

    setEmployees(newEmployees);
    setTaskCounters(newCounters);
    setDeptProductivity(newDept);
    setTimelinePoints(newTimeline);
    setOverdueTasksWithEmployee(newOverdue);
    setProductivityScore(newScore);
    const newActiveTasks: ActiveTaskRow[] = tasks
      .filter((t) => t.status === 'in_progress' && t.assigned_to)
      .map((t) => {
        const p = profileMapRef.current.get(t.assigned_to!);
        return {
          id: t.id,
          title: t.title,
          assignedTo: t.assigned_to!,
          assigneeName: p?.full_name ?? 'Unknown',
          assigneeAvatarUrl: p?.avatar_url ?? null,
          progress: t.progress_percent,
          priority: t.priority,
          dueDate: t.due_date ?? '',
        };
      });
    setActiveTasks(newActiveTasks);
  }, []);

  const fetchAll = React.useCallback(async () => {
    if (!workspaceId) return;

    const today = todayISO();

    const [membersResult, presenceResult, attendanceResult, tasksResult, updatesResult, deliverablesResult] =
      await Promise.all([
        supabase
          .from('workspace_members')
          .select('user_id, profiles!inner(id, full_name, email, department, job_title, avatar_url)')
          .eq('workspace_id', workspaceId),
        supabase
          .from('user_presence')
          .select('user_id, status, last_seen_at, status_emoji, status_text')
          .eq('workspace_id', workspaceId),
        supabase
          .from('attendance')
          .select('id, user_id, date, clock_in, clock_out, total_minutes, status')
          .eq('workspace_id', workspaceId)
          .eq('date', today),
        supabase
          .from('tasks')
          .select('id, title, assigned_to, status, priority, progress_percent, due_date, completed_at, created_at')
          .eq('workspace_id', workspaceId)
          .or(`created_at.gte.${today}T00:00:00,due_date.eq.${today},status.eq.in_progress`),
        supabase
          .from('task_updates')
          .select('id, task_id, updated_by, old_status, new_status, old_progress, new_progress, note, created_at')
          .eq('workspace_id' as never, workspaceId)
          .gte('created_at', `${today}T00:00:00`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('deliverables')
          .select('id, task_id, user_id, file_name, file_size_bytes, status, created_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'submitted'),
      ]);

    if (!mountedRef.current) return;

    profileMapRef.current.clear();
    if (membersResult.data) {
      for (const row of membersResult.data) {
        const profile = (row as unknown as { profiles: RawProfile }).profiles;
        if (profile) profileMapRef.current.set(profile.id, profile);
      }
    }

    presenceMapRef.current.clear();
    if (presenceResult.data) {
      for (const row of presenceResult.data) {
        presenceMapRef.current.set(row.user_id, row as RawPresence);
      }
    }

    attendanceMapRef.current.clear();
    if (attendanceResult.data) {
      for (const row of attendanceResult.data) {
        attendanceMapRef.current.set(row.user_id, row as RawAttendance);
      }
    }

    tasksRef.current.clear();
    if (tasksResult.data) {
      for (const row of tasksResult.data) {
        tasksRef.current.set(row.id, row as RawTask);
      }
    }

    const profileMap = profileMapRef.current;

    const newAttendanceEvents: AttendanceEvent[] = [];
    if (attendanceResult.data) {
      for (const row of attendanceResult.data as RawAttendance[]) {
        const profile = profileMap.get(row.user_id);
        if (row.clock_in) {
          const clockInDate = new Date(row.clock_in);
          const nineAM = new Date(clockInDate);
          nineAM.setHours(9, 0, 0, 0);
          newAttendanceEvents.push({
            id: `${row.id}-in`,
            userId: row.user_id,
            userName: profile?.full_name ?? row.user_id,
            avatarUrl: profile?.avatar_url ?? null,
            action: 'clock_in',
            time: row.clock_in,
            isLate: clockInDate > nineAM,
          });
        }
        if (row.clock_out) {
          newAttendanceEvents.push({
            id: `${row.id}-out`,
            userId: row.user_id,
            userName: profile?.full_name ?? row.user_id,
            avatarUrl: profile?.avatar_url ?? null,
            action: 'clock_out',
            time: row.clock_out,
            isLate: false,
          });
        }
      }
    }
    setAttendanceEvents(newAttendanceEvents);

    const newTaskActivity: TaskActivityEvent[] = [];
    if (updatesResult.data) {
      for (const row of updatesResult.data as RawTaskUpdate[]) {
        const profile = row.updated_by ? profileMap.get(row.updated_by) : null;
        const task = tasksRef.current.get(row.task_id);
        let action: 'started' | 'updated' | 'completed' = 'updated';
        if (row.new_status === 'in_progress' && row.old_status !== 'in_progress') action = 'started';
        else if (row.new_status === 'completed') action = 'completed';
        newTaskActivity.push({
          id: row.id,
          taskId: row.task_id,
          taskTitle: task?.title ?? row.task_id,
          userId: row.updated_by ?? '',
          userName: profile?.full_name ?? row.updated_by ?? 'Unknown',
          avatarUrl: profile?.avatar_url ?? null,
          action,
          progressBefore: row.old_progress ?? null,
          progressAfter: row.new_progress ?? null,
          time: row.created_at,
        });
      }
    }
    setTaskActivity(newTaskActivity.slice(0, 50));

    const newPendingDeliverables: PendingDeliverable[] = [];
    if (deliverablesResult.data) {
      for (const row of deliverablesResult.data as RawDeliverable[]) {
        const profile = profileMap.get(row.user_id);
        const task = row.task_id ? tasksRef.current.get(row.task_id) : null;
        newPendingDeliverables.push({
          id: row.id,
          fileName: row.file_name,
          taskId: row.task_id,
          taskTitle: task?.title ?? null,
          userId: row.user_id,
          userName: profile?.full_name ?? row.user_id,
          avatarUrl: profile?.avatar_url ?? null,
          createdAt: row.created_at,
        });
      }
    }
    setPendingDeliverables(newPendingDeliverables);

    rebuildDerived();
    setLastUpdated(new Date());
  }, [workspaceId, rebuildDerived]);

  React.useEffect(() => {
    if (!workspaceId) return;

    mountedRef.current = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) myUserIdRef.current = data.user.id;
    });

    void fetchAll();

    const today = todayISO();

    const channel = supabase
      .channel(`live-ops-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_presence', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          scheduleBatch(() => {
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { user_id?: string };
              if (old.user_id) presenceMapRef.current.delete(old.user_id);
            } else {
              const row = payload.new as RawPresence;
              presenceMapRef.current.set(row.user_id, row);
            }
            rebuildDerived();
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          scheduleBatch(() => {
            if (payload.eventType === 'DELETE') return;
            const row = payload.new as RawAttendance;
            if (row.date !== today) return;

            attendanceMapRef.current.set(row.user_id, row);
            rebuildDerived();

            const profile = profileMapRef.current.get(row.user_id);
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              setAttendanceEvents((prev) => {
                const filtered = prev.filter(
                  (e) => e.userId !== row.user_id,
                );
                const next = [...filtered];
                if (row.clock_in) {
                  const clockInDate = new Date(row.clock_in);
                  const nineAM = new Date(clockInDate);
                  nineAM.setHours(9, 0, 0, 0);
                  next.push({
                    id: `${row.id}-in`,
                    userId: row.user_id,
                    userName: profile?.full_name ?? row.user_id,
                    avatarUrl: profile?.avatar_url ?? null,
                    action: 'clock_in',
                    time: row.clock_in,
                    isLate: clockInDate > nineAM,
                  });
                }
                if (row.clock_out) {
                  next.push({
                    id: `${row.id}-out`,
                    userId: row.user_id,
                    userName: profile?.full_name ?? row.user_id,
                    avatarUrl: profile?.avatar_url ?? null,
                    action: 'clock_out',
                    time: row.clock_out,
                    isLate: false,
                  });
                }
                return next.filter(
                  (e) =>
                    e.time.startsWith(today),
                );
              });
            }
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_updates' },
        (payload) => {
          scheduleBatch(() => {
            const row = payload.new as RawTaskUpdate;
            if (!row.created_at.startsWith(today)) return;

            const profile = row.updated_by
              ? profileMapRef.current.get(row.updated_by)
              : null;
            const task = tasksRef.current.get(row.task_id);

            let action: 'started' | 'updated' | 'completed' = 'updated';
            if (row.new_status === 'in_progress' && row.old_status !== 'in_progress')
              action = 'started';
            else if (row.new_status === 'completed') action = 'completed';

            const entry: TaskActivityEvent = {
              id: row.id,
              taskId: row.task_id,
              taskTitle: task?.title ?? row.task_id,
              userId: row.updated_by ?? '',
              userName: profile?.full_name ?? row.updated_by ?? 'Unknown',
              avatarUrl: profile?.avatar_url ?? null,
              action,
              progressBefore: row.old_progress ?? null,
              progressAfter: row.new_progress ?? null,
              time: row.created_at,
            };

            setTaskActivity((prev) => [entry, ...prev].slice(0, 50));

            setActivityLog((prev) => {
              const logEntry: ActivityLogEntry = {
                id: row.id,
                icon: action === 'completed' ? '✅' : action === 'started' ? '▶️' : '📝',
                description:
                  action === 'completed'
                    ? `${entry.userName} completed "${entry.taskTitle}"`
                    : action === 'started'
                    ? `${entry.userName} started "${entry.taskTitle}"`
                    : `${entry.userName} updated "${entry.taskTitle}"`,
                time: row.created_at,
                type: action === 'completed' ? 'task_complete' : 'task_update',
              };
              return [logEntry, ...prev].slice(0, 100);
            });
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          scheduleBatch(() => {
            const row = payload.new as RawTask;
            tasksRef.current.set(row.id, row);
            rebuildDerived();
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deliverables', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          scheduleBatch(() => {
            const row = payload.new as RawDeliverable;
            if (row.status !== 'submitted') return;
            const profile = profileMapRef.current.get(row.user_id);
            const task = row.task_id ? tasksRef.current.get(row.task_id) : null;
            const entry: PendingDeliverable = {
              id: row.id,
              fileName: row.file_name,
              taskId: row.task_id,
              taskTitle: task?.title ?? null,
              userId: row.user_id,
              userName: profile?.full_name ?? row.user_id,
              avatarUrl: profile?.avatar_url ?? null,
              createdAt: row.created_at,
            };
            setPendingDeliverables((prev) => [entry, ...prev]);
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setIsConnected(true);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setIsConnected(false);
      });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenSinceRef.current = Date.now();
      } else {
        const hiddenDuration = hiddenSinceRef.current
          ? Date.now() - hiddenSinceRef.current
          : 0;
        hiddenSinceRef.current = null;
        if (hiddenDuration >= 30 * 60 * 1000 && myUserIdRef.current && workspaceId) {
          void supabase.from('user_presence').upsert(
            {
              user_id: myUserIdRef.current,
              workspace_id: workspaceId,
              status: 'away',
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,workspace_id' },
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const heartbeat = setInterval(async () => {
      if (document.hidden || !myUserIdRef.current || !workspaceId) return;
      await supabase.from('user_presence').upsert(
        {
          user_id: myUserIdRef.current,
          workspace_id: workspaceId,
          status: 'active',
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,workspace_id' },
      );
    }, 5 * 60 * 1000);

    return () => {
      mountedRef.current = false;
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchAll, scheduleBatch, rebuildDerived]);

  const [activityLog, setActivityLog] = React.useState<ActivityLogEntry[]>([]);

  React.useEffect(() => {
    setActivityLog(buildActivityLog(attendanceEvents, taskActivity).slice(0, 100));
  }, [attendanceEvents, taskActivity]);

  return {
    employees,
    attendanceEvents,
    taskActivity,
    activityLog,
    taskCounters,
    deptProductivity,
    timelinePoints,
    overdueTasksWithEmployee,
    pendingDeliverables,
    activeTasks,
    productivityScore,
    isConnected,
    lastUpdated,
    refetch: fetchAll,
  };
}
