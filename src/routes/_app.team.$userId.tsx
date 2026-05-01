import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAnyRole } from "@/lib/role-access";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  PRIORITY_BADGE,
  STATUS_BADGE,
  deptLabel,
  initialsOf,
  timeAgo,
} from "@/lib/nexus";
import { QuickAssignTaskDialog } from "@/components/team/QuickAssignTaskDialog";
import { FlagEmployeeDialog } from "@/components/team/FlagEmployeeDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { setEmployeeActiveFn, resolveFlagFn } from "@/server/admin.functions";
import { reopenFlagFn } from "@/server/tasks.functions";
import { useRealtime } from "@/lib/use-realtime";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Flag = Database["public"]["Tables"]["flags"]["Row"];
type Update = Database["public"]["Tables"]["task_updates"]["Row"];
type Kpi = Database["public"]["Tables"]["kpis"]["Row"];
type Att = Database["public"]["Tables"]["attendance"]["Row"];

export const Route = createFileRoute("/_app/team/$userId")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: EmployeeDetailPage,
});

function EmployeeDetailPage() {
  const { userId } = Route.useParams();
  const { isAdmin } = useAuth();
  const setActive = useServerFn(setEmployeeActiveFn);
  const resolveFlag = useServerFn(resolveFlagFn);
  const reopenFlag = useServerFn(reopenFlagFn);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [togglingActive, setTogglingActive] = useState(false);
  // Warning history filtering & pagination
  const [warningFrom, setWarningFrom] = useState<string>("");
  const [warningTo, setWarningTo] = useState<string>("");
  const [warningStatusFilter, setWarningStatusFilter] = useState<"all" | "active" | "resolved">("all");
  const [warningPage, setWarningPage] = useState(0);
  const WARNING_PAGE_SIZE = 5;
  // Confirm-resolve dialog state
  const [confirmFlag, setConfirmFlag] = useState<Flag | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      const p = prof as Profile | null;
      if (!cancelled) setProfile(p);

      const [tasksRes, flagsRes, attRes, kpisRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("assigned_to", userId).order("due_date", { ascending: false }),
        supabase.from("flags").select("*").eq("flagged_user_id", userId).order("created_at", { ascending: false }),
        supabase.from("attendance").select("*").eq("user_id", userId).gte("date", monthStartStr),
        p?.department
          ? supabase.from("kpis").select("*").eq("department", p.department as Database["public"]["Enums"]["department_type"])
          : Promise.resolve({ data: [] as Kpi[], error: null }),
      ]);
      const t = (tasksRes.data as Task[]) ?? [];
      if (!cancelled) {
        setTasks(t);
        setFlags((flagsRes.data as Flag[]) ?? []);
        setAtt((attRes.data as Att[]) ?? []);
        setKpis((kpisRes.data as Kpi[]) ?? []);
      }

      // Activity timeline: updates on tasks owned by this user
      if (t.length) {
        const { data: ups } = await supabase
          .from("task_updates")
          .select("*")
          .in("task_id", t.map((x) => x.id))
          .order("created_at", { ascending: false })
          .limit(20);
        if (!cancelled) setUpdates((ups as Update[]) ?? []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  // Realtime: refresh when this employee's tasks or flags change
  useRealtime({
    table: "tasks",
    filter: `assigned_to=eq.${userId}`,
    shouldHandle: (p) => {
      const row = (p.new ?? p.old) as { assigned_to?: string } | null;
      return !row || row.assigned_to === userId;
    },
    onChange: (p) => {
      setReloadKey((k) => k + 1);
      if (p?.eventType === "INSERT") {
        toast.message("New task assigned to this employee");
      } else if (p?.eventType === "UPDATE") {
        toast.message("Task updated");
      }
    },
  });
  useRealtime({
    table: "flags",
    filter: `flagged_user_id=eq.${userId}`,
    shouldHandle: (p) => {
      const row = (p.new ?? p.old) as { flagged_user_id?: string } | null;
      return !row || row.flagged_user_id === userId;
    },
    onChange: (p) => {
      setReloadKey((k) => k + 1);
      if (p?.eventType === "INSERT") {
        toast.warning("A new warning was added");
      }
    },
  });

  async function toggleActive() {
    if (!profile) return;
    const next = !profile.is_active;
    if (!confirm(`${next ? "Reactivate" : "Deactivate"} ${profile.full_name ?? profile.email}?`)) return;
    setTogglingActive(true);
    try {
      await setActive({ data: { userId: profile.id, isActive: next } });
      toast.success(next ? "Account reactivated" : "Account deactivated");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setTogglingActive(false);
    }
  }

  async function performResolveFlag(flag: Flag) {
    try {
      await resolveFlag({ data: { flagId: flag.id } });
      // Show toast with Undo action
      toast.success("Warning marked as resolved", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await reopenFlag({ data: { flagId: flag.id } });
              toast.success("Warning reopened");
              setReloadKey((k) => k + 1);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to undo");
            }
          },
        },
        duration: 6000,
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    }
  }

  const filteredTasks =
    statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  // Warning history: apply filters + pagination
  const filteredWarnings = React.useMemo(() => {
    return flags.filter((f) => {
      if (warningStatusFilter === "active" && f.is_resolved) return false;
      if (warningStatusFilter === "resolved" && !f.is_resolved) return false;
      const created = f.created_at.slice(0, 10);
      if (warningFrom && created < warningFrom) return false;
      if (warningTo && created > warningTo) return false;
      return true;
    });
  }, [flags, warningStatusFilter, warningFrom, warningTo]);

  const warningTotalPages = Math.max(1, Math.ceil(filteredWarnings.length / WARNING_PAGE_SIZE));
  const safePage = Math.min(warningPage, warningTotalPages - 1);
  const pagedWarnings = filteredWarnings.slice(
    safePage * WARNING_PAGE_SIZE,
    safePage * WARNING_PAGE_SIZE + WARNING_PAGE_SIZE,
  );

  function clearWarningFilters() {
    setWarningFrom("");
    setWarningTo("");
    setWarningStatusFilter("all");
    setWarningPage(0);
  }

  const monthPresent = att.filter((a) => a.status === "present" || a.status === "late").length;
  const monthLate = att.filter((a) => a.status === "late").length;
  const monthAbsent = att.filter((a) => a.status === "absent").length;

  return (
    <div className="space-y-6">
      <Link to="/team" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Team
      </Link>

      {loading || !profile ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
              {initialsOf(profile.full_name ?? profile.email)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{profile.full_name ?? "—"}</h1>
              <p className="text-sm text-muted-foreground">{profile.job_title ?? "—"} · {profile.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{deptLabel(profile.department)}</Badge>
                <Badge variant="outline" className={profile.is_active ? "text-success" : "text-destructive"}>
                  {profile.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Attendance · This Month</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold text-success">{monthPresent}</p>
              <p className="text-[10px] text-muted-foreground">Present</p>
            </div>
            <div>
              <p className="text-xl font-bold text-warning">{monthLate}</p>
              <p className="text-[10px] text-muted-foreground">Late</p>
            </div>
            <div>
              <p className="text-xl font-bold text-destructive">{monthAbsent}</p>
              <p className="text-[10px] text-muted-foreground">Absent</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Active Warnings</p>
          {flags.filter((f) => !f.is_resolved).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No active warnings.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {flags.filter((f) => !f.is_resolved).map((f) => (
                <li key={f.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] text-destructive">{f.severity}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(f.created_at)}</span>
                  </div>
                  <p className="mt-1.5">{f.reason}</p>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => handleResolveFlag(f.id)}>
                      Mark resolved
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Warning history */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Warning History ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warnings on record.</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li
                key={f.id}
                className={`rounded-lg border p-3 text-sm ${
                  f.is_resolved ? "border-border bg-background/40" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{f.severity}</Badge>
                    {f.is_resolved ? (
                      <Badge variant="outline" className="text-[10px] text-success">Resolved</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-destructive">Active</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(f.created_at)}</span>
                </div>
                <p className="mt-1.5">{f.reason}</p>
                {f.resolved_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Resolved {timeAgo(f.resolved_at)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tasks */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Assigned Tasks</h2>
          <div className="flex gap-1 rounded-lg border border-border bg-background/40 p-1">
            {["all", "todo", "in_progress", "completed", "overdue"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        {filteredTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No tasks match this filter.
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {new Date(t.due_date).toLocaleDateString()} · {t.progress_percent}%
                  </p>
                </div>
                <Badge variant="outline" className={PRIORITY_BADGE[t.priority] ?? ""}>{t.priority}</Badge>
                <Badge variant="outline" className={STATUS_BADGE[t.status] ?? ""}>{t.status.replace("_", " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* KPI progress for their department */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Department KPIs · {deptLabel(profile?.department)}
        </h2>
        {kpis.length === 0 ? (
          <p className="text-sm text-muted-foreground">No KPIs configured for this department.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {kpis.map((k) => {
              const done = tasks.filter((t) => t.kpi_id === k.id && t.status === "completed").length;
              const target = Number(k.target_value) || 1;
              const pct = Math.min(100, Math.round((done / target) * 100));
              return (
                <div key={k.id} className="rounded-xl border border-border bg-background/40 p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium">{k.title}</p>
                    <span className="text-xs text-muted-foreground">{done}/{target} {k.unit}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Activity timeline */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Activity Timeline</h2>
        {updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => {
              const task = tasks.find((t) => t.id === u.task_id);
              return (
                <li key={u.id} className="flex items-start gap-3 border-l-2 border-primary/30 pl-3">
                  <div className="flex-1">
                    <p className="text-sm">
                      Updated <span className="font-medium">"{task?.title ?? "task"}"</span>
                      {u.new_status ? <> to <span className="text-primary">{u.new_status}</span></> : null}
                      {u.new_progress != null ? <> at {u.new_progress}%</> : null}
                    </p>
                    {u.note && <p className="mt-0.5 text-xs text-muted-foreground">"{u.note}"</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(u.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <QuickAssignTaskDialog
          assigneeId={userId}
          assigneeName={profile?.full_name ?? profile?.email ?? undefined}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
        <FlagEmployeeDialog
          userId={userId}
          userName={profile?.full_name ?? profile?.email ?? undefined}
          onCreated={() => setReloadKey((k) => k + 1)}
        />
        {isAdmin && profile && (
          <Button
            variant="outline"
            onClick={toggleActive}
            disabled={togglingActive}
            className={profile.is_active ? "text-destructive hover:text-destructive" : ""}
          >
            {profile.is_active ? (
              <><UserX className="mr-2 h-4 w-4" /> Deactivate Account</>
            ) : (
              <><UserCheck className="mr-2 h-4 w-4" /> Reactivate Account</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
