import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
import { todayISO } from "@/lib/nexus";
import { Plus } from "lucide-react";

interface Props {
  assigneeId: string;
  assigneeName?: string | null;
  onCreated?: () => void;
  triggerLabel?: string;
}

export function QuickAssignTaskDialog({
  assigneeId,
  assigneeName,
  onCreated,
  triggerLabel = "Assign Task",
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    task_type: "one_time" as "daily" | "one_time" | "weekly",
    due_date: todayISO(),
  });

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assigned_to: assigneeId,
        assigned_by: user?.id ?? null,
        priority: form.priority,
        task_type: form.task_type,
        due_date: form.due_date,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    await supabase.from("notifications").insert({
      user_id: assigneeId,
      type: "task_assigned",
      title: "📋 New task assigned",
      message: form.title.trim(),
      related_task_id: data.id,
    });
    toast.success("Task assigned");
    setSubmitting(false);
    setOpen(false);
    setForm({
      title: "",
      description: "",
      priority: "medium",
      task_type: "one_time",
      due_date: todayISO(),
    });
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign task{assigneeName ? ` to ${assigneeName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) =>
                  setForm({ ...form, priority: v as typeof form.priority })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={form.task_type}
                onValueChange={(v) =>
                  setForm({ ...form, task_type: v as typeof form.task_type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Assigning…" : "Assign Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
