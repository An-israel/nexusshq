import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Target,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/okrs")({
  component: OkrsPage,
});

type DeptType = Database["public"]["Enums"]["department_type"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Objective {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  department: string | null;
  period: string;
  status: "on_track" | "at_risk" | "behind" | "completed";
  progress_percent: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  description: string | null;
  owner_id: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  created_at: string;
}

interface KrUpdate {
  id: string;
  key_result_id: string;
  updated_by: string;
  previous_value: number;
  new_value: number;
  note: string | null;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function krProgress(kr: KeyResult): number {
  if (kr.target_value === 0) return 0;
  return Math.min(100, Math.round((kr.current_value / kr.target_value) * 100));
}

function avgProgress(krs: KeyResult[]): number {
  if (krs.length === 0) return 0;
  return Math.round(krs.reduce((s, kr) => s + krProgress(kr), 0) / krs.length);
}

function deriveStatus(progress: number): Objective["status"] {
  if (progress >= 100) return "completed";
  if (progress >= 70) return "on_track";
  if (progress >= 40) return "at_risk";
  return "behind";
}

const STATUS_STYLE: Record<Objective["status"], string> = {
  on_track:  "bg-success/15 text-success border-success/30",
  at_risk:   "bg-warning/15 text-warning border-warning/30",
  behind:    "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-primary/15 text-primary border-primary/30",
};

const STATUS_ICON: Record<Objective["status"], React.ReactNode> = {
  on_track:  <TrendingUp className="h-3 w-3" />,
  at_risk:   <AlertTriangle className="h-3 w-3" />,
  behind:    <XCircle className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
};

const STATUS_LABEL: Record<Objective["status"], string> = {
  on_track:  "On track",
  at_risk:   "At risk",
  behind:    "Behind",
  completed: "Completed",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function OkrsPage() {
  const { user, isManager } = useAuth();
  const [objectives, setObjectives] = React.useState<Objective[]>([]);
  const [keyResults, setKeyResults] = React.useState<KeyResult[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);

  const [objDialogOpen, setObjDialogOpen] = React.useState(false);
  const [editObj, setEditObj] = React.useState<Objective | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data: objs }, { data: krs }] = await Promise.all([
      supabase.from("objectives").select("*").order("created_at", { ascending: false }),
      supabase.from("key_results").select("*").order("created_at"),
    ]);

    const objRows = (objs ?? []) as Objective[];
    const krRows  = (krs  ?? []) as KeyResult[];

    setObjectives(objRows);
    setKeyResults(krRows);

    // Load profiles for owners
    const ids = Array.from(new Set([
      ...objRows.map((o) => o.owner_id),
      ...krRows.map((kr) => kr.owner_id).filter((x): x is string => !!x),
    ]));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as ProfileMini; });
      setProfiles(map);
    }

    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function openNew() { setEditObj(null); setObjDialogOpen(true); }
  function openEdit(o: Objective) { setEditObj(o); setObjDialogOpen(true); }

  async function deleteObj(id: string) {
    const { error } = await supabase.from("objectives").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Objective deleted"); void load(); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals & OKRs</h1>
          <p className="text-sm text-muted-foreground">
            Objectives and key results across the company.
          </p>
        </div>
        {isManager && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> New Objective
          </Button>
        )}
      </div>

      {/* Summary bar */}
      {!loading && objectives.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["on_track", "at_risk", "behind", "completed"] as const).map((s) => {
            const count = objectives.filter((o) => o.status === s).length;
            return (
              <Card key={s} className="p-3">
                <div className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s]}`}>
                  {STATUS_ICON[s]}
                  {STATUS_LABEL[s]}
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums">{count}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Objectives list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : objectives.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No objectives yet.{isManager && ' Click "New Objective" to get started.'}
        </Card>
      ) : (
        <div className="space-y-4">
          {objectives.map((obj) => {
            const krs = keyResults.filter((kr) => kr.objective_id === obj.id);
            return (
              <ObjectiveCard
                key={obj.id}
                objective={obj}
                keyResults={krs}
                profiles={profiles}
                isManager={isManager}
                userId={user?.id ?? ""}
                onEdit={() => openEdit(obj)}
                onDelete={() => deleteObj(obj.id)}
                onRefresh={load}
              />
            );
          })}
        </div>
      )}

      {/* Objective create/edit dialog */}
      <ObjectiveDialog
        open={objDialogOpen}
        onOpenChange={setObjDialogOpen}
        existing={editObj}
        userId={user?.id ?? ""}
        profiles={profiles}
        onSaved={() => { setObjDialogOpen(false); void load(); }}
      />
    </div>
  );
}

// ─── Objective card ───────────────────────────────────────────────────────────

function ObjectiveCard({
  objective,
  keyResults,
  profiles,
  isManager,
  userId,
  onEdit,
  onDelete,
  onRefresh,
}: {
  objective: Objective;
  keyResults: KeyResult[];
  profiles: Record<string, ProfileMini>;
  isManager: boolean;
  userId: string;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [addKrOpen, setAddKrOpen] = React.useState(false);
  const [updateKr, setUpdateKr] = React.useState<KeyResult | null>(null);

  const progress = avgProgress(keyResults);
  const status = keyResults.length > 0 ? deriveStatus(progress) : objective.status;
  const owner = profiles[objective.owner_id];

  // Keep objective progress_percent + status in sync
  React.useEffect(() => {
    if (keyResults.length === 0) return;
    const p = avgProgress(keyResults);
    const s = deriveStatus(p);
    if (p !== objective.progress_percent || s !== objective.status) {
      void supabase
        .from("objectives")
        .update({ progress_percent: p, status: s })
        .eq("id", objective.id);
    }
  }, [keyResults, objective]);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Objective header */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <CollapsibleTrigger className="flex flex-1 items-start gap-3 text-left">
              <div className="mt-0.5 shrink-0 text-muted-foreground">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{objective.title}</h3>
                  <Badge variant="outline" className={`text-xs ${STATUS_STYLE[status]}`}>
                    <span className="mr-1">{STATUS_ICON[status]}</span>
                    {STATUS_LABEL[status]}
                  </Badge>
                  {objective.period && (
                    <Badge variant="outline" className="text-xs">{objective.period}</Badge>
                  )}
                  {objective.department && (
                    <Badge variant="outline" className="text-xs">{deptLabel(objective.department)}</Badge>
                  )}
                </div>
                {objective.description && (
                  <p className="text-sm text-muted-foreground">{objective.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {owner && <span>Owner: {owner.full_name ?? owner.email}</span>}
                  {objective.end_date && <span>Due: {objective.end_date}</span>}
                </div>
              </div>
            </CollapsibleTrigger>

            {/* Progress ring + actions */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">{progress}%</p>
                <p className="text-xs text-muted-foreground">{keyResults.length} key result{keyResults.length !== 1 ? "s" : ""}</p>
              </div>
              {isManager && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                status === "completed" ? "bg-primary" :
                status === "on_track"  ? "bg-success" :
                status === "at_risk"   ? "bg-warning" : "bg-destructive"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Key results */}
        <CollapsibleContent>
          <div className="border-t border-border">
            {keyResults.map((kr, idx) => (
              <KeyResultRow
                key={kr.id}
                kr={kr}
                profiles={profiles}
                isManager={isManager}
                isLast={idx === keyResults.length - 1 && !isManager}
                onUpdate={() => setUpdateKr(kr)}
                onDelete={async () => {
                  await supabase.from("key_results").delete().eq("id", kr.id);
                  onRefresh();
                }}
              />
            ))}

            {isManager && (
              <div className="px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setAddKrOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Add key result
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Add KR dialog */}
      <KeyResultDialog
        open={addKrOpen}
        onOpenChange={setAddKrOpen}
        objectiveId={objective.id}
        profiles={profiles}
        onSaved={() => { setAddKrOpen(false); onRefresh(); }}
      />

      {/* Update KR dialog */}
      {updateKr && (
        <UpdateKrDialog
          kr={updateKr}
          userId={userId}
          open={!!updateKr}
          onOpenChange={(o) => !o && setUpdateKr(null)}
          onSaved={() => { setUpdateKr(null); onRefresh(); }}
        />
      )}
    </Card>
  );
}

// ─── Key result row ───────────────────────────────────────────────────────────

function KeyResultRow({
  kr,
  profiles,
  isManager,
  isLast,
  onUpdate,
  onDelete,
}: {
  kr: KeyResult;
  profiles: Record<string, ProfileMini>;
  isManager: boolean;
  isLast: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const progress = krProgress(kr);
  const owner = kr.owner_id ? profiles[kr.owner_id] : null;

  return (
    <div className={`flex items-center gap-4 px-5 py-3 ${!isLast ? "border-b border-border/60" : ""}`}>
      {/* Tree connector */}
      <div className="flex shrink-0 flex-col items-center self-stretch pt-1">
        <div className="w-px flex-1 bg-border/60" />
        <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="w-px flex-1 bg-transparent" />
      </div>

      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{kr.title}</p>
          {owner && (
            <span className="text-xs text-muted-foreground">
              · {owner.full_name ?? owner.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {kr.current_value}/{kr.target_value} {kr.unit}
          </span>
          <span className="shrink-0 text-xs font-medium tabular-nums">{progress}%</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onUpdate}>
          <TrendingUp className="h-3 w-3" /> Update
        </Button>
        {isManager && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Update KR dialog ─────────────────────────────────────────────────────────

function UpdateKrDialog({
  kr,
  userId,
  open,
  onOpenChange,
  onSaved,
}: {
  kr: KeyResult;
  userId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [newValue, setNewValue] = React.useState(String(kr.current_value));
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const val = parseFloat(newValue);
    if (isNaN(val)) { toast.error("Enter a valid number"); return; }
    setSaving(true);

    const { error: updateErr } = await supabase
      .from("key_results")
      .update({ current_value: val })
      .eq("id", kr.id);

    if (updateErr) { toast.error(updateErr.message); setSaving(false); return; }

    await supabase.from("key_result_updates").insert({
      key_result_id: kr.id,
      updated_by: userId,
      previous_value: kr.current_value,
      new_value: val,
      note: note.trim() || null,
    });

    toast.success("Progress updated");
    setSaving(false);
    onSaved();
  }

  const progress = kr.target_value > 0
    ? Math.min(100, Math.round((parseFloat(newValue) / kr.target_value) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update progress</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{kr.title}</p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Current value <span className="text-muted-foreground">({kr.unit})</span>
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-32"
                min={0}
                max={kr.target_value}
                step="any"
              />
              <span className="text-sm text-muted-foreground">
                / {kr.target_value} {kr.unit}
              </span>
            </div>
          </div>

          {!isNaN(parseFloat(newValue)) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              rows={2}
              placeholder="What changed? Any blockers?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save progress"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Key result create dialog ─────────────────────────────────────────────────

function KeyResultDialog({
  open,
  onOpenChange,
  objectiveId,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  objectiveId: string;
  profiles: Record<string, ProfileMini>;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    owner_id: "",
    target_value: "100",
    current_value: "0",
    unit: "%",
  });
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const { error } = await supabase.from("key_results").insert({
      objective_id: objectiveId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      owner_id: form.owner_id || null,
      target_value: parseFloat(form.target_value) || 100,
      current_value: parseFloat(form.current_value) || 0,
      unit: form.unit.trim() || "%",
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Key result added");
    setSaving(false);
    setForm({ title: "", description: "", owner_id: "", target_value: "100", current_value: "0", unit: "%" });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add key result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Increase monthly revenue to $50k"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Owner <span className="text-muted-foreground">(optional)</span></Label>
            <Select value={form.owner_id} onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {Object.values(profiles).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Start value</Label>
              <Input type="number" value={form.current_value} onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Target</Label>
              <Input type="number" value={form.target_value} onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input placeholder="%, $, users…" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Add key result"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Objective create/edit dialog ─────────────────────────────────────────────

function ObjectiveDialog({
  open,
  onOpenChange,
  existing,
  userId,
  profiles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: Objective | null;
  userId: string;
  profiles: Record<string, ProfileMini>;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = React.useState({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    owner_id: existing?.owner_id ?? userId,
    department: existing?.department ?? "",
    period: existing?.period ?? `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
    start_date: existing?.start_date ?? today,
    end_date: existing?.end_date ?? "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setForm({
        title: existing?.title ?? "",
        description: existing?.description ?? "",
        owner_id: existing?.owner_id ?? userId,
        department: existing?.department ?? "",
        period: existing?.period ?? `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`,
        start_date: existing?.start_date ?? today,
        end_date: existing?.end_date ?? "",
      });
    }
  }, [open, existing, userId, today]);

  async function save() {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      owner_id: form.owner_id || userId,
      department: form.department || null,
      period: form.period.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    const { error } = isEdit
      ? await supabase.from("objectives").update(payload).eq("id", existing!.id)
      : await supabase.from("objectives").insert({ ...payload, status: "on_track", progress_percent: 0 });

    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(isEdit ? "Objective updated" : "Objective created");
    setSaving(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit objective" : "New objective"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Grow revenue by 30% this quarter"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Owner</Label>
              <Select value={form.owner_id} onValueChange={(v) => setForm((f) => ({ ...f, owner_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick owner" /></SelectTrigger>
                <SelectContent>
                  {Object.values(profiles).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department <span className="text-muted-foreground">(optional)</span></Label>
              <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Input placeholder="Q2 2026" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End date <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : isEdit ? "Save changes" : "Create objective"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
