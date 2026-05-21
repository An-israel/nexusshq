import * as React from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { waitForVerifiedUser } from "@/lib/auth-ready";

export const Route = createFileRoute("/create-workspace")({
  beforeLoad: async () => {
    // Use getUser() (server-verified) not getSession() (stale localStorage)
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signup" });
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
  const [checkingSlug, setCheckingSlug] = React.useState(false);
  const [slugAvailable, setSlugAvailable] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const cleaned = name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    setSlug(cleaned);
  }, [name]);

  React.useEffect(() => {
    if (!slug || !isValidSlug(slug)) {
      setCheckingSlug(false);
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    setSlugAvailable(null);

    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      setCheckingSlug(false);
      if (error) {
        setSlugAvailable(null);
        return;
      }

      setSlugAvailable(data === null);
    }, 350);

    return () => clearTimeout(timer);
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Company name is required");
    if (!isValidSlug(slug))
      return toast.error("Workspace URL must be 3-30 chars, lowercase letters, numbers, hyphens");
    if (checkingSlug) return toast.error("Still checking workspace URL — please wait a moment");
    if (slugAvailable === false) return toast.error("That workspace URL is already taken");

    setSubmitting(true);
    try {
      const verifiedUser = await waitForVerifiedUser();
      if (!verifiedUser) {
        toast.error("Your session is still loading. Please sign in again and try once more.");
        navigate({ to: "/login" });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("create_workspace_with_owner", {
        _name: name.trim(),
        _slug: slug,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.slug) throw new Error("Failed to create workspace");

      toast.success("Workspace created!");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: `/${row.slug}/dashboard` as any });
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      const msg =
        e?.message || e?.error_description || e?.hint || e?.details || "Failed to create workspace";
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
          <BrandMark size="md" />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold">Create another workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the same account across multiple companies or teams and switch between them
              anytime.
            </p>
          </div>
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Workspace URL</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">nexushq.app/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  required
                  className="bg-input flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {checkingSlug
                  ? "Checking availability…"
                  : slugAvailable === false
                    ? "This workspace URL is already in use."
                    : slugAvailable === true
                      ? "This workspace URL is available."
                      : "Choose a unique workspace URL for this team."}
              </p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating…" : "Create workspace"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/workspaces" })}
            >
              View my workspaces
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
