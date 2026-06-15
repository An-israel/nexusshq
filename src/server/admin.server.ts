// Server-only helpers for admin operations. Never import from client code.
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Department = Database["public"]["Enums"]["department_type"];
type DbClient = SupabaseClient<Database>;

// Only instantiated when inviteEmployee is called — throws a clear message if key is missing.
function requireAdminClient(): DbClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Inviting new employees requires a service-role key. " +
        "Please add SUPABASE_SERVICE_ROLE_KEY to your Lovable environment variables.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  }) as DbClient;
}

// Use the caller's own JWT to verify their role.
// "users view own roles" RLS policy allows this without service-role key.
export async function assertCallerIsAdmin(callerId: string, callerClient: DbClient) {
  // Check user_roles (legacy) first, then workspace_members (owner/admin)
  const [rolesRes, memberRes] = await Promise.all([
    callerClient.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin"),
    callerClient
      .from("workspace_members")
      .select("role")
      .eq("user_id", callerId)
      .eq("is_active", true)
      .in("role", ["owner", "admin"]),
  ]);
  const hasAdmin = (rolesRes.data?.length ?? 0) > 0 || (memberRes.data?.length ?? 0) > 0;
  if (!hasAdmin) throw new Error("Forbidden: admin role required");
}

export async function assertCallerIsManagerOrAdmin(callerId: string, callerClient: DbClient) {
  // Check user_roles (legacy) first, then workspace_members (owner/admin/manager)
  const [rolesRes, memberRes] = await Promise.all([
    callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "manager"]),
    callerClient
      .from("workspace_members")
      .select("role")
      .eq("user_id", callerId)
      .eq("is_active", true)
      .in("role", ["owner", "admin", "manager"]),
  ]);
  const hasRole = (rolesRes.data?.length ?? 0) > 0 || (memberRes.data?.length ?? 0) > 0;
  if (!hasRole) throw new Error("Forbidden: manager or admin role required");
}

export interface InviteEmployeeInput {
  email: string;
  full_name: string;
  job_title?: string | null;
  department?: Department | null;
  phone?: string | null;
  role: AppRole;
  redirectTo?: string;
  workspaceId: string;
}

export async function inviteEmployee(input: InviteEmployeeInput) {
  const adminClient = requireAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: input.full_name },
      redirectTo: input.redirectTo,
    },
  );
  if (inviteError) throw new Error(inviteError.message);

  const userId = invited.user?.id;
  if (!userId) throw new Error("Invite returned no user id");

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: input.full_name,
      job_title: input.job_title ?? null,
      department: input.department ?? "other",
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(profileError.message);

  if (input.phone) {
    await adminClient
      .from("profile_private")
      .upsert({ user_id: userId, phone: input.phone }, { onConflict: "user_id" });
  }

  await adminClient.from("user_roles").delete().eq("user_id", userId);
  const { error: roleError } = await adminClient
    .from("user_roles")
    .insert({ user_id: userId, role: input.role });
  if (roleError) throw new Error(roleError.message);

  // Add to workspace so RLS policies grant them access immediately on first login
  const { error: memberError } = await adminClient
    .from("workspace_members")
    .upsert(
      { workspace_id: input.workspaceId, user_id: userId, role: input.role, is_active: true },
      { onConflict: "workspace_id,user_id" },
    );
  if (memberError) throw new Error(memberError.message);

  return { userId, email };
}

