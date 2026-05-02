import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertCallerIsManagerOrAdmin } from "@/server/admin.server";

const statusEnum = z.enum(["todo", "in_progress", "completed", "overdue"]);

export const updateTaskStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: statusEnum,
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: task, error: loadErr } = await supabaseAdmin
      .from("tasks")
      .select("id, assigned_to, status, progress_percent")
      .eq("id", data.taskId)
      .maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!task) throw new Error("Task not found");

    if (task.assigned_to !== userId) {
      await assertCallerIsManagerOrAdmin(userId, context.supabase);
    }

    if (task.status === data.status) {
      return { ok: true, unchanged: true };
    }

    const newProgress =
      data.status === "completed"
        ? 100
        : data.status === "in_progress" && task.progress_percent === 0
          ? 10
          : task.progress_percent;

    const { error: updErr } = await supabaseAdmin
      .from("tasks")
      .update({
        status: data.status,
        progress_percent: newProgress,
        completed_at: data.status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", data.taskId);
    if (updErr) throw new Error(updErr.message);

    const { error: auditErr } = await supabaseAdmin.from("task_updates").insert({
      task_id: data.taskId,
      updated_by: userId,
      old_status: task.status,
      new_status: data.status,
      old_progress: task.progress_percent,
      new_progress: newProgress,
      note: data.note ?? null,
    });
    if (auditErr) throw new Error(auditErr.message);

    return { ok: true };
  });

export const reopenFlagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ flagId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertCallerIsManagerOrAdmin(context.userId, context.supabase);
    const { error } = await supabaseAdmin
      .from("flags")
      .update({ is_resolved: false, resolved_at: null })
      .eq("id", data.flagId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });