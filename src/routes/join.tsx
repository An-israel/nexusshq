import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { redeemInvitationFn, requestNewInviteFn } from "@/lib/admin.functions";
import { Eye, EyeOff, AlertTriangle, Send, Check } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

function isUsableToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value !== "undefined" &&
    value !== "null"
  );
}

export const Route = createFileRoute("/join")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: isUsableToken(s.token) ? s.token : undefined,
    // Distinguish "no token in URL" from "a token was there but it's broken"
    // (e.g. token=undefined from a malformed invite email).
    brokenLink: "token" in s && !isUsableToken(s.token) ? true : undefined,
  }),
  component: JoinPage,
});

function JoinPage() {
  const { token, brokenLink } = Route.useSearch();
  const navigate = useNavigate();
  const redeem = useServerFn(redeemInvitationFn);
  const requestNewInvite = useServerFn(requestNewInviteFn);

  const [code, setCode] = useState(token ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const key = code.trim();
    if (!key) return toast.error("Enter your invite link token or passcode");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");

    setSubmitting(true);
    setRedeemError(null);
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
      const message = err instanceof Error ? err.message : "Failed to redeem invitation";
      setRedeemError(message);
      setRequestState("idle");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestNewInvite() {
    const key = code.trim();
    setRequestState("sending");
    try {
      const { ok } = await requestNewInvite({ data: { tokenOrPasscode: key || "unknown" } });
      if (ok) {
        setRequestState("sent");
        toast.success("We've asked the person who invited you to send a fresh invite.");
      } else {
        setRequestState("idle");
        toast.error(
          "We couldn't match this invite. Please contact your manager or workspace admin directly for a new invitation.",
        );
      }
    } catch {
      setRequestState("idle");
      toast.error("Something went wrong. Please contact your workspace admin for a new invite.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark size="lg" className="mb-5" />
        <h1 className="text-2xl font-bold tracking-tight">Join your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {token
            ? "Your invite link was detected. Set a password to create your account."
            : "Enter the invite token from your email, or the passcode your manager shared."}
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        {brokenLink && !redeemError && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-medium">This invite link looks broken or incomplete.</p>
              <p className="mt-1 text-xs opacity-90">
                The link you opened didn't contain a valid invite token. If your manager shared a
                6-character passcode with you, enter it below instead — or ask them to resend the
                invitation.
              </p>
            </div>
          </div>
        )}

        {redeemError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="text-sm text-red-700 dark:text-red-400">
                <p className="font-medium">This invite can't be used.</p>
                <p className="mt-1 text-xs opacity-90">
                  {redeemError} Invitations expire after 7 days and can only be used once.
                </p>
              </div>
            </div>
            <div className="mt-3 pl-7">
              {requestState === "sent" ? (
                <p className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <Check className="h-3.5 w-3.5" /> Request sent — the person who invited you has
                  been notified to send a new invite.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestNewInvite}
                  disabled={requestState === "sending"}
                  className="text-xs"
                >
                  <Send className="mr-1.5 h-3 w-3" />
                  {requestState === "sending" ? "Requesting…" : "Request a new invite"}
                </Button>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="w-full space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="space-y-2">
            <Label htmlFor="code">Invite token or passcode</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setRedeemError(null);
              }}
              placeholder="Paste token from link, or enter 6-char passcode"
              autoFocus={!token}
              className="font-mono text-base md:text-sm"
            />
            {token ? (
              <p className="text-xs text-success">✓ Invite token detected from your link</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Your manager sent you a link like <code>/join?token=…</code> or a short passcode
                (e.g. <code>NXS7KP</code>).
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
    </div>
  );
}
