import React from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { MessageSquare, Clock, CheckCircle2, Briefcase } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { initialsOf } from '@/lib/nexus';
import type { LiveEmployee } from '@/lib/live/types';

interface TaskRow {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
  priority: string;
  due_date: string;
}

interface Props {
  employee: LiveEmployee | null;
  tasks: TaskRow[];
  onClose: () => void;
  onMessage: (employeeId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  away: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  dnd: 'bg-red-500/15 text-red-400 border-red-500/30',
  offline: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  away: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export function EmployeeDetailSidebar({ employee, tasks, onClose, onMessage }: Props) {
  const open = employee !== null;

  const clockInDisplay = employee?.clock_in
    ? format(new Date(employee.clock_in), 'h:mm a')
    : null;

  const durationMins =
    employee?.clock_in && !employee.clock_out
      ? differenceInMinutes(new Date(), new Date(employee.clock_in))
      : employee?.clock_in && employee.clock_out
      ? differenceInMinutes(new Date(employee.clock_out), new Date(employee.clock_in))
      : null;

  const durationDisplay =
    durationMins !== null
      ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
      : null;

  const completedToday = tasks.filter((t) => t.status === 'completed').length;
  const activeTask = tasks.find((t) => t.status === 'in_progress') ?? null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="max-w-sm w-full bg-[#111] border-[#2A2A2A] text-white p-0 flex flex-col"
      >
        {employee && (
          <>
            <SheetHeader className="p-5 pb-0">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  {employee.avatar_url ? (
                    <img
                      src={employee.avatar_url}
                      alt={employee.full_name ?? ''}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2A2A2A] text-base font-semibold text-white">
                      {initialsOf(employee.full_name ?? employee.email)}
                    </div>
                  )}
                  <span
                    className={cn(
                      'absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full ring-2 ring-[#111]',
                      employee.status === 'active' && 'bg-green-500 animate-pulse',
                      employee.status === 'away' && 'bg-amber-500',
                      employee.status === 'dnd' && 'bg-red-500',
                      employee.status === 'offline' && 'bg-gray-600',
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base text-white truncate">
                    {employee.full_name ?? employee.email ?? 'Unknown'}
                  </SheetTitle>
                  {employee.job_title && (
                    <p className="text-sm text-gray-400 truncate">{employee.job_title}</p>
                  )}
                  {employee.department && (
                    <p className="text-xs text-gray-500 truncate">{employee.department}</p>
                  )}
                  <Badge
                    variant="outline"
                    className={cn('mt-1.5 text-xs', STATUS_COLOR[employee.status])}
                  >
                    {STATUS_LABEL[employee.status]}
                  </Badge>
                </div>
              </div>
            </SheetHeader>

            <Separator className="mt-4 bg-[#2A2A2A]" />

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Today
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Clock className="h-4 w-4 text-gray-500 shrink-0" />
                  {clockInDisplay ? (
                    <span>
                      Clocked in at <span className="text-white">{clockInDisplay}</span>
                      {durationDisplay && (
                        <span className="ml-1 text-gray-400">· {durationDisplay}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-500">Not clocked in</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>
                    <span className="text-white">{completedToday}</span> task
                    {completedToday !== 1 ? 's' : ''} completed today
                  </span>
                </div>
              </div>

              {activeTask && (
                <>
                  <Separator className="bg-[#2A2A2A]" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Active Task
                    </p>
                    <div className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <Briefcase className="mt-0.5 h-4 w-4 text-gray-500 shrink-0" />
                        <p className="text-sm text-white leading-snug">{activeTask.title}</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Progress</span>
                          <span>{activeTask.progress_percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#2A2A2A]">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${activeTask.progress_percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[#2A2A2A] p-4">
              <Button
                className="w-full gap-2"
                onClick={() => onMessage(employee.id)}
              >
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
