import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Copy, Check, Link2, Mail, KeyRound, RefreshCw } from "lucide-react";
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";
import { useWorkspace } from "@/lib/workspace-context";
import { useServerFn } from "@tanstack/react-start";
import { createInvitationFn, resendInvitationFn } from "@/lib/admin.functions";

interface Generated {
  invitationId: string;
  token: string;
  passcode: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | null;
}

function CopyField({
  label,
  icon: Icon,
  value,
}: {
  label: string;
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
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <span className="flex-1 truncate font-mono text-sm">{value}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          title="Copy"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function InviteEmployeeDialog({
  onInvited,
  isAdmin = false,
}: {
  onInvited?: () => void;
  isAdmin?: boolean;
}) {
  const { workspace } = useWorkspace();
  const createInvitation = useServerFn(createInvitationFn);
  const resendInvitation = useServerFn(resendInvitationFn);

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [generated, setGenerated] = React.useState<Generated | null>(null);

  const [form, setForm] = React.useState({
    email: "",
    full_name: "",
    job_title: "",
    department: "other" as (typeof DEPARTMENTS)[number],
    phone: "",
    role: "employee" as "admin" | "manager" | "employee",
  });

  function reset() {
    setForm({
      email: "",
      full_name: "",
      job_title: "",
      department: "other",
      phone: "",
      role: "employee",
    });
    setGenerated(null);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  async function submit() {
    if (!form.email.trim() || !form.full_name.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createInvitation({
        data: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          job_title: form.job_title.trim() || null,
          department: (form.department || "other") as (typeof DEPARTMENTS)[number],
          phone: form.phone.trim() || null,
          role: form.role,
          siteUrl: window.location.origin,
        },
      });

      const inviteUrl = result.token ? `${window.location.origin}/join?token=${result.token}` : "";
      setGenerated({
        invitationId: result.invitationId,
        token: result.token,
        passcode: result.passcode,
        inviteUrl,
        emailSent: result.emailSent,
        emailError: result.emailError,
      });
      if (!result.emailSent && result.emailError) {
        toast.error(result.emailError);
      }
      onInvited?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!generated) return;
    setResending(true);
    try {
      const result = await resendInvitation({
        data: {
          invitationId: generated.invitationId,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          siteUrl: window.location.origin,
        },
      });

      setGenerated({
        ...generated,
        token: result.token,
        passcode: result.passcode,
        inviteUrl: result.token ? `${window.location.origin}/join?token=${result.token}` : "",
        emailSent: result.emailSent,
        emailError: result.emailError,
      });
      if (result.emailSent) {
        toast.success(`Invitation email re-sent to ${result.email}`);
      } else {
        toast.error(result.emailError ?? "Email could not be delivered — share the link instead.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Invite Employee
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) handleClose();
        }}
      >
        <DialogContent className="max-w-lg">
          {!generated ? (
            <>
              <DialogHeader>
                <DialogTitle>Invite a new employee</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Full name</Label>
                    <Input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="Jane Doe"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jane@company.com"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div>
                    <Label>Job title</Label>
                    <Input
                      value={form.job_title}
                      onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                      placeholder="Designer"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+234…"
                      className="text-base md:text-sm"
                    />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select
                      value={form.department}
                      onValueChange={(v) =>
                        setForm({ ...form, department: v as (typeof DEPARTMENTS)[number] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {deptLabel(d)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm({ ...form, role: v as "admin" | "manager" | "employee" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    "Sending…"
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" /> Send invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invitation sent</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div
                  className={`flex items-start gap-3 rounded-lg px-3 py-3 ${
                    generated.emailSent
                      ? "border border-green-500/30 bg-green-500/10"
                      : "border border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  <Mail
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      generated.emailSent
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  />
                  <p
                    className={`text-sm ${
                      generated.emailSent
                        ? "text-green-700 dark:text-green-400"
                        : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {generated.emailSent ? (
                      <>
                        An invitation email has been sent to <strong>{form.email}</strong>. They'll
                        receive a link to create their account and join{" "}
                        <strong>{workspace.name}</strong>.
                      </>
                    ) : (
                      <>
                        The invitation was created, but the email was not delivered.{" "}
                        {generated.emailError ? (
                          <span className="block mt-1 font-mono text-xs opacity-80">
                            {generated.emailError}
                          </span>
                        ) : null}
                        <span className="block mt-1">
                          Try resending below, or share the link or passcode with{" "}
                          <strong>{form.email}</strong> directly.
                        </span>
                      </>
                    )}
                  </p>
                </div>

                {!generated.emailSent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resend}
                    disabled={resending}
                    className="w-full"
                  >
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                    {resending ? "Resending…" : "Resend invitation email"}
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  Didn't receive the email? Share the link or passcode below as a backup.
                </p>

                <CopyField label="Invite link" icon={Link2} value={generated.inviteUrl} />
                <CopyField label="Passcode" icon={KeyRound} value={generated.passcode} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={reset} className="mr-auto">
                  Invite another
                </Button>
                {generated.emailSent && (
                  <Button variant="outline" onClick={resend} disabled={resending}>
                    <RefreshCw className={`mr-2 h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                    {resending ? "Resending…" : "Resend email"}
                  </Button>
                )}
                <Button onClick={handleClose}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
