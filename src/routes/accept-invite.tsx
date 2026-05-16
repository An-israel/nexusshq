import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";

interface InviteSearch {
  token?: string;
}

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>): InviteSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/accept-invite" });

  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; workspaceName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track session
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionReady(!!data.session);
      // If user came in via Supabase invite-link flow (hash tokens), they need to set password
      if (data.session && window.location.hash.includes("access_token")) {
        setNeedsPassword(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      setSessionReady(!!s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Look up invite metadata when we have a token
  useEffect(() => {
    if (!token) return;
    void (async () => {
      const { data, error: e } = await supabase
        .from("workspace_invites")
        .select("email, expires_at, accepted_at, workspaces(name)")
        .eq("token", token)
        .maybeSingle();
      if (e || !data) {
        setError("Invite not found. Ask your admin for a fresh link.");
        return;
      }
      if (data.accepted_at) {
        setError("This invite has already been used.");
        return;
      }
      if (new Date(data.expires_at as string) < new Date()) {
        setError("This invite has expired. Ask your admin for a fresh link.");
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wsName = (data as any).workspaces?.name ?? "the workspace";
      setInviteInfo({ email: data.email as string, workspaceName: wsName });
    })();
  }, [token]);

  // Auto-redeem token once we have a session
  useEffect(() => {
    if (!token || !sessionReady || needsPassword || error) return;
    void (async () => {
      setRedeeming(true);
      try {
        const { data, error: e } = await supabase.rpc("redeem_workspace_invite", { _token: token });
        if (e) throw e;
        const row = Array.isArray(data) ? data[0] : data;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slug = (row as any)?.slug;
        toast.success("Welcome aboard!");
        if (slug) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          navigate({ to: `/${slug}/dashboard` as any });
        } else {
          navigate({ to: "/login" });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not redeem invite";
        setError(msg);
      } finally {
        setRedeeming(false);
      }
    })();
  }, [token, sessionReady, needsPassword, error, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setSubmitting(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updErr) return toast.error(updErr.message);
    setNeedsPassword(false);
    toast.success("Password set");
    if (token) return; // useEffect will redeem
    // No token → resolve via existing membership
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: mem } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slug = (mem as any)?.workspaces?.slug;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (slug) { navigate({ to: `/${slug}/dashboard` as any }); return; }
    }
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size="lg" className="mb-5" />
          <h1 className="text-2xl font-bold tracking-tight">
            {token ? "Join workspace" : "Set your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {inviteInfo
              ? `You've been invited to join ${inviteInfo.workspaceName}.`
              : "Finish setting up your Nexus HQ account"}
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            <p className="font-medium">Couldn't accept invite</p>
            <p className="mt-1 text-destructive/80">{error}</p>
            <div className="mt-4 flex gap-2">
              <Link to="/login" className="text-primary hover:underline">Sign in</Link>
              <span className="text-muted-foreground">·</span>
              <Link to="/signup" className="text-primary hover:underline">Create account</Link>
            </div>
          </div>
        ) : token && sessionReady === false ? (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-sm">
            <p>
              {inviteInfo
                ? <>To accept this invite, sign in as <span className="font-medium">{inviteInfo.email}</span> or create an account with that email.</>
                : "Sign in or create an account to accept this invite."}
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link
                  to="/signup"
                  search={{ invite: token, email: inviteInfo?.email ?? "" } as never}
                >
                  Create account
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link
                  to="/login"
                  search={{ invite: token } as never}
                >
                  Sign in
                </Link>
              </Button>
            </div>
          </div>
        ) : sessionReady === null ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : needsPassword ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-input" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-input" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Saving…" : "Set password & continue"}
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {redeeming ? "Joining workspace…" : "Validating…"}
          </div>
        )}
      </div>
    </div>
  );
}
