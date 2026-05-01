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
