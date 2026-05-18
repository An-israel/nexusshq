import React, { useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { initialsOf, deptLabel } from "@/lib/nexus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AttendanceEvent, LiveEmployee } from "@/lib/live/types";

interface Props {
  events: AttendanceEvent[];
  employees: LiveEmployee[];
  workspaceId: string;
  currentUserId: string;
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

interface FeedItemProps {
  event: AttendanceEvent;
  isNew: boolean;
}

const FeedItem = React.memo(function FeedItem({ event, isNew }: FeedItemProps) {
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const time = new Date(event.time);
  const formattedTime = format(time, "h:mm a");
  const relativeTime = formatDistanceToNow(time, { addSuffix: true });

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-1 transition-all duration-300",
        isNew && !visible ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"
      )}
    >
      <Avatar
        url={event.avatarUrl}
        name={event.userName}
        id={event.userId}
        size={32}
      />
      <div className="flex-1 min-w-0">
        <span className="text-white font-medium text-sm">{event.userName}</span>
        <span className="text-[#888] text-sm">
          {" "}
          clocked{" "}
          <span
            className={cn(
              "font-medium",
              event.action === "clock_in" ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {event.action === "clock_in" ? "in" : "out"}
          </span>{" "}
          at {formattedTime}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {event.isLate && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs px-1.5 py-0">
            Late
          </Badge>
        )}
        <span className="text-[#555] text-xs whitespace-nowrap">{relativeTime}</span>
      </div>
    </div>
  );
});

interface ReminderButtonState {
  loading: boolean;
  sent: boolean;
}

export function AttendanceFeed({
  events,
  employees,
  workspaceId,
  currentUserId,
}: Props) {
  const [reminderStates, setReminderStates] = useState<Record<string, ReminderButtonState>>({});

  // IDs of employees who have a clock_in event today
  const clockedInIds = new Set(
    events.filter((e) => e.action === "clock_in").map((e) => e.userId)
  );

  // Employees not yet clocked in: offline status AND no clock_in event today
  const notYetClockedIn = employees.filter(
    (emp) =>
      !clockedInIds.has(emp.id) &&
      (emp.status === "offline" || !clockedInIds.has(emp.id))
  );

  const lateCount = events.filter((e) => e.isLate && e.action === "clock_in").length;
  const displayedEvents = events.slice(0, 20);

  const sendReminder = useCallback(
    async (employee: LiveEmployee) => {
      setReminderStates((prev) => ({
        ...prev,
        [employee.id]: { loading: true, sent: false },
      }));

      const { error } = await supabase.from("notifications").insert({
        user_id: employee.id,
        workspace_id: workspaceId,
        type: "clock_reminder",
        title: "Clock In Reminder",
        message: "Your manager is reminding you to clock in for today.",
        is_read: false,
      });

      if (error) {
        toast.error("Failed to send reminder");
        setReminderStates((prev) => ({
          ...prev,
          [employee.id]: { loading: false, sent: false },
        }));
        return;
      }

      toast.success(`Reminder sent to ${employee.full_name ?? employee.email ?? "employee"}`);
      setReminderStates((prev) => ({
        ...prev,
        [employee.id]: { loading: false, sent: true },
      }));

      setTimeout(() => {
        setReminderStates((prev) => ({
          ...prev,
          [employee.id]: { loading: false, sent: false },
        }));
      }, 2000);
    },
    [workspaceId]
  );

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <h2 className="text-white font-semibold text-base">Attendance Feed</h2>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-2 text-sm text-[#888]">
        <span>
          <span className="text-white font-medium">{clockedInIds.size}</span>{" "}
          clocked in today
        </span>
        <span className="text-[#333]">|</span>
        <span>
          <span className={cn("font-medium", lateCount > 0 ? "text-amber-400" : "text-white")}>
            {lateCount}
          </span>{" "}
          late
        </span>
        <span className="text-[#333]">|</span>
        <span>
          <span className={cn("font-medium", notYetClockedIn.length > 0 ? "text-rose-400" : "text-white")}>
            {notYetClockedIn.length}
          </span>{" "}
          not yet clocked in
        </span>
      </div>

      <Separator className="bg-[#1f1f1f]" />

      {/* Live feed */}
      {displayedEvents.length === 0 ? (
        <p className="text-[#555] text-sm text-center py-4">
          No clock-ins recorded yet today
        </p>
      ) : (
        <ScrollArea className="max-h-64">
          <div className="divide-y divide-[#1a1a1a]">
            {displayedEvents.map((event, index) => (
              <FeedItem key={event.id} event={event} isNew={index === 0} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Not yet clocked in section */}
      {notYetClockedIn.length > 0 && (
        <>
          <Separator className="bg-[#1f1f1f]" />
          <div className="space-y-2">
            <h3 className="text-[#888] text-xs font-medium uppercase tracking-wider">
              Not yet clocked in ({notYetClockedIn.length})
            </h3>
            <div className="space-y-1">
              {notYetClockedIn.map((emp) => {
                const state = reminderStates[emp.id];
                const name = emp.full_name ?? emp.email ?? "Unknown";
                return (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <Avatar url={emp.avatar_url} name={name} id={emp.id} size={28} />
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-sm font-medium">{name}</span>
                      <span className="text-[#555] text-sm">
                        {" "}
                        &mdash; {deptLabel(emp.department)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-[#333] bg-transparent text-[#aaa] hover:text-white hover:border-[#555] flex-shrink-0"
                      disabled={state?.loading || state?.sent}
                      onClick={() => sendReminder(emp)}
                    >
                      {state?.loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : state?.sent ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        "Send Reminder"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
