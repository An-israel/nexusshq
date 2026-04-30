import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

async function requireRole(allowed: Array<"admin" | "manager">) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: "/login" });
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  const has = (roles ?? []).some((r) => allowed.includes(r.role as "admin" | "manager"));
  if (!has) throw redirect({ to: "/dashboard" });
}

export const Route = createFileRoute("/_app/team")({
  beforeLoad: () => requireRole(["admin", "manager"]),
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Team Overview</h1>
      <p className="text-sm text-muted-foreground">Team page ships in Phase 5.</p>
    </div>
  ),
});
