import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Check, Link2, KeyRound, Mail, MailX, MailQuestion, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import { resendInvitationFn } from "@/lib/admin.functions";

interface InvitationRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  expires_at: string;
  email_status: string;
  email_error: string | null;
  email_attempts: number;
}

interface FreshCredentials {
  inviteUrl: string;
  passcode: string;
}

function InlineCopy({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate font-mono text-xs">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        title="Copy"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function EmailStatusBadge({ inv }: { inv: InvitationRow }) {
  if (inv.email_status === "sent") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-500/40 text-green-600 dark:text-green-400"
      >
        <Mail className="h-3 w-3" /> Email sent
      </Badge>
    );
  }
  if (inv.email_status === "failed") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-500/40 text-red-600 dark:text-red-400"
        title={inv.email_error ?? undefined}
      >
        <MailX className="h-3 w-3" /> Email failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <MailQuestion className="h-3 w-3" /> Email pending
    </Badge>
  );
}

export function PendingInvitations({ reloadKey }: { reloadKey: number }) {
  const { workspace } = useWorkspace();
  const resendInvitation = useServerFn(resendInvitationFn);

  const [invitations, setInvitations] = React.useState<InvitationRow[]>([]);
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [fresh, setFresh] = React.useState<Record<string, FreshCredentials>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // token/passcode are intentionally NOT selected — column-level grants
      // restrict them; fresh credentials come back from the resend server fn.
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select(
          "id, email, full_name, role, created_at, expires_at, email_status, email_error, email_attempts",
        )
        .eq("workspace_id", workspace.id)
        .is("used_at", null)
        .order("created_at", { ascending: false });
      if (!cancelled && !error) setInvitations((data as InvitationRow[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.id, reloadKey]);

  async function resend(inv: InvitationRow) {
    setResendingId(inv.id);
    try {
      const result = await resendInvitation({
        data: {
          invitationId: inv.id,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          siteUrl: window.location.origin,
        },
      });

      setFresh((prev) => ({
        ...prev,
        [inv.id]: {
          inviteUrl: `${window.location.origin}/join?token=${result.token}`,
          passcode: result.passcode,
        },
      }));
      setInvitations((prev) =>
        prev.map((row) =>
          row.id === inv.id
            ? {
                ...row,
                email_status: result.emailSent ? "sent" : "failed",
                email_error: result.emailError ?? null,
                email_attempts: row.email_attempts + 1,
              }
            : row,
        ),
      );
      if (result.emailSent) {
        toast.success(`Invitation email re-sent to ${result.email}`);
      } else {
        toast.error(
          result.emailError ?? "Email could not be delivered — share the fresh link instead.",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Pending invitations</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Invites that haven't been accepted yet. Resend regenerates a fresh link and emails it again.
      </p>
      <div className="mt-3 space-y-2">
        {invitations.map((inv) => {
          const expired = new Date(inv.expires_at).getTime() < Date.now();
          const credentials = fresh[inv.id];
          return (
            <div key={inv.id} className="rounded-lg border border-border px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{inv.email}</p>
                </div>
                <EmailStatusBadge inv={inv} />
                {expired && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                  >
                    Expired
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resend(inv)}
                  disabled={resendingId === inv.id}
                  className="text-xs"
                >
                  <RefreshCw
                    className={`mr-1.5 h-3 w-3 ${resendingId === inv.id ? "animate-spin" : ""}`}
                  />
                  {resendingId === inv.id ? "Resending…" : "Resend invitation"}
                </Button>
              </div>
              {inv.email_status === "failed" && inv.email_error && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                  Last attempt failed: {inv.email_error}
                </p>
              )}
              {credentials && (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  <InlineCopy icon={Link2} value={credentials.inviteUrl} />
                  <InlineCopy icon={KeyRound} value={credentials.passcode} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
