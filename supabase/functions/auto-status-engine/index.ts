// auto-status-engine/index.ts
// Schedule: 1 0 * * *  (00:01 UTC daily)
//
// For each active workspace (if auto_status_enabled):
//   Step 1 — Mark tasks as overdue where due_date < today and not yet completed/overdue
//   Step 2 — Auto-complete tasks at 100% progress that haven't been marked complete
//   Step 3 — Spawn new instances of completed daily recurring tasks

import {
  supabase,
  todayWAT,
  getActiveWorkspaces,
  getAutomationSettings,
  logAutomation,
  sendNotification,
  enqueueEmail,
  emailHeader,
  emailFooter,
  emailButton,
  APP_URL,
} from "../_shared/helpers.ts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  status: string;
  progress_percent: number;
  task_type: string;
  assigned_to: string;
  assigned_by: string | null;
  kpi_id: string | null;
  workspace_id: string;
  completed_at: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

// ── Email builders ────────────────────────────────────────────────────────────

function buildOverdueEmail(task: Task, employeeName: string): string {
  return (
    emailHeader("🔴 Task Is Now Overdue", "#dc2626") +
    `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;">Hi <strong>${employeeName}</strong>,</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;">
      The following task has passed its due date and has been marked <strong style="color:#dc2626;">overdue</strong>.
      Your manager has been notified. Please update the task or contact your manager as soon as possible.
    </p>

    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:18px 20px;border-radius:6px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Overdue Task</p>
      <h2 style="margin:0 0 8px;font-size:18px;color:#7f1d1d;font-weight:700;">${task.title}</h2>
      ${task.description ? `<p style="margin:0;font-size:14px;color:#991b1b;">${task.description}</p>` : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;width:40%;">Due Date</td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#dc2626;">${task.due_date}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Priority</td>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827;text-transform:capitalize;">${task.priority}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#6b7280;font-size:13px;">Progress at Due Date</td>
        <td style="padding:10px 0;font-size:13px;font-weight:700;color:#dc2626;">${task.progress_percent}%</td>
      </tr>
    </table>

    <div style="background:#fef2f2;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#991b1b;">
        ⚠️ <strong>Warning:</strong> This task is overdue. Your manager has been notified.
        Please take immediate action.
      </p>
    </div>
    ` +
    emailButton("Update Task Now →", APP_URL, "#dc2626") +
    emailFooter()
  );
}

// ── Step 1: Mark overdue tasks ────────────────────────────────────────────────

async function runMarkOverdue(workspaceId: string, today: string): Promise<number> {
  const { data: overdueTasks, error: fetchErr } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, priority, status, progress_percent, task_type, assigned_to, assigned_by, kpi_id, workspace_id, completed_at",
    )
    .eq("workspace_id", workspaceId)
    .lt("due_date", today)
    .not("status", "in", '("completed","overdue")');

  if (fetchErr) {
    console.error(`[auto-status-engine] [${workspaceId}] Step 1 fetch error:`, fetchErr.message);
    await logAutomation(
      workspaceId,
      "auto_status_engine",
      null,
      { step: "mark_overdue", error: fetchErr.message },
      "failed",
    );
    return 0;
  }

  const tasks = (overdueTasks ?? []) as Task[];
  let count = 0;

  // Find manager/admin for this workspace (used to notify on each overdue task)
  const { data: managerRows } = await supabase
    .from("workspace_members")
    .select("user_id, profiles!workspace_members_user_id_fkey(id, full_name, email)")
    .eq("workspace_id", workspaceId)
    .in("role", ["manager", "admin"])
    .limit(1);

  const managerProfile = ((managerRows?.[0] as any)?.profiles as Profile | null) ?? null;

  for (const task of tasks) {
    try {
      // 1a. Update task status
      const { error: updateErr } = await supabase
        .from("tasks")
        .update({
          status: "overdue",
          has_warning: true,
          warning_message: "This task is overdue. Your manager has been notified.",
        })
        .eq("id", task.id);

      if (updateErr) {
        throw new Error(`Update failed: ${updateErr.message}`);
      }

      // 1b. Fetch employee profile
      const { data: empRow, error: empErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", task.assigned_to)
        .maybeSingle();

      if (empErr) throw new Error(`Employee profile fetch failed: ${empErr.message}`);
      const employee = empRow as Profile | null;
      const employeeName = employee?.full_name ?? "Team member";

      // 1c. Notify employee
      await sendNotification(
        task.assigned_to,
        workspaceId,
        "task_overdue",
        `🔴 Task overdue: ${task.title}`,
        `Your task "${task.title}" (due ${task.due_date}) is now overdue. Your manager has been notified.`,
        task.id,
      );

      // 1d. Notify manager
      if (managerProfile) {
        await sendNotification(
          managerProfile.id,
          workspaceId,
          "task_overdue",
          `🔴 ${employeeName}'s task '${task.title}' is now overdue.`,
          `${employeeName}'s task "${task.title}" was due on ${task.due_date} and is now overdue (${task.progress_percent}% complete).`,
          task.id,
        );
      }

      // 1e. Email employee
      if (employee?.email) {
        await enqueueEmail(
          employee.email,
          `🔴 Overdue Task: ${task.title}`,
          buildOverdueEmail(task, employeeName),
        );
      }

      // 1f. Log
      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        {
          task_id: task.id,
          task_title: task.title,
          due_date: task.due_date,
          progress_percent: task.progress_percent,
          step: "mark_overdue",
          manager_notified: managerProfile?.id ?? null,
        },
        "success",
      );

      count++;
    } catch (err) {
      console.error(`[auto-status-engine] [${workspaceId}] Step 1 error for task ${task.id}:`, err);
      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        { task_id: task.id, task_title: task.title, step: "mark_overdue", error: String(err) },
        "failed",
      );
    }
  }

  return count;
}

