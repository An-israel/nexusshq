import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DEPARTMENTS, deptLabel, timeAgo } from "@/lib/nexus";
import {
  Save,
  UserCog,
  Shield,
  Users as UsersIcon,
  ToggleRight,
  MapPin,
  Building2,
  Palette,
  History,
  Download,
  Trash2,
  Lock,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Webhook,
  Monitor,
  Plus,
  Eye,
  EyeOff,
  Copy,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AvatarUploader } from "@/components/AvatarUploader";
import { Switch } from "@/components/ui/switch";
import { TOGGLEABLE_PAGES, useFeatureFlags, setFeatureFlag } from "@/lib/feature-flags";
import { useWorkspace } from "@/lib/workspace-context";
import { logAuditEvent } from "@/lib/audit-log";

class FeatureErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <Card className="max-w-2xl p-6">
          <p className="text-sm text-destructive font-medium">Failed to load feature toggles.</p>
          <p className="text-xs text-muted-foreground mt-1">{this.state.error.message}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/_app/$workspaceSlug/settings")({
  component: SettingsPage,
});

function OfficeLocationSettings() {
  const { workspace } = useWorkspace();
  const [form, setForm] = React.useState({
    office_lat: String(workspace?.office_lat ?? ""),
    office_lng: String(workspace?.office_lng ?? ""),
    clock_in_radius_m: String(workspace?.clock_in_radius_m ?? 500),
    enforce_gps_clockin: workspace?.enforce_gps_clockin ?? false,
  });
  const [saving, setSaving] = React.useState(false);
  const [detecting, setDetecting] = React.useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({
        office_lat: form.office_lat ? Number(form.office_lat) : null,
        office_lng: form.office_lng ? Number(form.office_lng) : null,
        clock_in_radius_m: Number(form.clock_in_radius_m) || 500,
        enforce_gps_clockin: form.enforce_gps_clockin,
      })
      .eq("id", workspace!.id);
    if (error) toast.error(error.message);
    else toast.success("Office location saved");
    setSaving(false);
  }

  function detectLocation() {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          office_lat: pos.coords.latitude.toFixed(7),
          office_lng: pos.coords.longitude.toFixed(7),
        }));
        toast.success("Location detected");
        setDetecting(false);
      },
      () => {
        toast.error("Could not detect location");
        setDetecting(false);
      },
    );
  }

  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div>
        <h3 className="font-semibold">Office Location</h3>
        <p className="text-sm text-muted-foreground">
          Enable GPS-verified clock-in so employees must be at the office to clock in.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Enforce GPS clock-in</p>
          <p className="text-xs text-muted-foreground">
            Employees must be within the set radius to clock in
          </p>
        </div>
        <Switch
          checked={form.enforce_gps_clockin}
          onCheckedChange={(v) => setForm((f) => ({ ...f, enforce_gps_clockin: v }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Latitude</Label>
          <Input
            className="text-base md:text-sm font-mono"
            placeholder="6.5244"
            value={form.office_lat}
            onChange={(e) => setForm((f) => ({ ...f, office_lat: e.target.value }))}
          />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input
            className="text-base md:text-sm font-mono"
            placeholder="3.3792"
            value={form.office_lng}
            onChange={(e) => setForm((f) => ({ ...f, office_lng: e.target.value }))}
          />
        </div>
        <div className="col-span-2">
          <Label>Required radius (metres)</Label>
          <Input
            type="number"
            className="text-base md:text-sm"
            min={50}
            max={5000}
            value={form.clock_in_radius_m}
            onChange={(e) => setForm((f) => ({ ...f, clock_in_radius_m: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={detectLocation} disabled={detecting}>
          <MapPin className="mr-2 h-4 w-4" />
          {detecting ? "Detecting…" : "Detect current location"}
        </Button>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}

type Dept = (typeof DEPARTMENTS)[number];

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  department: Dept | null;
  job_title: string | null;
  phone?: string | null;
  hire_date: string | null;
  base_salary?: number | null;
  is_active: boolean;
  avatar_url: string | null;
  whatsapp_opt_in: boolean;
}

interface RoleRow {
  user_id: string;
  role: "admin" | "manager" | "employee";
}

// ─── Workspace Settings ───────────────────────────────────────────────────────

const PRESET_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#06B6D4", // cyan
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
];

function WorkspaceSettings() {
  const { workspace } = useWorkspace();
  const [name, setName] = React.useState(workspace?.name ?? "");
  const [color, setColor] = React.useState(workspace?.primary_color ?? "#3B82F6");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Workspace name cannot be empty");
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), primary_color: color })
      .eq("id", workspace!.id);
    if (error) toast.error(error.message);
    else toast.success("Workspace updated — refresh to see the new name in the sidebar");
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Logo */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Workspace logo</h3>
          <p className="text-sm text-muted-foreground">
            Shown in the sidebar and header. Square image recommended.
          </p>
        </div>
        <AvatarUploader
          pathPrefix={`workspace-logos/${workspace!.id}`}
          currentUrl={workspace?.logo_url ?? null}
          fallbackName={workspace?.name}
          onUploaded={async (url) => {
            const { error } = await supabase
              .from("workspaces")
              .update({ logo_url: url })
              .eq("id", workspace!.id);
            if (error) toast.error(error.message);
            else toast.success("Logo updated — refresh to see it in the sidebar");
          }}
        />
      </Card>

      {/* Name + color */}
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="font-semibold">Workspace name</h3>
          <p className="text-sm text-muted-foreground">The display name shown to all members.</p>
        </div>
        <div>
          <Label>Name</Label>
          <Input
            className="text-base md:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Skryve HQ"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Label>Accent colour</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "white" : "transparent",
                  outline: color === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
                title={c}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border-2 border-border bg-transparent p-0"
              title="Custom colour"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used in the sidebar, avatars, and accent elements.
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 space-y-4 border-destructive/40">
        <div>
          <h3 className="font-semibold text-destructive">Danger zone</h3>
          <p className="text-sm text-muted-foreground">
            These actions affect the entire workspace and cannot easily be undone.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Deactivate workspace</p>
            <p className="text-xs text-muted-foreground">
              Suspends access for all members. Contact support to restore.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (
                !confirm(
                  "Deactivate this workspace? All members will lose access immediately. Type OK to confirm.",
                )
              )
                return;
              const { error } = await supabase
                .from("workspaces")
                .update({ is_active: false })
                .eq("id", workspace!.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Workspace deactivated");
                window.location.href = "/workspaces";
              }
            }}
          >
            Deactivate
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const { profile, refresh } = useAuth();
  const { isWorkspaceAdmin: isAdmin } = useWorkspace();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile{isAdmin ? " and workspace" : ""}.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <div className="overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="flex-nowrap">
            <TabsTrigger value="profile">
              <UserCog className="mr-2 h-4 w-4" /> Profile
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="workspace">
                <Building2 className="mr-2 h-4 w-4" /> Workspace
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="team">
                <UsersIcon className="mr-2 h-4 w-4" /> Team
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="roles">
                <Shield className="mr-2 h-4 w-4" /> Roles
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="features">
                <ToggleRight className="mr-2 h-4 w-4" /> Pages
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="location">
                <MapPin className="mr-2 h-4 w-4" /> Office
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="audit-log">
                <History className="mr-2 h-4 w-4" /> Audit Log
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="api">
                <KeyRound className="mr-2 h-4 w-4" /> API
              </TabsTrigger>
            )}
            <TabsTrigger value="privacy">
              <Download className="mr-2 h-4 w-4" /> Privacy
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="mr-2 h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="profile" className="mt-4">
          {profile ? (
            <ProfileForm profile={profile as unknown as ProfileRow} onSaved={refresh} />
          ) : (
            <div className="flex flex-col gap-3 max-w-2xl">
              <p className="text-sm text-muted-foreground">Profile is loading…</p>
              <Button variant="outline" className="w-fit" onClick={() => void refresh()}>
                Retry
              </Button>
            </div>
          )}
        </TabsContent>
        {isAdmin && (
          <TabsContent value="workspace" className="mt-4">
            <WorkspaceSettings />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="team" className="mt-4">
            <TeamAdmin />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="roles" className="mt-4">
            <RolesAdmin />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="features" className="mt-4">
            <FeatureErrorBoundary>
              <FeatureToggles />
            </FeatureErrorBoundary>
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="location" className="mt-4">
            <OfficeLocationSettings />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="audit-log" className="mt-4">
            <AuditLogAdmin />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="api" className="mt-4">
            <ApiSettings />
          </TabsContent>
        )}
        <TabsContent value="privacy" className="mt-4">
          <PrivacySettings />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Privacy (GDPR) ──────────────────────────────────────────────────────────

