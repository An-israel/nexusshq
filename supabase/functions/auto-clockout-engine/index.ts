// auto-clockout-engine/index.ts
// Schedule: 0 16 * * 1-5  (16:00 UTC weekdays = 17:00 WAT)
//
// For each active workspace (if auto_clockout_enabled):
//   1. Find every employee who has a clock_in today but no clock_out
//   2. Set clock_out = 15:00 UTC (16:00 WAT), compute total_minutes, set status
//   3. Send an in-app notification to each affected employee
//   4. Log the automation result

import {
  supabase,
  todayWAT,
  isWeekday,
  getActiveWorkspaces,
  getAutomationSettings,
  logAutomation,
  sendNotification,
} from "../_shared/helpers.ts";

interface AttendanceRow {
  id: string;
  user_id: string;
  clock_in: string;
  status: string | null;
}

Deno.serve(async (_req) => {
  if (!isWeekday()) {
    return Response.json({ ok: true, skipped: "not a weekday" });
  }

  const today = todayWAT();
  // Auto clock-out time: 16:00 WAT = 15:00 UTC
  const clockOutISO = `${today}T15:00:00Z`;
  const clockOutMs = new Date(clockOutISO).getTime();

  // 09:15 WAT = 08:15 UTC threshold for 'present' vs 'late'
  const PRESENT_THRESHOLD_UTC_HOUR = 8;
  const PRESENT_THRESHOLD_UTC_MIN = 15;

  const workspaces = await getActiveWorkspaces();
  let totalProcessed = 0;
  let totalWorkspaces = 0;
  const errors: string[] = [];

  for (const ws of workspaces) {
    const settings = await getAutomationSettings(ws.id);
    if (!settings?.auto_clockout_enabled) continue;

    totalWorkspaces++;

    // Find employees still clocked in today
    const { data: rows, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, user_id, clock_in, status")
      .eq("workspace_id", ws.id)
      .eq("date", today)
      .not("clock_in", "is", null)
      .is("clock_out", null);

    if (fetchErr) {
      errors.push(`workspace ${ws.id}: ${fetchErr.message}`);
      await logAutomation(
        ws.id,
        "auto_clockout",
        null,
        { date: today, error: fetchErr.message },
        "failed",
      );
      continue;
    }

    if (!rows || rows.length === 0) {
      await logAutomation(ws.id, "auto_clockout", null, { date: today, count: 0 }, "skipped");
      continue;
    }

    let wsCount = 0;

    for (const row of rows as AttendanceRow[]) {
      const clockInMs = new Date(row.clock_in).getTime();
      const totalMinutes = Math.max(0, Math.round((clockOutMs - clockInMs) / 60_000));

      // Determine final status
      const clockInDate = new Date(row.clock_in);
      const clockInUTCHour = clockInDate.getUTCHours();
      const clockInUTCMin = clockInDate.getUTCMinutes();
      const isOnTime =
        clockInUTCHour < PRESENT_THRESHOLD_UTC_HOUR ||
        (clockInUTCHour === PRESENT_THRESHOLD_UTC_HOUR &&
          clockInUTCMin < PRESENT_THRESHOLD_UTC_MIN);
      const newStatus = isOnTime ? "present" : "late";

      const { error: updateErr } = await supabase
        .from("attendance")
        .update({
          clock_out: clockOutISO,
          total_minutes: totalMinutes,
          status: newStatus,
        })
        .eq("id", row.id);

      if (updateErr) {
        errors.push(`workspace ${ws.id}, attendance ${row.id}: ${updateErr.message}`);
        await logAutomation(
          ws.id,
          "auto_clockout",
          row.user_id,
          { date: today, attendance_id: row.id, error: updateErr.message },
          "failed",
        );
        continue;
      }

      // Send in-app notification
      await sendNotification(
        row.user_id,
        ws.id,
        "clock_reminder",
        "🕔 You've been automatically clocked out",
        "Your attendance for today has been recorded. You were clocked out at 4:00 PM WAT.",
      );

      await logAutomation(
        ws.id,
        "auto_clockout",
        row.user_id,
        {
          date: today,
          clock_out: clockOutISO,
          total_minutes: totalMinutes,
          status: newStatus,
          auto_clocked_out: true,
        },
        "success",
      );

      wsCount++;
      totalProcessed++;
    }

    console.log(`[auto-clockout-engine] workspace=${ws.id} clocked_out=${wsCount}`);
  }

  return Response.json({
    ok: errors.length === 0,
    date: today,
    workspaces_processed: totalWorkspaces,
    employees_clocked_out: totalProcessed,
    errors: errors.length > 0 ? errors : undefined,
  });
});
