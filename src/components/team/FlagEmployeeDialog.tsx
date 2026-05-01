import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
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
import { Flag } from "lucide-react";

export function FlagEmployeeDialog({
  userId,
  userName,
  onCreated,
}: {
  userId: string;
  userName?: string | null;
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [severity, setSeverity] = React.useState<"low" | "medium" | "high">("medium");

  async function submit() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("flags").insert({
      flagged_user_id: userId,
      flagged_by: user?.id ?? null,
      reason: reason.trim(),
      severity,
    });
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "warning",
      title: "⚠️ A flag was added to your record",
      message: reason.trim(),
    });
    toast.success("Flag created");
    setReason("");
    setSeverity("medium");
    setSubmitting(false);
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Flag className="mr-2 h-4 w-4 text-warning" /> Flag Employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag {userName ?? "employee"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe what happened…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Saving…" : "Add Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
