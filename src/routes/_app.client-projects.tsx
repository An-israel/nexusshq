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
import { ExternalLink, Plus, Trash2, CheckCircle2, Circle, Clock, Copy } from "lucide-react";
import { timeAgo } from "@/lib/nexus";

export const Route = createFileRoute("/_app/client-projects")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: ClientProjectsPage,
});

interface ClientProject {
  id: string;
  name: string;
  client_name: string;
  description: string | null;
  status: "active" | "completed" | "on_hold";
  access_token: string;
  created_at: string;
}

interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed";
  due_date: string | null;
  order_index: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/15 text-success border-success/30",
  completed: "bg-muted text-muted-foreground border-border",
  on_hold: "bg-warning/15 text-warning border-warning/30",
};

const TASK_STATUS_ICON: Record<string, React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-primary" />,
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
};

function ClientProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = React.useState<ClientProject[]>([]);
  const [selected, setSelected] = React.useState<ClientProject | null>(null);
  const [tasks, setTasks] = React.useState<ProjectTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [newTaskOpen, setNewTaskOpen] = React.useState(false);

  const loadProjects = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_projects")
      .select("*")
      .order("created_at", { ascending: false });
    setProjects((data ?? []) as ClientProject[]);
    setLoading(false);
  }, []);

  const loadTasks = React.useCallback(async (projectId: string) => {
    const { data } = await supabase
      .from("client_project_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("order_index");
    setTasks((data ?? []) as ProjectTask[]);
  }, []);

  React.useEffect(() => { void loadProjects(); }, [loadProjects]);
  React.useEffect(() => {
    if (selected) void loadTasks(selected.id);
    else setTasks([]);
  }, [selected, loadTasks]);

  async function updateTaskStatus(task: ProjectTask, status: ProjectTask["status"]) {
    await supabase
      .from("client_project_tasks")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (selected) void loadTasks(selected.id);
  }

  async function deleteTask(id: string) {
    await supabase.from("client_project_tasks").delete().eq("id", id);
    if (selected) void loadTasks(selected.id);
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project and all its tasks?")) return;
    await supabase.from("client_projects").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    void loadProjects();
  }

  async function updateProjectStatus(id: string, status: ClientProject["status"]) {
    await supabase.from("client_projects").update({ status }).eq("id", id);
    void loadProjects();
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev);
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/track/${token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Client link copied to clipboard");
  }

  const progress = React.useMemo(() => {
    const done = tasks.filter((t) => t.status === "completed").length;
    return tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  }, [tasks]);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
      {/* Project list */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Client Projects</h2>
          <Button size="sm" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading && <p className="px-4 text-xs text-muted-foreground">Loading…</p>}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-4 py-3 hover:bg-accent transition-colors ${selected?.id === p.id ? "bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <span className={`shrink-0 text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${STATUS_BADGE[p.status]}`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{p.client_name}</p>
            </button>
          ))}
          {!loading && projects.length === 0 && (
            <p className="px-4 text-xs text-muted-foreground">No projects yet.</p>
          )}
        </div>
      </aside>

      {/* Project detail */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4 shrink-0 flex-wrap">
              <div>
                <h2 className="font-bold text-lg">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.client_name}</p>
                {selected.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selected.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={selected.status}
                  onValueChange={(v) => updateProjectStatus(selected.id, v as ClientProject["status"])}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => copyLink(selected.access_token)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy client link
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`/track/${selected.access_token}`, "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteProject(selected.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <div className="px-6 py-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Milestones</h3>
                <Button size="sm" onClick={() => setNewTaskOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add milestone
                </Button>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet. Add one to get started.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3"
                    >
                      <button
                        onClick={() => {
                          const next: Record<string, ProjectTask["status"]> = {
                            todo: "in_progress",
                            in_progress: "completed",
                            completed: "todo",
                          };
                          updateTaskStatus(task, next[task.status]);
                        }}
                      >
                        {TASK_STATUS_ICON[task.status]}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">Due {task.due_date}</p>
                        )}
                      </div>
                      <button onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Select a project to view details.</p>
          </div>
        )}
      </div>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <NewProjectDialog
          createdBy={user?.id ?? ""}
          onSaved={() => { setNewProjectOpen(false); void loadProjects(); }}
        />
      </Dialog>
      {selected && (
        <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
          <NewTaskDialog
            projectId={selected.id}
            nextIndex={tasks.length}
            onSaved={() => { setNewTaskOpen(false); void loadTasks(selected.id); }}
          />
        </Dialog>
      )}
    </div>
  );
}

function NewProjectDialog({ createdBy, onSaved }: { createdBy: string; onSaved: () => void }) {
  const [name, setName] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    if (!name.trim() || !clientName.trim()) { toast.error("Name and client name required"); return; }
    setSaving(true);
    const { error } = await supabase.from("client_projects").insert({
      name: name.trim(),
      client_name: clientName.trim(),
      description: desc.trim() || null,
      created_by: createdBy,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    onSaved();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Client Project</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Project name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand Redesign" autoFocus />
        </div>
        <div>
          <Label>Client name</Label>
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewTaskDialog({
  projectId,
  nextIndex,
  onSaved,
}: {
  projectId: string;
  nextIndex: number;
  onSaved: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    if (!title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const { error } = await supabase.from("client_project_tasks").insert({
      project_id: projectId,
      title: title.trim(),
      due_date: dueDate || null,
      order_index: nextIndex,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSaved();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Milestone title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Initial designs delivered" autoFocus />
        </div>
        <div>
          <Label>Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
