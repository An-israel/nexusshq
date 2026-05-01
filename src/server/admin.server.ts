// Server-only helpers for admin operations. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Department = Database["public"]["Enums"]["department_type"];

export async function assertCallerIsAdmin(callerId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export async function assertCallerIsManagerOrAdmin(callerId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .in("role", ["admin", "manager"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: manager or admin role required");
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
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  // 1. Invite user via auth admin (sends magic link to /accept-invite)
  const { data: invited, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: input.full_name },
      redirectTo: input.redirectTo,
    });

  if (inviteError) {
    // If user already exists, surface that nicely
    throw new Error(inviteError.message);
  }
  const userId = invited.user?.id;
  if (!userId) throw new Error("Invite returned no user id");

  // 2. Upsert profile (handle_new_user trigger may have created a stub)
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert(
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

  // 3. Set role (replace defaults from trigger)
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: input.role });
  if (roleError) throw new Error(roleError.message);

  return { userId, email };
}

export async function setEmployeeActive(userId: string, isActive: boolean) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function setEmployeeRole(userId: string, role: AppRole) {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (error) throw new Error(error.message);
}
