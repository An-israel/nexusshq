import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Star, CheckCircle2, Plus, Sparkles } from "lucide-react";
import { timeAgo } from "@/lib/nexus";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/$workspaceSlug/reviews")({
  component: ReviewsPage,
});

type Rating = "exceeds" | "meets" | "needs_improvement" | "unsatisfactory";

interface ReviewRow {
  id: string;
  user_id: string;
  reviewer_id: string | null;
  period_start: string;
  period_end: string;
  overall_rating: Rating;
  productivity_score: number;
  quality_score: number;
  attendance_score: number;
  collaboration_score: number;
  strengths: string | null;
  areas_to_improve: string | null;
  manager_notes: string | null;
  employee_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

const RATING_LABEL: Record<Rating, string> = {
  exceeds: "Exceeds expectations",
  meets: "Meets expectations",
  needs_improvement: "Needs improvement",
  unsatisfactory: "Unsatisfactory",
};

const RATING_STYLE: Record<Rating, string> = {
  exceeds: "bg-success/15 text-success border-success/30",
  meets: "bg-primary/15 text-primary border-primary/30",
  needs_improvement: "bg-warning/15 text-warning border-warning/30",
  unsatisfactory: "bg-destructive/15 text-destructive border-destructive/30",
};

function ReviewsPage() {
  const { user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  // AI Insights state
  const [insightReview, setInsightReview] = React.useState<ReviewRow | null>(null);
  const [insightText, setInsightText] = React.useState("");
  const [insightLoading, setInsightLoading] = React.useState(false);

  async function fetchInsights(r: ReviewRow) {
    setInsightReview(r);
    setInsightText("");
    setInsightLoading(true);
    const subj = profiles[r.user_id];
    try {
      const { data: { session: _session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(_session?.access_token ? { Authorization: `Bearer ${_session.access_token}` } : {}),
        },
        body: JSON.stringify({
          action: "performance-insights",
          context: {
            name: subj?.full_name ?? subj?.email ?? "Employee",
            scores: {
              productivity: r.productivity_score,
              quality: r.quality_score,
              attendance: r.attendance_score,
              collaboration: r.collaboration_score,
            },
            strengths: r.strengths ?? "",
            improvements: r.areas_to_improve ?? "",
          },
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as { result?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setInsightText(data.result ?? "");
    } catch (err) {
      toast.error(`AI insights failed: ${(err as Error).message}`);
      setInsightReview(null);
    } finally {
      setInsightLoading(false);
    }
  }

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from("performance_reviews")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("period_end", { ascending: false });
    if (!isManager) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as ReviewRow[];
    setReviews(rows);
    const ids = Array.from(
      new Set([
        ...rows.map((r) => r.user_id),
        ...rows.map((r) => r.reviewer_id).filter((x): x is string => !!x),
      ]),
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
      setProfiles(map);
    }
    setLoading(false);
  }, [user, isManager]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(id: string) {
    const { error } = await supabase
      .from("performance_reviews")
      .update({ employee_acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", workspace.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Review acknowledged");
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Reviews</h1>
          <p className="text-sm text-muted-foreground">
            {isManager ? "Track and create reviews for the team." : "Your performance history."}
          </p>
        </div>
        {isManager && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Review
              </Button>
            </DialogTrigger>
            <CreateReviewDialog
              workspaceId={workspace.id}
              onCreated={() => {
                setCreateOpen(false);
                void load();
              }}
            />
          </Dialog>
        )}
      </div>

      {/* AI Insights Sheet */}
      <Sheet open={!!insightReview} onOpenChange={(o) => !o && setInsightReview(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Performance Insights
            </SheetTitle>
          </SheetHeader>
          {insightReview && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-muted-foreground">
                Analysis for{" "}
                <span className="font-medium text-foreground">
                  {profiles[insightReview.user_id]?.full_name ??
                    profiles[insightReview.user_id]?.email ??
                    "Employee"}
                </span>{" "}
                · period {insightReview.period_start} → {insightReview.period_end}
              </p>
              {insightLoading ? (
                <div className="space-y-2 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full rounded" />
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{insightText}</p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-8 w-12 rounded" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-[88px] md:h-10 w-full rounded-xl md:rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Star className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No performance reviews yet.</p>
          {isManager && (
            <p className="text-xs text-muted-foreground">
              Create the first review using the button above.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {reviews.map((r) => {
            const subj = profiles[r.user_id];
            const reviewer = r.reviewer_id ? profiles[r.reviewer_id] : null;
            const avg = Math.round(
              (r.productivity_score +
                r.quality_score +
                r.attendance_score +
                r.collaboration_score) /
                4,
            );
            return (
              <Card key={r.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-warning" />
                      <h3 className="font-semibold">
                        {r.period_start} → {r.period_end}
                      </h3>
                      <span
                        className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${RATING_STYLE[r.overall_rating]}`}
                      >
                        {RATING_LABEL[r.overall_rating]}
                      </span>
                    </div>
                    {isManager && subj && (
                      <p className="text-xs text-muted-foreground mt-1">
                        For: <span className="text-foreground">{subj.full_name ?? subj.email}</span>
                        {reviewer && <> · By: {reviewer.full_name ?? reviewer.email}</>}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums">{avg}</div>
                    <p className="text-xs text-muted-foreground">avg score</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <ScoreDisplay label="Productivity" value={r.productivity_score} />
                  <ScoreDisplay label="Quality" value={r.quality_score} />
                  <ScoreDisplay label="Attendance" value={r.attendance_score} />
                  <ScoreDisplay label="Collaboration" value={r.collaboration_score} />
                </div>

                {(r.strengths || r.areas_to_improve || r.manager_notes) && (
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    {r.strengths && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Strengths</p>
                        <p className="whitespace-pre-wrap">{r.strengths}</p>
                      </div>
                    )}
                    {r.areas_to_improve && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Areas to improve</p>
                        <p className="whitespace-pre-wrap">{r.areas_to_improve}</p>
                      </div>
                    )}
                    {r.manager_notes && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Manager notes</p>
                        <p className="whitespace-pre-wrap">{r.manager_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
                  <div className="flex items-center gap-2">
                    {isManager && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => fetchInsights(r)}
                      >
                        <Sparkles className="h-3 w-3" />
                        AI Insights
                      </Button>
                    )}
                    {r.user_id === user?.id ? (
                      r.employee_acknowledged ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" /> Acknowledged
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => acknowledge(r.id)}>
                          Acknowledge
                        </Button>
                      )
                    ) : r.employee_acknowledged ? (
                      <span className="text-success">Acknowledged</span>
                    ) : (
                      <span className="text-muted-foreground">Pending acknowledgement</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreDisplay({
  label,
  value,
  color = "hsl(var(--primary))",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Mobile: SVG ring */}
      <div className="md:hidden flex flex-col items-center gap-1">
        <svg width="88" height="88" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
          />
          <text
            x="44"
            y="44"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="700"
            fill="currentColor"
          >
            {value}
          </text>
        </svg>
        <span className="text-[11px] text-muted-foreground text-center leading-tight">{label}</span>
      </div>
      {/* Desktop: bar */}
      <div className="hidden md:block w-full">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span className="tabular-nums font-medium">{value}</span>
        </div>
        <div className="h-1.5 rounded bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}

function CreateReviewDialog({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const monthStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  })();
  const monthEnd = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  })();

  const [form, setForm] = React.useState({
    user_id: "",
    period_start: monthStart,
    period_end: monthEnd,
    overall_rating: "meets" as Rating,
    productivity_score: 70,
    quality_score: 70,
    attendance_score: 80,
    collaboration_score: 70,
    strengths: "",
    areas_to_improve: "",
    manager_notes: "",
  });

  React.useEffect(() => {
    void supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, []);

  async function submit() {
    if (!form.user_id) {
      toast.error("Pick an employee");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("performance_reviews")
      .insert({
        ...form,
        reviewer_id: user?.id ?? null,
        strengths: form.strengths.trim() || null,
        areas_to_improve: form.areas_to_improve.trim() || null,
        manager_notes: form.manager_notes.trim() || null,
        workspace_id: workspaceId,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: form.user_id,
      type: "flag",
      title: "⭐ New performance review",
      message: `Review for ${form.period_start} → ${form.period_end} is ready.`,
      related_task_id: data.id,
      workspace_id: workspaceId,
    });
    toast.success("Review created");
    setSubmitting(false);
    onCreated();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Performance Review</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Employee</Label>
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Pick employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name ?? e.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Overall rating</Label>
            <Select
              value={form.overall_rating}
              onValueChange={(v) => setForm({ ...form, overall_rating: v as Rating })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exceeds">Exceeds</SelectItem>
                <SelectItem value="meets">Meets</SelectItem>
                <SelectItem value="needs_improvement">Needs improvement</SelectItem>
                <SelectItem value="unsatisfactory">Unsatisfactory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Period start</Label>
            <Input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              className="text-base md:text-sm"
            />
          </div>
          <div>
            <Label>Period end</Label>
            <Input
              type="date"
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
              className="text-base md:text-sm"
            />
          </div>
        </div>

        {(
          [
            "productivity_score",
            "quality_score",
            "attendance_score",
            "collaboration_score",
          ] as const
        ).map((k) => (
          <div key={k}>
            <div className="flex items-center justify-between mb-1">
              <Label className="capitalize">{k.replace("_score", "").replace("_", " ")}</Label>
              <span className="text-sm tabular-nums">{form[k]}</span>
            </div>
            <Slider
              value={[form[k]]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setForm({ ...form, [k]: v[0] ?? 0 })}
            />
          </div>
        ))}

        <div>
          <Label>Strengths</Label>
          <Textarea
            rows={2}
            value={form.strengths}
            onChange={(e) => setForm({ ...form, strengths: e.target.value })}
            className="text-base md:text-sm"
          />
        </div>
        <div>
          <Label>Areas to improve</Label>
          <Textarea
            rows={2}
            value={form.areas_to_improve}
            onChange={(e) => setForm({ ...form, areas_to_improve: e.target.value })}
            className="text-base md:text-sm"
          />
        </div>
        <div>
          <Label>Manager notes</Label>
          <Textarea
            rows={2}
            value={form.manager_notes}
            onChange={(e) => setForm({ ...form, manager_notes: e.target.value })}
            className="text-base md:text-sm"
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : "Create Review"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
