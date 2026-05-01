import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { setEmployeeRoleFn } from "@/server/admin.functions";

type AppRole = "admin" | "manager" | "employee";

interface Props {
  userId: string;
  userName?: string;
  currentRole: AppRole | null;
  onChanged?: (newRole: AppRole) => void;
  trigger?: React.ReactNode;
}

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Full access — manage team, KPIs, payslips, roles.",
  manager: "Can assign tasks, review deliverables, flag warnings.",
  employee: "Can view own tasks, clock in/out, submit deliverables.",
};

export function ManageRoleDialog({
  userId,
  userName,
  currentRole,
  onChanged,
  trigger,
}: Props) {
  const setRole = useServerFn(setEmployeeRoleFn);
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<AppRole>(
    currentRole ?? "employee",
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setSelected(currentRole ?? "employee");
  }, [open, currentRole]);

  async function handleSave() {
    if (selected === currentRole) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await setRole({ data: { userId, role: selected } });
      toast.success(
        `Role updated to ${selected}${userName ? ` for ${userName}` : ""}.`,
      );
      onChanged?.(selected);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Shield className="mr-2 h-4 w-4" /> Manage role
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage role</DialogTitle>
          <DialogDescription>
            Change {userName ?? "this employee"}'s permissions across the app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Role</Label>
          <Select
            value={selected}
            onValueChange={(v) => setSelected(v as AppRole)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {ROLE_DESCRIPTIONS[selected]}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
