import * as React from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronRight, Plus } from "lucide-react";

export const Route = createFileRoute("/workspaces")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: WorkspacesPage,
});

type WorkspaceMembership = {
  id: string;
  role: "owner" | "admin" | "manager" | "employee";
  is_active: boolean;
  workspaces:
    | {
        id: string;
        name: string;
        slug: string;
        plan: "starter" | "growth" | "business" | "enterprise";
        is_active: boolean;
      }
    | Array<{
        id: string;
        name: string;
        slug: string;
        plan: "starter" | "growth" | "business" | "enterprise";
        is_active: boolean;
      }>
    | null;
};

function firstWorkspace(
  value: WorkspaceMembership["workspaces"],
): {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "business" | "enterprise";
  is_active: boolean;
} | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function WorkspacesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [memberships, setMemberships] = React.useState<WorkspaceMembership[]>([]);

  React.useEffect(() => {
    let mounted = true;

    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        navigate({ to: "/login" });
        return;
      }

      const { data, error } = await supabase
        .from("workspace_members")
        .select("id, role, is_active, workspaces(id, name, slug, plan, is_active)")
        .eq("user_id", auth.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!mounted) return;

      if (error) {
        setMemberships([]);
      } else {
        setMemberships((data ?? []) as WorkspaceMembership[]);
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-base font-semibold">Your workspaces</p>
              <p className="text-xs text-muted-foreground">Open any team or create a new one.</p>
            </div>
          </Link>

          <Button onClick={() => navigate({ to: "/create-workspace" })}>
            <Plus className="h-4 w-4" />
            Create workspace
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : memberships.length === 0 ? (
          <Card className="flex min-h-[260px] flex-col items-center justify-center gap-4 border-dashed px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">No workspace yet</h1>
              <p className="text-sm text-muted-foreground">Create your first workspace and start inviting your team.</p>
            </div>
            <Button onClick={() => navigate({ to: "/create-workspace" })}>Create workspace</Button>
          </Card>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">Choose a workspace</h1>
              <p className="text-sm text-muted-foreground">One account can belong to multiple companies, brands, or internal teams.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {memberships
                .map((membership) => ({
                  membership,
                  workspace: firstWorkspace(membership.workspaces),
                }))
                .filter((entry) => entry.workspace)
                .map((membership) => {
                  const workspace = membership.workspace!;
                  const entry = membership.membership;

                  return (
                    <Link
                      key={entry.id}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      to={`/${workspace.slug}/dashboard` as any}
                      className="group block"
                    >
                      <Card className="flex h-full items-start justify-between gap-4 border-border/70 p-5 transition-colors hover:border-primary/40 hover:bg-accent/30">
                        <div className="space-y-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold">{workspace.name}</h2>
                              <Badge variant="secondary" className="capitalize">{entry.role}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">nexus.skryveai.com/{workspace.slug}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">{workspace.plan}</Badge>
                        </div>

                        <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                      </Card>
                    </Link>
                  );
                })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}