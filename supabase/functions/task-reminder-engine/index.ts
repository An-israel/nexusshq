// task-reminder-engine/index.ts
// Schedule: 0 7 * * 1-5  (07:00 UTC weekdays = 08:00 WAT)
//
// For each active workspace:
//   1. Skip if task_reminders_enabled = false
//   2. For each active employee, run three reminder steps:
//      - Step 1: Due today  → in-app + email + WhatsApp (if opted-in)
//      - Step 2: Due tomorrow → in-app only
//      - Step 3: Due in 3 days (high/urgent priority) → in-app only

import {
  supabase,
  todayWAT,
  dateOffsetWAT,
  isWeekday,
  getActiveWorkspaces,
  getAutomationSettings,
  logAutomation,
  sendNotification,
  enqueueEmail,
  notifyUserWhatsApp,
  emailHeader,
  emailFooter,
  emailButton,
  APP_URL,
} from "../_shared/helpers.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string;
  email: string;
  whatsapp_opt_in: boolean | null;
  phone: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  progress_percent: number;
  assigned_to: string;
  workspace_id: string;
}

// ── Email builders ────────────────────────────────────────────────────────────

function buildDueTodayEmail(task: Task, profile: Profile): string {
  const progress = task.progress_percent ?? 0;
  const progressColor = progress >= 80 ? "#16a34a" : progress >= 40 ? "#d97706" : "#dc2626";

  return (
    emailHeader("⏰ Task Due Today", "#d97706") +
    `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi <strong>${profile.full_name}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      This is your morning reminder that the following task is <strong>due today</strong>.
      Please make sure it's completed before end of day.
    </p>

    <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:18px 20px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Task</p>
      <h2 style="margin:0 0 8px;font-size:18px;color:#78350f;font-weight:700;">${task.title}</h2>
      ${task.description ? `<p style="margin:0;font-size:14px;color:#92400e;">${task.description}</p>` : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Priority</td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;text-transform:capitalize;">${task.priority}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:13px;">Current Progress</td>
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:${progressColor};">${progress}%</td>
      </tr>
    </table>

    <div style="background:#f3f4f6;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
      <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
        <div style="background:${progressColor};height:100%;width:${progress}%;border-radius:4px;"></div>
      </div>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;text-align:right;">${progress}% complete</p>
    </div>
    ` +
    emailButton("Open Task in Nexus HQ →", APP_URL, "#d97706") +
    emailFooter()
  );
}

// ── Step processors ───────────────────────────────────────────────────────────

async function processDueToday(
  task: Task,
  profile: Profile,
  workspaceId: string
): Promise<void> {
  // In-app notification
  await sendNotification(
    profile.id,
    workspaceId,
    "task_due_soon",
    `⏰ Due today: ${task.title}`,
    `This task is due today. Current progress: ${task.progress_percent}%`,
    task.id
  );

  // Email
  await enqueueEmail(
    profile.email,
    `⏰ Due Today: ${task.title}`,
    buildDueTodayEmail(task, profile)
  );

  // WhatsApp (if opted-in)
  await notifyUserWhatsApp(
    profile.id,
    `⏰ *Nexus HQ Reminder*\nYour task "*${task.title}*" is due today.\nCurrent progress: ${task.progress_percent}%\nLog in to update: ${APP_URL}`
  );

  await logAutomation(
    workspaceId,
    "task_reminder_engine",
    profile.id,
    { task_id: task.id, task_title: task.title, step: "due_today" },
    "success"
  );
}

async function processDueTomorrow(
  task: Task,
  profile: Profile,
  workspaceId: string
): Promise<void> {
  await sendNotification(
    profile.id,
    workspaceId,
    "task_due_soon",
    `📅 Due tomorrow: ${task.title}`,
    `This task is due tomorrow. Current progress: ${task.progress_percent}%`,
    task.id
  );

  await logAutomation(
    workspaceId,
    "task_reminder_engine",
    profile.id,
    { task_id: task.id, task_title: task.title, step: "due_tomorrow" },
    "success"
  );
}

