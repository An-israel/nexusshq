import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { redeemInvitationFn } from "@/lib/admin.functions";
import { Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemInvitationFn);

  const [code, setCode] = useState(token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const key = code.trim();
    if (!key) return toast.error("Enter your invite link token or passcode");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");

    setSubmitting(true);
    try {
      const { workspaceSlug, email } = await redeem({ data: { tokenOrPasscode: key, password } });

      // Sign in automatically with the new credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        // Account created but auto-login failed — send them to login
        toast.success("Account created! Please sign in with your email and password.");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        navigate({ to: "/login" as any });
        return;
      }

      toast.success("Welcome to Nexxos HQ!");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: `/${workspaceSlug}/dashboard` as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem invitation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark size="lg" className="mb-5" />
        <h1 className="text-2xl font-bold tracking-tight">Join your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the invite link or passcode your manager shared with you
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="space-y-2">
          <Label htmlFor="code">Invite token or passcode</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste token from link, or enter 6-char passcode"
            autoFocus={!token}
            className="font-mono text-base md:text-sm"
          />
          {token ? (
            <p className="text-xs text-success">✓ Invite token detected from your link</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Your manager sent you a link like <code>/join?token=…</code> or a short passcode (e.g.{" "}
              <code>NXS7KP</code>).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Create a password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-input pr-10 text-base md:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="bg-input text-base md:text-sm"
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating account…" : "Create account & join"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="underline hover:text-foreground">
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
