import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { toast } from "sonner";
import { PRIORITY_BADGE, STATUS_BADGE, todayISO, timeAgo } from "@/lib/nexus";
import { AlertTriangle, ArrowLeft, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/_app/tasks/$taskId")({
  component: TaskDetailPage,
});

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string | null;
  task_type: "daily" | "one_time" | "weekly";
  priority: "low" | "medium" | "high" | "urgent";
  status: "todo" | "in_progress" | "completed" | "overdue";
  progress_percent: number;
  due_date: string;
  has_warning: boolean;
  warning_message: string | null;
  completed_at: string | null;
  created_at: string;
}

interface UpdateRow {
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

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isManager } = useAuth();
  const [task, setTask] = React.useState<TaskRow | null>(null);
  const [updates, setUpdates] = React.useState<UpdateRow[]>([]);
  const [profileMap, setProfileMap] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);

  const [progress, setProgress] = React.useState(0);
  const [status, setStatus] = React.useState<TaskRow["status"]>("todo");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [warnOpen, setWarnOpen] = React.useState(false);
  const [warnMsg, setWarnMsg] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data: t, error: te }, { data: u }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase
        .from("task_updates")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
    ]);
    if (te || !t) {
      toast.error(te?.message ?? "Task not found");
      setLoading(false);
      return;
    }
    const tr = t as TaskRow;
    setTask(tr);
    setProgress(tr.progress_percent);
    setStatus(tr.status);
    const list = (u ?? []) as UpdateRow[];
    setUpdates(list);

    const ids = Array.from(
      new Set(
        [tr.assigned_to, tr.assigned_by, ...list.map((x) => x.updated_by)].filter(
          (x): x is string => !!x,
        ),
      ),
    );
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = p as ProfileMini;
      });
      setProfileMap(map);
    }
    setLoading(false);
  }, [taskId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading || !task) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const canEdit = task.assigned_to === user?.id || isManager;
  const overdue = task.status !== "completed" && task.due_date < todayISO();
  const statusKey = overdue ? "overdue" : task.status;

  async function saveProgress() {
    if (!task || !user) return;
    setSaving(true);
    const newStatus: TaskRow["status"] =
      progress >= 100 ? "completed" : progress > 0 ? "in_progress" : status;
    const patch: Partial<TaskRow> = {
      progress_percent: progress,
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    await supabase.from("task_updates").insert({
      task_id: task.id,
      updated_by: user.id,
      old_status: task.status,
      new_status: newStatus,
      old_progress: task.progress_percent,
      new_progress: progress,
      note: note.trim() || null,
    });
    // Notify the manager who assigned it (if it's not the same person)
    if (task.assigned_by && task.assigned_by !== user.id) {
      await supabase.from("notifications").insert({
        user_id: task.assigned_by,
        type: "task_assigned",
        title: newStatus === "completed" ? "✅ Task completed" : "📈 Task updated",
        message: `${task.title} — ${progress}%`,
        related_task_id: task.id,
      });
    }
    setNote("");
    toast.success("Progress saved");
    setSaving(false);
    void load();
  }

  async function issueWarning() {
    if (!task) return;
    if (!warnMsg.trim()) {
      toast.error("Warning message required");
      return;
    }
    const { error } = await supabase
      .from("tasks")
      .update({ has_warning: true, warning_message: warnMsg.trim() })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: task.assigned_to,
      type: "warning",
      title: "⚠️ Warning issued on task",
      message: `${task.title}: ${warnMsg.trim()}`,
      related_task_id: task.id,
    });
    await supabase.from("flags").insert({
      flagged_user_id: task.assigned_to,
      flagged_by: user?.id ?? null,
      severity: "medium",
      reason: `Task warning: ${task.title} — ${warnMsg.trim()}`,
    });
    toast.success("Warning issued");
    setWarnOpen(false);
    setWarnMsg("");
    void load();
  }

  async function clearWarning() {
    if (!task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ has_warning: false, warning_message: null })
      .eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Warning cleared");
    void load();
  }

  async function deleteTask() {
    if (!task) return;
    if (!confirm("Delete this task permanently?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task deleted");
    navigate({ to: "/tasks" });
  }

  const assignee = profileMap[task.assigned_to];
  const assigner = task.assigned_by ? profileMap[task.assigned_by] : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tasks" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to tasks
      </Button>

      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{task.title}</h1>
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
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 flex-wrap">
              <span>Due {task.due_date}</span>
              <span>Type: {task.task_type.replace("_", " ")}</span>
              {assignee && <span>Assigned to: {assignee.full_name ?? assignee.email}</span>}
              {assigner && <span>By: {assigner.full_name ?? assigner.email}</span>}
            </div>
          </div>
          {isManager && (
            <Button variant="ghost" size="sm" onClick={deleteTask}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        {task.has_warning && (
          <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-warning">Warning</p>
              <p className="text-muted-foreground">{task.warning_message}</p>
            </div>
            {isManager && (
              <Button variant="ghost" size="sm" onClick={clearWarning}>
                Clear
              </Button>
            )}
          </div>
        )}
      </Card>

      {canEdit && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Update Progress</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Progress</Label>
              <span className="font-medium">{progress}%</span>
            </div>
            <Slider
              value={[progress]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setProgress(v[0] ?? 0)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskRow["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveProgress} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Update"}
            </Button>
            {isManager && !task.has_warning && (
              <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <AlertTriangle className="mr-2 h-4 w-4 text-warning" /> Issue Warning
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Issue a Warning</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea
                      value={warnMsg}
                      onChange={(e) => setWarnMsg(e.target.value)}
                      placeholder="Explain what needs to improve…"
                      rows={4}
                    />
                  </div>
                  <DialogFooter>
                    <Button onClick={issueWarning}>Send Warning</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-3">
        <h2 className="font-semibold">Activity</h2>
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => {
              const who = u.updated_by ? profileMap[u.updated_by] : null;
              return (
                <li key={u.id} className="flex gap-3 text-sm border-b border-border pb-3 last:border-0">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1">
                    <p>
                      <span className="font-medium">{who?.full_name ?? who?.email ?? "Someone"}</span>{" "}
                      <span className="text-muted-foreground">
                        moved {u.old_progress ?? 0}% → {u.new_progress ?? 0}%
                        {u.new_status && u.new_status !== u.old_status
                          ? ` · ${u.new_status.replace("_", " ")}`
                          : ""}
                      </span>
                    </p>
                    {u.note && <p className="text-muted-foreground mt-0.5">{u.note}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(u.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
