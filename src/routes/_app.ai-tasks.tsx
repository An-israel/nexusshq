import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { requireAnyRole } from "@/lib/role-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Plus, CheckCircle2, RefreshCw } from "lucide-react";
import { DEPARTMENTS, deptLabel, PRIORITY_BADGE } from "@/lib/nexus";
import type { Database } from "@/integrations/supabase/types";

type Department = Database["public"]["Enums"]["department_type"];
type Priority = "low" | "medium" | "high" | "urgent";
type TaskType = "daily" | "one_time" | "weekly";

export const Route = createFileRoute("/_app/ai-tasks")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: AiTasksPage,
});

interface GeneratedTask {
  title: string;
  description: string;
  priority: Priority;
  task_type: TaskType;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
}

function AiTasksPage() {
  const { user } = useAuth();

  const [department, setDepartment] = React.useState<Department>("marketing");
  const [focus, setFocus] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [tasks, setTasks] = React.useState<GeneratedTask[]>([]);
  const [added, setAdded] = React.useState<Set<number>>(new Set());

  // For assign dialog
  const [assignIdx, setAssignIdx] = React.useState<number | null>(null);
  const [profiles, setProfiles] = React.useState<ProfileMini[]>([]);
  const [assignee, setAssignee] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  // Load profiles for assignment
  React.useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setProfiles((data as ProfileMini[]) ?? []));
  }, []);

  async function generate() {
    setGenerating(true);
    setTasks([]);
    setAdded(new Set());

    // Fetch a handful of current open tasks for context
    const { data: openTasks } = await supabase
      .from("tasks")
      .select("title")
      .in("status", ["todo", "in_progress"])
      .limit(10);

    const existingTasks = (openTasks ?? []).map((t: { title: string }) => t.title);

    try {
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-tasks",
          context: { department, focus, existingTasks },
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as { result?: string; error?: string };
      if (data.error) throw new Error(data.error);

      const parsed = JSON.parse(data.result ?? "[]") as GeneratedTask[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No tasks returned");
      setTasks(parsed);
    } catch (err) {
      toast.error(`AI generation failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  function openAssign(idx: number) {
    setAssignIdx(idx);
    setAssignee("");
    setDueDate("");
  }

  async function assignTask() {
    if (assignIdx === null || !assignee || !dueDate) return;
    setAssigning(true);
    const t = tasks[assignIdx];
    const { error } = await supabase.from("tasks").insert({
      title: t.title,
      description: t.description,
      priority: t.priority,
      task_type: t.task_type,
      assigned_to: assignee,
      assigned_by: user?.id,
      due_date: dueDate,
      status: "todo",
      progress_percent: 0,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Task assigned!");
      setAdded((prev) => new Set([...prev, assignIdx]));

      // Notification for assignee
      await supabase.from("notifications").insert({
        user_id: assignee,
        type: "info",
        title: `New task assigned: ${t.title}`,
        message: `Due ${dueDate}. Priority: ${t.priority}.`,
      });
    }
    setAssigning(false);
    setAssignIdx(null);
  }

  const deptProfiles = profiles.filter(
    (p) => !p.department || p.department === department,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">AI Weekly Task Generator</h1>
          <p className="text-sm text-muted-foreground">
            Let Claude suggest practical tasks for any department — then assign them with one click.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {deptLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Focus area <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. Q3 campaign, onboarding, cost reduction…"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={generate} disabled={generating} className="gap-2">
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate tasks
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Skeleton while generating */}
      {generating && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Results */}
      {!generating && tasks.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {tasks.length} tasks generated for <strong>{deptLabel(department)}</strong>.
            Click <strong>Assign</strong> to add them to the task list.
          </p>

          {tasks.map((t, i) => (
            <Card
              key={i}
              className={`flex items-start justify-between gap-4 p-4 transition-opacity ${
                added.has(i) ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {added.has(i) && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  )}
                  <span className="font-medium">{t.title}</span>
                  <Badge
                    className={`text-xs ${PRIORITY_BADGE[t.priority] ?? ""}`}
                    variant="outline"
                  >
                    {t.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {t.task_type.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </div>

              {!added.has(i) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => openAssign(i)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Assign dialog */}
      <Dialog open={assignIdx !== null} onOpenChange={(o) => !o && setAssignIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign task</DialogTitle>
          </DialogHeader>

          {assignIdx !== null && (
            <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{tasks[assignIdx]?.title}</p>
              <p className="text-muted-foreground">{tasks[assignIdx]?.description}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {(deptProfiles.length > 0 ? deptProfiles : profiles).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignIdx(null)}>
              Cancel
            </Button>
            <Button
              onClick={assignTask}
              disabled={assigning || !assignee || !dueDate}
            >
              {assigning ? "Assigning…" : "Assign task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
