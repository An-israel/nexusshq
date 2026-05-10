import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useRealtime } from "@/lib/use-realtime";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  PRIORITY_BADGE,
  STATUS_BADGE,
  PRIORITY_RANK,
  todayISO,
  startOfWeekISO,
  endOfWeekISO,
} from "@/lib/nexus";
import {
  MoreVertical,
  X,
  CheckSquare,
  AlertTriangle,
  Calendar,
  Plus,
  Check,
  Flag,
} from "lucide-react";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/$workspaceSlug/tasks")({
  component: TasksPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string | null;
  task_type: "daily" | "one_time" | "weekly" | "monthly";
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "completed" | "overdue";
  progress_percent: number;
  due_date: string;
  has_warning: boolean;
  warning_message: string | null;
  completed_at: string | null;
  created_at: string;
  kpi_id: string | null;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

interface KpiRow {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  target_value: number | null;
  unit: string | null;
  period: "weekly" | "monthly";
}

type FilterTab = "all" | "daily" | "weekly" | "overdue" | "completed";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDateLabel(
  dateStr: string,
  status: string
): { text: string; className: string } {
  if (status === "completed")
    return { text: "Completed", className: "text-green-400" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)
    return {
      text: `OVERDUE — ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} ago`,
      className: "text-red-400 font-medium",
    };
  if (diff === 0)
    return { text: "Due today", className: "text-amber-400 font-medium" };
  return {
    text: `Due in ${diff} day${diff === 1 ? "" : "s"}`,
    className: "text-muted-foreground",
  };
}

// ─── Summary Ring ─────────────────────────────────────────────────────────────

function ProgressRing({
  percent,
  size = 56,
}: {
  percent: number;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeWidth={6}
        fill="none"
        className="text-muted/30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="currentColor"
        strokeWidth={6}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-all duration-500"
      />
    </svg>
  );
}

