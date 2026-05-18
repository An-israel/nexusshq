import React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/nexus";
import type { LiveEmployee } from "@/lib/live/types";

interface StatusDotProps {
  status: LiveEmployee["status"];
}

const StatusDot = React.memo(function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#111]",
        status === "active" && "bg-green-500 animate-pulse",
        status === "away" && "bg-amber-500",
        status === "dnd" && "bg-red-500",
        status === "offline" && "bg-gray-600",
      )}
    />
  );
});

interface EmployeeCardProps {
  employee: LiveEmployee;
  isSelected: boolean;
  onSelect: (id: string) => void;
  now: number;
}

const EmployeeCard = React.memo(function EmployeeCard({
  employee,
  isSelected,
  onSelect,
  now,
}: EmployeeCardProps) {
  const clockedIn = employee.clock_in !== null && employee.clock_out === null;
  const clockInDisplay = employee.clock_in ? format(new Date(employee.clock_in), "h:mm a") : null;

  const durationMs = clockedIn ? Math.max(0, now - new Date(employee.clock_in!).getTime()) : 0;
  const durationHours = Math.floor(durationMs / 3_600_000);
  const durationMins = Math.floor((durationMs % 3_600_000) / 60_000);

  return (
    <button
      type="button"
      onClick={() => onSelect(employee.id)}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
        "bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A]",
        employee.status === "active" &&
          "ring-1 ring-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.1)]",
        employee.status === "offline" && "opacity-70",
        isSelected && "ring-2 ring-primary border-transparent",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <div className="relative shrink-0">
          {employee.avatar_url ? (
            <img
              src={employee.avatar_url}
              alt={employee.full_name ?? ""}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2A2A] text-sm font-medium text-white">
              {initialsOf(employee.full_name ?? employee.email)}
            </div>
          )}
          <StatusDot status={employee.status} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {employee.full_name ?? employee.email ?? "Unknown"}
          </p>
          <p className="truncate text-xs text-gray-400">
            {employee.job_title ?? employee.department ?? "—"}
          </p>
        </div>
      </div>

      <div className="w-full border-t border-[#2A2A2A] pt-1.5">
        {clockInDisplay ? (
          <>
            <p className="text-xs text-gray-400">Clocked in {clockInDisplay}</p>
            {clockedIn && (
              <p className="text-xs text-green-400">
                {durationHours}h {durationMins}m online
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-600">Not clocked in</p>
        )}
      </div>
    </button>
  );
});

interface Props {
  employees: LiveEmployee[];
  onSelectEmployee: (id: string) => void;
  selectedEmployeeId: string | null;
}

const STATUS_ORDER: Record<string, number> = { active: 0, away: 1, dnd: 2, offline: 3 };

export function TeamStatusGrid({ employees, onSelectEmployee, selectedEmployeeId }: Props) {
  const [showAll, setShowAll] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sorted = React.useMemo(
    () =>
      [...employees].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)),
    [employees],
  );

  const hasMany = sorted.length >= 50;
  const visible = hasMany && !showAll ? sorted.slice(0, 20) : sorted;

  const activeCount = employees.filter((e) => e.status === "active").length;
  const awayCount = employees.filter((e) => e.status === "away").length;
  const offlineCount = employees.filter((e) => e.status === "offline" || e.status === "dnd").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
        <span>
          <span className="text-green-400">🟢</span> {activeCount} Active
        </span>
        <span>
          <span className="text-amber-400">🟡</span> {awayCount} Away
        </span>
        <span>
          <span className="text-gray-500">⚫</span> {offlineCount} Offline
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((emp) => (
          <EmployeeCard
            key={emp.id}
            employee={emp}
            isSelected={selectedEmployeeId === emp.id}
            onSelect={onSelectEmployee}
            now={now}
          />
        ))}
      </div>

      {hasMany && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-1 self-start rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-gray-400 hover:border-[#3A3A3A] hover:text-white transition-colors"
        >
          Show {sorted.length - 20} more
        </button>
      )}
    </div>
  );
}
