import React, { useState, useEffect, useRef } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/nexus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { TaskActivityEvent, TaskCounters } from "@/lib/live/types";

interface ActiveTask {
  id: string;
  title: string;
  assignedTo: string;
  assigneeName: string;
  assigneeAvatarUrl: string | null;
  progress: number;
  priority: string;
  dueDate: string;
}

interface Props {
  events: TaskActivityEvent[];
  counters: TaskCounters;
  activeTasks: ActiveTask[];
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

interface CounterCardProps {
  label: string;
  value: number;
  valueClass?: string;
}

function CounterCard({ label, value, valueClass }: CounterCardProps) {
  const prevRef = useRef(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      setAnimating(true);
      const timer = setTimeout(() => setAnimating(false), 600);
      prevRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-lg p-4 flex flex-col items-center justify-center gap-1">
      <span
        className={cn(
          "text-4xl font-bold text-white transition-transform",
          animating && "animate-bounce",
          valueClass
        )}
      >
        {value}
      </span>
      <span className="text-[#666] text-xs text-center leading-tight">{label}</span>
    </div>
  );
}

function actionText(event: TaskActivityEvent): string {
  switch (event.action) {
    case "started":
      return "started";
    case "completed":
      return "completed";
    case "updated":
      if (event.progressAfter !== null) {
        return `updated progress to ${event.progressAfter}%`;
      }
      return "updated";
    default:
      return event.action;
  }
}

export function TaskActivityFeed({ events, counters, activeTasks }: Props) {
  const [showAllTasks, setShowAllTasks] = useState(false);

  const displayedEvents = events.slice(0, 10);
  const MAX_TASKS = 8;
  const visibleTasks = showAllTasks ? activeTasks : activeTasks.slice(0, MAX_TASKS);
  const hiddenCount = activeTasks.length - MAX_TASKS;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 space-y-5">
      {/* Task Overview Counters */}
      <div>
        <h2 className="text-white font-semibold text-base mb-3">Task Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CounterCard label="Total Today" value={counters.totalToday} />
          <CounterCard label="Complete Today" value={counters.completedToday} />
          <CounterCard label="In Progress" value={counters.inProgress} />
          <CounterCard
            label="Overdue"
            value={counters.overdue}
            valueClass={counters.overdue > 0 ? "text-red-400" : undefined}
          />
        </div>
      </div>

      <Separator className="bg-[#1f1f1f]" />

      {/* Live Activity Feed */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <h3 className="text-white font-semibold text-sm">Live Task Activity</h3>
        </div>

        {displayedEvents.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-3">
            Task activity will appear here
          </p>
        ) : (
          <ScrollArea className="max-h-56">
            <div className="space-y-1">
              {displayedEvents.map((event) => {
                const time = new Date(event.time);
                const relative = formatDistanceToNow(time, { addSuffix: true });
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 py-1.5 px-1"
                  >
                    <Avatar
                      url={event.avatarUrl}
                      name={event.userName}
                      id={event.userId}
                      size={28}
                    />
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="text-white font-medium">{event.userName}</span>{" "}
                      <span className="text-[#888]">{actionText(event)}</span>{" "}
                      <span className="text-[#ccc] font-medium truncate">
                        &ldquo;{event.taskTitle}&rdquo;
                      </span>
                    </div>
                    <span className="text-[#555] text-xs whitespace-nowrap flex-shrink-0 pt-0.5">
                      {relative}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator className="bg-[#1f1f1f]" />

      {/* Active Tasks List */}
      <div>
        <h3 className="text-white font-semibold text-sm mb-3">
          Active Right Now ({activeTasks.length})
        </h3>

        {activeTasks.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-3">
            No tasks in progress right now
          </p>
        ) : (
          <div className="space-y-3">
            {visibleTasks.map((task) => {
              const dueDateStr = task.dueDate ? task.dueDate.slice(0, 10) : null;
              const isToday = dueDateStr === todayStr;
              const dueDateDisplay = isToday
                ? "Today"
                : task.dueDate
                ? format(new Date(task.dueDate), "MMM d")
                : "—";

              return (
                <div
                  key={task.id}
                  className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={task.assigneeAvatarUrl}
                      name={task.assigneeName}
                      id={task.assignedTo}
                      size={32}
                    />
                    <span className="text-white text-sm font-medium">{task.assigneeName}</span>
                  </div>
                  <p className="text-[#aaa] text-xs">
                    Working on:{" "}
                    <span className="text-white font-medium">&ldquo;{task.title}&rdquo;</span>
                  </p>
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-[#666]">
                      <span>Progress</span>
                      <span className="text-white">{task.progress}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn("font-medium", isToday ? "text-amber-400" : "text-[#888]")}>
                      Due: {dueDateDisplay}
                    </span>
                    <span className="text-[#444]">·</span>
                    <span className="text-[#666]">Priority:</span>
                    <Badge
                      className={cn(
                        "text-xs px-1.5 py-0 h-4",
                        priorityBadgeClass(task.priority)
                      )}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              );
            })}

            {!showAllTasks && hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[#666] hover:text-white text-xs h-8"
                onClick={() => setShowAllTasks(true)}
              >
                Show {hiddenCount} more
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
