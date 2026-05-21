import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Supabase client (service role) ──────────────────────────────────────────

export const supabase: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ── App base URL ─────────────────────────────────────────────────────────────

export const APP_URL = Deno.env.get("APP_URL") ?? "https://nexus.skryveai.com";

// ── Date/time helpers (WAT = UTC+1) ─────────────────────────────────────────

/**
 * Returns today's date string in WAT (UTC+1) as YYYY-MM-DD.
 */
export function todayWAT(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the date string in WAT offset by `days` from today.
 * Negative values go into the past; positive into the future.
 */
export function dateOffsetWAT(days: number): string {
  const d = new Date();
  d.setHours(d.getHours() + 1); // shift to WAT
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns true if the current UTC day (adjusted to WAT) is Monday–Friday.
 */
export function isWeekday(): boolean {
  const d = new Date();
  d.setHours(d.getHours() + 1); // shift to WAT
  const day = d.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day >= 1 && day <= 5;
}

// ── Automation settings ──────────────────────────────────────────────────────

export interface AutomationSettings {
  workspace_id: string;
  task_reminders_enabled: boolean;
  auto_status_enabled: boolean;
  overdue_escalation_enabled: boolean;
  scheduled_reports_enabled: boolean;
  clock_reminders_enabled: boolean;
  auto_clockout_enabled: boolean;
  daily_report_time: string;
  weekly_report_day: string;
  report_recipients: string[];
}

/**
 * Fetches automation settings for a workspace. If no row exists yet it
 * upserts a default row and returns the defaults.
 */
export async function getAutomationSettings(
  workspaceId: string,
): Promise<AutomationSettings | null> {
  const { data, error } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error(`[helpers] getAutomationSettings error for ${workspaceId}:`, error.message);
    return null;
  }

  if (data) return data as AutomationSettings;

  // Row missing — upsert defaults and return them
  const { data: inserted, error: insertErr } = await supabase
    .from("automation_settings")
    .upsert({ workspace_id: workspaceId }, { onConflict: "workspace_id" })
    .select("*")
    .maybeSingle();

  if (insertErr) {
    console.error(
      `[helpers] upsert automation_settings error for ${workspaceId}:`,
      insertErr.message,
    );
    return null;
  }

  return inserted as AutomationSettings | null;
}

// ── Workspace helpers ────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
}

/**
 * Returns all active workspaces.
 */
export async function getActiveWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name")
    .eq("is_active", true);

  if (error) {
    console.error("[helpers] getActiveWorkspaces error:", error.message);
    return [];
  }

  return (data ?? []) as Workspace[];
}

// ── Automation logging ───────────────────────────────────────────────────────

/**
 * Inserts a row into automation_logs. Failures are logged to console but
 * never thrown — logging must not interrupt the automation run itself.
 */
export async function logAutomation(
  workspaceId: string,
  automationType: string,
  triggeredFor: string | null,
  details: Record<string, unknown>,
  status: "success" | "failed" | "skipped",
): Promise<void> {
  const { error } = await supabase.from("automation_logs").insert({
    workspace_id: workspaceId,
    automation_type: automationType,
    triggered_for: triggeredFor ?? null,
    details,
    status,
  });

  if (error) {
    console.error("[helpers] logAutomation error:", error.message);
  }
}

// ── In-app notifications ─────────────────────────────────────────────────────

/**
 * Inserts a row into the notifications table for a user.
 */
export async function sendNotification(
  userId: string,
  workspaceId: string,
  type: string,
  title: string,
  message: string,
  relatedTaskId?: string,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    workspace_id: workspaceId,
    type,
    title,
    message,
    ...(relatedTaskId ? { related_task_id: relatedTaskId } : {}),
  });

  if (error) {
    console.error("[helpers] sendNotification error:", error.message);
  }
}

// ── Email queue ──────────────────────────────────────────────────────────────

/**
 * Enqueues a transactional email for delivery by the email-worker function.
 */
export async function enqueueEmail(to: string, subject: string, html: string): Promise<void> {
  const { error } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: { to, subject, html },
  });

  if (error) {
    console.error("[helpers] enqueueEmail error:", error.message);
  }
}

// ── WhatsApp / SMS (Africa's Talking) ────────────────────────────────────────

/**
 * Sends an SMS/WhatsApp message via Africa's Talking.
 * Requires env vars: WHATSAPP_API_KEY, WHATSAPP_USERNAME (default "sandbox"),
 * WHATSAPP_SENDER_ID (default "NexxosHQ").
 */
export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const apiKey = Deno.env.get("WHATSAPP_API_KEY");
  const username = Deno.env.get("WHATSAPP_USERNAME") ?? "sandbox";
  const senderId = Deno.env.get("WHATSAPP_SENDER_ID") ?? "NexxosHQ";

  if (!apiKey) {
    // Dev mode — no API key configured, just log
    console.log(`[WhatsApp] TO: ${phone} | MSG: ${message}`);
    return;
  }

  const params = new URLSearchParams({
    username,
    to: phone,
    message,
    from: senderId,
  });

  const resp = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey,
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    console.error("[helpers] sendWhatsApp failed:", await resp.text());
  }
}

/**
 * Looks up a user's profile and, if WhatsApp opt-in is enabled and a phone
 * number is present, sends them a WhatsApp/SMS message.
 *
 * Phone normalisation (Nigerian numbers):
 *   - Already starts with '+' → used as-is
 *   - Starts with '0'        → replace leading '0' with '+234'
 *   - Otherwise              → prepend '+234'
 */
export async function notifyUserWhatsApp(userId: string, message: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("phone, whatsapp_opt_in, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[helpers] notifyUserWhatsApp profile lookup error:", error.message);
    return;
  }

  if (!profile?.whatsapp_opt_in || !profile?.phone) return;

  let phone: string = profile.phone;
  if (phone.startsWith("+")) {
    // already international — keep as-is
  } else if (phone.startsWith("0")) {
    phone = "+234" + phone.slice(1);
  } else {
    phone = "+234" + phone;
  }

  await sendWhatsApp(phone, message);
}

// ── Branded HTML email blocks ────────────────────────────────────────────────

/**
 * Returns the top header block for a Nexxos HQ branded email.
 * @param title - The heading text displayed in the header bar.
 * @param color - Background colour of the header (default #111111).
 */
export function emailHeader(title: string, color = "#111111"): string {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${color};padding:28px 32px;text-align:center;">
        <p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Nexxos HQ</p>
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
      </div>
      <div style="padding:28px 32px;">
  `.trim();
}

/**
 * Returns the closing footer block for a Nexxos HQ branded email.
 * Closes the inner padding div opened by emailHeader.
 */
export function emailFooter(): string {
  return `
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;text-align:center;">
        <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">
          Nexxos HQ &mdash; Automated notification
        </p>
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          You received this email because you are a member of a Nexxos HQ workspace.
          <br>
          <a href="${APP_URL}" style="color:#6b7280;text-decoration:underline;">Visit Nexxos HQ</a>
        </p>
      </div>
    </div>
  `.trim();
}

/**
 * Returns a full-width CTA button for use inside an email body.
 * @param label - Button text.
 * @param url   - Link URL.
 * @param color - Button background colour (default #111111).
 */
export function emailButton(label: string, url: string, color = "#111111"): string {
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}"
         style="display:inline-block;background:${color};color:#ffffff;padding:13px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:0.3px;">
        ${label}
      </a>
    </div>
  `.trim();
}
