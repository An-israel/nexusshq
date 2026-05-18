import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Download, FileText, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";
import { type DateRange, type DateRangePreset, getDateRange } from "@/lib/reports/date-ranges";

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  last_3_months: "Last 3 Months",
  custom: "Custom",
};

const PRESETS: DateRangePreset[] = [
  "today",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_3_months",
  "custom",
];

interface ReportFilterBarProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  departmentFilter: string | null;
  onDepartmentChange: (dept: string | null) => void;
  employeeFilter: string | null;
  onEmployeeChange: (id: string | null) => void;
  employees: Array<{ id: string; full_name: string | null; department: string | null }>;
  onGenerate: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  exportingCsv: boolean;
  exportingPdf: boolean;
}

export function ReportFilterBar({
  dateRange,
  onDateRangeChange,
  departmentFilter,
  onDepartmentChange,
  employeeFilter,
  onEmployeeChange,
  employees,
  onGenerate,
  onExportCsv,
  onExportPdf,
  exportingCsv,
  exportingPdf,
}: ReportFilterBarProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<string>(() => format(dateRange.start, "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(() => format(dateRange.end, "yyyy-MM-dd"));

  function handlePresetClick(preset: DateRangePreset) {
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    onDateRangeChange(getDateRange(preset));
  }

  function applyCustomRange() {
    if (customFrom && customTo) {
      onDateRangeChange(getDateRange("custom", new Date(customFrom), new Date(customTo)));
      setCustomOpen(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
      <div className="flex flex-wrap gap-2 px-4 py-3 items-center">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {PRESETS.map((preset) => {
            const isActive = dateRange.preset === preset;
            if (preset === "custom") {
              return (
                <Popover key={preset} open={customOpen} onOpenChange={setCustomOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "px-3 py-1 text-xs rounded-full font-medium transition-colors",
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                      )}
                      onClick={() => handlePresetClick("custom")}
                    >
                      {PRESET_LABELS.custom}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 space-y-3" align="start">
                    <p className="text-xs font-semibold text-foreground">Custom date range</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">From</label>
                        <input
                          type="date"
                          value={customFrom}
                          max={customTo}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">To</label>
                        <input
                          type="date"
                          value={customTo}
                          min={customFrom}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={applyCustomRange}>
                      Apply
                    </Button>
                  </PopoverContent>
                </Popover>
              );
            }
            return (
              <button
                key={preset}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80",
                )}
              >
                {PRESET_LABELS[preset]}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />

        {/* Department select */}
        <Select
          value={departmentFilter ?? "__all__"}
          onValueChange={(v) => onDepartmentChange(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Departments</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {deptLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employee select */}
        <Select
          value={employeeFilter ?? "__all__"}
          onValueChange={(v) => onEmployeeChange(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name ?? e.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={onGenerate}
          >
            <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
            Generate Report
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onExportCsv}
            disabled={exportingCsv}
          >
            {exportingCsv ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={onExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 mr-1.5" />
            )}
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
