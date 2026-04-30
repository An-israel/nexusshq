import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PRIORITY_BADGE, STATUS_BADGE, PRIORITY_RANK, todayISO } from "@/lib/nexus";
import { AlertTriangle, Plus, Calendar as CalIcon, Flag } from "lucide-react";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
});

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string | null;
  task_type: "daily" | "one_time" | "recurring";
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

function TasksPage() {
  const { user, isManager } = useAuth();
  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"all" | "today" | "open" | "completed">("all");
  const [assignOpen, setAssignOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true });
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
  }, [user, isManager]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const today = todayISO();
  const filtered = React.useMemo(() => {
    let list = [...tasks];
    if (filter === "today") list = list.filter((t) => t.due_date === today);
    else if (filter === "open")
      list = list.filter((t) => t.status === "todo" || t.status === "in_progress");
    else if (filter === "completed") list = list.filter((t) => t.status === "completed");
    list.sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 9;
      const pb = PRIORITY_RANK[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.due_date.localeCompare(b.due_date);
    });
    return list;
  }, [tasks, filter, today]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isManager ? "All Tasks" : "My Tasks"}</h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Assign, track, and warn across the team."
              : "Stay on top of what's due."}
          </p>
        </div>
        {isManager && (
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Assign Task
              </Button>
            </DialogTrigger>
            <AssignTaskDialog
              onCreated={() => {
                setAssignOpen(false);
                void load();
              }}
            />
          </Dialog>
        )}
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No tasks to show.
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  assignee={profiles[t.assigned_to]}
                  showAssignee={isManager}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskCard({
  task,
  assignee,
  showAssignee,
}: {
  task: TaskRow;
  assignee?: ProfileMini;
  showAssignee: boolean;
}) {
  const overdue =
    task.status !== "completed" && task.due_date < todayISO();
  const statusKey = overdue ? "overdue" : task.status;
  return (
    <Link to="/tasks/$taskId" params={{ taskId: task.id }} className="block">
      <Card className="p-4 hover:border-primary/50 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium truncate">{task.title}</h3>
              <span
                className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${PRIORITY_BADGE[task.priority]}`}
              >
                {task.priority}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${STATUS_BADGE[statusKey]}`}
              >
                {statusKey.replace("_", " ")}
              </span>
              {task.has_warning && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide rounded border border-warning/30 bg-warning/15 text-warning px-1.5 py-0.5">
                  <AlertTriangle className="h-3 w-3" /> Warning
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="inline-flex items-center gap-1">
                <CalIcon className="h-3 w-3" /> {task.due_date}
              </span>
              <span>{task.task_type.replace("_", " ")}</span>
              {showAssignee && assignee && (
                <span>→ {assignee.full_name ?? assignee.email}</span>
              )}
              <span className="ml-auto">{task.progress_percent}%</span>
            </div>
            <div className="mt-2 h-1 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${task.progress_percent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function AssignTaskDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium",
    task_type: "one_time",
    due_date: todayISO(),
  });

  React.useEffect(() => {
    void supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, []);

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.assigned_to) {
      toast.error("Pick an assignee");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: form.assigned_to,
        assigned_by: user?.id ?? null,
        priority: form.priority as TaskRow["priority"],
        task_type: form.task_type as TaskRow["task_type"],
        due_date: form.due_date,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    // Notify assignee
    await supabase.from("notifications").insert({
      user_id: form.assigned_to,
      type: "task_assigned",
      title: "📋 New task assigned",
      message: form.title.trim(),
      related_task_id: data.id,
    });
    toast.success("Task assigned");
    setSubmitting(false);
    onCreated();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Assign New Task</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add context, links, expectations…"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Assignee</Label>
            <Select
              value={form.assigned_to}
              onValueChange={(v) => setForm({ ...form, assigned_to: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pick employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name ?? e.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Priority</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm({ ...form, priority: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={form.task_type}
              onValueChange={(v) => setForm({ ...form, task_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One-time</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>
          <Flag className="mr-2 h-4 w-4" /> {submitting ? "Assigning…" : "Assign Task"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
