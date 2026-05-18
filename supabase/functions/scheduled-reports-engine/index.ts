// Scheduled Reports Engine
// Accepts { report_type: "daily" | "weekly" | "monthly" } from POST body.
//
// Cron schedules (from migration):
//   daily   — 30 16 * * 1-5  (16:30 UTC weekdays = 17:30 WAT)
//   weekly  — 0  6 * * 1     (06:00 UTC Monday = 07:00 WAT)
//   monthly — 0  6 1 * *     (06:00 UTC 1st of month = 07:00 WAT)

import {
  supabase,
  todayWAT,
  dateOffsetWAT,
  getActiveWorkspaces,
  getAutomationSettings,
  logAutomation,
  enqueueEmail,
} from "../_shared/helpers.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://nexus.skryveai.com";

type ReportType = "daily" | "weekly" | "monthly";

// ── Date utilities ──────────────────────────────────────────────────────────

/** Format a YYYY-MM-DD string as a human-readable date, e.g. "Mon 18 May 2026". */
function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Returns the Monday of the week containing the given WAT date. */
function weekStart(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon…
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Returns the Friday of the week containing the given WAT date. */
function weekEnd(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -2 : 5 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for the last Friday (relative to today WAT). */
function lastFriday(): string {
  const today = todayWAT();
  const d = new Date(today + "T12:00:00Z");
  const day = d.getUTCDay(); // 0=Sun…6=Sat
  // Days to go back to reach Friday
  const daysBack = day === 5 ? 7 : ((day + 2) % 7) + 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-01 for the first day of the previous calendar month. */
function prevMonthStart(): string {
  const today = todayWAT();
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

/** Returns the last day of the previous calendar month (YYYY-MM-DD). */
function prevMonthEnd(): string {
  const today = todayWAT();
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(0); // day 0 = last day of previous month
  return d.toISOString().slice(0, 10);
}

/** Returns a human-readable month name, e.g. "April 2026". */
function prevMonthName(): string {
  const today = todayWAT();
  const d = new Date(today + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// ── Email HTML builders ─────────────────────────────────────────────────────

function emailWrap(headerBg: string, headerText: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="background:${headerBg};padding:32px 28px;text-align:center;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Nexus HQ</p>
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.4px;line-height:1.3;">${headerText}</h1>
    </div>
    <div style="padding:32px 28px;">${body}</div>
    <div style="padding:18px 28px;border-top:1px solid #f3f4f6;background:#fafafa;text-align:center;">
      <p style="margin:0 0 6px;color:#6b7280;font-size:12px;">Nexus HQ &bull; Automated report</p>
      <a href="${APP_URL}" style="color:#6b7280;font-size:12px;text-decoration:underline;">View Full Dashboard</a>
    </div>
  </div>
</body>
</html>`;
}

function sectionHeader(title: string, color = "#111827"): string {
  return `<h2 style="margin:28px 0 12px;font-size:16px;font-weight:700;color:${color};border-bottom:2px solid #f3f4f6;padding-bottom:8px;">${title}</h2>`;
}

function statBadge(label: string, value: string | number, bg: string, fg = "#ffffff"): string {
  return `
    <div style="display:inline-block;background:${bg};border-radius:8px;padding:16px 20px;margin:0 8px 12px 0;min-width:110px;text-align:center;vertical-align:top;">
      <div style="font-size:28px;font-weight:800;color:${fg};line-height:1;">${value}</div>
      <div style="font-size:12px;color:${fg === "#ffffff" ? "rgba(255,255,255,0.8)" : fg};margin-top:4px;font-weight:500;">${label}</div>
    </div>`;
}

function tableRow(cells: string[], isHeader = false, bg = "#ffffff"): string {
  const tag = isHeader ? "th" : "td";
  const style = isHeader
    ? `padding:10px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;color:#374151;font-size:13px;text-align:left;`
    : `padding:10px 14px;border:1px solid #e5e7eb;color:#374151;font-size:13px;background:${bg};`;
  return `<tr>${cells.map((c) => `<${tag} style="${style}">${c}</${tag}>`).join("")}</tr>`;
}

function tableWrap(rows: string[]): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${rows.join("")}</table>`;
}

function ctaButton(label: string, url: string, color = "#111827"): string {
  return `
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${url}"
         style="display:inline-block;background:${color};color:#ffffff;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
        ${label}
      </a>
    </div>`;
}

function emptyNote(msg: string): string {
  return `<p style="color:#9ca3af;font-size:13px;font-style:italic;margin:4px 0 16px;">${msg}</p>`;
}

// ── Profile / member helpers ────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface MemberWithProfile {
  user_id: string;
  role: string;
  profiles: Profile | null;
}

async function getAdminsAndManagers(workspaceId: string): Promise<{ admins: Profile[]; managers: Profile[] }> {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role, profiles(id, full_name, email)")
    .eq("workspace_id", workspaceId)
    .in("role", ["admin", "owner", "manager"]);

  const admins: Profile[] = [];
  const managers: Profile[] = [];

  for (const row of (data ?? []) as MemberWithProfile[]) {
    const p = row.profiles;
    if (!p?.email) continue;
    if (row.role === "manager") {
      managers.push(p);
    } else {
      admins.push(p);
    }
  }

  return { admins, managers };
}

async function getAdminsOnly(workspaceId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role, profiles(id, full_name, email)")
    .eq("workspace_id", workspaceId)
    .in("role", ["admin", "owner"]);

  return ((data ?? []) as MemberWithProfile[])
    .map((r) => r.profiles)
    .filter((p): p is Profile => p !== null && !!p.email);
}

// ── DAILY REPORT ────────────────────────────────────────────────────────────

async function runDailyReport(workspaceId: string): Promise<void> {
  const today = todayWAT();
  const yesterday = dateOffsetWAT(-1);

  // 1. Tasks completed today
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, profiles!tasks_assigned_to_fkey(full_name)")
    .eq("workspace_id", workspaceId)
    .eq("status", "completed")
    .gte("completed_at", today + "T00:00:00Z");

  const completedCount = completedTasks?.length ?? 0;

  // 2. Tasks that became overdue today (status=overdue, due_date=yesterday)
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, profiles!tasks_assigned_to_fkey(full_name), due_date")
    .eq("workspace_id", workspaceId)
    .eq("status", "overdue")
    .eq("due_date", yesterday);

  const overdueCount = overdueTasks?.length ?? 0;

  // 3. Employees who didn't clock in today
  // Get all active workspace members (all roles)
  const { data: allMembers } = await supabase
    .from("workspace_members")
    .select("user_id, profiles!inner(id, full_name, email, is_active)")
    .eq("workspace_id", workspaceId);

  const allActiveProfiles: Profile[] = ((allMembers ?? []) as any[])
    .map((m) => m.profiles as Profile & { is_active: boolean } | null)
    .filter((p): p is Profile & { is_active: boolean } => p !== null && p.is_active)
    .map(({ id, full_name, email }) => ({ id, full_name, email }));

  const allActiveIds = allActiveProfiles.map((p) => p.id);

  const { data: clockedInRows } = allActiveIds.length > 0
    ? await supabase
        .from("attendance")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("date", today)
        .not("clock_in", "is", null)
        .in("user_id", allActiveIds)
    : { data: [] };

  const clockedInIds = new Set((clockedInRows ?? []).map((r) => r.user_id));
  const notClockedIn = allActiveProfiles.filter((p) => !clockedInIds.has(p.id));

  // 4. New flags today
  const { data: newFlags } = await supabase
    .from("flags")
    .select("id, reason, severity, flagged_user_id, profiles!flags_flagged_user_id_fkey(full_name)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", today + "T00:00:00Z");

  const flagsCount = newFlags?.length ?? 0;

  // Skip sending if nothing to report
  if (completedCount + overdueCount + notClockedIn.length + flagsCount === 0) {
    console.log(`Workspace ${workspaceId}: daily report — nothing to report, skipping`);
    await logAutomation(workspaceId, "scheduled_report_daily", null, { skipped: "no_data", date: today }, "skipped");
    return;
  }

  // Build email body
  let body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;">
      Here's your team summary for <strong>${fmtDate(today)}</strong>.
    </p>
    <div style="margin-bottom:4px;">
      ${statBadge("Completed", completedCount, "#059669")}
      ${statBadge("New Overdue", overdueCount, overdueCount > 0 ? "#d97706" : "#6b7280")}
      ${statBadge("Absent / No Clock-In", notClockedIn.length, notClockedIn.length > 0 ? "#dc2626" : "#6b7280")}
      ${statBadge("New Flags", flagsCount, flagsCount > 0 ? "#7c3aed" : "#6b7280")}
    </div>`;

  // Completed tasks table
  body += sectionHeader("✅ Tasks Completed Today", "#059669");
  if (completedCount > 0) {
    const rows = [tableRow(["Task", "Assigned To"], true)];
    for (const t of completedTasks ?? []) {
      const name = (t as any).profiles?.full_name ?? "—";
      rows.push(tableRow([t.title ?? "—", name]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("No tasks completed today.");
  }

  // Overdue tasks table
  body += sectionHeader("⚠️ Tasks That Became Overdue Today", "#d97706");
  if (overdueCount > 0) {
    const rows = [tableRow(["Task", "Assigned To", "Due Date"], true)];
    for (const t of overdueTasks ?? []) {
      const name = (t as any).profiles?.full_name ?? "—";
      rows.push(tableRow([t.title ?? "—", name, t.due_date ?? "—"]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("No tasks became overdue today.");
  }

  // Absent / no clock-in
  body += sectionHeader("🔴 Employees Without Clock-In Today", "#dc2626");
  if (notClockedIn.length > 0) {
    const rows = [tableRow(["Employee", "Email"], true)];
    for (const p of notClockedIn) {
      rows.push(tableRow([p.full_name ?? "—", p.email ?? "—"]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("All active employees clocked in today.");
  }

  // New flags
  body += sectionHeader("🚩 New Flags Today", "#7c3aed");
  if (flagsCount > 0) {
    const rows = [tableRow(["Employee", "Reason", "Severity"], true)];
    for (const f of newFlags ?? []) {
      const name = (f as any).profiles?.full_name ?? "—";
      rows.push(tableRow([name, f.reason ?? "—", f.severity ?? "—"]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("No new flags today.");
  }

  body += ctaButton("View Full Dashboard", APP_URL, "#111827");

  const html = emailWrap(
    "#111827",
    `📊 Daily Summary — ${fmtDate(today)}`,
    body,
  );
  const subject = `📊 Nexus HQ — Daily Summary ${today}`;

  // Send to all admins and managers
  const { admins, managers } = await getAdminsAndManagers(workspaceId);
  const recipients = [...admins, ...managers];
  const sentTo = new Set<string>();

  for (const r of recipients) {
    if (!r.email || sentTo.has(r.email)) continue;
    await enqueueEmail(r.email, subject, html);
    sentTo.add(r.email);
  }

  await logAutomation(workspaceId, "scheduled_report_daily", null, {
    date: today,
    completed: completedCount,
    overdue: overdueCount,
    not_clocked_in: notClockedIn.length,
    flags: flagsCount,
    recipients: sentTo.size,
  }, "success");
}

// ── WEEKLY REPORT ───────────────────────────────────────────────────────────

async function runWeeklyReport(workspaceId: string): Promise<void> {
  // Previous week Mon–Fri
  const today = todayWAT();
  const weekFrom = dateOffsetWAT(-7); // 7 days ago
  const weekTo = dateOffsetWAT(-1);   // yesterday
  const lf = lastFriday();

  // 1. Task completion rate for the week
  const { data: allWeekTasks } = await supabase
    .from("tasks")
    .select("id, status, assigned_to, profiles!tasks_assigned_to_fkey(id, full_name)")
    .eq("workspace_id", workspaceId)
    .gte("due_date", weekFrom)
    .lte("due_date", weekTo);

  const totalTasks = allWeekTasks?.length ?? 0;
  const completedTasks = (allWeekTasks ?? []).filter((t) => t.status === "completed");
  const completedCount = completedTasks.length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // 2. Attendance summary for the week
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("user_id, status")
    .eq("workspace_id", workspaceId)
    .gte("date", weekFrom)
    .lte("date", weekTo);

  const attPresent = (attendanceRows ?? []).filter((a) => a.status === "present").length;
  const attLate = (attendanceRows ?? []).filter((a) => a.status === "late").length;
  const attAbsent = (attendanceRows ?? []).filter((a) => a.status === "absent").length;
  const attHalfDay = (attendanceRows ?? []).filter((a) => a.status === "half_day").length;

  // 3. Top 3 performers and bottom 3 by task completion count
  // First try performance_reviews, fall back to task completion count
  const { data: perfReviews } = await supabase
    .from("performance_reviews")
    .select("user_id, productivity, quality, attendance, collaboration")
    .eq("workspace_id", workspaceId)
    .gte("created_at", weekFrom + "T00:00:00Z")
    .lte("created_at", weekTo + "T23:59:59Z");

  // Map of userId -> average score
  const perfMap = new Map<string, number>();
  if (perfReviews && perfReviews.length > 0) {
    const scoreAccum = new Map<string, { sum: number; count: number }>();
    for (const r of perfReviews) {
      const avg = ((r.productivity ?? 0) + (r.quality ?? 0) + (r.attendance ?? 0) + (r.collaboration ?? 0)) / 4;
      const existing = scoreAccum.get(r.user_id) ?? { sum: 0, count: 0 };
      scoreAccum.set(r.user_id, { sum: existing.sum + avg, count: existing.count + 1 });
    }
    scoreAccum.forEach(({ sum, count }, uid) => {
      perfMap.set(uid, Math.round((sum / count) * 10) / 10);
    });
  }

  // Task completion count per user (completed this week)
  const completionCountMap = new Map<string, number>();
  for (const t of completedTasks) {
    if (!t.assigned_to) continue;
    completionCountMap.set(t.assigned_to, (completionCountMap.get(t.assigned_to) ?? 0) + 1);
  }

  // Collect all active members for ranking
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id, profiles(id, full_name)")
    .eq("workspace_id", workspaceId);

  interface RankedMember { id: string; name: string; score: number; completions: number }
  const ranked: RankedMember[] = ((memberRows ?? []) as any[])
    .map((m) => {
      const p = m.profiles as { id: string; full_name: string | null } | null;
      if (!p) return null;
      return {
        id: p.id,
        name: p.full_name ?? "Unknown",
        score: perfMap.get(p.id) ?? -1,
        completions: completionCountMap.get(p.id) ?? 0,
      };
    })
    .filter((m): m is RankedMember => m !== null);

  // Sort: prefer perf score if available, else task completions
  const sortKey = (m: RankedMember) =>
    m.score >= 0 ? m.score * 100 + m.completions : m.completions;

  const sortedDesc = [...ranked].sort((a, b) => sortKey(b) - sortKey(a));
  const top3 = sortedDesc.slice(0, 3).filter((m) => m.completions > 0 || m.score >= 0);
  const bottom3 = sortedDesc.slice(-3).reverse().filter((m) => sortKey(m) < sortKey(sortedDesc[0]));

  // 4. Unresolved flags from last week
  const { data: unresolvedFlags } = await supabase
    .from("flags")
    .select("id, reason, severity, flagged_user_id, profiles!flags_flagged_user_id_fkey(full_name)")
    .eq("workspace_id", workspaceId)
    .eq("is_resolved", false)
    .gte("created_at", weekFrom + "T00:00:00Z")
    .lte("created_at", weekTo + "T23:59:59Z");

  // Build email body
  let body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;">
      Here is the team performance summary for the week ending <strong>${fmtDate(lf)}</strong>.
    </p>`;

  // Task completion stats
  body += sectionHeader("📋 Task Completion", "#2563eb");
  body += `
    <div style="margin-bottom:12px;">
      ${statBadge("Total Tasks", totalTasks, "#374151")}
      ${statBadge("Completed", completedCount, "#059669")}
      ${statBadge("Completion Rate", completionRate + "%", completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#d97706" : "#dc2626")}
    </div>`;

  // Attendance summary
  body += sectionHeader("🕘 Attendance Summary", "#0891b2");
  body += `
    <div style="margin-bottom:12px;">
      ${statBadge("Present", attPresent, "#059669")}
      ${statBadge("Late", attLate, "#d97706")}
      ${statBadge("Absent", attAbsent, attAbsent > 0 ? "#dc2626" : "#6b7280")}
      ${statBadge("Half Day", attHalfDay, "#6b7280")}
    </div>`;

  // Top performers
  body += sectionHeader("🏆 Top Performers", "#059669");
  if (top3.length > 0) {
    const rows = [tableRow(["#", "Employee", perfMap.size > 0 ? "Avg Score" : "Tasks Completed"], true)];
    top3.forEach((m, i) => {
      const scoreDisplay = m.score >= 0 ? `${m.score}/5` : `${m.completions} tasks`;
      rows.push(tableRow([`${i + 1}`, m.name, scoreDisplay], false, i % 2 === 0 ? "#f0fdf4" : "#ffffff"));
    });
    body += tableWrap(rows);
  } else {
    body += emptyNote("Not enough data to rank performers this week.");
  }

  // Needs support
  body += sectionHeader("💛 Needs Support This Week", "#d97706");
  if (bottom3.length > 0) {
    const rows = [tableRow(["Employee", perfMap.size > 0 ? "Avg Score" : "Tasks Completed"], true)];
    bottom3.forEach((m, i) => {
      const scoreDisplay = m.score >= 0 ? `${m.score}/5` : `${m.completions} tasks`;
      rows.push(tableRow([m.name, scoreDisplay], false, i % 2 === 0 ? "#fffbeb" : "#ffffff"));
    });
    body += tableWrap(rows);
    body += `<p style="color:#6b7280;font-size:12px;font-style:italic;margin:4px 0 8px;">These team members may benefit from extra support or check-ins this week.</p>`;
  } else {
    body += emptyNote("No performance data available this week.");
  }

  // Unresolved flags
  body += sectionHeader("🚩 Unresolved Flags From This Week", "#7c3aed");
  if ((unresolvedFlags?.length ?? 0) > 0) {
    const rows = [tableRow(["Employee", "Reason", "Severity"], true)];
    for (const f of unresolvedFlags ?? []) {
      const name = (f as any).profiles?.full_name ?? "—";
      rows.push(tableRow([name, f.reason ?? "—", f.severity ?? "—"]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("No unresolved flags from this week.");
  }

  body += ctaButton("View Full Dashboard", APP_URL, "#111827");

  const html = emailWrap("#111827", `📈 Weekly Team Report — w/e ${fmtDate(lf)}`, body);
  const subject = `📈 Nexus HQ — Weekly Team Report w/e ${lf}`;

  const admins = await getAdminsOnly(workspaceId);
  const sentTo = new Set<string>();
  for (const a of admins) {
    if (!a.email || sentTo.has(a.email)) continue;
    await enqueueEmail(a.email, subject, html);
    sentTo.add(a.email);
  }

  await logAutomation(workspaceId, "scheduled_report_weekly", null, {
    week_from: weekFrom,
    week_to: weekTo,
    total_tasks: totalTasks,
    completed: completedCount,
    completion_rate: completionRate,
    attendance_present: attPresent,
    recipients: sentTo.size,
  }, "success");
}

// ── MONTHLY REPORT ──────────────────────────────────────────────────────────

async function runMonthlyReport(workspaceId: string): Promise<void> {
  const monthStart = prevMonthStart();
  const monthEnd = prevMonthEnd();
  const monthName = prevMonthName();

  // 1. Total tasks assigned vs completed in the previous month
  const { data: allMonthTasks } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("workspace_id", workspaceId)
    .gte("due_date", monthStart)
    .lte("due_date", monthEnd);

  const totalAssigned = allMonthTasks?.length ?? 0;
  const totalCompleted = (allMonthTasks ?? []).filter((t) => t.status === "completed").length;
  const totalOverdue = (allMonthTasks ?? []).filter((t) => t.status === "overdue").length;
  const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  // 2. Attendance: present days across team
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("user_id, status, date")
    .eq("workspace_id", workspaceId)
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const totalPresent = (attendanceRows ?? []).filter((a) => a.status === "present").length;
  const totalLate = (attendanceRows ?? []).filter((a) => a.status === "late").length;
  const totalAbsent = (attendanceRows ?? []).filter((a) => a.status === "absent").length;
  const totalHalfDay = (attendanceRows ?? []).filter((a) => a.status === "half_day").length;

  // Count unique employee-days (total possible working days × employees)
  const uniqueDates = new Set((attendanceRows ?? []).map((a) => a.date));
  const workingDays = uniqueDates.size;
  const uniqueEmployees = new Set((attendanceRows ?? []).map((a) => a.user_id)).size;

  // 3. Flags issued and resolved
  const { data: allFlags } = await supabase
    .from("flags")
    .select("id, is_resolved, reason, severity, flagged_user_id, profiles!flags_flagged_user_id_fkey(full_name)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", monthStart + "T00:00:00Z")
    .lte("created_at", monthEnd + "T23:59:59Z");

  const flagsIssued = allFlags?.length ?? 0;
  const flagsResolved = (allFlags ?? []).filter((f) => f.is_resolved).length;
  const flagsUnresolved = flagsIssued - flagsResolved;

  // Build email body
  let body = `
    <p style="color:#374151;margin:0 0 20px;font-size:15px;">
      Here is the monthly performance report for <strong>${monthName}</strong>.
    </p>`;

  // Task overview
  body += sectionHeader("📋 Tasks Overview", "#2563eb");
  body += `
    <div style="margin-bottom:12px;">
      ${statBadge("Assigned", totalAssigned, "#374151")}
      ${statBadge("Completed", totalCompleted, "#059669")}
      ${statBadge("Overdue", totalOverdue, totalOverdue > 0 ? "#dc2626" : "#6b7280")}
      ${statBadge("Completion Rate", completionRate + "%", completionRate >= 80 ? "#059669" : completionRate >= 50 ? "#d97706" : "#dc2626")}
    </div>`;

  if (totalAssigned > 0) {
    const completedPct = completionRate;
    const overduePct = Math.round((totalOverdue / totalAssigned) * 100);
    body += `
      <div style="background:#f9fafb;border-radius:8px;padding:14px 18px;margin-bottom:12px;">
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;color:#374151;font-weight:600;">Completion Rate</span>
            <span style="font-size:12px;color:#374151;">${completedPct}%</span>
          </div>
          <div style="background:#e5e7eb;border-radius:9999px;height:8px;overflow:hidden;">
            <div style="background:#059669;height:100%;width:${completedPct}%;border-radius:9999px;"></div>
          </div>
        </div>
      </div>`;
  }

  // Attendance
  body += sectionHeader("🕘 Attendance Summary", "#0891b2");
  body += `
    <div style="margin-bottom:12px;">
      ${statBadge("Present Days", totalPresent, "#059669")}
      ${statBadge("Late", totalLate, "#d97706")}
      ${statBadge("Absent", totalAbsent, totalAbsent > 0 ? "#dc2626" : "#6b7280")}
      ${statBadge("Half Days", totalHalfDay, "#6b7280")}
    </div>`;

  if (workingDays > 0 && uniqueEmployees > 0) {
    body += `<p style="color:#6b7280;font-size:13px;margin:4px 0 16px;">
      Across <strong>${uniqueEmployees} employee${uniqueEmployees !== 1 ? "s" : ""}</strong>
      over approximately <strong>${workingDays} working day${workingDays !== 1 ? "s" : ""}</strong>.
    </p>`;
  }

  // Flags
  body += sectionHeader("🚩 Flags This Month", "#7c3aed");
  body += `
    <div style="margin-bottom:12px;">
      ${statBadge("Issued", flagsIssued, "#7c3aed")}
      ${statBadge("Resolved", flagsResolved, "#059669")}
      ${statBadge("Unresolved", flagsUnresolved, flagsUnresolved > 0 ? "#dc2626" : "#6b7280")}
    </div>`;

  if (flagsIssued > 0) {
    const rows = [tableRow(["Employee", "Reason", "Severity", "Resolved"], true)];
    for (const f of allFlags ?? []) {
      const name = (f as any).profiles?.full_name ?? "—";
      const resolved = f.is_resolved ? "✅ Yes" : "❌ No";
      rows.push(tableRow([name, f.reason ?? "—", f.severity ?? "—", resolved]));
    }
    body += tableWrap(rows);
  } else {
    body += emptyNote("No flags were issued this month.");
  }

  body += ctaButton("View Full Dashboard", APP_URL, "#111827");

  const html = emailWrap("#111827", `📋 Monthly Report — ${monthName}`, body);
  const subject = `📋 Nexus HQ — Monthly Report ${monthName}`;

  const admins = await getAdminsOnly(workspaceId);
  const sentTo = new Set<string>();
  for (const a of admins) {
    if (!a.email || sentTo.has(a.email)) continue;
    await enqueueEmail(a.email, subject, html);
    sentTo.add(a.email);
  }

  await logAutomation(workspaceId, "scheduled_report_monthly", null, {
    month: monthName,
    month_start: monthStart,
    month_end: monthEnd,
    total_assigned: totalAssigned,
    total_completed: totalCompleted,
    completion_rate: completionRate,
    flags_issued: flagsIssued,
    flags_resolved: flagsResolved,
    recipients: sentTo.size,
  }, "success");
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  let reportType: ReportType | null = null;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      reportType = (body?.report_type as ReportType) ?? null;
    }
    if (!reportType) {
      const url = new URL(req.url);
      reportType = (url.searchParams.get("report_type") as ReportType) ?? null;
    }
  } catch {
    // ignore parse errors
  }

  const validTypes: ReportType[] = ["daily", "weekly", "monthly"];
  if (!reportType || !validTypes.includes(reportType)) {
    return new Response(
      JSON.stringify({
        error: `Invalid or missing 'report_type'. Must be one of: ${validTypes.join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const summary = { report_type: reportType, workspaces: 0, errors: 0 };

  try {
    const workspaces = await getActiveWorkspaces();

    for (const workspace of workspaces) {
      const workspaceId = workspace.id;
      summary.workspaces++;

      try {
        const settings = await getAutomationSettings(workspaceId);
        if (!settings?.scheduled_reports_enabled) {
          console.log(`Workspace ${workspaceId}: scheduled_reports_enabled=false, skipping`);
          continue;
        }

        switch (reportType) {
          case "daily":
            await runDailyReport(workspaceId);
            break;
          case "weekly":
            await runWeeklyReport(workspaceId);
            break;
          case "monthly":
            await runMonthlyReport(workspaceId);
            break;
        }

        console.log(`Workspace ${workspaceId}: ${reportType} report sent`);
      } catch (wsError: unknown) {
        console.error(`Error processing workspace ${workspaceId} [${reportType}]:`, wsError);
        await logAutomation(
          workspaceId,
          `scheduled_report_${reportType}`,
          null,
          { error: String(wsError) },
          "failed",
        ).catch(() => {});
        summary.errors++;
      }
    }

    console.log("Scheduled reports engine complete:", summary);
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Fatal error in scheduled-reports-engine:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
