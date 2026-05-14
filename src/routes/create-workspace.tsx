import * as React from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap } from "lucide-react";

export const Route = createFileRoute("/create-workspace")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: CreateWorkspacePage,
});

function isValidSlug(s: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(s);
}

function CreateWorkspacePage() {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const cleaned = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    setSlug(cleaned);
  }, [name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name is required");
    if (!isValidSlug(slug)) return toast.error("Workspace URL must be 3-30 chars, lowercase letters, numbers, hyphens");

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert({ name: name.trim(), slug, plan: "starter" as const })
        .select("id, slug")
        .single();
      if (wsErr) throw wsErr;

      const { error: memErr } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" as const, is_active: true });
      if (memErr) throw memErr;

      toast.success("Workspace created!");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: `/${ws.slug}/dashboard` as any });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      const msg = e?.message || e?.error_description || e?.hint || e?.details || "Failed to create workspace";
      console.error("create-workspace failed:", e);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Nexus HQ</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold">Create your workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You don't belong to any workspace yet. Create one to get started.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Workspace URL</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">nexushq.app/</span>
                <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required className="bg-input flex-1" />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
