import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireAnyRole } from "@/lib/role-access";
import { useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useLiveData } from "@/lib/live/use-live-data";
import { LiveHeader } from "@/components/live/LiveHeader";
import { TeamStatusGrid } from "@/components/live/TeamStatusGrid";
import { EmployeeDetailSidebar } from "@/components/live/EmployeeDetailSidebar";
import { AttendanceFeed } from "@/components/live/AttendanceFeed";
import { TaskActivityFeed } from "@/components/live/TaskActivityFeed";
import { OverduePendingPanel } from "@/components/live/OverduePendingPanel";
import { ProductivityOverview } from "@/components/live/ProductivityOverview";
import { ActivityLogPanel } from "@/components/live/ActivityLogPanel";
import { QuickActionsButton } from "@/components/live/QuickActionsButton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/$workspaceSlug/live")({
  beforeLoad: () => requireAnyRole(["admin", "manager"]),
  component: LivePage,
});

function LivePage() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workspaceSlug } = Route.useParams();

  const workspaceId = workspace?.id ?? null;
  const currentUserId = user?.id ?? null;

  const {
    employees,
    attendanceEvents,
    taskActivity,
    activityLog,
    taskCounters,
    deptProductivity,
    timelinePoints,
    overdueTasksWithEmployee,
    pendingDeliverables,
    activeTasks,
    productivityScore,
    isConnected,
    lastUpdated,
    refetch,
  } = useLiveData(workspaceId);

  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);
  const [activityLogCollapsed, setActivityLogCollapsed] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // Employee detail sidebar data
  const selectedEmployee = React.useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const selectedEmployeeTasks = React.useMemo(() => {
    if (!selectedEmployeeId) return [];
    return activeTasks
      .filter((t) => t.assignedTo === selectedEmployeeId)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: "in_progress",
        progress_percent: t.progress,
        priority: t.priority,
        due_date: t.dueDate,
      }));
  }, [activeTasks, selectedEmployeeId]);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  async function handleApproveDeliverable(id: string) {
    const { error } = await supabase
      .from("deliverables")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewer_id: currentUserId })
      .eq("id", id);
    if (error) {
      toast.error("Failed to approve deliverable");
    } else {
      toast.success("Deliverable approved");
    }
  }

  async function handleReviseDeliverable(id: string) {
    const { error } = await supabase
      .from("deliverables")
      .update({ status: "rejected" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to mark for revision");
    } else {
      toast.success("Marked for revision");
    }
  }

  function handleFlagEmployee(employeeId: string, employeeName: string) {
    toast.info(`Use the Quick Actions FAB to flag ${employeeName}`);
  }

  function handleMessageEmployee(employeeId: string) {
    navigate({ to: `/${workspaceSlug}/messages` as any });
    setSelectedEmployeeId(null);
  }

  return (
    <div className="flex flex-col h-full bg-[#0F0F0F] text-white overflow-hidden">
      {/* Header */}
      <LiveHeader
        lastUpdated={lastUpdated}
        isConnected={isConnected}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-6 space-y-8 max-w-[1400px] mx-auto">

            {/* Section 1: Team Status Grid */}
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Team Status
              </h2>
              <TeamStatusGrid
                employees={employees}
                onSelectEmployee={setSelectedEmployeeId}
                selectedEmployeeId={selectedEmployeeId}
              />
            </section>

            {/* Section 2: Attendance Feed */}
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Attendance — Today
              </h2>
              <AttendanceFeed
                events={attendanceEvents}
                employees={employees}
                workspaceId={workspaceId ?? ""}
                currentUserId={currentUserId ?? ""}
              />
            </section>

            {/* Section 3: Task Progress */}
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Task Activity
              </h2>
              <TaskActivityFeed
                events={taskActivity}
                counters={taskCounters}
                activeTasks={activeTasks}
              />
            </section>

            {/* Section 4: Overdue + Pending */}
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Attention Required
              </h2>
              <OverduePendingPanel
                overdueTasks={overdueTasksWithEmployee}
                pendingDeliverables={pendingDeliverables}
                onApproveDeliverable={handleApproveDeliverable}
                onReviseDeliverable={handleReviseDeliverable}
                onFlagEmployee={handleFlagEmployee}
              />
            </section>

            {/* Section 5: Productivity Overview */}
            <section>
              <h2 className="text-base font-semibold text-white mb-3">
                Productivity Overview
              </h2>
              <ProductivityOverview
                score={productivityScore}
                counters={taskCounters}
                deptProductivity={deptProductivity}
                timelinePoints={timelinePoints}
                loading={false}
              />
            </section>

          </div>
        </div>

        {/* Activity Log Panel (right, desktop only) */}
        <ActivityLogPanel
          entries={activityLog}
          isConnected={isConnected}
          lastUpdated={lastUpdated}
          collapsed={activityLogCollapsed}
          onToggleCollapse={() => setActivityLogCollapsed((v) => !v)}
        />
      </div>

      {/* Employee Detail Sidebar */}
      <EmployeeDetailSidebar
        employee={selectedEmployee}
        tasks={selectedEmployeeTasks}
        onClose={() => setSelectedEmployeeId(null)}
        onMessage={handleMessageEmployee}
      />

      {/* Floating Quick Actions Button */}
      {currentUserId && workspaceId && (
        <QuickActionsButton
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          employees={employees.map((e) => ({
            id: e.id,
            full_name: e.full_name,
            department: e.department,
          }))}
        />
      )}
    </div>
  );
}