// ── Step 2: Auto-complete at 100% ─────────────────────────────────────────────

async function runAutoComplete(workspaceId: string): Promise<number> {
  const { data: readyTasks, error: fetchErr } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, priority, status, progress_percent, task_type, assigned_to, assigned_by, kpi_id, workspace_id, completed_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("status", "in_progress")
    .eq("progress_percent", 100)
    .is("completed_at", null);

  if (fetchErr) {
    console.error(`[auto-status-engine] [${workspaceId}] Step 2 fetch error:`, fetchErr.message);
    await logAutomation(
      workspaceId,
      "auto_status_engine",
      null,
      { step: "auto_complete", error: fetchErr.message },
      "failed",
    );
    return 0;
  }

  const tasks = (readyTasks ?? []) as Task[];
  let count = 0;

  for (const task of tasks) {
    try {
      const completedAt = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", task.id);

      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

      // Notify employee
      await sendNotification(
        task.assigned_to,
        workspaceId,
        "task_due_soon", // reuse task_due_soon as specified
        `✅ Task auto-completed: ${task.title}`,
        `Your task "${task.title}" reached 100% progress and has been automatically marked as completed.`,
        task.id,
      );

      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        {
          task_id: task.id,
          task_title: task.title,
          completed_at: completedAt,
          step: "auto_complete",
        },
        "success",
      );

      count++;
    } catch (err) {
      console.error(`[auto-status-engine] [${workspaceId}] Step 2 error for task ${task.id}:`, err);
      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        { task_id: task.id, task_title: task.title, step: "auto_complete", error: String(err) },
        "failed",
      );
    }
  }

  return count;
}

// ── Step 3: Spawn recurring daily task instances ──────────────────────────────

