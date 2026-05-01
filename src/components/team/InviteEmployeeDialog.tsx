import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";
import { inviteEmployeeFn } from "@/server/admin.functions";

export function InviteEmployeeDialog({ onInvited, isAdmin = false }: { onInvited?: () => void; isAdmin?: boolean }) {
  const invite = useServerFn(inviteEmployeeFn);
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    full_name: "",
    job_title: "",
    department: "other" as (typeof DEPARTMENTS)[number],
    phone: "",
    role: "employee" as "admin" | "manager" | "employee",
  });

  function reset() {
    setForm({
      email: "",
      full_name: "",
      job_title: "",
      department: "other",
      phone: "",
      role: "employee",
    });
  }

  async function submit() {
    if (!form.email.trim() || !form.full_name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/accept-invite`;
      await invite({
        data: {
          email: form.email.trim(),
          full_name: form.full_name.trim(),
          job_title: form.job_title.trim() || null,
          department: form.department,
          phone: form.phone.trim() || null,
          role: form.role,
          redirectTo,
        },
      });
      toast.success("Invitation sent");
      reset();
      setOpen(false);
      onInvited?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to invite";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Invite Employee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a new employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <Label>Job title</Label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="Designer"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+234…"
              />
            </div>
            <div>
              <Label>Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) =>
                  setForm({ ...form, department: v as (typeof DEPARTMENTS)[number] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {deptLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as "admin" | "manager" | "employee" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            They'll receive an email with a link to set their password and join the workspace.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
