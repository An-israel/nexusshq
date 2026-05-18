import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { getLastWorkspaceSlug } from "@/lib/last-workspace";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log In — Access Your Nexus HQ Workspace" },
      { name: "description", content: "Log in to your Nexus HQ workspace to manage attendance, tasks, standups, OKRs and team operations." },
      { property: "og:title", content: "Log In — Access Your Nexus HQ Workspace" },
      { property: "og:description", content: "Log in to manage attendance, tasks, standups and team operations." },
      { property: "og:url", content: "https://nexus.skryveai.com/login" },
    ],
    links: [{ rel: "canonical", href: "https://nexus.skryveai.com/login" }],
  }),
  component: LoginPage,
});

async function resolveWorkspace(userId: string): Promise<string | null> {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(slug)")
    .eq("user_id", userId)
    .eq("is_active", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slugs = (memberships ?? []).map((m: any) => m?.workspaces?.slug).filter(Boolean) as string[];

  if (slugs.length > 1) {
    // Prefer the user's last selected workspace if still valid.
    const last = getLastWorkspaceSlug();
    if (last && slugs.includes(last)) return last;
    return "__multi__";
  }

  if (slugs.length === 1) return slugs[0];

  // Fall back: check legacy user_roles — existing team members before migration
  const { data: legacyRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!legacyRole) return null;

  const { data: ws } = await supabase
    .from("workspaces")
    .select("slug")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return ws?.slug ?? "skryve";
}

function LoginPage() {
  const { signIn, session, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, resolve their workspace and redirect
  useEffect(() => {
    if (!session || !user) return;
    void resolveWorkspace(user.id).then((slug) => {
      if (slug === "__multi__") {
        navigate({ to: "/workspaces" });
        return;
      }
      if (slug) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: `/${slug}/dashboard` as any });
      }
      // If no workspace found at all, stay on login — they may need to sign up
    });
  }, [session, user, navigate]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error(error);
      setSubmitting(false);
      return;
    }
    // Redirect is handled by the useEffect above once session is set
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size="lg" showWordmark={false} className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight">Nexus HQ</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
        </div>

        <form
          onSubmit={handleSignIn}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="bg-input text-base md:text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-input pr-10 text-base md:text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Trouble signing in? Contact your workspace admin.
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have a workspace?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one free →
          </Link>
        </p>
      </div>
    </div>
  );
}
