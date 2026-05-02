import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requireAnyRole } from "@/lib/role-access";
import { useRealtime } from "@/lib/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronDown, Clock, History as HistoryIcon } from "lucide-react";
import { PRIORITY_BADGE, deptLabel, initialsOf, timeAgo } from "@/lib/nexus";
import { updateTaskStatusFn } from "@/lib/tasks.functions";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "department"
>;
type Update = Database["public"]["Tables"]["task_updates"]["Row"];
type Status = "todo" | "in_progress" | "completed" | "overdue";

export const Route = createFileRoute("/_app/team-board")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: TeamBoardPage,
});

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "bg-muted-foreground/40" },
  { id: "in_progress", label: "In Progress", color: "bg-primary" },
  { id: "completed", label: "Completed", color: "bg-success" },
  { id: "overdue", label: "Overdue", color: "bg-destructive" },
];

function TeamBoardPage() {
  const updateStatus = useServerFn(updateTaskStatusFn);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(true);
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("all");
  const [historyTask, setHistoryTask] = React.useState<Task | null>(null);
  const [history, setHistory] = React.useState<Update[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [tasksRes, profilesRes] = await Promise.all([
      supabase.from("tasks").select("*").order("due_date", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, department"),
    ]);
    setTasks((tasksRes.data as Task[]) ?? []);
    const map: Record<string, Profile> = {};
    ((profilesRes.data as Profile[]) ?? []).forEach((p) => (map[p.id] = p));
    setProfiles(map);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Realtime — only refetch when a task row actually changes
  useRealtime({
    table: "tasks",
    onChange: () => void load(),
  });

  async function loadHistory(taskId: string) {
    const { data } = await supabase
      .from("task_updates")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setHistory((data as Update[]) ?? []);
  }

  function openHistory(task: Task) {
    setHistoryTask(task);
    void loadHistory(task.id);
  }

  async function changeStatus(task: Task, status: Status) {
    if (task.status === status) return;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    try {
      await updateStatus({ data: { taskId: task.id, status } });
      toast.success(`Moved to ${status.replace("_", " ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)),
      );
    }
  }

  const filteredTasks = React.useMemo(() => {
    if (departmentFilter === "all") return tasks;
    return tasks.filter((t) => {
      const dept = profiles[t.assigned_to]?.department;
      return dept === departmentFilter;
    });
  }, [tasks, profiles, departmentFilter]);

  const grouped = React.useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const out: Record<Status, Task[]> = {
      todo: [],
      in_progress: [],
      completed: [],
      overdue: [],
    };
    filteredTasks.forEach((t) => {
      // Treat past-due, non-completed tasks as overdue
      const isOverdue =
        t.status !== "completed" && t.due_date < today && t.status !== "overdue";
      const status: Status = isOverdue ? "overdue" : (t.status as Status);
      out[status]?.push(t);
    });
    return out;
  }, [filteredTasks]);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    Object.values(profiles).forEach(
      (p) => p.department && set.add(p.department),
    );
    return Array.from(set).sort();
  }, [profiles]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team Task Board</h1>
          <p className="text-sm text-muted-foreground">
            All team tasks grouped by status. Drag-free quick status changes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/team" className="text-xs text-muted-foreground hover:text-foreground underline">
            Team overview
          </Link>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {deptLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.id} className="h-96 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = grouped[col.id] ?? [];
            return (
              <div
                key={col.id}
                className="flex min-h-[400px] flex-col rounded-2xl border border-border bg-card/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.color}`} />
                    <h2 className="text-sm font-semibold">{col.label}</h2>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Nothing here.
                    </p>
                  ) : (
                    items.map((t) => {
                      const p = profiles[t.assigned_to];
                      return (
                        <div
                          key={t.id}
                          className="rounded-lg border border-border bg-background p-3 text-sm shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to="/tasks/$taskId"
                              params={{ taskId: t.id }}
                              className="line-clamp-2 flex-1 font-medium hover:underline"
                            >
                              {t.title}
                            </Link>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-[10px] ${PRIORITY_BADGE[t.priority] ?? ""}`}
                            >
                              {t.priority}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                              {initialsOf(p?.full_name ?? p?.email)}
                            </span>
                            <span className="truncate">
                              {p?.full_name ?? p?.email ?? "—"}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(t.due_date).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openHistory(t)}
                                className="rounded p-1 hover:bg-accent"
                                title="View history"
                              >
                                <HistoryIcon className="h-3 w-3" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px]"
                                  >
                                    Move <ChevronDown className="ml-1 h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {COLUMNS.filter((c) => c.id !== col.id).map(
                                    (c) => (
                                      <DropdownMenuItem
                                        key={c.id}
                                        onClick={() => void changeStatus(t, c.id)}
                                      >
                                        Move to {c.label}
                                      </DropdownMenuItem>
                                    ),
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!historyTask}
        onOpenChange={(open) => !open && setHistoryTask(null)}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit trail</SheetTitle>
          </SheetHeader>
          {historyTask && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold">{historyTask.title}</p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No changes recorded yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {history.map((u) => {
                    const editor = profiles[u.updated_by ?? ""];
                    return (
                      <li
                        key={u.id}
                        className="border-l-2 border-primary/40 pl-3 text-xs"
                      >
                        <p className="font-medium">
                          {u.old_status && u.new_status ? (
                            <>
                              {u.old_status.replace("_", " ")}
                              {" → "}
                              <span className="text-primary">
                                {u.new_status.replace("_", " ")}
                              </span>
                            </>
                          ) : u.new_progress != null ? (
                            <>Progress {u.old_progress ?? 0}% → {u.new_progress}%</>
                          ) : (
                            "Updated"
                          )}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {editor?.full_name ?? editor?.email ?? "Someone"} ·{" "}
                          {timeAgo(u.created_at)}
                        </p>
                        {u.note && (
                          <p className="mt-1 italic text-muted-foreground">
                            "{u.note}"
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
