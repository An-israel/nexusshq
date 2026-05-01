import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, Clock, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/track/$token")({
  component: PublicTracker,
});

interface ClientProject {
  id: string;
  name: string;
  client_name: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "completed";
  due_date: string | null;
  order_index: number;
}

const TASK_ICON: Record<string, React.ReactNode> = {
  todo: <Circle className="h-5 w-5 text-muted-foreground" />,
  in_progress: <Clock className="h-5 w-5 text-primary animate-pulse" />,
  completed: <CheckCircle2 className="h-5 w-5 text-success" />,
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active: { text: "In Progress", cls: "bg-success/15 text-success border-success/30" },
  completed: { text: "Completed", cls: "bg-muted text-muted-foreground border-border" },
  on_hold: { text: "On Hold", cls: "bg-warning/15 text-warning border-warning/30" },
};

function PublicTracker() {
  const { token } = Route.useParams();
  const [project, setProject] = React.useState<ClientProject | null>(null);
  const [tasks, setTasks] = React.useState<ProjectTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: proj } = await supabase
        .from("client_projects")
        .select("id, name, client_name, description, status, created_at")
        .eq("access_token", token)
        .single();

      if (!proj) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProject(proj as ClientProject);

      const { data: taskData } = await supabase
        .from("client_project_tasks")
        .select("id, title, description, status, due_date, order_index")
        .eq("project_id", proj.id)
        .order("order_index");
      setTasks((taskData ?? []) as ProjectTask[]);
      setLoading(false);
    })();
  }, [token]);

  const done = tasks.filter((t) => t.status === "completed").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-4xl font-bold mb-3">404</p>
          <p className="text-muted-foreground text-sm">Project not found. Check the link with your team.</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[project.status] ?? STATUS_LABEL.active;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              N
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Nexus HQ</p>
              <p className="text-sm font-semibold">Project Tracker</p>
            </div>
          </div>
          <span className={`text-xs uppercase tracking-wide rounded border px-2 py-1 ${statusInfo.cls}`}>
            {statusInfo.text}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Project info */}
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prepared for <span className="text-foreground font-medium">{project.client_name}</span>
          </p>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-2">{project.description}</p>
          )}
        </div>

        {/* Progress */}
        {tasks.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-medium">Overall progress</span>
              <span className="text-muted-foreground">{done} of {tasks.length} milestones complete</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, oklch(0.62 0.19 259), oklch(0.72 0.16 162))",
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{pct}% complete</p>
          </div>
        )}

        {/* Milestones */}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Milestones
          </h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones added yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors
                    ${task.status === "completed"
                      ? "border-success/20 bg-success/5"
                      : task.status === "in_progress"
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-card"}`}
                >
                  <div className="mt-0.5 shrink-0">{TASK_ICON[task.status]}</div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        task.status === "completed" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                    )}
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.status === "completed" ? "Delivered" : "Expected"}: {task.due_date}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-[10px] uppercase tracking-wide font-medium mt-0.5
                    ${task.status === "completed" ? "text-success"
                      : task.status === "in_progress" ? "text-primary"
                      : "text-muted-foreground"}`}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground border-t border-border pt-6">
          This is a read-only view shared by your team. For questions, contact us directly.
        </p>
      </main>
    </div>
  );
}