async function runRecurringDaily(workspaceId: string, today: string): Promise<number> {
  // Find completed daily tasks whose completed_at is before today
  const { data: completedDailies, error: fetchErr } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, priority, status, progress_percent, task_type, assigned_to, assigned_by, kpi_id, workspace_id, completed_at",
    )
    .eq("workspace_id", workspaceId)
    .eq("task_type", "daily")
    .eq("status", "completed")
    .lt("completed_at", today); // completed_at is a timestamptz; comparing to date works for "before today"

  if (fetchErr) {
    console.error(`[auto-status-engine] [${workspaceId}] Step 3 fetch error:`, fetchErr.message);
    await logAutomation(
      workspaceId,
      "auto_status_engine",
      null,
      { step: "recurring_daily", error: fetchErr.message },
      "failed",
    );
    return 0;
  }

  const tasks = (completedDailies ?? []) as Task[];
  let count = 0;

  for (const task of tasks) {
    try {
      // Check whether a non-completed task with the same title + assignee already exists for today
      const { data: existing, error: checkErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("title", task.title)
        .eq("assigned_to", task.assigned_to)
        .eq("due_date", today)
        .neq("status", "completed")
        .maybeSingle();

      if (checkErr) throw new Error(`Duplicate check failed: ${checkErr.message}`);

      // Task for today already exists — skip
      if (existing) {
        await logAutomation(
          workspaceId,
          "auto_status_engine",
          task.assigned_to,
          {
            task_id: task.id,
            task_title: task.title,
            step: "recurring_daily",
            reason: "already_exists_for_today",
          },
          "skipped",
        );
        continue;
      }

      // Insert new daily task instance for today
      const { data: newTask, error: insertErr } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          assigned_to: task.assigned_to,
          assigned_by: task.assigned_by,
          kpi_id: task.kpi_id,
          priority: task.priority,
          task_type: "daily",
          workspace_id: workspaceId,
          due_date: today,
          status: "todo",
          progress_percent: 0,
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

      // Notify employee
      await sendNotification(
        task.assigned_to,
        workspaceId,
        "task_assigned",
        `📋 Recurring task ready: ${task.title}`,
        `Your daily recurring task "${task.title}" is ready for today. Get it done!`,
        newTask.id,
      );

      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        {
          source_task_id: task.id,
          new_task_id: newTask.id,
          task_title: task.title,
          due_date: today,
          step: "recurring_daily",
        },
        "success",
      );

      count++;
    } catch (err) {
      console.error(`[auto-status-engine] [${workspaceId}] Step 3 error for task ${task.id}:`, err);
      await logAutomation(
        workspaceId,
        "auto_status_engine",
        task.assigned_to,
        { task_id: task.id, task_title: task.title, step: "recurring_daily", error: String(err) },
        "failed",
      );
    }
  }

  return count;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    const today = todayWAT();
    const workspaces = await getActiveWorkspaces();

    console.log(
      `[auto-status-engine] Processing ${workspaces.length} workspace(s). Date: ${today}`,
    );

    const summary = {
      workspaces_processed: 0,
      workspaces_skipped: 0,
      marked_overdue: 0,
      auto_completed: 0,
      recurring_spawned: 0,
      errors: 0,
    };

    for (const workspace of workspaces) {
      const workspaceId = workspace.id;

      // ── Check automation settings ─────────────────────────────────────────
      const settings = await getAutomationSettings(workspaceId);

      if (!settings?.auto_status_enabled) {
        console.log(
          `[auto-status-engine] [${workspace.name}] auto_status_enabled=false — skipping.`,
        );
        await logAutomation(
          workspaceId,
          "auto_status_engine",
          null,
          { reason: "auto_status_disabled" },
          "skipped",
        );
        summary.workspaces_skipped++;
        continue;
      }

      summary.workspaces_processed++;

      // ── Step 1: Mark overdue ──────────────────────────────────────────────
      try {
        const overdue = await runMarkOverdue(workspaceId, today);
        summary.marked_overdue += overdue;
        console.log(
          `[auto-status-engine] [${workspace.name}] Step 1: ${overdue} task(s) marked overdue.`,
        );
      } catch (err) {
        console.error(`[auto-status-engine] [${workspace.name}] Step 1 fatal:`, err);
        summary.errors++;
      }

      // ── Step 2: Auto-complete at 100% ─────────────────────────────────────
      try {
        const completed = await runAutoComplete(workspaceId);
        summary.auto_completed += completed;
        console.log(
          `[auto-status-engine] [${workspace.name}] Step 2: ${completed} task(s) auto-completed.`,
        );
      } catch (err) {
        console.error(`[auto-status-engine] [${workspace.name}] Step 2 fatal:`, err);
        summary.errors++;
      }

      // ── Step 3: Recurring daily tasks ─────────────────────────────────────
      try {
        const spawned = await runRecurringDaily(workspaceId, today);
        summary.recurring_spawned += spawned;
        console.log(
          `[auto-status-engine] [${workspace.name}] Step 3: ${spawned} recurring task(s) spawned.`,
        );
      } catch (err) {
        console.error(`[auto-status-engine] [${workspace.name}] Step 3 fatal:`, err);
        summary.errors++;
      }

      // ── Workspace summary log ─────────────────────────────────────────────
      await logAutomation(
        workspaceId,
        "auto_status_engine",
        null,
        {
          step: "workspace_summary",
          date: today,
          marked_overdue: summary.marked_overdue,
          auto_completed: summary.auto_completed,
          recurring_spawned: summary.recurring_spawned,
        },
        "success",
      );
    }

    console.log("[auto-status-engine] Run complete.", summary);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[auto-status-engine] Fatal error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