// Uses admin client — permission is already validated by assertCallerIsAdmin upstream.
export async function setEmployeeActive(
  userId: string,
  isActive: boolean,
  _callerClient: DbClient,
) {
  const adminClient = requireAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
  callerClient: DbClient,
) {
  const { error } = await callerClient.rpc("remove_workspace_member", {
    _workspace_id: workspaceId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function setEmployeeRole(
  userId: string,
  workspaceId: string,
  role: AppRole,
  callerClient: DbClient,
) {
  const { error: delError } = await callerClient.from("user_roles").delete().eq("user_id", userId);
  if (delError) throw new Error(delError.message);

  const { error } = await callerClient.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(error.message);

  // Also update the workspace-scoped role, which is what RLS policies
  // (is_workspace_admin/is_workspace_manager) actually check.
  const { error: memberError } = await callerClient
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (memberError) throw new Error(memberError.message);
}

export async function resolveFlag(flagId: string, callerClient: DbClient) {
  const { error } = await callerClient
    .from("flags")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) throw new Error(error.message);
}

// ── Invite email ──────────────────────────────────────────────────────────────

export async function sendInviteEmail(opts: {
  toEmail: string;
  toName: string;
  workspaceName: string;
  inviterName: string;
  joinUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[invite-email] RESEND_API_KEY is not set — invite email cannot be sent", {
      to: opts.toEmail,
    });
    throw new Error("Invite email is not configured yet.");
  }
  const from = process.env.RESEND_FROM_EMAIL
    ? process.env.RESEND_FROM_EMAIL.includes("<")
      ? process.env.RESEND_FROM_EMAIL
      : `Nexxos HQ <${process.env.RESEND_FROM_EMAIL}>`
    : (process.env.EMAIL_FROM ?? "Nexxos HQ <onboarding@resend.dev>");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.toEmail],
      subject: `${opts.inviterName} invited you to join ${opts.workspaceName} on Nexxos HQ`,
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workspace Invitation</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#0f0f0f;padding:28px 32px">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.3px">Nexxos HQ</p>
        </td></tr>
        <tr><td style="padding:36px 32px">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f0f0f">You've been invited!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6">
            <strong>${opts.inviterName}</strong> has invited you to join
            <strong>${opts.workspaceName}</strong> on Nexxos HQ — the all-in-one workspace for team operations.
          </p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${opts.joinUrl}" style="display:inline-block;background:#0f0f0f;color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:8px;text-decoration:none">
              Accept Invitation →
            </a>
          </td></tr></table>
          <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.5">
            This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.<br><br>
            Or copy this link into your browser:<br>
            <a href="${opts.joinUrl}" style="color:#6366f1;word-break:break-all">${opts.joinUrl}</a>
          </p>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee">
          <p style="margin:0;font-size:12px;color:#aaa">© Nexxos HQ · nexxoshq.app</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    // Server-side log of the raw provider failure (status + body) for debugging.
    console.error("[invite-email] Resend rejected the invite email", {
      to: opts.toEmail,
      status: response.status,
      body: errorBody,
    });
    let providerMessage = errorBody || response.statusText;
    try {
      const parsed = JSON.parse(errorBody) as { message?: string };
      if (parsed.message) providerMessage = parsed.message;
    } catch {
      // body wasn't JSON — keep raw text
    }
    throw new Error(`Invite email failed: ${providerMessage}`);
  }

  const result = (await response.json().catch(() => null)) as { id?: string } | null;
  console.log("[invite-email] accepted by Resend", { to: opts.toEmail, id: result?.id ?? null });
}

/**
 * Records the outcome of an invite email attempt on the invitation row so
 * admins can see real delivery status instead of a false "email sent" state.
 * Best-effort: never throws.
 */
export async function markInviteEmailResult(
  invitationId: string,
  sent: boolean,
  errorMessage?: string | null,
): Promise<void> {
  try {
    const adminClient = requireAdminClient();
    const { data: current } = await adminClient
      .from("workspace_invitations")
      .select("email_attempts")
      .eq("id", invitationId)
      .maybeSingle();

    const { error } = await adminClient
      .from("workspace_invitations")
      .update({
        email_status: sent ? "sent" : "failed",
        email_error: sent ? null : (errorMessage ?? "Unknown email delivery error"),
        email_attempts: (current?.email_attempts ?? 0) + 1,
        email_last_attempt_at: new Date().toISOString(),
      })
      .eq("id", invitationId);
    if (error) throw error;
  } catch (err) {
    console.error("[invite-email] failed to record email delivery status", {
      invitationId,
      err,
    });
  }
}

// ── Invitation system (link + passcode, email sent automatically) ─────────────

const PASSCODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePasscode(len = 6): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => PASSCODE_CHARS[b % PASSCODE_CHARS.length])
    .join("");
}

function generateInviteToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreateInvitationInput {
  workspaceId: string;
  email: string;
  full_name: string;
  job_title?: string | null;
  department?: Department | null;
  phone?: string | null;
  role: AppRole;
  invitedBy: string;
}

export async function createInvitation(input: CreateInvitationInput): Promise<{
  invitationId: string;
  token: string;
  passcode: string;
}> {
  const adminClient = requireAdminClient();
  const passcode = generatePasscode();
  const token = generateInviteToken();

  const { data, error } = await adminClient
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      token,
      passcode,
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      job_title: input.job_title ?? null,
      department: (input.department ?? "other") as Department,
      phone: input.phone ?? null,
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { invitationId: data.id, token, passcode };
}

/**
 * Regenerates a fresh token + passcode for an existing unused invitation and
 * extends its expiry, so it can be emailed again even if the original link
 * was broken or the first email never arrived.
 */
export async function resendInvitation(opts: {
  invitationId: string;
  workspaceId: string;
}): Promise<{
  token: string;
  passcode: string;
  email: string;
  full_name: string;
}> {
  const adminClient = requireAdminClient();

  const { data: inv, error: lookupErr } = await adminClient
    .from("workspace_invitations")
    .select("id, email, full_name, used_at")
    .eq("id", opts.invitationId)
    .eq("workspace_id", opts.workspaceId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);
  if (!inv) throw new Error("Invitation not found.");
  if (inv.used_at) throw new Error("This invitation has already been used.");

  const token = generateInviteToken();
  const passcode = generatePasscode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await adminClient
    .from("workspace_invitations")
    .update({ token, passcode, expires_at: expiresAt, email_status: "pending", email_error: null })
    .eq("id", inv.id);

  if (updateErr) throw new Error(updateErr.message);
  return { token, passcode, email: inv.email, full_name: inv.full_name };
}

