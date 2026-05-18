// Clock Reminder Engine
// Handles four distinct steps driven by the cron schedule and passed in the
// POST body (or ?step= query param):
//
//   morning_15   08:15 UTC (09:15 WAT) — first clock-in reminder
//   morning_30   08:30 UTC (09:30 WAT) — second clock-in reminder + mark late
//   afternoon_15 15:15 UTC (16:15 WAT) — clock-out reminder
//   auto_clockout 16:00 UTC (17:00 WAT) — auto clock-out employees still in

import {
  supabase,
  todayWAT,
  isWeekday,
  getActiveWorkspaces,
  getAutomationSettings,
  logAutomation,
  sendNotification,
  enqueueEmail,
  notifyUserWhatsApp,
} from "../_shared/helpers.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://nexus.skryveai.com";

type Step = "morning_15" | "morning_30" | "afternoon_15" | "auto_clockout";

// ── Email HTML builders ─────────────────────────────────────────────────────

function emailWrap(headerBg: string, headerText: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:${headerBg};padding:28px 24px;text-align:center;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Nexus HQ</p>
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${headerText}</h1>
    </div>
    <div style="padding:28px 24px;">${body}</div>
    <div style="padding:16px 24px;border-top:1px solid #f3f4f6;background:#fafafa;color:#9ca3af;font-size:12px;text-align:center;">
      Nexus HQ &bull; Automated clock reminder &bull; Do not reply to this email
    </div>
  </div>
</body>
</html>`;
}

function buildClockInReminderEmail(employeeName: string): string {
  const body = `
    <p style="color:#374151;margin:0 0 16px;">Hi ${employeeName},</p>
    <p style="color:#374151;margin:0 0 20px;">
      Work started at <strong>9:00 AM WAT</strong>. You haven't clocked in yet today.
      Please clock in now to ensure your attendance is recorded.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}"
         style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
        Clock In Now &rarr;
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
      If you are already on-site, please use the Nexus HQ app to record your attendance.
    </p>`;
  return emailWrap("#2563eb", "⏰ Clock-In Reminder", body);
}

// ── Type helpers ────────────────────────────────────────────────────────────

interface ActiveEmployee {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface AttendanceRow {
  user_id: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
}

// ── Step handlers ───────────────────────────────────────────────────────────

/**
 * morning_15 (08:15 UTC = 09:15 WAT)
 * Remind every active employee who has NO attendance record at all for today.
 */
async function handleMorning15(workspaceId: string, today: string): Promise<number> {
  const settings = await getAutomationSettings(workspaceId);
  if (!settings?.clock_reminders_enabled) return 0;

  // All active employees in workspace
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id, profiles!inner(id, full_name, email, is_active)")
    .eq("workspace_id", workspaceId)
    .eq("role", "employee");

  const employees: ActiveEmployee[] = (memberRows ?? [])
    .map((m) => (m as any).profiles as (ActiveEmployee & { is_active: boolean }) | null)
    .filter((p): p is ActiveEmployee & { is_active: boolean } => p !== null && p.is_active)
    .map(({ id, full_name, email }) => ({ id, full_name, email }));

  if (employees.length === 0) return 0;

  // Employees who already have an attendance record today (any record)
  const employeeIds = employees.map((e) => e.id);
  const { data: presentRows } = await supabase
    .from("attendance")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .in("user_id", employeeIds);

  const presentIds = new Set((presentRows ?? []).map((r) => r.user_id));
  const notClockedIn = employees.filter((e) => !presentIds.has(e.id));

  let count = 0;
  for (const emp of notClockedIn) {
    await sendNotification(
      emp.id,
      workspaceId,
      "clock_reminder",
      "🕘 You haven't clocked in yet",
      "Work started at 9:00 AM. Please clock in.",
    );

    if (emp.email) {
      await enqueueEmail(
        emp.email,
        "⏰ Clock-in Reminder — Nexus HQ",
        buildClockInReminderEmail(emp.full_name ?? "Team Member"),
      );
    }

    await notifyUserWhatsApp(
      emp.id,
      "⏰ Nexus HQ Reminder: You haven't clocked in yet today. Work started at 9:00 AM WAT. Please clock in now.",
    );

    await logAutomation(
      workspaceId,
      "clock_reminder_morning_15",
      emp.id,
      { date: today },
      "success",
    );

    count++;
  }

  return count;
}

/**
 * morning_30 (08:30 UTC = 09:30 WAT)
 * Find active employees STILL not clocked in (no attendance row with clock_in NOT NULL).
 * Notify them + their managers. UPSERT attendance record with status='late'.
 */
async function handleMorning30(workspaceId: string, today: string): Promise<number> {
  // All active employees
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id, profiles!inner(id, full_name, email, is_active)")
    .eq("workspace_id", workspaceId)
    .eq("role", "employee");

  const employees: ActiveEmployee[] = (memberRows ?? [])
    .map((m) => (m as any).profiles as (ActiveEmployee & { is_active: boolean }) | null)
    .filter((p): p is ActiveEmployee & { is_active: boolean } => p !== null && p.is_active)
    .map(({ id, full_name, email }) => ({ id, full_name, email }));

  if (employees.length === 0) return 0;

  // Employees who have already clocked in today
  const employeeIds = employees.map((e) => e.id);
  const { data: clockedInRows } = await supabase
    .from("attendance")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .not("clock_in", "is", null)
    .in("user_id", employeeIds);

  const clockedInIds = new Set((clockedInRows ?? []).map((r) => r.user_id));
  const notClockedIn = employees.filter((e) => !clockedInIds.has(e.id));

  if (notClockedIn.length === 0) return 0;

  // Fetch managers + admins for this workspace (they receive notification)
  const { data: supervisorRows } = await supabase
    .from("workspace_members")
    .select("user_id, profiles(id, full_name, email)")
    .eq("workspace_id", workspaceId)
    .in("role", ["manager", "admin", "owner"]);

  const supervisors: ActiveEmployee[] = (supervisorRows ?? [])
    .map((m) => (m as any).profiles as ActiveEmployee | null)
    .filter((p): p is ActiveEmployee => p !== null);

  let count = 0;
  for (const emp of notClockedIn) {
    // Notify employee
    await sendNotification(
      emp.id,
      workspaceId,
      "clock_reminder",
      "⚠️ You're 30 minutes late",
      "You're 30 minutes late. Please clock in now.",
    );

    // Notify each supervisor
    for (const sup of supervisors) {
      await sendNotification(
        sup.id,
        workspaceId,
        "clock_reminder",
        `${emp.full_name ?? "An employee"} has not clocked in — 30 minutes late`,
        `${emp.full_name ?? "An employee"} has not clocked in as of 09:30 WAT today.`,
      );
    }

    // UPSERT attendance row: mark late (only update status if clock_in is still NULL)
    const { error: upsertErr } = await supabase.rpc("upsert_attendance_late", {
      p_user_id: emp.id,
      p_date: today,
      p_workspace_id: workspaceId,
    });

    // Fallback: if the RPC doesn't exist, do it with raw upsert
    if (upsertErr) {
      // Try raw INSERT … ON CONFLICT approach via raw SQL through .from()
      // We do an upsert but guard with a check that clock_in is null
      await supabase.from("attendance").upsert(
        {
          user_id: emp.id,
          date: today,
          workspace_id: workspaceId,
          status: "late",
        },
        {
          onConflict: "user_id,date",
          ignoreDuplicates: false,
        },
      );
      // Note: the Supabase upsert above will overwrite status regardless of
      // clock_in state; the RPC version (if available) guards on clock_in IS NULL.
      // The RPC is the preferred path; this is a fallback for dev environments.
    }

    await logAutomation(
      workspaceId,
      "clock_reminder_morning_30",
      emp.id,
      { date: today, marked_late: true },
      "success",
    );

    count++;
  }

  return count;
}

/**
 * afternoon_15 (15:15 UTC = 16:15 WAT)
 * Remind employees who are still clocked in (clock_in NOT NULL, clock_out IS NULL)
 * to clock out before they leave.
 */
async function handleAfternoon15(workspaceId: string, today: string): Promise<number> {
  const settings = await getAutomationSettings(workspaceId);
  if (!settings?.clock_reminders_enabled) return 0;

  const { data: rows } = await supabase
    .from("attendance")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null);

  let count = 0;
  for (const row of rows ?? []) {
    await sendNotification(
      row.user_id,
      workspaceId,
      "clock_reminder",
      "🕓 Don't forget to clock out",
      "Remember to clock out before you leave today.",
    );

    await logAutomation(
      workspaceId,
      "clock_reminder_afternoon_15",
      row.user_id,
      { date: today },
      "success",
    );

    count++;
  }

  return count;
}

/**
 * auto_clockout (16:00 UTC = 17:00 WAT)
 * Auto clock-out every employee still clocked in.
 * Clock-out time is fixed at 16:00 WAT = 15:00 UTC.
 */
async function handleAutoClockout(workspaceId: string, today: string): Promise<number> {
  const settings = await getAutomationSettings(workspaceId);
  if (!settings?.auto_clockout_enabled) return 0;

  const { data: rows } = await supabase
    .from("attendance")
    .select("id, user_id, clock_in, status")
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .not("clock_in", "is", null)
    .is("clock_out", null);

  if (!rows || rows.length === 0) return 0;

  // Fixed auto clock-out time: 16:00 WAT = 15:00 UTC
  const clockOutISO = `${today}T15:00:00Z`;
  const clockOutMs = new Date(clockOutISO).getTime();

  // 09:15 WAT = 08:15 UTC — threshold for 'present' vs 'late'
  const presentThresholdUTCHour = 8;
  const presentThresholdUTCMin = 15;

  let count = 0;
  for (const row of rows as (AttendanceRow & { id: string })[]) {
    if (!row.clock_in) continue;

    const clockInMs = new Date(row.clock_in).getTime();
    const totalMinutes = Math.round((clockOutMs - clockInMs) / 60_000);

    // Determine status: if clocked in before 08:15 UTC (09:15 WAT) → present, else late
    const clockInDate = new Date(row.clock_in);
    const clockInUTCHour = clockInDate.getUTCHours();
    const clockInUTCMin = clockInDate.getUTCMinutes();
    const isOnTime =
      clockInUTCHour < presentThresholdUTCHour ||
      (clockInUTCHour === presentThresholdUTCHour && clockInUTCMin < presentThresholdUTCMin);
    const newStatus = isOnTime ? "present" : "late";

    const { error: updateErr } = await supabase
      .from("attendance")
      .update({
        clock_out: clockOutISO,
        total_minutes: totalMinutes > 0 ? totalMinutes : 0,
        status: newStatus,
      })
      .eq("id", row.id);

    if (updateErr) {
      console.error(`auto_clockout: failed to update attendance ${row.id}:`, updateErr.message);
      continue;
    }

    await sendNotification(
      row.user_id,
      workspaceId,
      "clock_reminder",
      "🕔 You've been automatically clocked out",
      "You've been automatically clocked out at 4:00 PM.",
    );

    await logAutomation(
      workspaceId,
      "auto_clockout",
      row.user_id,
      {
        date: today,
        auto_clocked_out: true,
        clock_out: clockOutISO,
        total_minutes: totalMinutes > 0 ? totalMinutes : 0,
        status: newStatus,
      },
      "success",
    );

    count++;
  }

  return count;
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (!isWeekday()) {
    return new Response(JSON.stringify({ ok: true, skipped: "not_weekday" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Determine step from POST body or query param
  let step: Step | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      step = (body?.step as Step) ?? null;
    }
    if (!step) {
      const url = new URL(req.url);
      step = (url.searchParams.get("step") as Step) ?? null;
    }
  } catch {
    // ignore parse errors
  }

  const validSteps: Step[] = ["morning_15", "morning_30", "afternoon_15", "auto_clockout"];
  if (!step || !validSteps.includes(step)) {
    return new Response(
      JSON.stringify({
        error: `Invalid or missing 'step'. Must be one of: ${validSteps.join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const today = todayWAT();
  const summary = { step, workspaces: 0, affected: 0, errors: 0 };

  try {
    const workspaces = await getActiveWorkspaces();

    for (const workspace of workspaces) {
      const workspaceId = workspace.id;
      summary.workspaces++;

      try {
        let affected = 0;

        switch (step) {
          case "morning_15":
            affected = await handleMorning15(workspaceId, today);
            break;
          case "morning_30":
            affected = await handleMorning30(workspaceId, today);
            break;
          case "afternoon_15":
            affected = await handleAfternoon15(workspaceId, today);
            break;
          case "auto_clockout":
            affected = await handleAutoClockout(workspaceId, today);
            break;
        }

        summary.affected += affected;
        console.log(`Workspace ${workspaceId} [${step}]: ${affected} affected`);
      } catch (wsError: unknown) {
        console.error(`Error processing workspace ${workspaceId} [${step}]:`, wsError);
        await logAutomation(
          workspaceId,
          `clock_reminder_${step}`,
          null,
          { error: String(wsError) },
          "failed",
        ).catch(() => {});
        summary.errors++;
      }
    }

    console.log("Clock reminder engine complete:", summary);
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Fatal error in clock-reminder-engine:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
