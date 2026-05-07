import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

async function resolveWorkspace(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(slug)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).workspaces?.slug ?? null;
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
      if (slug) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: `/${slug}/dashboard` as any });
      } else {
        navigate({ to: "/signup" });
      }
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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <span className="text-xl font-bold">N</span>
          </div>
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
              className="bg-input"
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
                className="bg-input pr-10"
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
