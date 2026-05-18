import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Overdue Escalation Engine
// Schedule: 0 9 * * 1-5  (09:00 UTC weekdays = 10:00 WAT)
//
// Day 1 overdue → skipped (handled by auto-status-engine)
// Day 2 overdue → notify employee + managers, email managers
// Day 3+ overdue → notify employee + managers + admins, email admins,
//                  escalate priority to 'urgent', auto-flag employee

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.nexushq.io";

// ── Date helpers ────────────────────────────────────────────────────────────

/** Returns today's date string in WAT (UTC+1) as YYYY-MM-DD */
function todayWAT(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // shift +1h
  return d.toISOString().slice(0, 10);
}

// ── Email HTML builders ─────────────────────────────────────────────────────

function emailWrap(headerBg: string, headerText: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:${headerBg};padding:28px 24px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${headerText}</h1>
    </div>
    <div style="padding:28px 24px;">${body}</div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;background:#fafafa;color:#9ca3af;font-size:12px;text-align:center;">
      Nexus HQ &bull; Automated escalation engine &bull; Do not reply to this email
    </div>
  </div>
</body>
</html>`;
}

function buildManagerEmail(
  employeeName: string,
  taskTitle: string,
  dueDate: string,
  progress: number,
  daysOverdue: number,
): string {
  const body = `
    <p style="color:#374151;margin:0 0 16px;">Hi there,</p>
    <p style="color:#374151;margin:0 0 20px;">
      A task assigned to <strong>${employeeName}</strong> is now
      <strong style="color:#d97706;">${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue</strong>
      and requires your attention.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#fffbeb;">
        <td style="padding:10px 14px;border:1px solid #fde68a;font-weight:600;color:#92400e;width:40%;">Employee</td>
        <td style="padding:10px 14px;border:1px solid #fde68a;color:#374151;">${employeeName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;background:#f9fafb;">Task</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">${taskTitle}</td>
      </tr>
      <tr style="background:#fffbeb;">
        <td style="padding:10px 14px;border:1px solid #fde68a;font-weight:600;color:#92400e;">Due Date</td>
        <td style="padding:10px 14px;border:1px solid #fde68a;color:#374151;">${dueDate}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;background:#f9fafb;">Progress</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">${progress}%</td>
      </tr>
      <tr style="background:#fffbeb;">
        <td style="padding:10px 14px;border:1px solid #fde68a;font-weight:600;color:#92400e;">Days Overdue</td>
        <td style="padding:10px 14px;border:1px solid #fde68a;color:#d97706;font-weight:700;">${daysOverdue}</td>
      </tr>
    </table>
    <a href="${APP_URL}" style="display:inline-block;background:#d97706;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Dashboard →</a>`;
  return emailWrap("#d97706", `⚠ ${employeeName} — Task 2 Days Overdue`, body);
}

function buildAdminEmail(
  employeeName: string,
  taskTitle: string,
  dueDate: string,
  progress: number,
  daysOverdue: number,
  assignedByName: string,
): string {
  const body = `
    <p style="color:#374151;margin:0 0 16px;">Hi there,</p>
    <p style="color:#374151;margin:0 0 20px;">
      This is a critical escalation. A task assigned to <strong>${employeeName}</strong> is now
      <strong style="color:#dc2626;">${daysOverdue} days overdue</strong>.
      The employee has been automatically flagged and the task priority has been escalated to
      <strong style="color:#dc2626;">Urgent</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#fef2f2;">
        <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:600;color:#991b1b;width:40%;">Employee</td>
        <td style="padding:10px 14px;border:1px solid #fecaca;color:#374151;">${employeeName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;background:#f9fafb;">Task</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">${taskTitle}</td>
      </tr>
      <tr style="background:#fef2f2;">
        <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:600;color:#991b1b;">Original Due Date</td>
        <td style="padding:10px 14px;border:1px solid #fecaca;color:#374151;">${dueDate}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;background:#f9fafb;">Current Progress</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#374151;">${progress}%</td>
      </tr>
      <tr style="background:#fef2f2;">
        <td style="padding:10px 14px;border:1px solid #fecaca;font-weight:600;color:#991b1b;">Assigned By</td>
        <td style="padding:10px 14px;border:1px solid #fecaca;color:#374151;">${assignedByName}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;background:#f9fafb;">Days Overdue</td>
        <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:700;">${daysOverdue}</td>
      </tr>
    </table>
    <a href="${APP_URL}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Take Action →</a>`;
  return emailWrap(
    "#dc2626",
    `🔴 Critical: ${employeeName} — Task ${daysOverdue} Days Overdue`,
    body,
  );
}

// ── Supabase helpers ────────────────────────────────────────────────────────

async function sendNotification(
  userId: string,
  workspaceId: string,
  type: string,
  title: string,
  message: string,
  taskId?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    workspace_id: workspaceId,
    type,
    title,
    message,
    is_read: false,
  };
  if (taskId) payload.related_task_id = taskId;
  await supabase.from("notifications").insert(payload);
}

async function enqueueEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await supabase
    .rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: { to, subject, html },
    })
    .catch((e: unknown) =>
      console.error(`enqueue_email failed for ${to}:`, e)
    );
}