function PrivacySettings() {
  const [exporting, setExporting] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleteInput, setDeleteInput] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch("/api/gdpr/export", {
        method: "POST",
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        toast.error(err.error ?? "Export failed");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has been downloaded.");
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteInput !== "DELETE") return;
    setDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch("/api/gdpr/delete", {
        method: "POST",
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        toast.error(err.error ?? "Account deletion failed");
        setDeleting(false);
        return;
      }
      toast.success("Account deleted. You will be signed out.");
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast.error("Account deletion failed. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Download className="h-4 w-4" /> Export your data
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download a copy of all data associated with your account — profile, attendance, tasks,
            messages, notifications, and more — as a JSON file.
          </p>
        </div>
        <Button onClick={() => void handleExport()} disabled={exporting} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          {exporting ? "Preparing export…" : "Download my data"}
        </Button>
      </Card>

      <Card className="p-6 space-y-4 border-destructive/40">
        <div>
          <h3 className="font-semibold text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Delete my account
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently removes your personal information. Your contributions (tasks, messages,
            attendance) are retained for workspace integrity but will no longer be attributed to
            you. This action cannot be undone.
          </p>
        </div>

        {!deleteConfirm ? (
          <Button variant="destructive" onClick={() => setDeleteConfirm(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete my account
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Type{" "}
              <code className="font-mono bg-muted px-1 rounded">DELETE</code> to confirm
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="text-base md:text-sm font-mono max-w-xs"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeleteInput("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={deleteInput !== "DELETE" || deleting}
              >
                {deleting ? "Deleting…" : "Permanently delete account"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Security / MFA ──────────────────────────────────────────────────────────

type MfaFactor = {
  id: string;
  factor_type: string;
  friendly_name?: string | null;
  status: string;
};

function SecuritySettings() {
  const [factors, setFactors] = React.useState<MfaFactor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [enrolling, setEnrolling] = React.useState(false);
  const [qrUri, setQrUri] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = React.useState<string | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [unenrolling, setUnenrolling] = React.useState<string | null>(null);

  const loadFactors = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
    } else {
      setFactors([...(data.totp ?? []), ...(data.phone ?? [])] as MfaFactor[]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function startEnroll() {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message ?? "Failed to start enrollment");
      setEnrolling(false);
      return;
    }
    setQrUri(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPendingFactorId(data.id);
    setEnrolling(false);
  }

  async function verifyEnrollment() {
    if (!pendingFactorId || !totpCode) return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: pendingFactorId,
      code: totpCode,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Two-factor authentication enabled.");
      setQrUri(null);
      setSecret(null);
      setPendingFactorId(null);
      setTotpCode("");
      void loadFactors();
    }
    setVerifying(false);
  }

  async function unenroll(factorId: string) {
    setUnenrolling(factorId);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Authenticator removed.");
      void loadFactors();
    }
    setUnenrolling(null);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMfa = verifiedFactors.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Two-factor authentication (2FA)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add an extra layer of security to your account. When enabled, you'll need a verification
            code from your authenticator app in addition to your password.
          </p>
        </div>

        {hasMfa && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Two-factor authentication is enabled
            </p>
          </div>
        )}

        {verifiedFactors.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{f.friendly_name ?? "Authenticator app"}</p>
              <p className="text-xs text-muted-foreground capitalize">{f.factor_type} · active</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={unenrolling === f.id}
              onClick={() => void unenroll(f.id)}
            >
              {unenrolling === f.id ? "Removing…" : "Remove"}
            </Button>
          </div>
        ))}

        {!qrUri && (
          <Button
            variant={hasMfa ? "outline" : "default"}
            onClick={() => void startEnroll()}
            disabled={enrolling}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {enrolling ? "Setting up…" : hasMfa ? "Add another authenticator" : "Enable 2FA"}
          </Button>
        )}

        {qrUri && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Scan this QR code with your authenticator app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use Google Authenticator, Authy, 1Password, or any TOTP-compatible app.
              </p>
            </div>
            <img
              src={qrUri}
              alt="MFA QR code"
              className="rounded-lg border border-border"
              width={200}
              height={200}
            />
            {secret && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Or enter the setup key manually:
                </p>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded select-all break-all">
                  {secret}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label>Enter the 6-digit code from your app to confirm</Label>
              <div className="flex gap-2">
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="text-base md:text-sm font-mono w-32"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <Button
                  onClick={() => void verifyEnrollment()}
                  disabled={totpCode.length !== 6 || verifying}
                >
                  {verifying ? "Verifying…" : "Verify & enable"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQrUri(null);
                    setSecret(null);
                    setPendingFactorId(null);
                    setTotpCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function FeatureToggles() {
  const { workspace } = useWorkspace();
  const { flags, loading } = useFeatureFlags(workspace?.id ?? null);
  const { profile } = useAuth();
  const [pending, setPending] = React.useState<string | null>(null);

  async function toggle(key: string, next: boolean) {
    setPending(key);
    try {
      await setFeatureFlag(key, next, workspace?.id ?? "", profile?.id);
      toast.success(next ? "Page enabled" : "Page disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="max-w-2xl p-6 space-y-4">
      <div>
        <h3 className="font-semibold">Page visibility</h3>
        <p className="text-sm text-muted-foreground">
          Turn pages off for everyone. Admins can still see disabled pages in the sidebar (greyed in
          normal use) so you can toggle them back on.
        </p>
      </div>
      <div className="divide-y divide-border">
        {TOGGLEABLE_PAGES.map((p) => {
          const enabled = flags[p.key] !== false;
          return (
            <div key={p.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">/{p.key}</p>
              </div>
              <Switch
                checked={enabled}
                disabled={loading || pending === p.key}
                onCheckedChange={(v) => void toggle(p.key, v)}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: ProfileRow;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = React.useState<ProfileRow>(profile);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        department: form.department,
        job_title: form.job_title,
        whatsapp_opt_in: form.whatsapp_opt_in,
      })
      .eq("id", form.id);
    if (!error && form.phone !== undefined) {
      await supabase
        .from("profile_private")
        .upsert({ user_id: form.id, phone: form.phone ?? null }, { onConflict: "user_id" });
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      await onSaved();
    }
    setSaving(false);
  }

  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <AvatarUploader
        pathPrefix={form.id}
        currentUrl={form.avatar_url}
        fallbackName={form.full_name ?? form.email}
        onUploaded={async (url) => {
          const { error } = await supabase
            .from("profiles")
            .update({ avatar_url: url })
            .eq("id", form.id);
          if (error) {
            toast.error(error.message);
            return;
          }
          setForm({ ...form, avatar_url: url });
          await onSaved();
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Full name</Label>
          <Input
            value={form.full_name ?? ""}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email ?? ""} disabled />
        </div>
        <div>
          <Label>Job title</Label>
          <Input
            value={form.job_title ?? ""}
            onChange={(e) => setForm({ ...form, job_title: e.target.value })}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={form.phone ?? ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-xl bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">WhatsApp notifications</p>
            <p className="text-xs text-muted-foreground">
              Receive leave approvals, task assignments and alerts via SMS/WhatsApp
            </p>
          </div>
          <Switch
            checked={form.whatsapp_opt_in ?? false}
            onCheckedChange={(v) => setForm((f) => ({ ...f, whatsapp_opt_in: v }))}
          />
        </div>
        <div className="col-span-2">
          <Label>Department</Label>
          <Select
            value={form.department ?? "other"}
            onValueChange={(v) => setForm({ ...form, department: v as Dept })}
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
      </div>
      <Button onClick={save} disabled={saving}>
        <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Profile"}
      </Button>
    </Card>
  );
}

interface MemberRow {
  id: string;
  role: "owner" | "admin" | "manager" | "employee";
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    department: Dept | null;
    job_title: string | null;
    phone: string | null;
    hire_date: string | null;
    base_salary: number | null;
    is_active: boolean;
    avatar_url: string | null;
    whatsapp_opt_in: boolean;
  } | null;
}

function TeamAdmin() {
  const { workspace, isWorkspaceAdmin } = useWorkspace();
  const { user } = useAuth();
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [removeTarget, setRemoveTarget] = React.useState<{
    id: string;
    name: string;
    userId: string;
  } | null>(null);

  const load = React.useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workspace_members")
      .select(
        "id, role, user_id, profiles!workspace_members_user_id_fkey(id, full_name, email, department, job_title, hire_date, is_active, avatar_url, whatsapp_opt_in)",
      )
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("role");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as MemberRow[];
    const userIds = rows.map((r) => r.user_id).filter(Boolean);
    if (userIds.length) {
      const { data: priv } = await supabase
        .from("profile_private")
        .select("user_id, phone, base_salary")
        .in("user_id", userIds);
      const map = new Map((priv ?? []).map((p) => [p.user_id, p]));
      for (const r of rows) {
        if (r.profiles) {
          const p = map.get(r.user_id);
          r.profiles.phone = p?.phone ?? null;
          r.profiles.base_salary = p?.base_salary ?? null;
        }
      }
    }
    setMembers(rows);
    setLoading(false);
  }, [workspace?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function updateProfile(profileId: string, patch: Partial<ProfileRow>) {
    const { phone, base_salary, ...rest } = patch;
    const { error } = await supabase.from("profiles").update(rest).eq("id", profileId);
    if (!error && (phone !== undefined || base_salary !== undefined)) {
      const priv: { user_id: string; phone?: string | null; base_salary?: number } = {
        user_id: profileId,
      };
      if (phone !== undefined) priv.phone = phone;
      if (base_salary !== undefined && base_salary !== null) priv.base_salary = base_salary;
      await supabase.from("profile_private").upsert(priv, { onConflict: "user_id" });
    }
    if (error) toast.error(error.message);
    else {
      if (workspace?.id && patch.is_active !== undefined) {
        const target = members.find((m) => m.profiles?.id === profileId)?.profiles;
        void logAuditEvent({
          workspaceId: workspace.id,
          action: patch.is_active ? "member.activated" : "member.deactivated",
          targetType: "profile",
          targetId: profileId,
          metadata: { target_name: target?.full_name ?? null, target_email: target?.email ?? null },
        });
      }
      toast.success("Updated");
      void load();
    }
  }

  async function removeMember(memberId: string, targetUserId: string, targetName: string) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) return;

    // Soft-remove: set is_active = false + record who removed + when
    const { error } = await supabase
      .from("workspace_members")
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: currentUser.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .eq("id", memberId)
      .eq("workspace_id", workspace!.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Also unassign their pending tasks in this workspace
    await supabase
      .from("tasks")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ assigned_to: null } as any)
      .eq("workspace_id", workspace!.id)
      .eq("assigned_to", targetUserId)
      .in("status", ["todo", "in_progress"]);

    if (workspace?.id) {
      void logAuditEvent({
        workspaceId: workspace.id,
        action: "member.removed",
        targetType: "workspace_member",
        targetId: targetUserId,
        metadata: { target_name: targetName },
      });
    }

    toast.success("Member removed from workspace");
    void load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <div className="space-y-3">
        {members.map((m) => {
          const p = m.profiles;
          if (!p) return null;
          const canRemove = isWorkspaceAdmin && m.role !== "owner" && m.user_id !== user?.id;
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.full_name ?? p.email}</p>
                    <span className="text-xs text-muted-foreground capitalize rounded bg-muted px-1.5 py-0.5">
                      {m.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end w-full sm:w-auto">
                  <div>
                    <Label className="text-xs">Department</Label>
                    <Select
                      value={p.department ?? "other"}
                      onValueChange={(v) => updateProfile(p.id, { department: v as Dept })}
                    >
                      <SelectTrigger className="h-8">
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
                    <Label className="text-xs">Base salary</Label>
                    <Input
                      type="number"
                      className="h-8"
                      defaultValue={p.base_salary ?? 0}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== Number(p.base_salary)) updateProfile(p.id, { base_salary: v });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Active</Label>
                    <Select
                      value={p.is_active ? "true" : "false"}
                      onValueChange={(v) => updateProfile(p.id, { is_active: v === "true" })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {canRemove ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() =>
                      setRemoveTarget({
                        id: m.id,
                        name: p.full_name ?? p.email ?? "this member",
                        userId: m.user_id,
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="text-base font-semibold">Remove {removeTarget.name}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              They will immediately lose access to this workspace. Their historical data (tasks,
              attendance, payslips) will be preserved.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  void removeMember(removeTarget.id, removeTarget.userId, removeTarget.name);
                  setRemoveTarget(null);
                }}
              >
                Remove Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RolesAdmin() {
  const { workspace } = useWorkspace();
  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);
  const [roles, setRoles] = React.useState<Record<string, RoleRow["role"]>>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setProfiles((profs ?? []) as ProfileRow[]);
    const map: Record<string, RoleRow["role"]> = {};
    ((rs ?? []) as RoleRow[]).forEach((r) => {
      const cur = map[r.user_id];
      // pick highest role
      const rank = (x: RoleRow["role"]) => (x === "admin" ? 0 : x === "manager" ? 1 : 2);
      if (!cur || rank(r.role) < rank(cur)) map[r.user_id] = r.role;
    });
    setRoles(map);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function setRole(userId: string, role: RoleRow["role"]) {
    // Remove existing roles, then insert new
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) {
      toast.error(del.error.message);
      return;
    }
    const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (ins.error) {
      toast.error(ins.error.message);
      return;
    }
    if (workspace?.id) {
      const target = profiles.find((p) => p.id === userId);
      void logAuditEvent({
        workspaceId: workspace.id,
        action: "member.role_changed",
        targetType: "profile",
        targetId: userId,
        metadata: {
          target_name: target?.full_name ?? null,
          target_email: target?.email ?? null,
          new_role: role,
        },
      });
    }
    toast.success(`Role set to ${role}`);
    void load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card className="p-4">
      <div className="divide-y divide-border">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3 gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">{p.full_name ?? p.email}</p>
              <p className="text-xs text-muted-foreground">{p.email}</p>
            </div>
            <Select
              value={roles[p.id] ?? "employee"}
              onValueChange={(v) => setRole(p.id, v as RoleRow["role"])}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </Card>
  );
}

interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ActorMini {
  full_name: string | null;
  email: string | null;
}

function describeAuditEvent(e: AuditEvent): string {
  const meta = e.metadata ?? {};
  const name =
    (meta.target_name as string | undefined) || (meta.target_email as string | undefined);
  const title = meta.title as string | undefined;
  switch (e.action) {
    case "member.removed":
      return `removed ${name ?? "a member"} from the workspace`;
    case "member.activated":
      return `reactivated ${name ?? "a member"}`;
    case "member.deactivated":
      return `deactivated ${name ?? "a member"}`;
    case "member.role_changed":
      return `changed ${name ?? "a member"}'s role to ${(meta.new_role as string | undefined) ?? "—"}`;
    case "announcement.created":
      return `posted the announcement "${title ?? "Untitled"}"`;
    case "announcement.deleted":
      return `deleted the announcement "${title ?? "Untitled"}"`;
    default:
      return e.action.replace(/[._]/g, " ");
  }
}

function AuditLogAdmin() {
  const { workspace } = useWorkspace();
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [actors, setActors] = React.useState<Record<string, ActorMini>>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_events")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as AuditEvent[];
    setEvents(rows);

    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
    if (actorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      const map: Record<string, ActorMini> = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = { full_name: p.full_name, email: p.email };
      });
      setActors(map);
    } else {
      setActors({});
    }
    setLoading(false);
  }, [workspace?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <Card className="p-4">
      <div>
        <h3 className="text-sm font-semibold">Audit log</h3>
        <p className="text-xs text-muted-foreground">
          Sensitive admin actions in this workspace — who did what, and when.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No audit events recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {events.map((e) => {
            const actor = e.actor_id ? actors[e.actor_id] : null;
            return (
              <li key={e.id} className="py-3 text-sm">
                <p>
                  <span className="font-medium">
                    {actor?.full_name ?? actor?.email ?? "Someone"}
                  </span>{" "}
                  <span className="text-muted-foreground">{describeAuditEvent(e)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(e.created_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── API Settings (API Keys + Webhooks + Active Sessions) ────────────────────

const WEBHOOK_EVENTS = [
  "task.created",
  "task.completed",
  "standup.submitted",
  "member.joined",
  "attendance.clock_in",
  "attendance.clock_out",
] as const;

const API_KEY_SCOPES = [
  "tasks:read",
  "tasks:write",
  "attendance:read",
  "members:read",
  "workspace:read",
] as const;

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}
interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_fired_at: string | null;
  last_error: string | null;
  created_at: string;
}
interface UserSession {
  id: string;
  session_id: string;
  device_name: string | null;
  user_agent: string | null;
  created_at: string;
  last_active_at: string;
}

function ApiSettings() {
  return (
    <div className="max-w-2xl space-y-8">
      <ApiKeysSection />
      <Separator />
      <WebhooksSection />
      <Separator />
      <ActiveSessionsSection />
    </div>
  );
}

function ApiKeysSection() {
  const { workspace } = useWorkspace();
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [showKey, setShowKey] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`/api/apikeys?workspace=${workspace.slug}`, {
      headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
    });
    if (res.ok) {
      const json = (await res.json()) as { keys: ApiKey[] };
      setKeys(json.keys);
    }
    setLoading(false);
  }, [workspace.slug]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function toggleScope(scope: string) {
    setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));
  }

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ workspace: workspace.slug, name: name.trim(), scopes }),
    });
    if (res.ok) {
      const json = (await res.json()) as { key: ApiKey & { plaintext: string } };
      setNewKey(json.key.plaintext);
      setName("");
      setScopes([]);
      void load();
    } else {
      toast.error("Failed to create API key");
    }
    setCreating(false);
  }

  async function revoke(id: string) {
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/apikeys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
    });
    void load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> API Keys
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Use API keys to authenticate requests to{" "}
          <code className="text-xs bg-muted px-1 rounded">/api/v1/*</code>.
        </p>
      </div>

      {newKey && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-2">
          <p className="text-xs font-medium text-green-400">
            API key created — copy it now, it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono bg-background rounded px-2 py-1 truncate">
              {showKey ? newKey : newKey.slice(0, 12) + "•".repeat(20)}
            </code>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(newKey);
                toast.success("Copied");
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setNewKey(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {API_KEY_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => toggleScope(scope)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors ${scopes.includes(scope) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >
              {scope}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Leave all unselected for unrestricted access to /api/v1/*.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Key name (e.g. Zapier integration)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={() => void create()} disabled={creating || !name.trim()}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {creating ? "Creating…" : "Create"}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-xs text-muted-foreground">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{k.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {k.scopes.length ? k.scopes.join(", ") : "unrestricted"}
                </p>
                {k.last_used_at && (
                  <p className="text-xs text-muted-foreground">
                    Last used {timeAgo(k.last_used_at)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs shrink-0 ml-3"
                onClick={() => void revoke(k.id)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksSection() {
  const { workspace } = useWorkspace();
  const [endpoints, setEndpoints] = React.useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ name: "", url: "", events: [] as string[] });
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`/api/webhooks?workspace=${workspace.slug}`, {
      headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
    });
    if (res.ok) {
      const json = (await res.json()) as { endpoints: WebhookEndpoint[] };
      setEndpoints(json.endpoints);
    }
    setLoading(false);
  }, [workspace.slug]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!form.name.trim() || !form.url.trim() || !form.events.length) {
      toast.error("Name, URL, and at least one event are required");
      return;
    }
    setCreating(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ workspace: workspace.slug, ...form }),
    });
    if (res.ok) {
      toast.success("Webhook endpoint created");
      setForm({ name: "", url: "", events: [] });
      void load();
    } else {
      const err = (await res.json()) as { error?: string };
      toast.error(err.error ?? "Failed to create webhook");
    }
    setCreating(false);
  }

  async function remove(id: string) {
    const { data: session } = await supabase.auth.getSession();
    await fetch(`/api/webhooks/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
    });
    void load();
  }

  function toggleEvent(ev: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhook Endpoints
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Receive real-time events in Zapier, Make, or your own server. Each request is signed with{" "}
          <code className="text-xs bg-muted px-1 rounded">X-Nexus-Signature</code>.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h4 className="text-xs font-medium text-foreground">New endpoint</h4>
        <Input
          placeholder="Name (e.g. Zapier trigger)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-8 text-sm"
        />
        <Input
          placeholder="https://hooks.zapier.com/…"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          className="h-8 text-sm"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {WEBHOOK_EVENTS.map((ev) => (
            <button
              key={ev}
              onClick={() => toggleEvent(ev)}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors ${form.events.includes(ev) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >
              {ev}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => void create()} disabled={creating} className="mt-1">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {creating ? "Creating…" : "Add endpoint"}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : endpoints.length === 0 ? (
        <p className="text-xs text-muted-foreground">No webhook endpoints yet.</p>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <div key={ep.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{ep.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ep.url}</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs shrink-0"
                  onClick={() => void remove(ep.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {ep.events.map((ev) => (
                  <Badge key={ev} variant="secondary" className="text-[10px] font-mono py-0">
                    {ev}
                  </Badge>
                ))}
              </div>
              {ep.last_error && (
                <p className="text-xs text-destructive">Last error: {ep.last_error}</p>
              )}
              {ep.last_fired_at && (
                <p className="text-xs text-muted-foreground">
                  Last fired {timeAgo(ep.last_fired_at)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveSessionsSection() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [sessions, setSessions] = React.useState<UserSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [signingOut, setSigningOut] = React.useState(false);

  const currentSessionId = React.useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem("nexus_device_session_id");
  }, []);

  const load = React.useCallback(async () => {
    if (!user || !workspace?.id) return;
    const { data } = await supabase
      .from("user_sessions")
      .select("id, session_id, device_name, user_agent, created_at, last_active_at")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace.id)
      .order("last_active_at", { ascending: false });
    setSessions((data ?? []) as UserSession[]);
    setLoading(false);
  }, [user?.id, workspace?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function signOutOthers() {
    setSigningOut(true);
    await supabase.auth.signOut({ scope: "others" });
    // Remove non-current sessions from our table
    if (currentSessionId && user) {
      await supabase
        .from("user_sessions")
        .delete()
        .eq("user_id", user.id)
        .neq("session_id", currentSessionId);
    }
    void load();
    toast.success("All other devices have been signed out.");
    setSigningOut(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Active Sessions
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Devices where you're currently signed in.
          </p>
        </div>
        {sessions.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void signOutOthers()}
            disabled={signingOut}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {signingOut ? "Signing out…" : "Sign out others"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sessions found.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            return (
              <div
                key={s.id}
                className={`flex items-start justify-between rounded-lg border px-3 py-2.5 ${isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{s.device_name ?? "Unknown device"}</p>
                    {isCurrent && <Badge className="text-[10px] py-0 h-4">This device</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last active {timeAgo(s.last_active_at)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {s.user_agent?.slice(0, 60)}…
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
