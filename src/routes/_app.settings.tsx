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
import { Save, UserCog, Shield, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

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
}

interface RoleRow { user_id: string; role: "admin" | "manager" | "employee"; }

function SettingsPage() {
  const { profile, refresh, isAdmin } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile{isAdmin ? " and team" : ""}.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><UserCog className="mr-2 h-4 w-4" /> Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="team"><UsersIcon className="mr-2 h-4 w-4" /> Team</TabsTrigger>}
          {isAdmin && <TabsTrigger value="roles"><Shield className="mr-2 h-4 w-4" /> Roles</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          {profile && <ProfileForm profile={profile as ProfileRow} onSaved={refresh} />}
        </TabsContent>
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
      </Tabs>
    </div>
  );
}

function ProfileForm({ profile, onSaved }: { profile: ProfileRow; onSaved: () => void | Promise<void> }) {
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
      })
      .eq("id", form.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); await onSaved(); }
    setSaving(false);
  }

  return (
    <Card className="p-6 space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Full name</Label>
          <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email ?? ""} disabled />
        </div>
        <div>
          <Label>Job title</Label>
          <Input value={form.job_title ?? ""} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="col-span-2">
          <Label>Department</Label>
          <Select value={form.department ?? "other"} onValueChange={(v) => setForm({ ...form, department: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>)}
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

function TeamAdmin() {
  const [profiles, setProfiles] = React.useState<ProfileRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");
    if (error) toast.error(error.message);
    else setProfiles((data ?? []) as ProfileRow[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function update(id: string, patch: Partial<ProfileRow>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); void load(); }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      {profiles.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium">{p.full_name ?? p.email}</p>
              <p className="text-xs text-muted-foreground">{p.email}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 items-end">
              <div>
                <Label className="text-xs">Department</Label>
                <Select value={p.department ?? "other"} onValueChange={(v) => update(p.id, { department: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>)}
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
                    if (v !== Number(p.base_salary)) update(p.id, { base_salary: v });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Active</Label>
                <Select value={p.is_active ? "true" : "false"} onValueChange={(v) => update(p.id, { is_active: v === "true" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
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
      const rank = (x: RoleRow["role"]) => x === "admin" ? 0 : x === "manager" ? 1 : 2;
      if (!cur || rank(r.role) < rank(cur)) map[r.user_id] = r.role;
    });
    setRoles(map);
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function setRole(userId: string, role: RoleRow["role"]) {
    // Remove existing roles, then insert new
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) { toast.error(del.error.message); return; }
    const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (ins.error) { toast.error(ins.error.message); return; }
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
            <Select value={roles[p.id] ?? "employee"} onValueChange={(v) => setRole(p.id, v as RoleRow["role"])}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
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