async function logAutomation(
  workspaceId: string,
  automationType: string,
  status: "success" | "failed" | "skipped",
  triggeredFor: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  await supabase.from("automation_logs").insert({
    workspace_id: workspaceId,
    automation_type: automationType,
    status,
    triggered_for: triggeredFor,
    details,
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const today = todayWAT();
  const todayMs = new Date(today).getTime();
  const summary = { workspaces: 0, tasksProcessed: 0, escalations2d: 0, escalations3d: 0, errors: 0 };

  try {
    // Fetch all active workspaces
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("id")
      .eq("is_active", true);

    if (wsErr) throw new Error(`Failed to fetch workspaces: ${wsErr.message}`);

    for (const workspace of workspaces ?? []) {
      const workspaceId: string = workspace.id;
      summary.workspaces++;

      try {
        // Check automation settings
        const { data: settings } = await supabase
          .from("automation_settings")
          .select("overdue_escalation_enabled")
          .eq("workspace_id", workspaceId)
          .single();

        if (!settings?.overdue_escalation_enabled) {
          console.log(`Workspace ${workspaceId}: overdue_escalation_enabled=false, skipping`);
          continue;
        }

        // Fetch overdue tasks with assignee and assigner profiles
        const { data: tasks, error: tasksErr } = await supabase
          .from("tasks")
          .select(`
            id, title, due_date, progress_percent, priority,
            assigned_to, assigned_by,
            assignee:profiles!tasks_assigned_to_fkey(id, full_name, email, whatsapp_opt_in),
            assigner:profiles!tasks_assigned_by_fkey(id, full_name)
          `)
          .eq("status", "overdue")
          .eq("workspace_id", workspaceId);

        if (tasksErr) {
          console.error(`Workspace ${workspaceId}: tasks query error:`, tasksErr.message);
          summary.errors++;
          continue;
        }

        // Fetch workspace managers
        const { data: managerMembers } = await supabase
          .from("workspace_members")
          .select("user_id, profiles(id, full_name, email)")
          .eq("workspace_id", workspaceId)
          .eq("role", "manager");

        // Fetch workspace admins (includes owners)
        const { data: adminMembers } = await supabase
          .from("workspace_members")
          .select("user_id, profiles(id, full_name, email)")
          .eq("workspace_id", workspaceId)
          .in("role", ["admin", "owner"]);

        const managers = (managerMembers ?? []).map((m) => (m as any).profiles as { id: string; full_name: string | null; email: string | null } | null).filter(Boolean) as { id: string; full_name: string | null; email: string | null }[];
        const admins = (adminMembers ?? []).map((m) => (m as any).profiles as { id: string; full_name: string | null; email: string | null } | null).filter(Boolean) as { id: string; full_name: string | null; email: string | null }[];

        for (const task of tasks ?? []) {
          summary.tasksProcessed++;

          const dueMs = new Date(task.due_date).getTime();
          const daysOverdue = Math.floor((todayMs - dueMs) / 86_400_000);

          if (daysOverdue <= 1) {
            // Day 1: handled by auto-status-engine on the day it goes overdue
            continue;
          }

          const assignee = (task as any).assignee as { id: string; full_name: string | null; email: string | null; whatsapp_opt_in: boolean } | null;
          const assigner = (task as any).assigner as { id: string; full_name: string | null } | null;
          const employeeName = assignee?.full_name ?? "Unknown Employee";
          const assignedByName = assigner?.full_name ?? "Unknown";
          const progress = task.progress_percent ?? 0;
          const dueDate = task.due_date;

          if (daysOverdue === 2) {
            // ── 2 days overdue ───────────────────────────────────────────

            // Notify employee
            if (task.assigned_to) {
              await sendNotification(
                task.assigned_to,
                workspaceId,
                "task_overdue",
                `⚠️ Task 2 days overdue: ${task.title}`,
                `Your task "${task.title}" is 2 days past its due date. Please update your progress or reach out to your manager.`,
                task.id,
              );
            }

            // Notify each manager + send manager email
            for (const manager of managers) {
              if (!manager?.id) continue;

              await sendNotification(
                manager.id,
                workspaceId,
                "task_overdue",
                `⚠️ ${employeeName} has a task 2 days overdue: ${task.title}`,
                `${employeeName}'s task "${task.title}" is 2 days overdue (${progress}% complete).`,
                task.id,
              );

              if (manager.email) {
                await enqueueEmail(
                  manager.email,
                  `⚠ ${employeeName} has a task 2 days overdue: ${task.title}`,
                  buildManagerEmail(employeeName, task.title, dueDate, progress, daysOverdue),
                );
              }
            }

            await logAutomation(workspaceId, "overdue_escalation_2d", "success", task.assigned_to ?? null, {
              days_overdue: daysOverdue,
              task_id: task.id,
              task_title: task.title,
            });

            summary.escalations2d++;
          } else {
            // ── 3+ days overdue ──────────────────────────────────────────

            // Notify employee
            if (task.assigned_to) {
              await sendNotification(
                task.assigned_to,
                workspaceId,
                "task_overdue",
                `🔴 Task ${daysOverdue} days overdue: ${task.title}`,
                `Your task "${task.title}" is critically overdue (${daysOverdue} days). Immediate action is required.`,
                task.id,
              );
            }

            // Notify all managers
            for (const manager of managers) {
              if (!manager?.id) continue;
              await sendNotification(
                manager.id,
                workspaceId,
                "task_overdue",
                `🔴 ${employeeName} — task ${daysOverdue} days overdue: ${task.title}`,
                `${employeeName}'s task "${task.title}" is ${daysOverdue} days overdue (${progress}% complete).`,
                task.id,
              );
            }

            // Notify all admins + email each admin
            for (const admin of admins) {
              if (!admin?.id) continue;

              await sendNotification(
                admin.id,
                workspaceId,
                "task_overdue",
                `🔴 Critical: ${employeeName} — task ${daysOverdue} days overdue`,
                `${employeeName}'s task "${task.title}" is ${daysOverdue} days overdue. Priority has been escalated to urgent.`,
                task.id,
              );

              if (admin.email) {
                await enqueueEmail(
                  admin.email,
                  `🔴 Critical: ${employeeName} — task ${daysOverdue} days overdue`,
                  buildAdminEmail(employeeName, task.title, dueDate, progress, daysOverdue, assignedByName),
                );
              }
            }

            // Escalate priority to 'urgent' if not already
            if (task.priority !== "urgent") {
              const { error: priorityErr } = await supabase
                .from("tasks")
                .update({ priority: "urgent" })
                .eq("id", task.id);
              if (priorityErr) {
                console.error(`Failed to escalate priority for task ${task.id}:`, priorityErr.message);
              }
            }

            // Auto-flag employee if no unresolved flag exists for this task
            if (task.assigned_to) {
              const flagReason = `Task overdue for ${daysOverdue} days: ${task.title}`;
              const flagReasonPattern = `Task overdue for%: ${task.title}`;

              const { data: existingFlags } = await supabase
                .from("flags")
                .select("id")
                .eq("flagged_user_id", task.assigned_to)
                .eq("is_resolved", false)
                .like("reason", flagReasonPattern)
                .limit(1);

              if (!existingFlags || existingFlags.length === 0) {
                const { error: flagErr } = await supabase.from("flags").insert({
                  flagged_user_id: task.assigned_to,
                  flagged_by: null,
                  reason: flagReason,
                  severity: "medium",
                  is_resolved: false,
                  workspace_id: workspaceId,
                });
                if (flagErr) {
                  console.error(`Failed to insert flag for user ${task.assigned_to}:`, flagErr.message);
                }
              }
            }

            await logAutomation(workspaceId, "overdue_escalation_critical", "success", task.assigned_to ?? null, {
              days_overdue: daysOverdue,
              task_id: task.id,
              task_title: task.title,
            });

            summary.escalations3d++;
          }
        }
      } catch (wsError: unknown) {
        console.error(`Error processing workspace ${workspaceId}:`, wsError);
        await logAutomation(workspaceId, "overdue_escalation_engine", "failed", null, {
          error: String(wsError),
        }).catch(() => {});
        summary.errors++;
      }
    }

    console.log("Overdue escalation engine complete:", summary);
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Fatal error in overdue-escalation-engine:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
