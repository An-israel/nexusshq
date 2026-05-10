import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Brain, AlertTriangle, CheckCircle, TrendingDown, Loader2, Users } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/burnout")({
  component: BurnoutPage,
});

type RiskLevel = "high" | "medium" | "low";

interface EmployeeRisk {
  userId: string;
  name: string;
  risk: RiskLevel;
  summary: string;
  signals: string[];
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

const RISK_STYLE: Record<RiskLevel, { bg: string; text: string; border: string; label: string; icon: React.ReactNode }> = {
  high: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "High Risk", icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", label: "Monitor", icon: <TrendingDown className="h-4 w-4" /> },
  low: { bg: "bg-success/10", text: "text-success", border: "border-success/30", label: "Healthy", icon: <CheckCircle className="h-4 w-4" /> },
};

function BurnoutPage() {
  const { isManager } = useAuth();
  const { workspace } = useWorkspace();
  const [results, setResults] = React.useState<EmployeeRisk[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [lastRun, setLastRun] = React.useState<string | null>(null);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Brain className="h-14 w-14 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">This page is for managers only.</p>
      </div>
    );
  }

  async function runAnalysis() {
    setLoading(true);
    setResults([]);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sinceStr = thirtyDaysAgo.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Get all active employees
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      const employees = (profiles ?? []) as ProfileMini[];
      if (!employees.length) { toast.error("No employees found"); setLoading(false); return; }

      // 2. Get attendance for last 30 days
      const { data: attendance } = await supabase
        .from("attendance")
        .select("user_id, date, status, total_minutes")
        .eq("workspace_id", workspace.id)
        .gte("date", sinceStr)
        .lte("date", todayStr);

      // 3. Get tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assigned_to, status, due_date, created_at")
        .eq("workspace_id", workspace.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // 4. Get leave requests
      const { data: leaves } = await supabase
        .from("leave_requests")
        .select("user_id, status, created_at")
        .eq("workspace_id", workspace.id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // 5. Build per-employee stats
      const attByUser: Record<string, { present: number; late: number; absent: number; totalMins: number }> = {};
      for (const a of (attendance ?? [])) {
        if (!attByUser[a.user_id]) attByUser[a.user_id] = { present: 0, late: 0, absent: 0, totalMins: 0 };
        if (a.status === "present") attByUser[a.user_id].present++;
        if (a.status === "late") attByUser[a.user_id].late++;
        if (a.status === "absent") attByUser[a.user_id].absent++;
        attByUser[a.user_id].totalMins += (a.total_minutes as number | null) ?? 0;
      }

      const tasksByUser: Record<string, { total: number; completed: number; overdue: number }> = {};
      const now = new Date();
      for (const t of (tasks ?? [])) {
        const uid = t.assigned_to as string | null;
        if (!uid) continue;
        if (!tasksByUser[uid]) tasksByUser[uid] = { total: 0, completed: 0, overdue: 0 };
        tasksByUser[uid].total++;
        if (t.status === "completed") tasksByUser[uid].completed++;
        if (t.due_date && new Date(t.due_date) < now && t.status !== "completed") tasksByUser[uid].overdue++;
      }

      const leavesByUser: Record<string, number> = {};
      for (const l of (leaves ?? [])) {
        leavesByUser[l.user_id] = (leavesByUser[l.user_id] ?? 0) + 1;
      }

      // 6. Call AI for analysis
      const employeeData = employees.map(e => ({
        id: e.id,
        name: e.full_name ?? e.email ?? "Unknown",
        attendance: attByUser[e.id] ?? { present: 0, late: 0, absent: 0, totalMins: 0 },
        tasks: tasksByUser[e.id] ?? { total: 0, completed: 0, overdue: 0 },
        leaveRequests: leavesByUser[e.id] ?? 0,
      }));

      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "burnout-analysis",
          context: { employees: employeeData, periodDays: 30 },
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json() as { result?: string; error?: string };
      if (data.error) throw new Error(data.error);

      // Parse AI response — expect JSON array
      let parsed: EmployeeRisk[] = [];
      try {
        const raw = data.result ?? "[]";
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as EmployeeRisk[];
      } catch {
        // Fallback: derive from stats if AI response isn't parseable
        parsed = employees.map(e => {
          const att = attByUser[e.id] ?? { present: 0, late: 0, absent: 0 };
          const t = tasksByUser[e.id] ?? { total: 0, completed: 0, overdue: 0 };
          const leaveCnt = leavesByUser[e.id] ?? 0;
          const signals: string[] = [];
          if (att.absent > 4) signals.push(`${att.absent} absences`);
          if (att.late > 6) signals.push(`${att.late} late arrivals`);
          if (t.overdue > 2) signals.push(`${t.overdue} overdue tasks`);
          if (leaveCnt > 2) signals.push(`${leaveCnt} leave requests`);
          const risk: RiskLevel = signals.length >= 3 ? "high" : signals.length >= 1 ? "medium" : "low";
          return {
            userId: e.id,
            name: e.full_name ?? e.email ?? "Unknown",
            risk,
            summary: signals.length ? `${signals.join(", ")} in the last 30 days.` : "No concerning patterns detected.",
            signals,
          };
        });
      }

      setResults(parsed);
      setLastRun(new Date().toLocaleString());
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const highRisk = results.filter(r => r.risk === "high");
  const medRisk = results.filter(r => r.risk === "medium");
  const lowRisk = results.filter(r => r.risk === "low");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Burnout Detection</h1>
          <p className="text-sm text-muted-foreground">
            AI analysis of attendance, tasks and leave to surface at-risk employees.
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
          {loading ? "Analysing…" : "Run Analysis"}
        </Button>
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground">Last run: {lastRun}</p>
      )}

      {/* Summary pills */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "High risk", count: highRisk.length, style: RISK_STYLE.high },
            { label: "Monitor", count: medRisk.length, style: RISK_STYLE.medium },
            { label: "Healthy", count: lowRisk.length, style: RISK_STYLE.low },
          ].map(({ label, count, style }) => (
            <div key={label} className={cn("rounded-xl border p-4 text-center", style.bg, style.border)}>
              <p className={cn("text-2xl font-bold tabular-nums", style.text)}>{count}</p>
              <p className={cn("text-xs font-medium", style.text)}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Users className="h-14 w-14 text-muted-foreground/30" />
          <p className="text-base font-medium text-muted-foreground">No analysis yet</p>
          <p className="text-sm text-muted-foreground">Click "Run Analysis" to scan your team's wellbeing signals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...highRisk, ...medRisk, ...lowRisk].map(r => {
            const style = RISK_STYLE[r.risk];
            return (
              <Card key={r.userId} className={cn("p-5 border", style.border)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.summary}</p>
                    </div>
                  </div>
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0", style.bg, style.text)}>
                    {style.icon}
                    {style.label}
                  </span>
                </div>
                {r.signals.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.signals.map((s, i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{s}</span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
