import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { todayISO, initialsOf } from "@/lib/nexus";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/tasks/assign")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: AssignTaskPage,
});

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  role: string;
}

interface KpiRow {
  id: string;
  title: string;
  department: string | null;
  target_value: number | null;
  unit: string | null;
  period: string | null;
}

type TaskType = "daily" | "weekly" | "one_time";
type Priority = "low" | "medium" | "high" | "urgent";

interface FormState {
  assigned_to: string;
  title: string;
  description: string;
  task_type: TaskType;
  due_date: string;
  priority: Priority;
  kpi_id: string;
  has_warning: boolean;
  warning_message: string;
}

function AssignTaskPage() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const { workspaceSlug } = Route.useParams();

  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [kpis, setKpis] = React.useState<KpiRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [form, setForm] = React.useState<FormState>({
    assigned_to: "",
    title: "",
    description: "",
    task_type: "one_time",
    due_date: todayISO(),
    priority: "medium",
    kpi_id: "",
    has_warning: false,
    warning_message: "",
  });

  // Load members and KPIs on mount
  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const [membersResult, kpisResult] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("user_id, role, profiles(id, full_name, email, department, job_title)")
          .eq("workspace_id", workspace.id)
          .eq("is_active", true),
        supabase
          .from("kpis")
          .select("id, title, department, target_value, unit, period")
          .eq("workspace_id", workspace.id),
      ]);

      if (membersResult.data) {
        const mapped: MemberRow[] = membersResult.data.flatMap((m) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          if (!p) return [];
          return [
            {
              id: (p as { id: string }).id,
              full_name: (p as { full_name: string | null }).full_name,
              email: (p as { email: string | null }).email,
              department: (p as { department: string | null }).department,
              job_title: (p as { job_title: string | null }).job_title,
              role: m.role,
            },
          ];
        });
        setMembers(mapped);
      }

      if (kpisResult.data) {
        setKpis(kpisResult.data as KpiRow[]);
      }

      setLoading(false);
    }

    void load();
  }, [workspace.id]);

  // Derive selected member
  const selectedMember = members.find((m) => m.id === form.assigned_to) ?? null;

  // Filter KPIs by selected employee's department
  const filteredKpis = selectedMember?.department
    ? kpis.filter((k) => k.department === selectedMember.department)
    : kpis;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!form.assigned_to) {
      toast.error("Select an employee");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: form.assigned_to,
        assigned_by: user?.id ?? null,
        priority: form.priority,
        task_type: form.task_type,
        due_date: form.due_date,
        kpi_id: form.kpi_id || null,
        has_warning: form.has_warning,
        warning_message: form.has_warning ? form.warning_message.trim() || null : null,
        workspace_id: workspace.id,
        status: "todo",
        progress_percent: 0,
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    const assignee = members.find((m) => m.id === form.assigned_to);
    const taskTitle = form.title.trim();
    const dueDateFormatted = new Date(form.due_date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    // Insert notification
    await supabase.from("notifications").insert({
      user_id: form.assigned_to,
      type: "task_assigned",
      title: "📋 New task assigned",
      message: `${taskTitle} — due ${dueDateFormatted}`,
      related_task_id: task.id,
      workspace_id: workspace.id,
    });

    // Enqueue email if assignee has email
    if (assignee?.email) {
      const warningSection =
        form.has_warning && form.warning_message
          ? `
      <div style="border-left:4px solid #f59e0b;background:#fef3c7;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <strong style="color:#92400e;">⚠ Warning:</strong>
        <p style="color:#78350f;margin:4px 0 0;">${form.warning_message}</p>
      </div>`
          : "";

      const priorityColor: Record<Priority, string> = {
        low: "#6b7280",
        medium: "#3b82f6",
        high: "#f59e0b",
        urgent: "#ef4444",
      };

      const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#111;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">New Task Assigned</h1>
        </div>
        <div style="padding:24px;">
          <p style="color:#374151;margin:0 0 16px;">Hi ${assignee.full_name ?? "there"},</p>
          <p style="color:#374151;margin:0 0 16px;">A new task has been assigned to you in Nexus HQ.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
            <h2 style="margin:0 0 8px;font-size:18px;color:#111;">${taskTitle}</h2>
            ${form.description ? `<p style="color:#6b7280;margin:0 0 12px;">${form.description}</p>` : ""}
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
              <span style="background:${priorityColor[form.priority]}20;color:${priorityColor[form.priority]};padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase;">${form.priority}</span>
              <span style="color:#6b7280;font-size:14px;">📅 Due: ${dueDateFormatted}</span>
              <span style="color:#6b7280;font-size:14px;">🔁 ${form.task_type.replace("_", " ")}</span>
            </div>
          </div>
          ${warningSection}
          <a href="https://app.nexushq.io" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View in Nexus HQ →</a>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">You're receiving this because you're a member of your workspace on Nexus HQ.</div>
      </div>`;

      await supabase
        .rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: { to: assignee.email, subject: `New Task Assigned — ${taskTitle}`, html },
        })
        .catch(() => {}); // non-fatal
    }

    toast.success("Task assigned successfully");
    setSubmitting(false);
    navigate({ to: "/$workspaceSlug/tasks", params: { workspaceSlug } });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            to="/$workspaceSlug/tasks"
            params={{ workspaceSlug }}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Assign Task</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Create and assign a task to a team member
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          {/* ── Section 1: Assignee ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assignee
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="assigned_to">Employee</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => {
                  setField("assigned_to", v);
                  // Reset KPI when employee changes
                  setField("kpi_id", "");
                }}
              >
                <SelectTrigger id="assigned_to" className="w-full">
                  <SelectValue placeholder="Select an employee…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? m.email ?? m.id} —{" "}
                      <span className="capitalize">{m.role}</span>
                      {m.department ? ` (${m.department})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee chip */}
            {selectedMember && (
              <div className="flex items-center gap-3 mt-2 bg-muted/40 rounded-lg px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {initialsOf(selectedMember.full_name ?? selectedMember.email)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none truncate">
                    {selectedMember.full_name ?? selectedMember.email}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[selectedMember.job_title, selectedMember.department]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 2: Task Details ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Details
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Submit weekly report"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional details about this task…"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* ── Section 3: Task Type ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Type
            </h2>
            <div className="flex rounded-md overflow-hidden border border-border">
              {(
                [
                  { value: "daily", label: "Daily" },
                  { value: "weekly", label: "Weekly" },
                  { value: "one_time", label: "One-time" },
                ] as { value: TaskType; label: string }[]
              ).map(({ value, label }, idx, arr) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField("task_type", value)}
                  className={[
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none",
                    idx !== arr.length - 1 ? "border-r border-border" : "",
                    form.task_type === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ── Section 4: Schedule & Priority ── */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schedule &amp; Priority
            </h2>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => setField("due_date", e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex rounded-md overflow-hidden border border-border">
                {(
                  [
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                    { value: "urgent", label: "Urgent" },
                  ] as { value: Priority; label: string }[]
                ).map(({ value, label }, idx, arr) => {
                  const isActive = form.priority === value;
                  const colorClasses: Record<Priority, { base: string; active: string }> = {
                    low: {
                      base: "text-muted-foreground hover:bg-muted",
                      active: "bg-muted text-foreground border-border",
                    },
                    medium: {
                      base: "text-blue-400 hover:bg-blue-500/10",
                      active: "bg-blue-500/20 text-blue-400 border-blue-500/50",
                    },
                    high: {
                      base: "text-amber-400 hover:bg-amber-500/10",
                      active: "bg-amber-500/20 text-amber-400 border-amber-500/50",
                    },
                    urgent: {
                      base: "text-red-400 hover:bg-red-500/10",
                      active: "bg-red-500/20 text-red-400 border-red-500/50",
                    },
                  };
                  const { base, active } = colorClasses[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField("priority", value)}
                      className={[
                        "flex-1 px-3 py-2 text-sm font-medium transition-colors focus:outline-none",
                        idx !== arr.length - 1 ? "border-r border-border" : "",
                        isActive ? active : `bg-background ${base}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Section 5: Link to KPI ── */}
          {filteredKpis.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Link to KPI{" "}
                  <span className="normal-case font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </h2>
                <div className="space-y-1.5">
                  <Label htmlFor="kpi_id">KPI</Label>
                  <Select
                    value={form.kpi_id}
                    onValueChange={(v) => setField("kpi_id", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger id="kpi_id" className="w-full">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {filteredKpis.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.title}
                          {k.period ? ` — ${k.period}` : ""}
                          {k.target_value != null
                            ? ` target: ${k.target_value}${k.unit ? ` ${k.unit}` : ""}`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* ── Section 6: Warning ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Warning
            </h2>

            {/* Toggle row */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              {/* Switch-style toggle */}
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.has_warning}
                  onChange={(e) => setField("has_warning", e.target.checked)}
                />
                <div
                  onClick={() => setField("has_warning", !form.has_warning)}
                  className={[
                    "w-10 h-5 rounded-full transition-colors cursor-pointer",
                    form.has_warning ? "bg-amber-500" : "bg-muted",
                  ].join(" ")}
                />
                <div
                  onClick={() => setField("has_warning", !form.has_warning)}
                  className={[
                    "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform cursor-pointer",
                    form.has_warning ? "translate-x-5" : "translate-x-0",
                  ].join(" ")}
                />
              </div>
              <span className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle
                  className={[
                    "h-4 w-4 transition-colors",
                    form.has_warning ? "text-amber-400" : "text-muted-foreground",
                  ].join(" ")}
                />
                Add Warning
              </span>
            </label>

            {/* Warning message textarea */}
            {form.has_warning && (
              <div className="space-y-1.5 border border-amber-500/30 bg-amber-500/5 rounded-lg p-3">
                <Label htmlFor="warning_message" className="text-amber-400 text-xs font-semibold">
                  Warning Message
                </Label>
                <Textarea
                  id="warning_message"
                  placeholder="Describe what the employee should be aware of…"
                  value={form.warning_message}
                  onChange={(e) => setField("warning_message", e.target.value)}
                  rows={3}
                  className="resize-none bg-background border-amber-500/30 focus-visible:ring-amber-500/50"
                />
              </div>
            )}
          </div>

          <Separator />

          {/* ── Submit ── */}
          <Button
            className="w-full"
            size="lg"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Assigning…" : "Assign Task →"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
