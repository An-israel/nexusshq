import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Hash, Megaphone, Shuffle, Check, Users, Zap, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/onboarding")({
  component: OnboardingPage,
});

// ── Default channels preview ─────────────────────────────────────────────────

const DEFAULT_CHANNELS = [
  {
    name: "general",
    description: "Company-wide announcements and general chat",
    icon: Hash,
    color: "text-blue-400",
  },
  {
    name: "announcements",
    description: "Important updates from leadership",
    icon: Megaphone,
    color: "text-amber-400",
  },
  {
    name: "random",
    description: "Off-topic conversations and fun stuff",
    icon: Shuffle,
    color: "text-green-400",
  },
] as const;

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2">
      {([1, 2, 3] as const).map((n) => (
        <div
          key={n}
          className={`h-2.5 rounded-full transition-all duration-300 ${
            n === current
              ? "w-6 bg-primary"
              : n < current
                ? "w-2.5 bg-primary/60"
                : "w-2.5 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function OnboardingPage() {
  const { workspaceSlug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const workspaceId = workspace?.id ?? null;
  const userId = user?.id ?? null;

  const [step, setStep] = React.useState<1 | 2>(1);

  // Step 1 state
  const [emails, setEmails] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sentCount, setSentCount] = React.useState<number | null>(null);

  async function handleSendInvites() {
    if (!workspaceId || !userId) {
      toast.error("Workspace not loaded yet — please wait a moment");
      return;
    }

    const raw = emails
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (raw.length === 0) {
      toast.error("Please enter at least one valid email address");
      return;
    }

    setSending(true);
    try {
      const inserts = raw.map((email) => ({
        workspace_id: workspaceId,
        email,
        invited_by: userId,
        role: "employee" as const,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const { error } = await (supabase.from("workspace_invites" as never) as any).insert(inserts);
      if (error) throw error;

      setSentCount(raw.length);
      toast.success(`${raw.length} invite${raw.length !== 1 ? "s" : ""} sent!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invites — please try again");
    } finally {
      setSending(false);
    }
  }

  function goToStep2() {
    setStep(2);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      {/* Logo / brand */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
          <Zap className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold tracking-tight">Nexxos HQ</span>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <ProgressDots current={step} />
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl">
        {step === 1 ? (
          <Step1
            emails={emails}
            onEmailsChange={setEmails}
            sending={sending}
            sentCount={sentCount}
            onSend={handleSendInvites}
            onSkip={goToStep2}
          />
        ) : (
          <Step2 workspaceSlug={workspaceSlug} onNavigate={(to) => navigate({ to: to as any })} />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Invite your team ──────────────────────────────────────────────────

interface Step1Props {
  emails: string;
  onEmailsChange: (v: string) => void;
  sending: boolean;
  sentCount: number | null;
  onSend: () => void;
  onSkip: () => void;
}

function Step1({ emails, onEmailsChange, sending, sentCount, onSend, onSkip }: Step1Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Invite your team</h1>
            <p className="text-xs text-muted-foreground">Step 1 of 2</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter email addresses to invite team members. They&apos;ll receive a link to join your
          workspace.
        </p>
      </div>

      {/* Success message */}
      {sentCount !== null && (
        <div className="flex items-center gap-2.5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>
            {sentCount} invite{sentCount !== 1 ? "s" : ""} sent successfully!
          </span>
        </div>
      )}

      {/* Textarea */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="invite-emails">
          Email addresses
        </label>
        <textarea
          id="invite-emails"
          value={emails}
          onChange={(e) => onEmailsChange(e.target.value)}
          placeholder={"jane@acme.com\njohn@acme.com, sarah@acme.com"}
          rows={5}
          className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
        <p className="text-xs text-muted-foreground">One per line or comma-separated</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button onClick={onSend} disabled={sending || !emails.trim()} className="w-full gap-2">
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending invites…
            </>
          ) : (
            <>
              Send invites <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Channels are ready ────────────────────────────────────────────────

interface Step2Props {
  workspaceSlug: string;
  onNavigate: (to: string) => void;
}

function Step2({ workspaceSlug, onNavigate }: Step2Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Your channels are ready</h1>
            <p className="text-xs text-muted-foreground">Step 2 of 2</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          We&apos;ve created three default channels to get your team communicating right away.
        </p>
      </div>

      {/* Channels list */}
      <div className="space-y-2.5">
        {DEFAULT_CHANNELS.map((ch) => {
          const Icon = ch.icon;
          return (
            <div
              key={ch.name}
              className="flex items-start gap-3 rounded-xl border border-border bg-background/60 px-4 py-3.5"
            >
              <div className={`mt-0.5 shrink-0 ${ch.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">#{ch.name}</p>
                <p className="text-xs text-muted-foreground">{ch.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-done indicator */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
        <Check className="h-4 w-4 shrink-0" />
        <span>Your workspace is all set up and ready to go!</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button onClick={() => onNavigate(`/${workspaceSlug}/messages`)} className="w-full gap-2">
          Take me to messages <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => onNavigate(`/${workspaceSlug}/dashboard`)}
          className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Go to dashboard first →
        </button>
      </div>
    </div>
  );
}
