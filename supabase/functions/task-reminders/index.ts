import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs daily at 07:00 UTC (08:00 WAT)
// Scheduled via Supabase cron: 0 7 * * *

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildDueTodayHtml(taskTitle: string, assigneeName: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#111;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">⏰ Task Due Today</h1>
      </div>
      <div style="padding:24px;">
        <p style="color:#374151;margin:0 0 16px;">Hi ${assigneeName},</p>
        <p style="color:#374151;margin:0 0 16px;">This is a reminder that the following task is <strong>due today</strong>:</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin-bottom:16px;">
          <h2 style="margin:0;font-size:18px;color:#92400e;">${taskTitle}</h2>
        </div>
        <a href="https://app.nexushq.io" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Open Nexus HQ →</a>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">Nexus HQ automated reminder</div>
    </div>`;
}

function buildOverdueHtml(taskTitle: string, assigneeName: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#dc2626;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">🔴 Overdue Task</h1>
      </div>
      <div style="padding:24px;">
        <p style="color:#374151;margin:0 0 16px;">Hi ${assigneeName},</p>
        <p style="color:#374151;margin:0 0 16px;">The following task is now <strong style="color:#dc2626;">overdue</strong> and requires your immediate attention:</p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin-bottom:16px;">
          <h2 style="margin:0;font-size:18px;color:#991b1b;">${taskTitle}</h2>
        </div>
        <a href="https://app.nexushq.io" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View Task →</a>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">Nexus HQ automated reminder</div>
    </div>`;
}

Deno.serve(async (_req) => {
  try {
    const today = todayISO();
    const tomorrow = tomorrowISO();

    // Fetch all active (non-completed) tasks with assignee profile
    const { data: tasks, error: tasksErr } = await supabase
      .from("tasks")
      .select("id, title, status, due_date, assigned_to, workspace_id, profiles!tasks_assigned_to_fkey(full_name, email)")
      .not("status", "eq", "completed");

    if (tasksErr) {
      console.error("Failed to fetch tasks:", tasksErr.message);
      return new Response(JSON.stringify({ error: tasksErr.message }), { status: 500 });
    }

    const results = { dueToday: 0, dueTomorrow: 0, markedOverdue: 0, errors: 0 };

    for (const task of tasks ?? []) {
      const profile = (task as any).profiles as { full_name: string | null; email: string | null } | null;
      const assigneeName = profile?.full_name ?? "there";
      const assigneeEmail = profile?.email;
      const workspaceId = task.workspace_id;

      try {
        // ── DUE TODAY ─────────────────────────────────────────────────────────
        if (task.due_date === today) {
          await supabase.from("notifications").insert({
            user_id: task.assigned_to,
            type: "task_due_soon",
            title: "⏰ Task due TODAY",
            message: task.title,
            related_task_id: task.id,
            workspace_id: workspaceId,
          });

          if (assigneeEmail) {
            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: { to: assigneeEmail, subject: `⏰ Task Due Today — ${task.title}`, html: buildDueTodayHtml(task.title, assigneeName) },
            }).catch(() => {});
          }

          results.dueToday++;
        }

        // ── DUE TOMORROW ──────────────────────────────────────────────────────
        else if (task.due_date === tomorrow) {
          await supabase.from("notifications").insert({
            user_id: task.assigned_to,
            type: "task_due_soon",
            title: "📅 Task due tomorrow",
            message: task.title,
            related_task_id: task.id,
            workspace_id: workspaceId,
          });

          results.dueTomorrow++;
        }

        // ── OVERDUE ───────────────────────────────────────────────────────────
        else if (task.due_date < today && task.status !== "overdue") {
          // Update status to overdue
          await supabase
            .from("tasks")
            .update({ status: "overdue" })
            .eq("id", task.id);

          await supabase.from("notifications").insert({
            user_id: task.assigned_to,
            type: "task_overdue",
            title: "🔴 Overdue task",
            message: task.title,
            related_task_id: task.id,
            workspace_id: workspaceId,
          });

          if (assigneeEmail) {
            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: { to: assigneeEmail, subject: `🔴 Overdue Task — ${task.title}`, html: buildOverdueHtml(task.title, assigneeName) },
            }).catch(() => {});
          }

          results.markedOverdue++;
        }
      } catch (err) {
        console.error(`Error processing task ${task.id}:`, err);
        results.errors++;
      }
    }

    console.log("Task reminders complete:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
