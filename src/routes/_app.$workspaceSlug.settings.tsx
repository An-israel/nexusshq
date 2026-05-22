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
import { DEPARTMENTS, deptLabel } from "@/lib/nexus";
import {
  Save,
  UserCog,
  Shield,
  Users as UsersIcon,
  ToggleRight,
  MapPin,
  Building2,
  Palette,
} from "lucide-react";
import { AvatarUploader } from "@/components/AvatarUploader";
import { Switch } from "@/components/ui/switch";
import { TOGGLEABLE_PAGES, useFeatureFlags, setFeatureFlag } from "@/lib/feature-flags";
import { useWorkspace } from "@/lib/workspace-context";

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
  phone: string | null;
  hire_date: string | null;
  base_salary: number | null;
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
  const { profile, refresh, isAdmin } = useAuth();

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
      </Tabs>
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
        phone: form.phone,
        whatsapp_opt_in: form.whatsapp_opt_in,
      })
      .eq("id", form.id);
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
        "id, role, user_id, profiles(id, full_name, email, department, job_title, phone, hire_date, base_salary, is_active, avatar_url, whatsapp_opt_in)",
      )
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("role");
    if (error) toast.error(error.message);
    else setMembers((data ?? []) as unknown as MemberRow[]);
    setLoading(false);
  }, [workspace?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function updateProfile(profileId: string, patch: Partial<ProfileRow>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", profileId);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      void load();
    }
  }

  async function removeMember(memberId: string, targetUserId: string) {
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
                  void removeMember(removeTarget.id, removeTarget.userId);
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