/**
 * Lets someone holding a dead invite link ask the inviter for a fresh one.
 * Looks the invitation up by token or passcode regardless of expiry/used
 * state and notifies the inviter in-app (the notification email cron picks
 * it up from there). Never reveals invitation details to the caller.
 */
export async function requestNewInvite(tokenOrPasscode: string): Promise<{ ok: boolean }> {
  const adminClient = requireAdminClient();
  const key = tokenOrPasscode.trim();
  if (!key || key === "undefined" || key === "null") return { ok: false };

  const isPasscode = /^[A-Z0-9]{4,8}$/i.test(key) && key.length <= 8;
  const query = adminClient
    .from("workspace_invitations")
    .select("id, email, full_name, workspace_id, invited_by");
  const { data: inv } = await (
    isPasscode ? query.eq("passcode", key.toUpperCase()) : query.eq("token", key)
  ).maybeSingle();

  if (!inv?.invited_by) return { ok: false };

  // Light dedupe: skip if we already nudged this inviter about this invite recently.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await adminClient
    .from("notifications")
    .select("id")
    .eq("user_id", inv.invited_by)
    .eq("title", "Invitation needs to be resent")
    .gt("created_at", oneHourAgo)
    .limit(1);
  if (recent && recent.length > 0) return { ok: true };

  const { error } = await adminClient.from("notifications").insert({
    user_id: inv.invited_by,
    workspace_id: inv.workspace_id,
    type: "info",
    title: "Invitation needs to be resent",
    message: `${inv.full_name} (${inv.email}) tried to use an invite link that is expired, already used, or broken. Resend the invitation from Team → Pending invitations.`,
  });
  if (error) {
    console.error("[invite] failed to notify inviter about a new-invite request", error);
    return { ok: false };
  }
  return { ok: true };
}

export interface RedeemInvitationInput {
  tokenOrPasscode: string;
  password: string;
}

export async function redeemInvitation(input: RedeemInvitationInput): Promise<{
  workspaceSlug: string;
  email: string;
}> {
  const adminClient = requireAdminClient();
  const key = input.tokenOrPasscode.trim();

  // Look up by token (hex, longer) or passcode (6 uppercase)
  const isPasscode = /^[A-Z0-9]{4,8}$/.test(key.toUpperCase()) && key.length <= 8;
  const filter = isPasscode
    ? adminClient.from("workspace_invitations").select("*").eq("passcode", key.toUpperCase())
    : adminClient.from("workspace_invitations").select("*").eq("token", key);

  const { data: inv, error: lookupErr } = await filter
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (lookupErr || !inv) throw new Error("Invitation not found, already used, or expired.");

  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: inv.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: inv.full_name },
  });

  let userId: string | null = created?.user?.id ?? null;

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    const alreadyExists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists") ||
      msg.includes("duplicate");
    if (!alreadyExists) throw new Error(createErr.message);

    // User already exists — find them and reset their password so they can sign in.
    const { data: prof } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", inv.email)
      .maybeSingle();
    let existingId = prof?.id ?? null;

    if (!existingId) {
      const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      existingId = list?.users.find((u) => u.email?.toLowerCase() === inv.email)?.id ?? null;
    }

    if (!existingId) {
      throw new Error("This email is already registered but the account couldn't be located.");
    }

    const { error: updErr } = await adminClient.auth.admin.updateUserById(existingId, {
      password: input.password,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);
    userId = existingId;
  }

  if (userId) {
    await adminClient.from("profiles").upsert(
      {
        id: userId,
        email: inv.email,
        full_name: inv.full_name,
        job_title: inv.job_title ?? null,
        department: inv.department ?? "other",
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (inv.phone) {
      await adminClient
        .from("profile_private")
        .upsert({ user_id: userId, phone: inv.phone }, { onConflict: "user_id" });
    }

    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("user_roles").insert({ user_id: userId, role: inv.role });

    await adminClient
      .from("workspace_members")
      .upsert(
        { workspace_id: inv.workspace_id, user_id: userId, role: inv.role, is_active: true },
        { onConflict: "workspace_id,user_id" },
      );
  }

  // Mark invitation as used
  await adminClient
    .from("workspace_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", inv.id);

  // Fetch workspace slug for redirect
  const { data: ws } = await adminClient
    .from("workspaces")
    .select("slug")
    .eq("id", inv.workspace_id)
    .single();

  return { workspaceSlug: ws?.slug ?? "", email: inv.email };
}
