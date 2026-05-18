import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CalendarOff, CheckCircle2, XCircle, Clock, Plus } from "lucide-react";
import { timeAgo } from "@/lib/nexus";
import { sendWhatsAppFn } from "@/lib/notifications.functions";

export const Route = createFileRoute("/_app/$workspaceSlug/leave")({
  component: LeavePage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
  color: string;
  requires_approval: boolean;
}

interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  days_allocated: number;
  days_used: number;
}

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Colour helper ────────────────────────────────────────────────────────────

const COLOR_CLASS: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  purple: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  pink: "bg-pink-500/15 text-pink-600 border-pink-500/30",
  teal: "bg-teal-500/15 text-teal-600 border-teal-500/30",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function workdaysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LeavePage() {
  const { user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const year = new Date().getFullYear();

  const [leaveTypes, setLeaveTypes] = React.useState<LeaveType[]>([]);
  const [balances, setBalances] = React.useState<LeaveBalance[]>([]);
  const [requests, setRequests] = React.useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [requestOpen, setRequestOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: types }, { data: bals }, { data: reqs }] = await Promise.all([
      supabase.from("leave_types").select("*").eq("workspace_id", workspace.id).order("name"),
      supabase.from("leave_balances").select("*").eq("workspace_id", workspace.id).eq("year", year),
      isManager
        ? supabase
            .from("leave_requests")
            .select("*")
            .eq("workspace_id", workspace.id)
            .order("created_at", { ascending: false })
        : supabase
            .from("leave_requests")
            .select("*")
            .eq("workspace_id", workspace.id)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
    ]);

    setLeaveTypes((types ?? []) as LeaveType[]);

    // Only keep balances relevant to current user (or all for manager)
    const myBals = (bals ?? []) as LeaveBalance[];
    setBalances(isManager ? myBals : myBals.filter((b) => b.user_id === user.id));

    const reqRows = (reqs ?? []) as LeaveRequest[];
    setRequests(reqRows);

    // Load profiles for all unique user IDs in requests
    if (isManager && reqRows.length) {
      const ids = Array.from(new Set(reqRows.map((r) => r.user_id)));
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
  }, [user, isManager, year]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Auto-initialise balances if none exist for this user this year
  React.useEffect(() => {
    if (!user || loading) return;
    const mine = balances.filter((b) => b.user_id === user.id);
    if (mine.length === 0 && leaveTypes.length > 0) {
      void supabase
        .rpc("init_leave_balances", {
          p_user_id: user.id,
          p_year: year,
        })
        .then(() => void load());
    }
  }, [user, loading, balances, leaveTypes, year, load]);

  const myBalances = balances.filter((b) => b.user_id === user?.id);
  const typeMap = Object.fromEntries(leaveTypes.map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave & Time Off</h1>
          <p className="text-sm text-muted-foreground">
            {isManager ? "Manage team leave requests." : "Request and track your time off."}
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </div>

      {/* My balance cards */}
      {!loading && myBalances.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {myBalances.map((bal) => {
            const type = typeMap[bal.leave_type_id];
            if (!type) return null;
            const remaining = bal.days_allocated - bal.days_used;
            const pct = Math.min(100, (bal.days_used / Math.max(1, bal.days_allocated)) * 100);
            return (
              <Card key={bal.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{type.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${COLOR_CLASS[type.color] ?? ""}`}
                  >
                    {type.color}
                  </Badge>
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">
                    {remaining}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{bal.days_allocated} days
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">remaining</p>
                </div>
                <div className="h-1.5 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {/* Requests table */}
      <Tabs defaultValue={isManager ? "pending" : "mine"}>
        <TabsList>
          {isManager ? (
            <>
              <TabsTrigger value="pending">
                Pending
                {requests.filter((r) => r.status === "pending").length > 0 && (
                  <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                    {requests.filter((r) => r.status === "pending").length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All requests</TabsTrigger>
            </>
          ) : (
            <TabsTrigger value="mine">My requests</TabsTrigger>
          )}
        </TabsList>

        {isManager && (
          <TabsContent value="pending" className="mt-4 space-y-3">
            <RequestList
              requests={requests.filter((r) => r.status === "pending")}
              typeMap={typeMap}
              profiles={profiles}
              showEmployee
              workspaceId={workspace.id}
              onReview={load}
            />
          </TabsContent>
        )}

        <TabsContent value={isManager ? "all" : "mine"} className="mt-4 space-y-3">
          <RequestList
            requests={isManager ? requests : requests.filter((r) => r.user_id === user?.id)}
            typeMap={typeMap}
            profiles={isManager ? profiles : {}}
            showEmployee={isManager}
            workspaceId={workspace.id}
            onReview={load}
          />
        </TabsContent>
      </Tabs>

      {/* Request leave dialog */}
      <RequestLeaveDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        leaveTypes={leaveTypes}
        balances={myBalances}
        userId={user?.id ?? ""}
        workspaceId={workspace.id}
        onCreated={() => {
          setRequestOpen(false);
          void load();
        }}
      />
    </div>
  );
}

// ─── Request list ─────────────────────────────────────────────────────────────

function RequestList({
  requests,
  typeMap,
  profiles,
  showEmployee,
  workspaceId,
  onReview,
}: {
  requests: LeaveRequest[];
  typeMap: Record<string, LeaveType>;
  profiles: Record<string, ProfileMini>;
  showEmployee: boolean;
  workspaceId: string;
  onReview: () => void;
}) {
  const { user, isManager } = useAuth();
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [action, setAction] = React.useState<"approved" | "rejected">("approved");
  const [saving, setSaving] = React.useState(false);

  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No leave requests to show.
      </Card>
    );
  }

  async function submitReview() {
    if (!reviewId) return;
    setSaving(true);
    const req = requests.find((r) => r.id === reviewId);

    const { error } = await supabase
      .from("leave_requests")
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        reviewer_note: note.trim() || null,
      })
      .eq("id", reviewId);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Send WhatsApp notification (fire and forget — don't await in UI)
    if (req) {
      if (action === "approved") {
        void sendWhatsAppFn({
          data: {
            userId: req.user_id,
            message: `Hi, your leave request (${req.start_date} to ${req.end_date}) has been approved. — NexusHQ`,
          },
        }).catch(() => {});
      } else {
        void sendWhatsAppFn({
          data: {
            userId: req.user_id,
            message: `Hi, your leave request (${req.start_date} to ${req.end_date}) has been declined. Please contact your manager for details. — NexusHQ`,
          },
        }).catch(() => {});
      }
    }

    // Update balance if approved
    if (action === "approved" && req) {
      const yr = new Date(req.start_date).getFullYear();
      await supabase.rpc("init_leave_balances", { p_user_id: req.user_id, p_year: yr });
      await supabase
        .from("leave_balances")
        .update({ days_used: supabase.rpc as never }) // done via direct update below
        .eq("workspace_id", workspaceId)
        .eq("user_id", req.user_id)
        .eq("leave_type_id", req.leave_type_id)
        .eq("year", yr);

      // Increment days_used directly
      const { data: bal } = await supabase
        .from("leave_balances")
        .select("days_used")
        .eq("workspace_id", workspaceId)
        .eq("user_id", req.user_id)
        .eq("leave_type_id", req.leave_type_id)
        .eq("year", yr)
        .single();

      if (bal) {
        await supabase
          .from("leave_balances")
          .update({ days_used: (bal.days_used as number) + req.days_requested })
          .eq("workspace_id", workspaceId)
          .eq("user_id", req.user_id)
          .eq("leave_type_id", req.leave_type_id)
          .eq("year", yr);
      }

      // Notify employee
      await supabase.from("notifications").insert({
        workspace_id: workspaceId,
        user_id: req.user_id,
        type: action === "approved" ? "info" : "warning",
        title: `Leave request ${action}`,
        message: `Your ${typeMap[req.leave_type_id]?.name} from ${req.start_date} to ${req.end_date} was ${action}.${note.trim() ? ` Note: ${note.trim()}` : ""}`,
      });
    }

    toast.success(`Request ${action}`);
    setSaving(false);
    setReviewId(null);
    setNote("");
    onReview();
  }

  return (
    <>
      <div className="space-y-3">
        {requests.map((r) => {
          const type = typeMap[r.leave_type_id];
          const person = profiles[r.user_id];
          return (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {type && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${COLOR_CLASS[type.color] ?? ""}`}
                      >
                        {type.name}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-xs ${STATUS_STYLE[r.status]}`}>
                      {r.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                      {r.status === "approved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {r.status === "rejected" && <XCircle className="mr-1 h-3 w-3" />}
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.days_requested} day{r.days_requested !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {showEmployee && person && (
                    <p className="text-sm font-medium">{person.full_name ?? person.email}</p>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {r.start_date} → {r.end_date}
                  </p>

                  {r.reason && <p className="text-xs text-muted-foreground italic">"{r.reason}"</p>}
                  {r.reviewer_note && (
                    <p className="text-xs text-muted-foreground">Manager note: {r.reviewer_note}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                  {isManager && r.status === "pending" && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-success border-success/40 hover:bg-success/10"
                        onClick={() => {
                          setAction("approved");
                          setReviewId(r.id);
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                        onClick={() => {
                          setAction("rejected");
                          setReviewId(r.id);
                        }}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Review confirm dialog */}
      <Dialog open={!!reviewId} onOpenChange={(o) => !o && setReviewId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{action} leave request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Optional note to send to the employee:</p>
            <Textarea
              rows={3}
              placeholder="e.g. Enjoy your time off! / Please reschedule to next month."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewId(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={saving}
              className={action === "rejected" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {saving ? "Saving…" : `Confirm ${action}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Request leave dialog ─────────────────────────────────────────────────────

function RequestLeaveDialog({
  open,
  onOpenChange,
  leaveTypes,
  balances,
  userId,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leaveTypes: LeaveType[];
  balances: LeaveBalance[];
  userId: string;
  workspaceId: string;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = React.useState({
    leave_type_id: "",
    start_date: today,
    end_date: today,
    reason: "",
  });
  const [submitting, setSubmitting] = React.useState(false);

  const days = React.useMemo(
    () => workdaysBetween(form.start_date, form.end_date),
    [form.start_date, form.end_date],
  );

  const selectedType = leaveTypes.find((t) => t.id === form.leave_type_id);
  const balance = balances.find((b) => b.leave_type_id === form.leave_type_id);
  const remaining = balance ? balance.days_allocated - balance.days_used : null;

  async function submit() {
    if (!form.leave_type_id) {
      toast.error("Pick a leave type");
      return;
    }
    if (days <= 0) {
      toast.error("End date must be after start date");
      return;
    }
    if (remaining !== null && days > remaining) {
      toast.error(`You only have ${remaining} days remaining for this leave type`);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      workspace_id: workspaceId,
      user_id: userId,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date: form.end_date,
      days_requested: days,
      reason: form.reason.trim() || null,
      status: selectedType?.requires_approval ? "pending" : "approved",
    });

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Notify managers
    const { data: managers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    if (managers?.length) {
      await supabase.from("notifications").insert(
        managers.map((m) => ({
          workspace_id: workspaceId,
          user_id: m.user_id,
          type: "info" as const,
          title: `Leave request: ${selectedType?.name ?? "Leave"}`,
          message: `${form.start_date} → ${form.end_date} (${days} day${days !== 1 ? "s" : ""})`,
        })),
      );
    }

    toast.success(
      selectedType?.requires_approval
        ? "Request submitted — awaiting approval"
        : "Leave recorded (no approval needed)",
    );
    setSubmitting(false);
    setForm({ leave_type_id: "", start_date: today, end_date: today, reason: "" });
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            Request Time Off
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave type</Label>
            <Select
              value={form.leave_type_id}
              onValueChange={(v) => setForm((f) => ({ ...f, leave_type_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => {
                  const bal = balances.find((b) => b.leave_type_id === t.id);
                  const rem = bal ? bal.days_allocated - bal.days_used : t.days_per_year;
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      <span className="ml-2 text-xs text-muted-foreground">({rem} days left)</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedType && !selectedType.requires_approval && (
              <p className="text-xs text-muted-foreground">
                This leave type does not require approval.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input
                type="date"
                min={today}
                value={form.start_date}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    start_date: e.target.value,
                    end_date: e.target.value > f.end_date ? e.target.value : f.end_date,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>End date</Label>
              <Input
                type="date"
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>

          {days > 0 && (
            <p className="text-sm text-muted-foreground">
              That's{" "}
              <strong>
                {days} working day{days !== 1 ? "s" : ""}
              </strong>
              .
              {remaining !== null && (
                <span className={days > remaining ? " text-destructive" : ""}>
                  {" "}
                  You have {remaining} remaining.
                </span>
              )}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              rows={2}
              placeholder="Family event, medical appointment…"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || days <= 0}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
