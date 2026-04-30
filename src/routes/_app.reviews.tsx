import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { Star, CheckCircle2, Plus } from "lucide-react";
import { timeAgo } from "@/lib/nexus";

export const Route = createFileRoute("/_app/reviews")({
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
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("performance_reviews").select("*").order("period_end", { ascending: false });
    if (!isManager) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as ReviewRow[];
    setReviews(rows);
    const ids = Array.from(new Set([...rows.map((r) => r.user_id), ...rows.map((r) => r.reviewer_id).filter((x): x is string => !!x)]));
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
      .eq("id", id);
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
            <CreateReviewDialog onCreated={() => { setCreateOpen(false); void load(); }} />
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No reviews yet.</Card>
      ) : (
        <div className="grid gap-3">
          {reviews.map((r) => {
            const subj = profiles[r.user_id];
            const reviewer = r.reviewer_id ? profiles[r.reviewer_id] : null;
            const avg = Math.round(
              (r.productivity_score + r.quality_score + r.attendance_score + r.collaboration_score) / 4,
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
                      <span className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${RATING_STYLE[r.overall_rating]}`}>
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
                  <ScoreBar label="Productivity" value={r.productivity_score} />
                  <ScoreBar label="Quality" value={r.quality_score} />
                  <ScoreBar label="Attendance" value={r.attendance_score} />
                  <ScoreBar label="Collaboration" value={r.collaboration_score} />
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <div className="h-1.5 rounded bg-muted overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CreateReviewDialog({ onCreated }: { onCreated: () => void }) {
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
              <SelectTrigger><SelectValue placeholder="Pick employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Overall rating</Label>
            <Select value={form.overall_rating} onValueChange={(v) => setForm({ ...form, overall_rating: v as Rating })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          </div>
          <div>
            <Label>Period end</Label>
            <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </div>
        </div>

        {(["productivity_score", "quality_score", "attendance_score", "collaboration_score"] as const).map((k) => (
          <div key={k}>
            <div className="flex items-center justify-between mb-1">
              <Label className="capitalize">{k.replace("_score", "").replace("_", " ")}</Label>
              <span className="text-sm tabular-nums">{form[k]}</span>
            </div>
            <Slider value={[form[k]]} min={0} max={100} step={5} onValueChange={(v) => setForm({ ...form, [k]: v[0] ?? 0 })} />
          </div>
        ))}

        <div>
          <Label>Strengths</Label>
          <Textarea rows={2} value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
        </div>
        <div>
          <Label>Areas to improve</Label>
          <Textarea rows={2} value={form.areas_to_improve} onChange={(e) => setForm({ ...form, areas_to_improve: e.target.value })} />
        </div>
        <div>
          <Label>Manager notes</Label>
          <Textarea rows={2} value={form.manager_notes} onChange={(e) => setForm({ ...form, manager_notes: e.target.value })} />
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
