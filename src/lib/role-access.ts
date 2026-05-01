import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { logSupabaseClientError } from "@/lib/supabase-diagnostics";

export type AppRole = "admin" | "manager" | "employee";

type RoleRow = { role: AppRole };

function isRetryableRoleError(error: { code?: string; message?: string; status?: number } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST000" ||
    error.code === "PGRST001" ||
    error.code === "PGRST002" ||
    error.status === 503 ||
    /schema cache|retrying the connection|database connection error|database client error/i.test(
      error.message ?? "",
    )
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchUserRolesWithRetry(userId: string, attempts = 5) {
  let lastError: { code?: string; message?: string; status?: number } | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    if (!error) {
      return { roles: ((data ?? []) as RoleRow[]), error: null };
    }

    lastError = error;

    logSupabaseClientError({
      scope: "fetchUserRolesWithRetry",
      error,
      matchers: ["/rest/v1/user_roles", `user_id=eq.${userId}`],
      extra: {
        attempt: attempt + 1,
        attempts,
        userId,
        query: "select role from user_roles where user_id = ?",
      },
    });

    if (!isRetryableRoleError(error) || attempt === attempts - 1) {
      break;
    }

    await wait(400 * (attempt + 1));
  }

  return { roles: [] as RoleRow[], error: lastError };
}

export function pickTopRole(rows: RoleRow[]) {
  const roles = rows.map((row) => row.role);

  if (roles.includes("admin")) return "admin" satisfies AppRole;
  if (roles.includes("manager")) return "manager" satisfies AppRole;
  if (roles.includes("employee")) return "employee" satisfies AppRole;
  return null;
}

export async function requireAnyRole(allowedRoles: AppRole[]) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isTransientAuthError =
    !!error && /unexpected failure|database error querying schema|please check server logs/i.test(error.message);

  if (error) {
    logSupabaseClientError({
      scope: "requireAnyRole:getUser",
      error,
      matchers: ["/auth/v1/user"],
      extra: {
        allowedRoles,
      },
    });
  }

  if (!user && !isTransientAuthError) {
    throw redirect({ to: "/login" });
  }

  if (!user) {
    return;
  }

  const { roles, error: roleError } = await fetchUserRolesWithRetry(user.id);

  if (roleError) {
    logSupabaseClientError({
      scope: "requireAnyRole:roleLookup",
      error: roleError,
      matchers: ["/rest/v1/user_roles", `user_id=eq.${user.id}`],
      extra: {
        allowedRoles,
        userId: user.id,
      },
    });
    console.warn("Role lookup failed during route access check", roleError);
    return;
  }

  if (!roles.some((row) => allowedRoles.includes(row.role))) {
    throw redirect({ to: "/dashboard" });
  }
}