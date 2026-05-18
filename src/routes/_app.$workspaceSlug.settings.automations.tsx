import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";
import {
  Bell,
  RefreshCw,
  AlertTriangle,
  BarChart2,
  Clock,
  Save,
  ChevronDown,
  Zap,
  ShieldAlert,
  Play,
} from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/settings/automations")({
  component: AutomationsPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationSettings {
  workspace_id: string;
  task_reminders_enabled: boolean;
  auto_status_enabled: boolean;
  overdue_escalation_enabled: boolean;
  scheduled_reports_enabled: boolean;
  clock_reminders_enabled: boolean;
  auto_clockout_enabled: boolean;
  daily_report_time: string;
  weekly_report_day: string;
  report_recipients: string[];
  updated_at: string;
}

interface AutomationLog {
  id: string;
  workspace_id: string;
  automation_type: string;
  triggered_for: string | null;
  details: Record<string, unknown>;
  status: "success" | "failed" | "skipped";
  ran_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultSettings: Omit<AutomationSettings, "workspace_id" | "updated_at"> = {
  task_reminders_enabled: false,
  auto_status_enabled: false,
  overdue_escalation_enabled: false,
  scheduled_reports_enabled: false,
  clock_reminders_enabled: false,
  auto_clockout_enabled: false,
  daily_report_time: "17:30",
  weekly_report_day: "monday",
  report_recipients: [],
};

// ─── Automation definitions ───────────────────────────────────────────────────

interface AutomationDef {
  key: keyof Pick<
    AutomationSettings,
    | "task_reminders_enabled"
    | "auto_status_enabled"
    | "overdue_escalation_enabled"
    | "scheduled_reports_enabled"
    | "clock_reminders_enabled"
  >;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  automationType: string;
}

const AUTOMATIONS: AutomationDef[] = [
  {
    key: "task_reminders_enabled",
    label: "Task Reminders",
    description: "Sends due-today, due-tomorrow, and high-priority 3-day warnings daily at 8 AM.",
    icon: Bell,
    automationType: "task-reminder-engine",
  },
  {
    key: "auto_status_enabled",
    label: "Auto Status Updates",
    description:
      "Marks overdue tasks, auto-completes 100% tasks, and creates daily recurring task instances at midnight.",
    icon: RefreshCw,
    automationType: "auto-status-engine",
  },
  {
    key: "overdue_escalation_enabled",
    label: "Overdue Escalation",
    description:
      "Escalates tasks that are 2+ days overdue to managers, and 3+ days to admins with auto-flagging.",
    icon: AlertTriangle,
    automationType: "overdue-escalation-engine",
  },
  {
    key: "scheduled_reports_enabled",
    label: "Scheduled Reports",
    description:
      "Sends daily summaries at 5:30 PM, weekly reports Monday 7 AM, and monthly reports on the 1st.",
    icon: BarChart2,
    automationType: "scheduled-reports-engine",
  },
  {
    key: "clock_reminders_enabled",
    label: "Clock Reminders & Auto Clock-out",
    description:
      "Reminds employees to clock in at 9:15 AM, marks late at 9:30 AM, and auto clocks out at 4 PM.",
    icon: Clock,
    automationType: "clock-reminder-engine",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lastRunStatus(
  logs: AutomationLog[],
  type: string,
): { status: "success" | "failed" | "skipped" | "never"; log: AutomationLog | null } {
  const relevant = logs.filter((l) => l.automation_type === type);
  if (!relevant.length) return { status: "never", log: null };
  const latest = relevant.reduce((a, b) => (new Date(a.ran_at) > new Date(b.ran_at) ? a : b));
  return { status: latest.status, log: latest };
}

function StatusDot({ status }: { status: "success" | "failed" | "skipped" | "never" }) {
  const cls =
    status === "success"
      ? "bg-green-500"
      : status === "failed"
        ? "bg-destructive"
        : "bg-muted-foreground/40";
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", cls)} />;
}

function statusLabel(status: "success" | "failed" | "skipped" | "never") {
  if (status === "success") return "Last run succeeded";
  if (status === "failed") return "Last run failed";
  if (status === "skipped") return "Last run skipped";
  return "Never run";
}

function logStatusBadge(status: "success" | "failed" | "skipped") {
  if (status === "success")
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-500/30 border">success</Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive" className="border-0">
        failed
      </Badge>
    );
  return (
    <Badge variant="secondary" className="border">
      skipped
    </Badge>
  );
}

// ─── Logs Sheet ───────────────────────────────────────────────────────────────

function LogsSheet({
  open,
  onClose,
  automationLabel,
  automationType,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  automationLabel: string;
  automationType: string;
  workspaceId: string;
}) {
  const [logs, setLogs] = React.useState<AutomationLog[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    void supabase
      .from("automation_logs")
      .select("*, profiles(full_name, email)")
      .eq("workspace_id", workspaceId)
      .eq("automation_type", automationType)
      .order("ran_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setLogs((data ?? []) as AutomationLog[]);
        setLoading(false);
      });
  }, [open, workspaceId, automationType]);

