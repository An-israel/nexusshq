import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requireAnyRole } from "@/lib/role-access";
import { useWorkspace } from "@/lib/workspace-context";
import { supabase } from "@/integrations/supabase/client";
import { getDateRange } from "@/lib/reports/date-ranges";
import { useReportData } from "@/lib/reports/use-report-data";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import { Section1DailyProductivity } from "@/components/reports/Section1DailyProductivity";
import { Section2AttendanceSummary } from "@/components/reports/Section2AttendanceSummary";
import { Section3TaskCompletion } from "@/components/reports/Section3TaskCompletion";
import { Section4PerformanceTrends } from "@/components/reports/Section4PerformanceTrends";
import { Section5KpiReports } from "@/components/reports/Section5KpiReports";
import { Section6StaffAttention } from "@/components/reports/Section6StaffAttention";
import { Section7TopPerformers } from "@/components/reports/Section7TopPerformers";
import type { DateRange } from "@/lib/reports/date-ranges";

export const Route = createFileRoute("/_app/$workspaceSlug/reports")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: ReportsPage,
});

function ReportsPage() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [dateRange, setDateRange] = React.useState<DateRange>(() => getDateRange("this_month"));
  const [deptFilter, setDeptFilter] = React.useState<string | null>(null);
  const [employeeFilter, setEmployeeFilter] = React.useState<string | null>(null);
  const [employees, setEmployees] = React.useState<
    Array<{ id: string; full_name: string | null; department: string | null }>
  >([]);
  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [exportingPdf, setExportingPdf] = React.useState(false);

  const { data, loading, generate } = useReportData(workspaceId);

  // Load employees for the filter dropdown
  React.useEffect(() => {
    if (!workspaceId) return;
    void supabase
      .from("profiles")
      .select("id, full_name, department")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .then(({ data }) => {
        setEmployees(
          (data ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
            department: p.department,
          })),
        );
      });
  }, [workspaceId]);

  // Auto-generate on mount
  React.useEffect(() => {
    if (!workspaceId) return;
    void generate(dateRange, deptFilter, employeeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  function handleGenerate() {
    void generate(dateRange, deptFilter, employeeFilter);
  }

  function handleExportCsv() {
    setExportingCsv(true);
    try {
      const rows = data.taskEmployeeRows.map((r) => ({
        employee: r.name,
        assigned: r.assigned,
        completed: r.completed,
        overdue: r.overdue,
        on_time_pct: r.onTimePct.toFixed(0),
        avg_days: r.avgDays.toFixed(1),
      }));
      if (!rows.length) return;
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(","),
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexxos-report-${dateRange.preset}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  function handleExportPdf() {
    setExportingPdf(true);
    setTimeout(() => {
      window.print();
      setExportingPdf(false);
    }, 100);
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      <ReportFilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        departmentFilter={deptFilter}
        onDepartmentChange={setDeptFilter}
        employeeFilter={employeeFilter}
        onEmployeeChange={setEmployeeFilter}
        employees={employees}
        onGenerate={handleGenerate}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        exportingCsv={exportingCsv}
        exportingPdf={exportingPdf}
      />

      <div className="flex-1 px-4 md:px-6 py-6 space-y-10 max-w-6xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dateRange.label} · {workspace?.name}
          </p>
        </div>

        <Section1DailyProductivity
          stats={data.prodStats}
          chartData={data.prodChart}
          heatmap={data.prodHeatmap}
          loading={loading}
        />

        <Section2AttendanceSummary
          stats={data.attStats}
          trend={data.attTrend}
          punctuality={data.attPunctuality}
          matrix={data.attMatrix}
          loading={loading}
          dateRange={dateRange}
        />

        <Section3TaskCompletion
          stats={data.taskStats}
          employeeRows={data.taskEmployeeRows}
          deptPoints={data.taskDeptPoints}
          velocityPoints={data.taskVelocity}
          loading={loading}
          dateRange={dateRange}
        />

        <Section4PerformanceTrends
          stats={data.perfStats}
          trend={data.perfTrend}
          distribution={data.perfDistribution}
          departmentFilter={deptFilter}
          loading={loading}
        />

        <Section5KpiReports kpiRows={data.kpiRows} loading={loading} dateRange={dateRange} />

        <Section6StaffAttention rows={data.attentionRows} loading={loading} dateRange={dateRange} />

        <Section7TopPerformers
          topFive={data.topFive}
          mostConsistent={data.mostConsistent}
          mostImproved={data.mostImproved}
          loading={loading}
        />
      </div>
    </div>
  );
}
