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
  const { data, error } = await callerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export async function assertCallerIsManagerOrAdmin(callerId: string, callerClient: DbClient) {
  const { data, error } = await callerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "manager"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0)
    throw new Error("Forbidden: manager or admin role required");
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

  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: input.full_name },
      redirectTo: input.redirectTo,
    });
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
      phone: input.phone ?? null,
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (profileError) throw new Error(profileError.message);

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

// Uses the caller's JWT — manager RLS policies allow these writes (see migration).
export async function setEmployeeActive(
  userId: string,
  isActive: boolean,
  callerClient: DbClient,
) {
  const { error } = await callerClient
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
  role: AppRole,
  callerClient: DbClient,
) {
  const { error: delError } = await callerClient
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(delError.message);

  const { error } = await callerClient
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (error) throw new Error(error.message);
}

export async function resolveFlag(flagId: string, callerClient: DbClient) {
  const { error } = await callerClient
    .from("flags")
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", flagId);
  if (error) throw new Error(error.message);
}

// ── Invitation system (link + passcode, no email required) ────────────────────

const PASSCODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePasscode(len = 6): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => PASSCODE_CHARS[b % PASSCODE_CHARS.length]).join("");
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
  token: string;
  passcode: string;
}> {
  const adminClient = requireAdminClient();
  const passcode = generatePasscode();

  const { data, error } = await adminClient
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      passcode,
      email: input.email.trim().toLowerCase(),
      full_name: input.full_name.trim(),
      job_title: input.job_title ?? null,
      department: (input.department ?? "other") as Department,
      phone: input.phone ?? null,
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select("token, passcode")
    .single();

  if (error) throw new Error(error.message);
  return { token: data.token, passcode: data.passcode };
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

  if (createErr) {
    // If user already exists (re-attempt), just log them in — don't block
    if (!createErr.message.toLowerCase().includes("already")) throw new Error(createErr.message);
  }

  const userId = created?.user?.id;

  if (userId) {
    await adminClient.from("profiles").upsert(
      {
        id: userId,
        email: inv.email,
        full_name: inv.full_name,
        job_title: inv.job_title ?? null,
        department: inv.department ?? "other",
        phone: inv.phone ?? null,
        is_active: true,
      },
      { onConflict: "id" },
    );

    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("user_roles").insert({ user_id: userId, role: inv.role });

    await adminClient.from("workspace_members").upsert(
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