async function processDueIn3Days(
  task: Task,
  profile: Profile,
  workspaceId: string
): Promise<void> {
  await sendNotification(
    profile.id,
    workspaceId,
    "task_due_soon",
    `📌 Due in 3 days: ${task.title}`,
    `This ${task.priority}-priority task is due in 3 days. Current progress: ${task.progress_percent}%`,
    task.id
  );

  await logAutomation(
    workspaceId,
    "task_reminder_engine",
    profile.id,
    { task_id: task.id, task_title: task.title, step: "due_in_3_days", priority: task.priority },
    "success"
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    // Guard: only run on weekdays (WAT)
    if (!isWeekday()) {
      console.log("[task-reminder-engine] Skipping — not a weekday in WAT.");
      return Response.json({ ok: true, skipped: true, reason: "not_weekday" });
    }

    const today = todayWAT();
    const tomorrow = dateOffsetWAT(1);
    const inThreeDays = dateOffsetWAT(3);

    const workspaces = await getActiveWorkspaces();
    console.log(`[task-reminder-engine] Processing ${workspaces.length} workspace(s). Date: ${today}`);

    const summary = {
      workspaces_processed: 0,
      workspaces_skipped: 0,
      due_today: 0,
      due_tomorrow: 0,
      due_in_3_days: 0,
      errors: 0,
    };

    for (const workspace of workspaces) {
      const workspaceId = workspace.id;

      // ── 1. Check automation settings ──────────────────────────────────────
      const settings = await getAutomationSettings(workspaceId);

      if (!settings?.task_reminders_enabled) {
        console.log(`[task-reminder-engine] [${workspace.name}] task_reminders_enabled=false — skipping.`);
        await logAutomation(workspaceId, "task_reminder_engine", null, { reason: "task_reminders_disabled" }, "skipped");
        summary.workspaces_skipped++;
        continue;
      }

      summary.workspaces_processed++;

      // ── 2. Fetch all active employees for this workspace ──────────────────
      const { data: members, error: membersErr } = await supabase
        .from("workspace_members")
        .select(
          `user_id,
           profiles!workspace_members_user_id_fkey (
             id, full_name, email, whatsapp_opt_in, phone
           )`
        )
        .eq("workspace_id", workspaceId)
        .eq("role", "employee");

      if (membersErr) {
        console.error(`[task-reminder-engine] [${workspace.name}] Failed to fetch members:`, membersErr.message);
        await logAutomation(workspaceId, "task_reminder_engine", null, { error: membersErr.message, step: "fetch_members" }, "failed");
        summary.errors++;
        continue;
      }

      const employees = (members ?? [])
        .map((m: any) => m.profiles as Profile | null)
        .filter((p): p is Profile => p !== null && Boolean(p.email));

      console.log(`[task-reminder-engine] [${workspace.name}] ${employees.length} active employee(s).`);

      // ── 3. Process each employee ──────────────────────────────────────────
      for (const profile of employees) {
        // Fetch this employee's relevant tasks in one query
        const { data: tasks, error: tasksErr } = await supabase
          .from("tasks")
          .select("id, title, description, due_date, priority, status, progress_percent, assigned_to, workspace_id")
          .eq("workspace_id", workspaceId)
          .eq("assigned_to", profile.id)
          .neq("status", "completed")
          .in("due_date", [today, tomorrow, inThreeDays]);

        if (tasksErr) {
          console.error(`[task-reminder-engine] [${workspace.name}] Task fetch error for user ${profile.id}:`, tasksErr.message);
          await logAutomation(workspaceId, "task_reminder_engine", profile.id, { error: tasksErr.message, step: "fetch_tasks" }, "failed");
          summary.errors++;
          continue;
        }

        for (const task of tasks ?? []) {
          try {
            if (task.due_date === today) {
              // Step 1 — Due Today
              await processDueToday(task as Task, profile, workspaceId);
              summary.due_today++;
            } else if (task.due_date === tomorrow) {
              // Step 2 — Due Tomorrow
              await processDueTomorrow(task as Task, profile, workspaceId);
              summary.due_tomorrow++;
            } else if (task.due_date === inThreeDays && ["high", "urgent"].includes(task.priority)) {
              // Step 3 — Due in 3 Days (high/urgent only)
              await processDueIn3Days(task as Task, profile, workspaceId);
              summary.due_in_3_days++;
            }
          } catch (taskErr) {
            console.error(
              `[task-reminder-engine] [${workspace.name}] Error processing task ${task.id} for user ${profile.id}:`,
              taskErr
            );
            await logAutomation(
              workspaceId,
              "task_reminder_engine",
              profile.id,
              { task_id: task.id, task_title: task.title, error: String(taskErr), step: "process_task" },
              "failed"
            );
            summary.errors++;
          }
        }
      }

      // ── 4. Workspace summary log ──────────────────────────────────────────
      await logAutomation(
        workspaceId,
        "task_reminder_engine",
        null,
        {
          step: "workspace_summary",
          date: today,
          employees_processed: employees.length,
        },
        "success"
      );
    }

    console.log("[task-reminder-engine] Run complete.", summary);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[task-reminder-engine] Fatal error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