// ─── useIsMobile ──────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function TasksPage() {
  const { user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const { workspaceSlug } = Route.useParams();
  const isMobile = useIsMobile();

  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>(
    {}
  );
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<FilterTab>("all");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(
    null
  );

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("due_date", { ascending: true });
    if (!isManager) q = q.eq("assigned_to", user.id);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as TaskRow[];
    setTasks(rows);

    const ids = Array.from(new Set(rows.map((t) => t.assigned_to)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = p as ProfileMini;
      });
      setProfiles(map);
    }
    setLoading(false);
  }, [user, isManager, workspace.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "tasks",
    filter: isManager
      ? undefined
      : user
        ? `assigned_to=eq.${user.id}`
        : undefined,
    enabled: !!user,
    onChange: () => void load(),
  });

  const today = todayISO();
  const weekStart = startOfWeekISO();
  const weekEnd = endOfWeekISO();

  // Weekly stats for summary bar
  const weekTasks = React.useMemo(
    () =>
      tasks.filter((t) => t.due_date >= weekStart && t.due_date <= weekEnd),
    [tasks, weekStart, weekEnd]
  );
  const weekTotal = weekTasks.length;
  const weekCompleted = weekTasks.filter(
    (t) => t.status === "completed"
  ).length;
  const weekInProgress = weekTasks.filter(
    (t) => t.status === "in_progress"
  ).length;
  const weekOverdue = weekTasks.filter(
    (t) =>
      t.status === "overdue" ||
      (t.status !== "completed" && t.due_date < today)
  ).length;
  const ringPercent = Math.round(
    (weekCompleted / Math.max(weekTotal, 1)) * 100
  );

  // Filtered task list
  const filtered = React.useMemo(() => {
    let list = [...tasks];
    if (filter === "daily") list = list.filter((t) => t.task_type === "daily");
    else if (filter === "weekly")
      list = list.filter((t) => t.task_type === "weekly");
    else if (filter === "overdue")
      list = list.filter(
        (t) =>
          t.status === "overdue" ||
          (t.status !== "completed" && t.due_date < today)
      );
    else if (filter === "completed")
      list = list.filter((t) => t.status === "completed");

    list.sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 9;
      const pb = PRIORITY_RANK[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.due_date.localeCompare(b.due_date);
    });
    return list;
  }, [tasks, filter, today]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column: list ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-6 pb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-bold">
              {isManager ? "All Tasks" : "My Tasks"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isManager
                ? "Assign, track, and warn across the team."
                : "Stay on top of what's due."}
            </p>
          </div>
          {isManager && (
            <Button asChild size="sm">
              <Link
                to="/$workspaceSlug/tasks/assign"
                params={{ workspaceSlug }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Assign Task
              </Link>
            </Button>
          )}
        </div>

        {/* Summary bar */}
        <div className="px-4 md:px-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            {/* Ring */}
            <div className="relative shrink-0 flex items-center justify-center">
              <ProgressRing percent={ringPercent} size={56} />
              <span className="absolute text-xs font-semibold text-foreground">
                {ringPercent}%
              </span>
            </div>
            <div className="h-10 w-px bg-border mx-1 shrink-0" />
            {/* Chips */}
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <StatChip
                label="Total this week"
                value={weekTotal}
                className="text-foreground bg-muted/50 border-border"
              />
              <StatChip
                label="Completed"
                value={weekCompleted}
                className="text-green-400 bg-green-500/10 border-green-500/20"
              />
              <StatChip
                label="In Progress"
                value={weekInProgress}
                className="text-blue-400 bg-blue-500/10 border-blue-500/20"
              />
              <StatChip
                label="Overdue"
                value={weekOverdue}
                className="text-red-400 bg-red-500/10 border-red-500/20"
              />
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-4 md:px-6 pb-3 shrink-0">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as FilterTab)}
          >
            <div className="flex overflow-x-auto gap-2 pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none">
              <TabsList className="flex-nowrap">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-6 pb-6 w-full">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/2 rounded" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No tasks yet</p>
              <p className="text-xs text-muted-foreground">Tasks assigned to you will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  assignee={profiles[t.assigned_to]}
                  isManager={isManager}
                  isSelected={selectedTaskId === t.id}
                  isMobile={isMobile}
                  onSelect={() =>
                    setSelectedTaskId((prev) =>
                      prev === t.id ? null : t.id
                    )
                  }
                  onRefresh={load}
                  workspaceId={workspace.id}
                  userId={user?.id ?? ""}
                  onComplete={
                    t.status !== "completed"
                      ? async () => {
                          const { error } = await supabase
                            .from("tasks")
                            .update({
                              status: "completed",
                              progress_percent: 100,
                              completed_at: new Date().toISOString(),
                            })
                            .eq("id", t.id);
                          if (error) {
                            toast.error(error.message);
                            return;
                          }
                          toast.success("Task marked complete!");
                          void load();
                        }
                      : undefined
                  }
                  onDelete={async () => {
                    const { error } = await supabase
                      .from("tasks")
                      .delete()
                      .eq("id", t.id);
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success("Task deleted");
                    void load();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right column: detail panel (desktop only) ── */}
      {selectedTask && !isMobile && (
        <div className="hidden md:block w-96 shrink-0 border-l border-border overflow-y-auto">
          <TaskDetailPanel
            task={selectedTask}
            assignee={profiles[selectedTask.assigned_to]}
            isManager={isManager}
            user={user}
            workspaceId={workspace.id}
            onClose={() => setSelectedTaskId(null)}
            onRefresh={load}
          />
        </div>
      )}

      {/* ── Mobile bottom sheet ── */}
      {isMobile && (
        <Sheet open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}>
          <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl pb-safe p-0">
            <div className="mx-auto mt-3 mb-2 h-1 w-9 rounded-full bg-muted" />
            {selectedTask && (
              <TaskDetailPanel
                task={selectedTask}
                assignee={profiles[selectedTask.assigned_to]}
                isManager={isManager}
                user={user}
                workspaceId={workspace.id}
                onClose={() => setSelectedTaskId(null)}
                onRefresh={load}
              />
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${className}`}
    >
      <span className="text-base font-bold leading-none">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  assignee,
  isManager,
  isSelected,
  isMobile,
  onSelect,
  onRefresh,
  workspaceId,
  userId,
  onComplete,
  onDelete,
}: {
  task: TaskRow;
  assignee?: ProfileMini;
  isManager: boolean;
  isSelected: boolean;
  isMobile?: boolean;
  onSelect: () => void;
  onRefresh: () => void;
  workspaceId: string;
  userId: string;
  onComplete?: () => void;
  onDelete?: () => void;
}) {
  const today = todayISO();
  const isOverdue =
    task.status !== "completed" && task.due_date < today;
  const dueLabel = dueDateLabel(task.due_date, task.status);

  const [warningOpen, setWarningOpen] = React.useState(false);
  const [flagOpen, setFlagOpen] = React.useState(false);

  const borderAccent = isOverdue
    ? "border-l-4 border-l-red-500"
    : task.priority === "urgent"
      ? "border-l-4 border-l-red-400"
      : task.priority === "high"
        ? "border-l-4 border-l-amber-400"
        : "";

  async function escalateToUrgent(e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase
      .from("tasks")
      .update({ priority: "urgent" })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "task_assigned",
      title: "⚡ Task escalated to Urgent",
      message: task.title,
      related_task_id: task.id,
      workspace_id: workspaceId,
    });
    toast.success("Task escalated to Urgent");
    onRefresh();
  }

  async function removeWarning(e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase
      .from("tasks")
      .update({ has_warning: false, warning_message: null })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Warning removed");
    onRefresh();
  }

  const cardContent = (
      <div
        className={`relative rounded-lg border bg-card p-4 cursor-pointer transition-colors hover:border-primary/40
          ${borderAccent}
          ${task.status === "completed" ? "opacity-60" : ""}
          ${isSelected ? "border-primary" : "border-border"}
        `}
        onClick={onSelect}
      >
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}
              >
                {task.title}
              </h3>
              {/* Priority badge */}
              <span
                className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${PRIORITY_BADGE[task.priority]}`}
              >
                {task.priority}
              </span>
              {/* Status badge */}
              <span
                className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${STATUS_BADGE[isOverdue ? "overdue" : task.status]}`}
              >
                {(isOverdue ? "overdue" : task.status).replace("_", " ")}
              </span>
              {/* Warning badge */}
              {task.has_warning && (
                <span className="animate-pulse bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded text-[10px] px-1.5 py-0.5 uppercase inline-flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Warning
                </span>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
              <span
                className={`inline-flex items-center gap-1 ${dueLabel.className}`}
              >
                <Calendar className="h-3 w-3 shrink-0" />
                {dueLabel.text}
              </span>
              <span className="text-muted-foreground capitalize">
                {task.task_type.replace("_", " ")}
              </span>
              {isManager && assignee && (
                <span className="text-muted-foreground truncate max-w-[120px]">
                  → {assignee.full_name ?? assignee.email}
                </span>
              )}
            </div>

            {/* Progress bar (in_progress only) */}
            {task.status === "in_progress" && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{task.progress_percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${task.progress_percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Three-dot menu (managers only) */}
          {isManager && (
            <div className="shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    disabled={task.priority === "urgent"}
                    onSelect={(e) =>
                      void escalateToUrgent(e as unknown as React.MouseEvent)
                    }
                  >
                    ⚡ Escalate to Urgent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setWarningOpen(true);
                    }}
                  >
                    ⚠ Add Warning
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!task.has_warning}
                    onSelect={(e) =>
                      void removeWarning(e as unknown as React.MouseEvent)
                    }
                  >
                    Remove Warning
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-400"
                    onSelect={(e) => {
                      e.preventDefault();
                      setFlagOpen(true);
                    }}
                  >
                    <Flag className="h-3.5 w-3.5 mr-2" /> Flag Employee
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
  );

  return (
    <>
      {isMobile ? (
        <SwipeableRow
          onComplete={onComplete}
          onDelete={onDelete}
        >
          {cardContent}
        </SwipeableRow>
      ) : (
        cardContent
      )}

      {/* Add Warning Dialog */}
      <AddWarningDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        task={task}
        workspaceId={workspaceId}
        onDone={() => {
          setWarningOpen(false);
          onRefresh();
        }}
      />

      {/* Flag Employee Dialog */}
      <FlagEmployeeDialog
        open={flagOpen}
        onOpenChange={setFlagOpen}
        task={task}
        workspaceId={workspaceId}
        userId={userId}
        onDone={() => {
          setFlagOpen(false);
        }}
      />
    </>
  );
}

// ─── Add Warning Dialog ───────────────────────────────────────────────────────

function AddWarningDialog({
  open,
  onOpenChange,
  task,
  workspaceId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow;
  workspaceId: string;
  onDone: () => void;
}) {
  const [input, setInput] = React.useState(task.warning_message ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!input.trim()) {
      toast.error("Warning message is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({ has_warning: true, warning_message: input.trim() })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "warning",
      title: "⚠ Warning added to your task",
      message: `${task.title}: ${input.trim()}`,
      related_task_id: task.id,
      workspace_id: workspaceId,
    });
    toast.success("Warning added");
    setSaving(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Warning</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This warning will be visible to the employee on their task.
          </p>
          <div>
            <Label>Warning message</Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe the issue or expectation…"
              rows={3}
              className="mt-1.5 text-base md:text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Add Warning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Flag Employee Dialog ─────────────────────────────────────────────────────

function FlagEmployeeDialog({
  open,
  onOpenChange,
  task,
  workspaceId,
  userId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow;
  workspaceId: string;
  userId: string;
  onDone: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [severity, setSeverity] = React.useState("medium");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("flags").insert({
      flagged_user_id: task.assigned_to,
      flagged_by: userId,
      reason: reason.trim(),
      severity,
      workspace_id: workspaceId,
      is_resolved: false,
    });
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "flag",
      title: "🚩 You have been flagged",
      message: reason.trim(),
      workspace_id: workspaceId,
    });
    toast.success("Employee flagged");
    setSaving(false);
    setReason("");
    setSeverity("medium");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-red-400" /> Flag Employee
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Flag this employee for review. They will be notified.
          </p>
          <div>
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for flagging…"
              rows={3}
              className="mt-1.5 text-base md:text-sm"
            />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Flagging…" : "Flag Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({
  task,
  assignee,
  isManager,
  user,
  workspaceId,
  onClose,
  onRefresh,
}: {
  task: TaskRow;
  assignee?: ProfileMini;
  isManager: boolean;
  user: { id: string } | null;
  workspaceId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [progress, setProgress] = React.useState(task.progress_percent);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [kpi, setKpi] = React.useState<KpiRow | null>(null);

  // Sync progress when task changes
  React.useEffect(() => {
    setProgress(task.progress_percent);
  }, [task.id, task.progress_percent]);

  // Load KPI if linked
  React.useEffect(() => {
    if (!task.kpi_id) {
      setKpi(null);
      return;
    }
    void supabase
      .from("kpis")
      .select("id, title, description, department, target_value, unit, period")
      .eq("id", task.kpi_id)
      .single()
      .then(({ data }) => setKpi(data as KpiRow | null));
  }, [task.kpi_id]);

  const canEdit =
    isManager || (user?.id && task.assigned_to === user.id);
  const isOverdue = task.status !== "completed" && task.due_date < todayISO();
  const dueLabel = dueDateLabel(task.due_date, task.status);

  async function updateStatus(newStatus: TaskRow["status"], newProgress: number) {
    if (!canEdit) return;
    setSaving(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        progress_percent: newProgress,
        completed_at:
          newStatus === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("task_updates").insert({
      task_id: task.id,
      updated_by: user?.id,
      workspace_id: workspaceId,
      old_status: task.status,
      new_status: newStatus,
      old_progress: task.progress_percent,
      new_progress: newProgress,
      note: note.trim() || null,
    });
    toast.success(
      newStatus === "completed" ? "Task marked complete!" : "Progress saved"
    );
    setNote("");
    setSaving(false);
    onRefresh();
  }

  async function saveProgress() {
    await updateStatus("in_progress", progress);
  }

  async function markInProgress() {
    await updateStatus("in_progress", task.progress_percent);
  }

  async function markComplete() {
    await updateStatus("completed", 100);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-5 border-b border-border shrink-0">
        <h2 className="text-base font-semibold leading-snug flex-1 min-w-0">
          {task.title}
        </h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Warning block */}
        {task.has_warning && task.warning_message && (
          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-3">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold uppercase tracking-wide mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Warning
            </div>
            <p className="text-sm text-amber-300/90">{task.warning_message}</p>
          </div>
        )}

        {/* Task info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${PRIORITY_BADGE[task.priority]}`}
            >
              {task.priority}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${STATUS_BADGE[isOverdue ? "overdue" : task.status]}`}
            >
              {(isOverdue ? "overdue" : task.status).replace("_", " ")}
            </span>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className={dueLabel.className}>{dueLabel.text}</span>
              <span className="text-muted-foreground/50">({task.due_date})</span>
            </div>
            <div className="text-muted-foreground capitalize">
              Type:{" "}
              <span className="text-foreground">
                {task.task_type.replace("_", " ")}
              </span>
            </div>
            {isManager && assignee && (
              <div className="text-muted-foreground">
                Assigned to:{" "}
                <span className="text-foreground">
                  {assignee.full_name ?? assignee.email}
                </span>
              </div>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-muted-foreground leading-relaxed pt-1">
              {task.description}
            </p>
          )}
        </div>

        <Separator />

        {/* Status controls */}
        {canEdit && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Update Status
            </p>

            {task.status === "todo" && (
              <Button
                size="sm"
                className="w-full"
                onClick={markInProgress}
                disabled={saving}
              >
                Mark In Progress
              </Button>
            )}

            {task.status === "in_progress" && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <Label className="text-xs">Progress</Label>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(+e.target.value)}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <Label className="text-xs">Note (optional)</Label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a progress note…"
                    rows={2}
                    className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={saveProgress}
                    disabled={saving}
                  >
                    Save Progress
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={markComplete}
                    disabled={saving}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Complete
                  </Button>
                </div>
              </div>
            )}

            {(task.status === "overdue" || isOverdue) &&
              task.status !== "completed" &&
              task.status !== "in_progress" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={markInProgress}
                  disabled={saving}
                >
                  Start Working on This
                </Button>
              )}

            {task.status === "completed" && (
              <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                <Check className="h-4 w-4 shrink-0" />
                <span>
                  Completed{" "}
                  {task.completed_at
                    ? new Date(task.completed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                </span>
              </div>
            )}
          </div>
        )}

        {/* KPI block */}
        {kpi && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                KPI Contribution
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-0.5">
                <p className="font-medium text-foreground">
                  📊 {kpi.title}
                </p>
                {kpi.department && (
                  <p className="text-xs text-muted-foreground">
                    {kpi.department}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Target:{" "}
                  <span className="text-foreground">
                    {kpi.target_value ?? "—"} {kpi.unit ?? ""}
                  </span>{" "}
                  <span className="capitalize">({kpi.period})</span>
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
