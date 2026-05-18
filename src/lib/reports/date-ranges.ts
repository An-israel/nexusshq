import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  subWeeks,
  format,
  eachDayOfInterval,
  isWeekend,
  differenceInCalendarDays,
  getDay,
} from "date-fns";

export type DateRangePreset =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
  preset: DateRangePreset;
}

/**
 * Returns start and end Date objects for each preset.
 * Week starts on Monday (weekStartsOn: 1).
 */
export function getDateRange(
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date,
): DateRange {
  const now = new Date();

  switch (preset) {
    case "today": {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return { start, end, label: format(start, "MMM d, yyyy"), preset };
    }

    case "this_week": {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        preset,
      };
    }

    case "last_week": {
      const lastWeekAny = subWeeks(now, 1);
      const start = startOfWeek(lastWeekAny, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeekAny, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        preset,
      };
    }

    case "this_month": {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return {
        start,
        end,
        label: format(start, "MMMM yyyy"),
        preset,
      };
    }

    case "last_month": {
      const lastMonth = subMonths(now, 1);
      const start = startOfMonth(lastMonth);
      const end = endOfMonth(lastMonth);
      return {
        start,
        end,
        label: format(start, "MMMM yyyy"),
        preset,
      };
    }

    case "last_3_months": {
      const start = startOfMonth(subMonths(now, 2));
      const end = endOfMonth(now);
      return {
        start,
        end,
        label: `${format(start, "MMM yyyy")} – ${format(end, "MMM yyyy")}`,
        preset,
      };
    }

    case "custom": {
      const start = startOfDay(customStart ?? now);
      const end = endOfDay(customEnd ?? now);
      return {
        start,
        end,
        label: `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`,
        preset,
      };
    }
  }
}

/**
 * Format a date range as a display label: "May 1 – May 31, 2026"
 */
export function formatDateRangeLabel(range: DateRange): string {
  const { start, end } = range;
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) {
      return format(start, "MMM d, yyyy");
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  }
  return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
}

/**
 * Get all working days (Mon–Fri) within a date range (inclusive).
 */
export function getWorkingDays(start: Date, end: Date): Date[] {
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
}

/**
 * Convert a Date to an ISO date string "YYYY-MM-DD".
 */
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Get the day of week as 0–6 where 0 = Monday and 6 = Sunday.
 * date-fns getDay() returns 0=Sunday … 6=Saturday, so we remap.
 */
export function dayOfWeekMon0(d: Date): number {
  const dow = getDay(d); // 0=Sun, 1=Mon … 6=Sat
  return dow === 0 ? 6 : dow - 1;
}

/**
 * Get the previous period of the same calendar length (for trend comparison).
 * The previous period ends the day before the current period starts and has
 * the same number of calendar days.
 */
export function getPreviousPeriod(range: DateRange): DateRange {
  const length = differenceInCalendarDays(range.end, range.start) + 1;
  const prevEnd = new Date(range.start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (length - 1));

  return {
    start: startOfDay(prevStart),
    end: endOfDay(prevEnd),
    label: `${format(prevStart, "MMM d")} – ${format(prevEnd, "MMM d, yyyy")}`,
    preset: "custom",
  };
}
