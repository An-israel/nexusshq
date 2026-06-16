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
import { todayISO, initialsOf, escapeHtml } from "@/lib/nexus";
import { ArrowLeft, AlertTriangle, X } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/tasks_/assign")({
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
type Recurrence = "daily" | "weekly";
type Priority = "low" | "medium" | "high" | "urgent";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface FormState {
  assigned_to: string[]; // array of user IDs
  title: string;
  description: string;
  is_recurring: boolean;
  recurrence: Recurrence;
  day_of_week: string;
  due_date: string;
  due_time: string;
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
  const [memberSearch, setMemberSearch] = React.useState("");

  const [form, setForm] = React.useState<FormState>({
    assigned_to: [],
    title: "",
    description: "",
    is_recurring: false,
    recurrence: "weekly",
    day_of_week: "0",
    due_date: todayISO(),
    due_time: "",
    priority: "medium",
    kpi_id: "",
    has_warning: false,
    warning_message: "",
  });

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const [membersResult, kpisResult] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("user_id, role")
          .eq("workspace_id", workspace.id)
          .eq("is_active", true),
        supabase
          .from("kpis")
          .select("id, title, department, target_value, unit, period")
          .eq("workspace_id", workspace.id),
      ]);

      if (membersResult.data && membersResult.data.length > 0) {
        const userIds = membersResult.data.map((m) => m.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email, department, job_title")
          .in("id", userIds);
        const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
        const mapped: MemberRow[] = membersResult.data.flatMap((m) => {
          const p = profileMap.get(m.user_id);
          if (!p) return [];
          return [
            {
              id: p.id,
              full_name: p.full_name,
              email: p.email,
              department: p.department,
              job_title: p.job_title,
              role: m.role,
            },
          ];
        });
        setMembers(mapped);
      }

      if (kpisResult.data) setKpis(kpisResult.data as KpiRow[]);
      setLoading(false);
    }
    void load();
  }, [workspace.id]);

  const selectedMembers = members.filter((m) => form.assigned_to.includes(m.id));

  // Filter KPIs by department when all assignees share one department
  const assigneeDepts = Array.from(new Set(selectedMembers.map((m) => m.department).filter(Boolean)));
  const filteredKpis =
    assigneeDepts.length === 1
      ? kpis.filter((k) => k.department === assigneeDepts[0] || !k.department)
      : kpis;

  const visibleMembers = memberSearch.trim()
    ? members.filter((m) =>
        `${m.full_name ?? ""} ${m.email ?? ""} ${m.department ?? ""}`.toLowerCase()
          .includes(memberSearch.toLowerCase()),
      )
    : members;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleAssignee(id: string) {
    setForm((prev) => ({
      ...prev,
      assigned_to: prev.assigned_to.includes(id)
        ? prev.assigned_to.filter((x) => x !== id)
        : [...prev.assigned_to, id],
      kpi_id: "",
    }));
  }

  async function submit() {
    if (form.assigned_to.length === 0) {
      toast.error("Select at least one employee");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);

    const taskType: TaskType = form.is_recurring ? form.recurrence : "one_time";
    const primaryAssignee = form.assigned_to[0]!;

    if (form.is_recurring) {
      const { error: templateError } = await supabase.from("recurring_tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: primaryAssignee,
        created_by: user?.id ?? null,
        priority: form.priority,
        recurrence: form.recurrence,
        day_of_week: form.recurrence === "weekly" ? parseInt(form.day_of_week, 10) : null,
        due_time: form.due_time || null,
        last_generated_date: form.due_date,
        workspace_id: workspace.id,
      });
      if (templateError) {
        toast.error(templateError.message);
        setSubmitting(false);
        return;
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: primaryAssignee,
        assigned_by: user?.id ?? null,
        priority: form.priority,
        task_type: taskType,
        due_date: form.due_date,
        due_time: form.due_time || null,
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

    // Insert all assignees into task_assignees junction table
    const { error: assigneesError } = await supabase.from("task_assignees").insert(
      form.assigned_to.map((uid) => ({
        task_id: task.id,
        user_id: uid,
        assigned_by: user?.id ?? null,
        workspace_id: workspace.id,
      })),
    );
    if (assigneesError) {
      toast.error(assigneesError.message);
      setSubmitting(false);
      return;
    }

    const taskTitle = form.title.trim();
    const dueDateObj = new Date(`${form.due_date}T${form.due_time || "00:00"}:00`);
    const dueDateFormatted = dueDateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const dueFormatted = form.due_time
      ? `${dueDateFormatted} at ${dueDateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : dueDateFormatted;

    const priorityColor: Record<Priority, string> = {
      low: "#6b7280",
      medium: "#3b82f6",
      high: "#f59e0b",
      urgent: "#ef4444",
    };

    const warningSection =
      form.has_warning && form.warning_message
        ? `<div style="border-left:4px solid #f59e0b;background:#fef3c7;padding:12px 16px;margin:16px 0;border-radius:4px;">
            <strong style="color:#92400e;">⚠ Warning:</strong>
            <p style="color:#78350f;margin:4px 0 0;">${escapeHtml(form.warning_message)}</p>
          </div>`
        : "";

    // Notify all assignees
    await Promise.all(
      selectedMembers.map(async (assignee) => {
        await supabase.from("notifications").insert({
          user_id: assignee.id,
          type: "task_assigned",
          title: "📋 New task assigned",
          message: `${taskTitle} — due ${dueFormatted}`,
          related_task_id: task.id,
          workspace_id: workspace.id,
          ...(assignee.email ? { email_sent_at: new Date().toISOString() } : {}),
        });

        if (assignee.email) {
          const html = `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:#111;padding:24px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:20px;">New Task Assigned</h1>
            </div>
            <div style="padding:24px;">
              <p style="color:#374151;margin:0 0 16px;">Hi ${escapeHtml(assignee.full_name ?? "there")},</p>
              <p style="color:#374151;margin:0 0 16px;">A new task has been assigned to you in Nexxos HQ.</p>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:16px;">
                <h2 style="margin:0 0 8px;font-size:18px;color:#111;">${escapeHtml(taskTitle)}</h2>
                ${form.description ? `<p style="color:#6b7280;margin:0 0 12px;">${escapeHtml(form.description)}</p>` : ""}
                <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;">
                  <span style="background:${priorityColor[form.priority]}20;color:${priorityColor[form.priority]};padding:4px 10px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase;">${form.priority}</span>
                  <span style="color:#6b7280;font-size:14px;">📅 Due: ${dueFormatted}</span>
                  <span style="color:#6b7280;font-size:14px;">🔁 ${taskType.replace("_", " ")}</span>
                </div>
              </div>
              ${warningSection}
              <a href="https://app.nexxoshq.io" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View in Nexxos HQ →</a>
            </div>
            <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">You're receiving this because you're a member of your workspace on Nexxos HQ.</div>
          </div>`;
          try {
            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: { to: assignee.email, subject: `New Task Assigned — ${taskTitle}`, html },
            } as never);
          } catch {
            /* non-fatal */
          }
        }
      }),
    );

    toast.success(
      form.is_recurring
        ? "Recurring task created — first occurrence assigned now"
        : form.assigned_to.length > 1
          ? `Task assigned to ${form.assigned_to.length} people`
          : "Task assigned successfully",
    );
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
              Create and assign a task to one or more team members
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          {/* ── Section 1: Assignees ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assignees
            </h2>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full pl-2.5 pr-1.5 py-1"
                  >
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-primary">
                        {initialsOf(m.full_name ?? m.email)}
                      </span>
                    </div>
                    <span className="text-xs font-medium">{m.full_name ?? m.email}</span>
                    <button
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className="h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center ml-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <Input
              placeholder="Search employees…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="h-8 text-sm"
            />

            {/* Checkbox list */}
            <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border/50">
              {visibleMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  No members found
                </p>
              ) : (
                visibleMembers.map((m) => {
                  const checked = form.assigned_to.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssignee(m.id)}
                        className="rounded border-border accent-primary h-4 w-4 shrink-0"
                      />
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {initialsOf(m.full_name ?? m.email)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-none">
                          {m.full_name ?? m.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="capitalize">{m.role}</span>
                          {m.department ? ` · ${m.department}` : ""}
                          {m.job_title ? ` · ${m.job_title}` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {form.assigned_to.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Check one or more team members to assign this task to all of them.
              </p>
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

          {/* ── Section 3: Recurrence ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recurrence
            </h2>
            <div className="flex rounded-md overflow-hidden border border-border">
              {(
                [
                  { value: false, label: "One-time" },
                  { value: true, label: "Recurring" },
                ] as { value: boolean; label: string }[]
              ).map(({ value, label }, idx, arr) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setField("is_recurring", value)}
                  className={[
                    "flex-1 px-4 py-2 text-sm font-medium transition-colors focus:outline-none",
                    idx !== arr.length - 1 ? "border-r border-border" : "",
                    form.is_recurring === value
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

            {form.is_recurring && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Repeats</Label>
                  <Select
                    value={form.recurrence}
                    onValueChange={(v) => setField("recurrence", v as Recurrence)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.recurrence === "weekly" && (
                  <div className="space-y-1.5">
                    <Label>Day of week</Label>
                    <Select
                      value={form.day_of_week}
                      onValueChange={(v) => setField("day_of_week", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((d, idx) => (
                          <SelectItem key={d} value={String(idx)}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {form.is_recurring
                ? "A repeating template will be created and the first occurrence assigned right away."
                : "This task will be assigned once with the deadline below."}
            </p>
          </div>

          <Separator />

          {/* ── Section 4: Schedule & Priority ── */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Schedule &amp; Priority
            </h2>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="due_time">
                  Due Time{" "}
                  <span className="normal-case font-normal text-muted-foreground/60">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="due_time"
                  type="time"
                  value={form.due_time}
                  onChange={(e) => setField("due_time", e.target.value)}
                  className="w-full"
                />
              </div>
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
                    low: { base: "text-muted-foreground hover:bg-muted", active: "bg-muted text-foreground border-border" },
                    medium: { base: "text-blue-400 hover:bg-blue-500/10", active: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
                    high: { base: "text-amber-400 hover:bg-amber-500/10", active: "bg-amber-500/20 text-amber-400 border-amber-500/50" },
                    urgent: { base: "text-red-400 hover:bg-red-500/10", active: "bg-red-500/20 text-red-400 border-red-500/50" },
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
                      ].filter(Boolean).join(" ")}
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
            <label className="flex items-center gap-3 cursor-pointer select-none">
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
          <Button className="w-full" size="lg" disabled={submitting} onClick={() => void submit()}>
            {submitting
              ? "Assigning…"
              : form.assigned_to.length > 1
                ? `Assign Task to ${form.assigned_to.length} People →`
                : "Assign Task →"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
