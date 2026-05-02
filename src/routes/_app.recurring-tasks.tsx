import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { requireAnyRole } from "@/lib/role-access";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Plus, Pause, Play, Trash2, Zap } from "lucide-react";
import { todayISO } from "@/lib/nexus";
import type { Database } from "@/integrations/supabase/types";

type TaskPriority = Database["public"]["Enums"]["task_priority"];

export const Route = createFileRoute("/_app/recurring-tasks")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: RecurringTasksPage,
});

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  priority: string;
  recurrence: "daily" | "weekly";
  day_of_week: number | null;
  is_active: boolean;
  last_generated_date: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function RecurringTasksPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = React.useState<RecurringTask[]>([]);
  const [employees, setEmployees] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [tmplRes, empRes] = await Promise.all([
      supabase.from("recurring_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    ]);
    setTemplates((tmplRes.data ?? []) as RecurringTask[]);
    setEmployees((empRes.data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function toggle(t: RecurringTask) {
    await supabase.from("recurring_tasks").update({ is_active: !t.is_active }).eq("id", t.id);
    void load();
  }

  async function del(id: string) {
    if (!confirm("Delete this recurring task template?")) return;
    await supabase.from("recurring_tasks").delete().eq("id", id);
    void load();
  }

  async function generateNow(t: RecurringTask) {
    setGenerating(t.id);
    const today = todayISO();
    const dueDate = today;
    const taskType = t.recurrence === "daily" ? "daily" : "weekly";

    // Check if a task was already generated today
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("assigned_to", t.assigned_to)
      .eq("title", t.title)
      .eq("due_date", today)
      .maybeSingle();

    if (existing) {
      toast.info("Task already generated for today");
      setGenerating(null);
      return;
    }

    const payload: Database["public"]["Tables"]["tasks"]["Insert"] = {
      title: t.title,
      description: t.description,
      assigned_to: t.assigned_to,
      assigned_by: user?.id,
      priority: t.priority as TaskPriority,
      task_type: taskType,
      due_date: dueDate,
      status: "todo",
    };
    const { error } = await supabase.from("tasks").insert(payload);

    if (error) { toast.error(error.message); setGenerating(null); return; }

    // Update last generated date
    await supabase.from("recurring_tasks").update({ last_generated_date: today }).eq("id", t.id);
    await supabase.from("notifications").insert({
      user_id: t.assigned_to,
      type: "task_assigned",
      title: "Recurring task assigned",
      message: t.title,
    });

    toast.success("Task generated");
    setGenerating(null);
    void load();
  }

  const empMap = React.useMemo(() => {
    const m: Record<string, Profile> = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recurring Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Templates that auto-generate daily or weekly tasks.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No recurring task templates yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const emp = empMap[t.assigned_to];
            return (
              <Card key={t.id} className={`p-4 ${!t.is_active ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{t.title}</p>
                      <span className="text-[10px] uppercase tracking-wide rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                        {t.recurrence === "weekly" && t.day_of_week != null
                          ? `Every ${DAY_NAMES[t.day_of_week]}`
                          : "Daily"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                        {t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned to: {emp?.full_name ?? emp?.email ?? "—"}
                      {t.last_generated_date && ` · Last generated ${t.last_generated_date}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateNow(t)}
                      disabled={generating === t.id}
                      title="Generate task now"
                    >
                      <Zap className={`h-3.5 w-3.5 ${generating === t.id ? "animate-pulse" : ""}`} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(t)} title={t.is_active ? "Pause" : "Activate"}>
                      {t.is_active
                        ? <Pause className="h-3.5 w-3.5" />
                        : <Play className="h-3.5 w-3.5 text-success" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => del(t.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <NewTemplateDialog
          employees={employees}
          createdBy={user?.id ?? ""}
          onSaved={() => { setOpen(false); void load(); }}
        />
      </Dialog>
    </div>
  );
}

function NewTemplateDialog({
  employees,
  createdBy,
  onSaved,
}: {
  employees: Profile[];
  createdBy: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [recurrence, setRecurrence] = React.useState<"daily" | "weekly">("weekly");
  const [dayOfWeek, setDayOfWeek] = React.useState<string>("0");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!title.trim() || !assignedTo) { toast.error("Title and assignee are required"); return; }
    setSaving(true);
    const payload: Database["public"]["Tables"]["recurring_tasks"]["Insert"] = {
      title: title.trim(),
      description: desc.trim() || null,
      assigned_to: assignedTo,
      created_by: createdBy,
      priority,
      recurrence,
      day_of_week: recurrence === "weekly" ? parseInt(dayOfWeek) : null,
    };
    const { error } = await supabase.from("recurring_tasks").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template created");
    onSaved();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>New Recurring Task Template</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Task title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly report submission" autoFocus />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <Label>Assign to</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo}>
            <SelectTrigger><SelectValue placeholder="Pick employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Repeats</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as "daily" | "weekly")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {recurrence === "weekly" && (
          <div>
            <Label>Day of week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create template"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
