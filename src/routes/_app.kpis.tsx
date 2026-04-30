import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { requireAnyRole } from "@/lib/role-access";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS, deptLabel, startOfWeekISO } from "@/lib/nexus";
import type { Database } from "@/integrations/supabase/types";

type Kpi = Database["public"]["Tables"]["kpis"]["Row"];
type Department = Database["public"]["Enums"]["department_type"];
type Period = Database["public"]["Enums"]["kpi_period"];

export const Route = createFileRoute("/_app/kpis")({
  beforeLoad: () => requireAnyRole(["admin"]),
  component: KpisPage,
});

interface FormState {
  id?: string;
  department: Department;
  title: string;
  description: string;
  target_value: string;
  unit: string;
  period: Period;
}

const EMPTY_FORM: FormState = {
  department: "marketing",
  title: "",
  description: "",
  target_value: "10",
  unit: "",
  period: "monthly",
};

function KpisPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [progress, setProgress] = useState<Record<string, { done: number; target: number }>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Kpi | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("kpis").select("*").order("department");
    if (error) {
      toast.error("Failed to load KPIs");
      setLoading(false);
      return;
    }
    const list = (data as Kpi[]) ?? [];
    setKpis(list);

    // Team progress per KPI: count completed tasks linked to this KPI in the period
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const counts: Record<string, { done: number; target: number }> = {};
    await Promise.all(
      list.map(async (k) => {
        const { count } = await supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("kpi_id", k.id)
          .eq("status", "completed")
          .gte("due_date", k.period === "weekly" ? startOfWeekISO() : monthStartStr);
        // approximate "team target" = per-employee target * employees in dept
        const { count: empCount } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("department", k.department)
          .eq("is_active", true);
        const teamTarget = Number(k.target_value) * (empCount ?? 1);
        counts[k.id] = { done: count ?? 0, target: teamTarget || 1 };
      }),
    );
    setProgress(counts);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setOpen(true);
  };
  const openEdit = (k: Kpi) => {
    setForm({
      id: k.id,
      department: k.department,
      title: k.title,
      description: k.description ?? "",
      target_value: String(k.target_value),
      unit: k.unit,
      period: k.period,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    const target = Number(form.target_value);
    if (!isFinite(target) || target <= 0) {
      toast.error("Target must be a positive number");
      return;
    }
    setSaving(true);
    const payload = {
      department: form.department,
      title: form.title.trim(),
      description: form.description.trim() || null,
      target_value: target,
      unit: form.unit.trim(),
      period: form.period,
      created_by: user?.id ?? null,
    };
    const { error } = form.id
      ? await supabase.from("kpis").update(payload).eq("id", form.id)
      : await supabase.from("kpis").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? "KPI updated" : "KPI created");
    setOpen(false);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("kpis").delete().eq("id", confirmDelete.id);
    if (error) toast.error(error.message);
    else toast.success("KPI deleted");
    setConfirmDelete(null);
    load();
  };

  const grouped = DEPARTMENTS.map((d) => ({ dept: d, items: kpis.filter((k) => k.department === d) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KPI Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set department targets. Tasks linked to a KPI auto-feed into progress.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Add KPI
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No KPIs yet. Click "Add KPI" to define your first target.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.dept} className="rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">{deptLabel(g.dept)}</h2>
                <Badge variant="outline">{g.items.length} KPI{g.items.length !== 1 ? "s" : ""}</Badge>
              </div>
              <div className="divide-y divide-border">
                {g.items.map((k) => {
                  const pr = progress[k.id] ?? { done: 0, target: 1 };
                  const pct = Math.min(100, Math.round((pr.done / pr.target) * 100));
                  const healthy = pct >= 60;
                  return (
                    <div key={k.id} className="grid grid-cols-12 items-center gap-3 px-5 py-4">
                      <div className="col-span-12 md:col-span-4">
                        <p className="text-sm font-medium">{k.title}</p>
                        {k.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{k.description}</p>
                        )}
                      </div>
                      <div className="col-span-4 md:col-span-2 text-xs">
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-medium">{k.target_value} {k.unit}</p>
                      </div>
                      <div className="col-span-4 md:col-span-2 text-xs">
                        <p className="text-muted-foreground">Period</p>
                        <p className="font-medium capitalize">{k.period}</p>
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Team avg</span>
                          <span className="font-medium">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: healthy
                                ? "linear-gradient(90deg, oklch(0.62 0.19 259), oklch(0.72 0.16 162))"
                                : "linear-gradient(90deg, oklch(0.78 0.16 73), oklch(0.65 0.22 25))",
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-1 flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(k)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(k)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit KPI" : "New KPI"}</DialogTitle>
            <DialogDescription>
              Define a measurable target for a department. Tasks tagged with this KPI count toward it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) => setForm((f) => ({ ...f, department: v as Department }))}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Select
                  value={form.period}
                  onValueChange={(v) => setForm((f) => ({ ...f, period: v as Period }))}
                >
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1.5"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Videos Produced"
                maxLength={120}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                className="mt-1.5"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What counts toward this KPI?"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target value</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="1"
                  value={form.target_value}
                  onChange={(e) => setForm((f) => ({ ...f, target_value: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  className="mt-1.5"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="videos, leads, posts…"
                  maxLength={32}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save KPI"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" will be removed. Tasks previously linked will be unlinked but not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