  function detailSummary(log: AutomationLog): string {
    const d = log.details;
    if (!d) return "—";
    if (typeof d.count === "number") return `${d.count} processed`;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
    return "—";
  }

  function forLabel(log: AutomationLog): string {
    if (log.profiles?.full_name) return log.profiles.full_name;
    if (log.profiles?.email) return log.profiles.email;
    if (log.triggered_for) return log.triggered_for;
    return "System";
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{automationLabel} — Logs</SheetTitle>
          <SheetDescription>Last 50 runs for this automation in your workspace.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Zap className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No automations have run yet</p>
            <p className="text-xs text-muted-foreground/70">
              Once this automation runs, logs will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">For</th>
                  <th className="pb-2 pr-3 font-medium">Details</th>
                  <th className="pb-2 font-medium whitespace-nowrap">Ran at</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">{logStatusBadge(log.status)}</td>
                    <td className="py-2 pr-3 max-w-[120px] truncate text-xs">{forLabel(log)}</td>
                    <td className="py-2 pr-3 max-w-[160px] truncate text-xs text-muted-foreground">
                      {detailSummary(log)}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(log.ran_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Automation Card ──────────────────────────────────────────────────────────

function AutomationCard({
  def,
  enabled,
  onToggle,
  toggling,
  recentLogs,
  workspaceId,
  onRun,
}: {
  def: AutomationDef;
  enabled: boolean;
  onToggle: (key: keyof AutomationSettings, value: boolean) => void;
  toggling: boolean;
  recentLogs: AutomationLog[];
  workspaceId: string;
  onRun: (automationType: string, label: string) => Promise<void>;
}) {
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const { status, log } = lastRunStatus(recentLogs, def.automationType);
  const Icon = def.icon;

  async function handleRun() {
    setRunning(true);
    await onRun(def.automationType, def.label);
    setRunning(false);
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">{def.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {def.description}
                </p>
              </div>
              <Switch
                checked={enabled}
                disabled={toggling}
                onCheckedChange={(v) => onToggle(def.key, v)}
                aria-label={`Toggle ${def.label}`}
              />
            </div>

            {/* Status row */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusDot status={status} />
                <span>{statusLabel(status)}</span>
                {log && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{timeAgo(log.ran_at)}</span>
                    {typeof log.details?.count === "number" && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{log.details.count} processed</span>
                      </>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void handleRun()}
                  disabled={running || toggling}
                  title="Manually trigger this automation now"
                >
                  <Play className="mr-1 h-3 w-3" />
                  {running ? "Running…" : "Run Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setLogsOpen(true)}
                >
                  View Logs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <LogsSheet
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        automationLabel={def.label}
        automationType={def.automationType}
        workspaceId={workspaceId}
      />
    </>
  );
}

// ─── Report Settings Card ─────────────────────────────────────────────────────

function ReportSettingsCard({
  settings,
  workspaceId,
  onChange,
}: {
  settings: Partial<AutomationSettings>;
  workspaceId: string;
  onChange: (patch: Partial<AutomationSettings>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [dailyTime, setDailyTime] = React.useState(settings.daily_report_time ?? "17:30");
  const [weeklyDay, setWeeklyDay] = React.useState(settings.weekly_report_day ?? "monday");
  const [saving, setSaving] = React.useState(false);

  // Keep local state in sync if settings prop changes
  React.useEffect(() => {
    setDailyTime(settings.daily_report_time ?? "17:30");
    setWeeklyDay(settings.weekly_report_day ?? "monday");
  }, [settings.daily_report_time, settings.weekly_report_day]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("automation_settings").upsert({
      workspace_id: workspaceId,
      daily_report_time: dailyTime,
      weekly_report_day: weeklyDay,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Report settings saved");
      onChange({ daily_report_time: dailyTime, weekly_report_day: weeklyDay });
    }
    setSaving(false);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BarChart2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Report Settings</p>
                <p className="text-xs text-muted-foreground">
                  Configure daily and weekly report schedules
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                open && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="daily-report-time">Daily report time</Label>
                <Input
                  id="daily-report-time"
                  type="time"
                  className="mt-1 text-base md:text-sm"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  When to send the daily summary report
                </p>
              </div>
              <div>
                <Label htmlFor="weekly-report-day">Weekly report day</Label>
                <Select value={weeklyDay} onValueChange={setWeeklyDay}>
                  <SelectTrigger id="weekly-report-day" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["monday", "tuesday", "wednesday", "thursday", "friday"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Which day to send the weekly summary
                </p>
              </div>
            </div>
            <Button onClick={save} disabled={saving} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AutomationsPage() {
  const { role } = useAuth();
  const { workspace } = useWorkspace();

  const [settings, setSettings] = React.useState<
    Omit<AutomationSettings, "workspace_id" | "updated_at"> & {
      workspace_id?: string;
      updated_at?: string;
    }
  >({ workspace_id: workspace.id, ...defaultSettings });
  const [loading, setLoading] = React.useState(true);
  const [recentLogs, setRecentLogs] = React.useState<AutomationLog[]>([]);
  const [toggling, setToggling] = React.useState<string | null>(null);

  // ── Load settings + recent logs ──────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    const [settingsRes, logsRes] = await Promise.all([
      supabase
        .from("automation_settings")
        .select("*")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      supabase
        .from("automation_logs")
        .select("*, profiles(full_name, email)")
        .eq("workspace_id", workspace.id)
        .order("ran_at", { ascending: false })
        .limit(100),
    ]);

    if (settingsRes.error) toast.error(settingsRes.error.message);
    setSettings(
      settingsRes.data
        ? (settingsRes.data as AutomationSettings)
        : { workspace_id: workspace.id, updated_at: new Date().toISOString(), ...defaultSettings },
    );

    if (logsRes.error) toast.error(logsRes.error.message);
    setRecentLogs((logsRes.data ?? []) as AutomationLog[]);

    setLoading(false);
  }, [workspace.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // ── Run Now handler ──────────────────────────────────────────────────────
  async function runAutomation(automationType: string, label: string) {
    const toastId = toast.loading(`Running ${label}…`);
    const { data, error } = await supabase.functions.invoke(automationType);
    if (error) {
      toast.error(`${label} failed: ${error.message}`, { id: toastId });
    } else {
      const result = data as Record<string, unknown> | null;
      const summary =
        typeof result?.employees_clocked_out === "number"
          ? `${result.employees_clocked_out} employees processed`
          : typeof result?.processed === "number"
            ? `${result.processed} records processed`
            : "Completed successfully";
      toast.success(`${label}: ${summary}`, { id: toastId });
      // Refresh logs to show the new run
      void load();
    }
  }

  // ── Toggle handler ───────────────────────────────────────────────────────
  async function toggle(key: keyof AutomationSettings, value: boolean) {
    setToggling(key);
    // Optimistic update
    setSettings((prev) => ({ ...prev, [key]: value }));

    const patch = { workspace_id: workspace.id, [key]: value };
    const { error } = await supabase
      .from("automation_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(patch as any);

    if (error) {
      toast.error(error.message);
      // Revert on error
      setSettings((prev) => ({ ...prev, [key]: !value }));
    } else {
      toast.success(value ? "Automation enabled" : "Automation disabled");
    }
    setToggling(null);
  }

  // ── Access guard ─────────────────────────────────────────────────────────
  if (role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Only admins can view and configure automations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Automation Engine</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Configure and monitor automated workflows that run without human triggering.
        </p>
      </div>

      {/* Automation toggle cards */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full max-w-sm" />
                    <div className="flex items-center justify-between pt-1">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-7 w-20 rounded-md" />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          : AUTOMATIONS.map((def) => (
              <AutomationCard
                key={def.key}
                def={def}
                enabled={!!(settings as Record<string, unknown>)[def.key]}
                onToggle={toggle}
                toggling={toggling === def.key}
                recentLogs={recentLogs}
                workspaceId={workspace.id}
                onRun={runAutomation}
              />
            ))}
      </div>

      {/* Report Settings collapsible */}
      {!loading && (
        <ReportSettingsCard
          settings={settings}
          workspaceId={workspace.id}
          onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        />
      )}
    </div>
  );
}
