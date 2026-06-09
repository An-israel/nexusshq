import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DEPARTMENTS, deptLabel, initialsOf } from "@/lib/nexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Camera, Save, Lock, CalendarDays, Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/profile")({
  component: ProfilePage,
});

type Department = (typeof DEPARTMENTS)[number];
type PresenceStatus = "active" | "away" | "dnd" | "offline";

interface PresenceRow {
  user_id: string;
  status: PresenceStatus;
  status_emoji: string | null;
  status_text: string | null;
  last_seen_at: string | null;
}

const STATUS_OPTIONS: {
  value: PresenceStatus;
  label: string;
  dotClass: string;
  textClass: string;
}[] = [
  { value: "active", label: "Active", dotClass: "bg-green-400", textClass: "text-green-400" },
  { value: "away", label: "Away", dotClass: "bg-yellow-400", textClass: "text-yellow-400" },
  { value: "dnd", label: "Do Not Disturb", dotClass: "bg-red-400", textClass: "text-red-400" },
  {
    value: "offline",
    label: "Offline",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function ProfilePage() {
  const { user, profile, refresh } = useAuth();

  if (!user || !profile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your personal info, status and security settings.
        </p>
      </div>

      <AvatarSection user={user} profile={profile} refresh={refresh} />
      <ProfileDetailsSection user={user} profile={profile} refresh={refresh} />
      <StatusSection user={user} />
      <CalendarFeedSection />
      <SecuritySection />
    </div>
  );
}

/* ─── Section 1: Avatar & Identity ───────────────────────────────────── */

function AvatarSection({
  user,
  profile,
  refresh,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  profile: NonNullable<ReturnType<typeof useAuth>["profile"]>;
  refresh: () => Promise<void>;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(profile.avatar_url);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please use JPEG, PNG, GIF or WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (upErr) {
        toast.error("Upload failed: " + upErr.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Avatar updated");
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadAvatar(file);
    // Reset so re-selecting same file triggers onChange
    e.target.value = "";
  }

  const initials = initialsOf(profile.full_name ?? profile.email);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avatar</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        {/* Avatar circle */}
        <div className="relative shrink-0">
          <div className="h-16 w-16 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xl font-semibold select-none">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.full_name ?? "Avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{profile.full_name ?? profile.email}</p>
          <p className="text-xs text-muted-foreground">{profile.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="mr-2 h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload photo"}
          </Button>
          <p className="text-xs text-muted-foreground">JPEG, PNG, GIF or WebP · max 2 MB</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}

/* ─── Section 2: Profile Details Form ────────────────────────────────── */

function ProfileDetailsSection({
  user,
  profile,
  refresh,
}: {
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  profile: NonNullable<ReturnType<typeof useAuth>["profile"]>;
  refresh: () => Promise<void>;
}) {
  const [fullName, setFullName] = React.useState(profile.full_name ?? "");
  const [jobTitle, setJobTitle] = React.useState(profile.job_title ?? "");
  const [department, setDepartment] = React.useState<Department>(
    (profile.department as Department) ?? "other",
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, job_title: jobTitle, department })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
      await refresh();
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user.email ?? ""}
              disabled
              className="opacity-50 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-title">Job title</Label>
            <Input
              id="job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Product Designer"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Department</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
              <SelectTrigger id="department">
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

        <div className="pt-2">
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Section 3: Status & Presence ───────────────────────────────────── */

function StatusSection({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  const [presence, setPresence] = React.useState<PresenceRow | null>(null);
  const [status, setStatus] = React.useState<PresenceStatus>("offline");
  const [statusText, setStatusText] = React.useState("");
  const [statusEmoji, setStatusEmoji] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchPresence() {
      const { data } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        const row = data as PresenceRow;
        setPresence(row);
        setStatus(row.status ?? "offline");
        setStatusText(row.status_text ?? "");
        setStatusEmoji(row.status_emoji ?? "");
      }
      setLoading(false);
    }
    void fetchPresence();
  }, [user.id]);

  async function saveStatus() {
    setSaving(true);
    const { error } = await supabase.from("user_presence").upsert(
      {
        user_id: user.id,
        status,
        status_text: statusText,
        status_emoji: statusEmoji,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Status updated");
      setPresence((prev) => ({
        ...(prev ?? { user_id: user.id, last_seen_at: null }),
        status,
        status_text: statusText,
        status_emoji: statusEmoji,
      }));
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status &amp; Presence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Status picker */}
            <div>
              <Label className="mb-2 block text-sm">Current status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={[
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      status === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/40",
                    ].join(" ")}
                  >
                    <span
                      className={["inline-block h-2 w-2 rounded-full shrink-0", opt.dotClass].join(
                        " ",
                      )}
                    />
                    <span className={status === opt.value ? opt.textClass : "text-foreground"}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status-emoji">Status emoji</Label>
                <Input
                  id="status-emoji"
                  value={statusEmoji}
                  onChange={(e) => setStatusEmoji(e.target.value)}
                  placeholder="😊"
                  maxLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status-text">What are you up to?</Label>
                <Input
                  id="status-text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  placeholder="What are you up to?"
                  maxLength={120}
                />
              </div>
            </div>

            <div>
              <Button onClick={() => void saveStatus()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Update status"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Section 4: Change Password ─────────────────────────────────────── */

function SecuritySection() {
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function updatePassword() {
    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <Button onClick={() => void updatePassword()} disabled={saving}>
            <Lock className="mr-2 h-4 w-4" />
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Section 5: Calendar Feed ────────────────────────────────────────── */

function CalendarFeedSection() {
  const [feedUrl, setFeedUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function generateFeed(rotate = false) {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error("Failed to generate calendar link");
      const json = (await res.json()) as { url: string };
      setFeedUrl(json.url);
      if (rotate) toast.success("Calendar link regenerated.");
    } catch {
      toast.error("Could not generate calendar link.");
    }
    setLoading(false);
  }

  function copyUrl() {
    if (!feedUrl) return;
    void navigator.clipboard.writeText(feedUrl);
    toast.success("Copied to clipboard.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Calendar Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Subscribe to your tasks and leave requests in Google Calendar, Apple Calendar, or any
          iCal-compatible app.
        </p>

        {feedUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={feedUrl}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="icon" variant="outline" onClick={copyUrl} aria-label="Copy URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this URL into your calendar app. The feed updates automatically.
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void generateFeed(true)}
              disabled={loading}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate link
            </Button>
          </div>
        ) : (
          <Button onClick={() => void generateFeed()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
            {loading ? "Generating…" : "Get calendar link"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
