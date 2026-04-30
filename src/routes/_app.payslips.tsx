import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Wallet, Plus, Download } from "lucide-react";

export const Route = createFileRoute("/_app/payslips")({
  component: PayslipsPage,
});

interface PayslipRow {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_pay: number;
  currency: string;
  notes: string | null;
  issued_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  base_salary: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMoney(amt: number, ccy: string) {
  return `${ccy} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PayslipsPage() {
  const { user, isAdmin } = useAuth();
  const [payslips, setPayslips] = React.useState<PayslipRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("payslips").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false });
    if (!isAdmin) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as PayslipRow[];
    setPayslips(rows);
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, base_salary")
        .in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as ProfileMini; });
      setProfiles(map);
    }
    setLoading(false);
  }, [user, isAdmin]);

  React.useEffect(() => { void load(); }, [load]);

  function downloadPayslip(p: PayslipRow) {
    const subj = profiles[p.user_id];
    const lines = [
      "NEXUS HQ — PAYSLIP",
      "=========================================",
      `Employee: ${subj?.full_name ?? subj?.email ?? p.user_id}`,
      `Period:   ${MONTHS[p.period_month - 1]} ${p.period_year}`,
      `Issued:   ${new Date(p.issued_at).toLocaleDateString()}`,
      "",
      `Base salary:   ${fmtMoney(Number(p.base_salary), p.currency)}`,
      `Bonus:       + ${fmtMoney(Number(p.bonus), p.currency)}`,
      `Deductions:  - ${fmtMoney(Number(p.deductions), p.currency)}`,
      "-----------------------------------------",
      `NET PAY:       ${fmtMoney(Number(p.net_pay), p.currency)}`,
      "",
      p.notes ? `Notes: ${p.notes}` : "",
    ].filter(Boolean).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip_${p.period_year}_${String(p.period_month).padStart(2, "0")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payslips</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Issue and manage monthly payslips." : "Your monthly pay history."}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Issue Payslip</Button>
            </DialogTrigger>
            <CreatePayslipDialog onCreated={() => { setCreateOpen(false); void load(); }} />
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : payslips.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No payslips yet.</Card>
      ) : (
        <div className="grid gap-3">
          {payslips.map((p) => {
            const subj = profiles[p.user_id];
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{MONTHS[p.period_month - 1]} {p.period_year}</p>
                      {isAdmin && subj && (
                        <p className="text-xs text-muted-foreground">{subj.full_name ?? subj.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-6 text-right text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Base</p>
                      <p className="tabular-nums">{fmtMoney(Number(p.base_salary), p.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bonus</p>
                      <p className="tabular-nums text-success">+{fmtMoney(Number(p.bonus), p.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Deductions</p>
                      <p className="tabular-nums text-destructive">-{fmtMoney(Number(p.deductions), p.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net</p>
                      <p className="tabular-nums font-bold">{fmtMoney(Number(p.net_pay), p.currency)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadPayslip(p)}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </Button>
                </div>
                {p.notes && (
                  <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">{p.notes}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreatePayslipDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const now = new Date();
  const [form, setForm] = React.useState({
    user_id: "",
    period_month: now.getMonth() + 1,
    period_year: now.getFullYear(),
    base_salary: 0,
    bonus: 0,
    deductions: 0,
    currency: "NGN",
    notes: "",
  });

  React.useEffect(() => {
    void supabase
      .from("profiles")
      .select("id, full_name, email, base_salary")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, []);

  // Auto-fill base salary when employee picked
  React.useEffect(() => {
    const e = employees.find((x) => x.id === form.user_id);
    if (e?.base_salary) setForm((f) => ({ ...f, base_salary: Number(e.base_salary) }));
  }, [form.user_id, employees]);

  const net = Number(form.base_salary) + Number(form.bonus) - Number(form.deductions);

  async function submit() {
    if (!form.user_id) { toast.error("Pick an employee"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("payslips").insert({
      user_id: form.user_id,
      period_month: form.period_month,
      period_year: form.period_year,
      base_salary: form.base_salary,
      bonus: form.bonus,
      deductions: form.deductions,
      net_pay: net,
      currency: form.currency,
      notes: form.notes.trim() || null,
      issued_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: form.user_id,
      type: "flag",
      title: "💰 New payslip issued",
      message: `${MONTHS[form.period_month - 1]} ${form.period_year} — ${fmtMoney(net, form.currency)}`,
    });
    toast.success("Payslip issued");
    setSubmitting(false);
    onCreated();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Issue Payslip</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Employee</Label>
          <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pick employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Month</Label>
            <Select value={String(form.period_month)} onValueChange={(v) => setForm({ ...form, period_month: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Base salary</Label>
            <Input type="number" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Bonus</Label>
            <Input type="number" step="0.01" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Deductions</Label>
            <Input type="number" step="0.01" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: Number(e.target.value) })} />
          </div>
        </div>
        <div className="rounded border border-border bg-muted/30 p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Net pay</span>
          <span className="text-xl font-bold tabular-nums">{fmtMoney(net, form.currency)}</span>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>{submitting ? "Issuing…" : "Issue Payslip"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
