import React, { useEffect, useRef, useState } from "react";
import { Plus, ClipboardList, AlertTriangle, Flag, Megaphone, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deptLabel, DEPARTMENTS } from "@/lib/nexus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  workspaceId: string;
  currentUserId: string;
  employees: Array<{ id: string; full_name: string | null; department: string | null }>;
  onAssignTask?: () => void;
}

type ModalType = "warning" | "flag" | "broadcast" | null;

// ─── Send Warning Modal ────────────────────────────────────────────────────────
function SendWarningModal({
  open,
  onClose,
  employees,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  employees: Props["employees"];
  workspaceId: string;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!employeeId || !message.trim()) {
      toast.error("Please select an employee and enter a message.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: employeeId,
      workspace_id: workspaceId,
      type: "warning",
      title: "Warning from Manager",
      message: message.trim(),
      is_read: false,
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to send warning.");
      return;
    }
    toast.success("Warning sent successfully.");
    setEmployeeId("");
    setMessage("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111] border-[#1f1f1f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Send Warning
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Employee</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="bg-[#1a1a1a] border-[#2f2f2f] text-white">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2f2f2f]">
                {employees.map((emp) => (
                  <SelectItem
                    key={emp.id}
                    value={emp.id}
                    className="text-white focus:bg-[#2f2f2f]"
                  >
                    {emp.full_name ?? "Unknown"}{" "}
                    {emp.department ? `(${deptLabel(emp.department)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Warning message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue..."
              className="bg-[#1a1a1a] border-[#2f2f2f] text-white placeholder:text-[#555] resize-none min-h-[100px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[#888] hover:text-white hover:bg-[#1f1f1f]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              {loading ? "Sending..." : "Send Warning"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Flag Employee Modal ───────────────────────────────────────────────────────
function FlagEmployeeModal({
  open,
  onClose,
  employees,
  workspaceId,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  employees: Props["employees"];
  workspaceId: string;
  currentUserId: string;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!employeeId || !reason.trim()) {
      toast.error("Please select an employee and enter a reason.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("flags").insert({
      flagged_user_id: employeeId,
      flagged_by: currentUserId,
      workspace_id: workspaceId,
      reason: reason.trim(),
      severity,
      is_resolved: false,
    });
    setLoading(false);
    if (error) {
      toast.error("Failed to flag employee.");
      return;
    }
    toast.success("Employee flagged successfully.");
    setEmployeeId("");
    setReason("");
    setSeverity("medium");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111] border-[#1f1f1f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            Flag Employee
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Employee</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="bg-[#1a1a1a] border-[#2f2f2f] text-white">
                <SelectValue placeholder="Select employee..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2f2f2f]">
                {employees.map((emp) => (
                  <SelectItem
                    key={emp.id}
                    value={emp.id}
                    className="text-white focus:bg-[#2f2f2f]"
                  >
                    {emp.full_name ?? "Unknown"}{" "}
                    {emp.department ? `(${deptLabel(emp.department)})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the reason for flagging..."
              className="bg-[#1a1a1a] border-[#2f2f2f] text-white placeholder:text-[#555] resize-none min-h-[100px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Severity</label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as "low" | "medium" | "high")}
            >
              <SelectTrigger className="bg-[#1a1a1a] border-[#2f2f2f] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2f2f2f]">
                <SelectItem value="low" className="text-white focus:bg-[#2f2f2f]">
                  Low
                </SelectItem>
                <SelectItem value="medium" className="text-white focus:bg-[#2f2f2f]">
                  Medium
                </SelectItem>
                <SelectItem value="high" className="text-white focus:bg-[#2f2f2f]">
                  High
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[#888] hover:text-white hover:bg-[#1f1f1f]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              {loading ? "Flagging..." : "Flag Employee"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Broadcast Modal ───────────────────────────────────────────────────────────
function BroadcastModal({
  open,
  onClose,
  employees,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  employees: Props["employees"];
  workspaceId: string;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [department, setDepartment] = useState("__all__");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !message.trim()) {
      toast.error("Please fill in the title and message.");
      return;
    }
    setLoading(true);

    const targets =
      department === "__all__"
        ? employees
        : employees.filter((e) => e.department === department);

    const insertions = targets.map((emp) => ({
      user_id: emp.id,
      workspace_id: workspaceId,
      type: "info" as const,
      title: title.trim(),
      message: message.trim(),
      is_read: false,
    }));

    if (insertions.length === 0) {
      toast.error("No employees found for the selected department.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("notifications").insert(insertions);
    setLoading(false);
    if (error) {
      toast.error("Failed to broadcast message.");
      return;
    }
    toast.success(`Broadcast sent to ${insertions.length} employee${insertions.length !== 1 ? "s" : ""}.`);
    setTitle("");
    setMessage("");
    setDepartment("__all__");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#111] border-[#1f1f1f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" />
            Broadcast Message
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Broadcast title..."
              className="bg-[#1a1a1a] border-[#2f2f2f] text-white placeholder:text-[#555]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message..."
              className="bg-[#1a1a1a] border-[#2f2f2f] text-white placeholder:text-[#555] resize-none min-h-[100px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[#aaa] text-sm">Department</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="bg-[#1a1a1a] border-[#2f2f2f] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2f2f2f]">
                <SelectItem value="__all__" className="text-white focus:bg-[#2f2f2f]">
                  All Departments
                </SelectItem>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem
                    key={dept}
                    value={dept}
                    className="text-white focus:bg-[#2f2f2f]"
                  >
                    {deptLabel(dept)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[#888] hover:text-white hover:bg-[#1f1f1f]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white font-semibold"
            >
              {loading ? "Sending..." : "Broadcast"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action button item used in the expanded FAB ───────────────────────────────
function ActionBtn({
  icon,
  label,
  onClick,
  index,
  visible,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  index: number;
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: visible ? `${index * 40}ms` : "0ms" }}
    >
      <span className="text-white text-xs font-medium bg-[#1f1f1f] px-2 py-1 rounded-md whitespace-nowrap shadow">
        {label}
      </span>
      <button
        onClick={onClick}
        className="h-11 w-11 rounded-full bg-white text-xl shadow-lg hover:scale-110 active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
        aria-label={label}
      >
        {icon}
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function QuickActionsButton({
  workspaceId,
  currentUserId,
  employees,
  onAssignTask,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animate action buttons in after FAB opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setActionsVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setActionsVisible(false);
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openModal(type: ModalType) {
    setOpen(false);
    setModal(type);
  }

  const actions: { icon: string; label: string; onClick: () => void }[] = [
    {
      icon: "📋",
      label: "Assign Task",
      onClick: () => {
        setOpen(false);
        onAssignTask?.();
      },
    },
    {
      icon: "⚠️",
      label: "Send Warning",
      onClick: () => openModal("warning"),
    },
    {
      icon: "🚩",
      label: "Flag Employee",
      onClick: () => openModal("flag"),
    },
    {
      icon: "📢",
      label: "Broadcast",
      onClick: () => openModal("broadcast"),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB container */}
      <div
        ref={containerRef}
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      >
        {/* Action buttons (rendered above FAB when open) */}
        <div
          className={cn(
            "flex flex-col-reverse items-end gap-3 transition-all duration-200",
            open ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          {actions.map((action, i) => (
            <ActionBtn
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={action.onClick}
              index={i}
              visible={actionsVisible}
            />
          ))}
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "h-14 w-14 rounded-full bg-primary shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center text-white",
            open && "bg-primary/90"
          )}
          aria-label={open ? "Close quick actions" : "Open quick actions"}
          aria-expanded={open}
        >
          <Plus
            className={cn(
              "w-6 h-6 transition-transform duration-200",
              open && "rotate-45"
            )}
          />
        </button>
      </div>

      {/* Modals */}
      <SendWarningModal
        open={modal === "warning"}
        onClose={() => setModal(null)}
        employees={employees}
        workspaceId={workspaceId}
      />
      <FlagEmployeeModal
        open={modal === "flag"}
        onClose={() => setModal(null)}
        employees={employees}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
      />
      <BroadcastModal
        open={modal === "broadcast"}
        onClose={() => setModal(null)}
        employees={employees}
        workspaceId={workspaceId}
      />
    </>
  );
}
