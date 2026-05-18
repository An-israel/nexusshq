export interface LiveEmployee {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  avatar_url: string | null;
  status: 'active' | 'away' | 'dnd' | 'offline';
  last_seen_at: string | null;
  status_emoji: string | null;
  status_text: string | null;
  clock_in: string | null;
  clock_out: string | null;
  onlineDurationMs: number;
}

export interface AttendanceEvent {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  action: 'clock_in' | 'clock_out';
  time: string;
  isLate: boolean;
}

export interface TaskActivityEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  action: 'started' | 'updated' | 'completed';
  progressBefore: number | null;
  progressAfter: number | null;
  time: string;
}

export interface ActivityLogEntry {
  id: string;
  icon: string;
  description: string;
  time: string;
  type: 'clock_in' | 'clock_out' | 'task_update' | 'task_complete' | 'deliverable' | 'flag' | 'other';
}

export interface TaskCounters {
  totalToday: number;
  completedToday: number;
  inProgress: number;
  overdue: number;
}

export interface DeptProductivity {
  department: string;
  label: string;
  completed: number;
  total: number;
  pct: number;
}

export interface TimelinePoint {
  hour: string;
  cumulative: number;
}

export interface OverdueTaskRow {
  taskId: string;
  title: string;
  daysOverdue: number;
  priority: string;
  kpiId: string | null;
  employee: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface PendingDeliverable {
  id: string;
  fileName: string;
  taskId: string | null;
  taskTitle: string | null;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  createdAt: string;
}
