import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/nexus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, RotateCcw, ExternalLink, Flag } from "lucide-react";
import type { OverdueTaskRow, PendingDeliverable } from "@/lib/live/types";

interface Props {
  overdueTasks: OverdueTaskRow[];
  pendingDeliverables: PendingDeliverable[];
  onApproveDeliverable: (id: string) => void;
  onReviseDeliverable: (id: string) => void;
  onFlagEmployee: (employeeId: string, employeeName: string) => void;
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 40%)`;
}

interface AvatarProps {
  url: string | null;
  name: string;
  id: string;
  size: number;
}

function Avatar({ url, name, id, size }: AvatarProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{
        width: size,
        height: size,
        background: hashColor(id),
        fontSize: size * 0.38,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

function priorityBadgeClass(priority: string): string {
  switch (priority.toLowerCase()) {
    case "urgent":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "high":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    case "medium":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-[#333] text-[#888] border-[#444]";
  }
}

const MAX_OVERDUE = 10;
const MAX_DELIVERABLES = 10;

function OverdueTasksPanel({
  tasks,
  onFlagEmployee,
}: {
  tasks: OverdueTaskRow[];
  onFlagEmployee: (employeeId: string, employeeName: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = [...tasks].sort((a, b) => b.daysOverdue - a.daysOverdue);
  const visible = showAll ? sorted : sorted.slice(0, MAX_OVERDUE);
  const hiddenCount = sorted.length - MAX_OVERDUE;

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 h-full flex flex-col gap-3">
      <h2 className="text-white font-semibold text-base flex items-center gap-2">
        <span>🔴</span>
        <span>Overdue ({tasks.length})</span>
      </h2>

      {tasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-emerald-400 text-sm text-center">
            ✅ All clear — no overdue tasks right now
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {visible.map((task) => {
              const empName = task.employee.name ?? "Unknown";
              return (
                <div
                  key={task.taskId}
                  className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-2"
                >
                  {/* Employee */}
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={task.employee.avatarUrl}
                      name={empName}
                      id={task.employee.id}
                      size={28}
                    />
                    <span className="text-white text-sm font-medium">{empName}</span>
                  </div>

                  {/* Task title + overdue */}
                  <div>
                    <p className="text-[#ccc] text-sm font-medium leading-tight">{task.title}</p>
                    <p className="text-red-400 text-xs mt-0.5">
                      {task.daysOverdue} {task.daysOverdue === 1 ? "day" : "days"} overdue
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={cn("text-xs px-1.5 py-0 h-4", priorityBadgeClass(task.priority))}
                    >
                      {task.priority}
                    </Badge>
                    {task.kpiId && (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs px-1.5 py-0 h-4">
                        KPI
                      </Badge>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1"
                      onClick={() => onFlagEmployee(task.employee.id, empName)}
                    >
                      <Flag className="w-3 h-3" />
                      Flag Employee
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-[#666] hover:text-white hover:bg-white/5 gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Task
                    </Button>
                  </div>
                </div>
              );
            })}

            {!showAll && hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[#666] hover:text-white text-xs h-8"
                onClick={() => setShowAll(true)}
              >
                Show {hiddenCount} more
              </Button>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function PendingApprovalsPanel({
  deliverables,
  onApproveDeliverable,
  onReviseDeliverable,
}: {
  deliverables: PendingDeliverable[];
  onApproveDeliverable: (id: string) => void;
  onReviseDeliverable: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const visible = showAll ? deliverables : deliverables.slice(0, MAX_DELIVERABLES);
  const hiddenCount = deliverables.length - MAX_DELIVERABLES;

  const handleApprove = (id: string) => {
    setApprovingIds((prev) => new Set(prev).add(id));
    onApproveDeliverable(id);
    setTimeout(() => {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setApprovedIds((prev) => new Set(prev).add(id));
    }, 500);
  };

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 h-full flex flex-col gap-3">
      <h2 className="text-white font-semibold text-base flex items-center gap-2">
        <span>⏳</span>
        <span>Pending Review ({deliverables.length})</span>
      </h2>

      {deliverables.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-emerald-400 text-sm text-center">✅ Nothing waiting for review</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {visible.map((item) => {
              const isApproving = approvingIds.has(item.id);
              const isApproved = approvedIds.has(item.id);
              const relative = formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
              });
              const name = item.userName;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-2 transition-all duration-500",
                    isApproving && "opacity-0 scale-95",
                    isApproved && "hidden",
                  )}
                >
                  {/* Employee */}
                  <div className="flex items-center gap-2">
                    <Avatar url={item.avatarUrl} name={name} id={item.userId} size={28} />
                    <span className="text-white text-sm font-medium">{name}</span>
                  </div>

                  {/* File info */}
                  <div>
                    <p className="text-[#ccc] text-sm font-medium truncate" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <p className="text-[#555] text-xs mt-0.5">Uploaded {relative}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {item.taskId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-[#666] hover:text-white hover:bg-white/5 gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
                      onClick={() => handleApprove(item.id)}
                      disabled={isApproving}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1"
                      onClick={() => onReviseDeliverable(item.id)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revise
                    </Button>
                  </div>
                </div>
              );
            })}

            {!showAll && hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[#666] hover:text-white text-xs h-8"
                onClick={() => setShowAll(true)}
              >
                Show {hiddenCount} more
              </Button>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function OverduePendingPanel({
  overdueTasks,
  pendingDeliverables,
  onApproveDeliverable,
  onReviseDeliverable,
  onFlagEmployee,
}: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <OverdueTasksPanel tasks={overdueTasks} onFlagEmployee={onFlagEmployee} />
      <PendingApprovalsPanel
        deliverables={pendingDeliverables}
        onApproveDeliverable={onApproveDeliverable}
        onReviseDeliverable={onReviseDeliverable}
      />
    </div>
  );
}
