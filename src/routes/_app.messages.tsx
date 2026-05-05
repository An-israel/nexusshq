import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRealtime } from "@/lib/use-realtime";
import { toast } from "sonner";
import { Send, Plus, Users, Settings, UserPlus, LogOut, X } from "lucide-react";
import { initialsOf, timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { AvatarUploader } from "@/components/AvatarUploader";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
});

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface Msg {
  id: string;
  from_id: string;
  to_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  members: Profile[];
  unread: number;
}

interface GroupMsg {
  id: string;
  group_id: string;
  from_id: string;
  body: string;
  created_at: string;
  sender: Profile | null;
}

type View =
  | { type: "dm"; contact: Profile }
  | { type: "group"; group: Group };

// ── Avatar component ────────────────────────────────────────────────────────
function Avatar({ url, name, size = 28, kind = "user" }: { url?: string | null; name?: string | null; size?: number; kind?: "user" | "group" }) {
  const radius = "rounded-full";
  if (url) {
    return <img src={url} alt="" className={cn(radius, "object-cover shrink-0")} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cn(radius, "shrink-0 flex items-center justify-center font-semibold",
        kind === "user" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground")}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {kind === "group" && !name ? <Users className="h-3.5 w-3.5" /> : initialsOf(name ?? "")}
    </div>
  );
}

// Render message body with @mentions highlighted
function renderBody(body: string, members: Profile[]) {
  const tokens = body.split(/(@[\w.-]+|@all)/g);
  return tokens.map((t, i) => {
    if (t === "@all") {
      return <span key={i} className="rounded bg-primary/20 px-1 font-medium text-primary">@all</span>;
    }
    if (t.startsWith("@")) {
      const handle = t.slice(1).toLowerCase();
      const match = members.find((m) => {
        const name = (m.full_name ?? m.email ?? "").toLowerCase();
        return name.replace(/\s+/g, "") === handle.replace(/\s+/g, "") || (m.email ?? "").toLowerCase().split("@")[0] === handle;
      });
      if (match) {
        return <span key={i} className="rounded bg-primary/20 px-1 font-medium text-primary">{t}</span>;
      }
    }
    return <span key={i}>{t}</span>;
  });
}

function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = React.useState<Profile[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [view, setView] = React.useState<View | null>(null);
  const [dmThread, setDmThread] = React.useState<Msg[]>([]);
  const [groupThread, setGroupThread] = React.useState<GroupMsg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [dmUnread, setDmUnread] = React.useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [pickedMembers, setPickedMembers] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [mentionState, setMentionState] = React.useState<{ open: boolean; query: string; start: number }>({ open: false, query: "", start: 0 });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // ── Load contacts ──
  React.useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("is_active", true)
      .neq("id", user.id)
      .order("full_name")
      .then(({ data }) => setContacts((data ?? []) as Profile[]));
  }, [user]);

  // ── Load groups ──
  const loadGroups = React.useCallback(async () => {
    if (!user) return;
    const { data: myMemberships } = await supabase
      .from("message_group_members")
      .select("group_id, last_read_at")
      .eq("user_id", user.id);
    if (!myMemberships?.length) { setGroups([]); return; }

    const groupIds = myMemberships.map((m) => m.group_id);
    const lastReadByGroup = Object.fromEntries(myMemberships.map((m) => [m.group_id, m.last_read_at]));

    const { data: groupRows } = await supabase
      .from("message_groups")
      .select("id, name, avatar_url, created_by, created_at")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    const { data: memberRows } = await supabase
      .from("message_group_members")
      .select("group_id, user_id, profiles(id, full_name, email, avatar_url)")
      .in("group_id", groupIds);

    const { data: unreadRows } = await supabase
      .from("group_messages")
      .select("group_id, created_at")
      .in("group_id", groupIds)
      .neq("from_id", user.id);

    const unreadByGroup: Record<string, number> = {};
    for (const row of unreadRows ?? []) {
      const lr = lastReadByGroup[row.group_id];
      if (!lr || new Date(row.created_at) > new Date(lr)) {
        unreadByGroup[row.group_id] = (unreadByGroup[row.group_id] ?? 0) + 1;
      }
    }

    const membersByGroup: Record<string, Profile[]> = {};
    for (const row of memberRows ?? []) {
      const p = row.profiles as unknown as Profile | null;
      if (!p) continue;
      membersByGroup[row.group_id] ??= [];
      membersByGroup[row.group_id].push(p);
    }

    const list = (groupRows ?? []).map((g) => ({
      ...g,
      members: membersByGroup[g.id] ?? [],
      unread: unreadByGroup[g.id] ?? 0,
    }));
    setGroups(list);

    // sync currently-open group view with fresh data
    setView((cur) => {
      if (cur?.type === "group") {
        const fresh = list.find((g) => g.id === cur.group.id);
        if (fresh) return { type: "group", group: fresh };
      }
      return cur;
    });
  }, [user]);

  React.useEffect(() => { void loadGroups(); }, [loadGroups]);

  // ── DM unread ──
  const loadDmUnread = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("from_id")
      .eq("to_id", user.id)
      .eq("is_read", false);
    const counts: Record<string, number> = {};
    (data ?? []).forEach((m: { from_id: string }) => {
      counts[m.from_id] = (counts[m.from_id] ?? 0) + 1;
    });
    setDmUnread(counts);
  }, [user]);

  React.useEffect(() => { void loadDmUnread(); }, [loadDmUnread]);

  // ── DM thread ──
  const loadDmThread = React.useCallback(async () => {
    if (!user || view?.type !== "dm") return;
    const contact = view.contact;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(from_id.eq.${user.id},to_id.eq.${contact.id}),and(from_id.eq.${contact.id},to_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setDmThread((data ?? []) as Msg[]);
    await supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("from_id", contact.id)
      .eq("to_id", user.id)
      .eq("is_read", false);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "direct_message");
    void loadDmUnread();
  }, [user, view, loadDmUnread]);

  // ── Group thread ──
  const loadGroupThread = React.useCallback(async () => {
    if (!user || view?.type !== "group") return;
    const group = view.group;
    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, from_id, body, created_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true });

    const senderIds = [...new Set((data ?? []).map((m) => m.from_id))];
    const { data: profileRows } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", senderIds)
      : { data: [] };
    const profileById = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p as Profile]));

    setGroupThread((data ?? []).map((m) => ({ ...m, sender: profileById[m.from_id] ?? null })));

    await supabase
      .from("message_group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", group.id)
      .eq("user_id", user.id);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("type", ["group_message", "mention"]);
    void loadGroups();
  }, [user, view, loadGroups]);

  React.useEffect(() => {
    if (view?.type === "dm") void loadDmThread();
    else if (view?.type === "group") void loadGroupThread();
  }, [view?.type, view?.type === "dm" ? view.contact.id : view?.type === "group" ? view.group.id : null]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmThread, groupThread]);

  // ── Realtime ──
  useRealtime({
    table: "direct_messages",
    filter: user ? `to_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => { void loadDmThread(); void loadDmUnread(); },
  });
  useRealtime({
    table: "group_messages",
    enabled: !!user,
    onChange: () => { void loadGroupThread(); void loadGroups(); },
  });
  useRealtime({
    table: "message_group_members",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => void loadGroups(),
  });
  useRealtime({
    table: "message_groups",
    enabled: !!user,
    onChange: () => void loadGroups(),
  });

  // ── Send ──
  async function send() {
    if (!draft.trim() || !user) return;
    setSending(true);
    const body = draft.trim();
    if (view?.type === "dm") {
      const { error } = await supabase.from("direct_messages").insert({
        from_id: user.id,
        to_id: view.contact.id,
        body,
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      void loadDmThread();
    } else if (view?.type === "group") {
      const { error } = await supabase.from("group_messages").insert({
        group_id: view.group.id,
        from_id: user.id,
        body,
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      // Process mentions → notifications
      await processMentions(body, view.group);
      void loadGroupThread();
    }
    setDraft("");
    setMentionState({ open: false, query: "", start: 0 });
    setSending(false);
  }

  async function processMentions(body: string, group: Group) {
    if (!user) return;
    const mentioned = new Set<string>();
    const all = /(^|\s)@all(\b|$)/i.test(body);
    if (all) {
      group.members.forEach((m) => { if (m.id !== user.id) mentioned.add(m.id); });
    } else {
      const matches = body.match(/@[\w.-]+/g) ?? [];
      for (const tok of matches) {
        const handle = tok.slice(1).toLowerCase();
        const m = group.members.find((p) => {
          const n = (p.full_name ?? "").toLowerCase().replace(/\s+/g, "");
          const e = (p.email ?? "").toLowerCase().split("@")[0];
          return n === handle.replace(/\s+/g, "") || e === handle;
        });
        if (m && m.id !== user.id) mentioned.add(m.id);
      }
    }
    if (!mentioned.size) return;
    const { data: senderProf } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const senderName = senderProf?.full_name ?? "Someone";
    const rows = [...mentioned].map((uid) => ({
      user_id: uid,
      type: "mention" as const,
      title: `${senderName} mentioned you in ${group.name}`,
      message: body,
    }));
    await supabase.from("notifications").insert(rows);
  }

  // ── Mention autocomplete ──
  const mentionCandidates = React.useMemo(() => {
    if (view?.type !== "group" || !mentionState.open) return [];
    const q = mentionState.query.toLowerCase();
    const opts: { id: string; label: string; sub?: string }[] = [
      { id: "all", label: "all", sub: "Notify the entire group" },
      ...view.group.members
        .filter((m) => m.id !== user?.id)
        .map((m) => ({ id: m.id, label: (m.full_name ?? m.email ?? "").replace(/\s+/g, ""), sub: m.email ?? undefined })),
    ];
    return opts.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 6);
  }, [view, mentionState, user]);

  function onDraftChange(value: string) {
    setDraft(value);
    if (view?.type !== "group") return;
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const m = before.match(/(?:^|\s)@([\w.-]*)$/);
    if (m) {
      setMentionState({ open: true, query: m[1], start: cursor - m[1].length - 1 });
    } else {
      setMentionState({ open: false, query: "", start: 0 });
    }
  }

  function pickMention(label: string) {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart ?? draft.length;
    const before = draft.slice(0, mentionState.start);
    const after = draft.slice(cursor);
    const next = `${before}@${label} ${after}`;
    setDraft(next);
    setMentionState({ open: false, query: "", start: 0 });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // ── Create group ──
  async function createGroup() {
    if (!groupName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: grp, error: grpErr } = await supabase
        .from("message_groups")
        .insert({ name: groupName.trim(), created_by: user.id })
        .select("id")
        .single();
      if (grpErr) throw new Error(grpErr.message);
      const memberIds = Array.from(new Set([user.id, ...pickedMembers]));
      const { error: memErr } = await supabase
        .from("message_group_members")
        .insert(memberIds.map((uid) => ({ group_id: grp.id, user_id: uid })));
      if (memErr) throw new Error(memErr.message);
      toast.success(`Group "${groupName.trim()}" created`);
      setCreateOpen(false);
      setGroupName("");
      setPickedMembers([]);
      await loadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  // ── Group settings actions ──
  async function updateGroupAvatar(url: string) {
    if (view?.type !== "group") return;
    const { error } = await supabase.from("message_groups").update({ avatar_url: url }).eq("id", view.group.id);
    if (error) { toast.error(error.message); return; }
    void loadGroups();
  }
  async function renameGroup(name: string) {
    if (view?.type !== "group" || !name.trim()) return;
    const { error } = await supabase.from("message_groups").update({ name: name.trim() }).eq("id", view.group.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Group renamed");
    void loadGroups();
  }
  async function leaveGroup() {
    if (view?.type !== "group" || !user) return;
    if (!confirm(`Leave "${view.group.name}"?`)) return;
    const { error } = await supabase
      .from("message_group_members")
      .delete()
      .eq("group_id", view.group.id)
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    setView(null);
    setDetailsOpen(false);
    void loadGroups();
  }
  async function removeMember(uid: string) {
    if (view?.type !== "group") return;
    const { error } = await supabase
      .from("message_group_members")
      .delete()
      .eq("group_id", view.group.id)
      .eq("user_id", uid);
    if (error) { toast.error(error.message); return; }
    void loadGroups();
  }
  async function addMembers(ids: string[]) {
    if (view?.type !== "group" || !ids.length) return;
    const { error } = await supabase
      .from("message_group_members")
      .insert(ids.map((uid) => ({ group_id: view.group.id, user_id: uid })));
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} member(s) added`);
    setAddOpen(false);
    void loadGroups();
  }

  const toggleMember = (id: string) =>
    setPickedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const threadIsEmpty = view?.type === "dm" ? dmThread.length === 0 : groupThread.length === 0;
  const isCreator = view?.type === "group" && view.group.created_by === user?.id;
  const memberIdsInGroup = view?.type === "group" ? new Set(view.group.members.map((m) => m.id)) : new Set<string>();
  const addableContacts = contacts.filter((c) => !memberIdsInGroup.has(c.id));

  return (
    <>
      <div className="flex h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => { setView({ type: "dm", contact: c }); setDraft(""); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors",
                  view?.type === "dm" && view.contact.id === c.id && "bg-accent",
                )}
              >
                <Avatar url={c.avatar_url} name={c.full_name ?? c.email} />
                <span className="flex-1 min-w-0 text-sm truncate">{c.full_name ?? c.email}</span>
                {(dmUnread[c.id] ?? 0) > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {dmUnread[c.id]}
                  </span>
                )}
              </button>
            ))}
            {contacts.length === 0 && <p className="px-4 py-2 text-xs text-muted-foreground">No team members yet.</p>}

            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Groups</p>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="New group"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => { setView({ type: "group", group: g }); setDraft(""); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors",
                  view?.type === "group" && view.group.id === g.id && "bg-accent",
                )}
              >
                <Avatar url={g.avatar_url} name={g.name} kind="group" />
                <span className="flex-1 min-w-0 text-sm truncate">{g.name}</span>
                {g.unread > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {g.unread}
                  </span>
                )}
              </button>
            ))}
            {groups.length === 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                No groups yet.{" "}
                <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">Create one</button>
              </p>
            )}
          </div>
        </aside>

        {/* Thread panel */}
        <div className="flex flex-1 flex-col min-w-0">
          {view ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
                {view.type === "dm" ? (
                  <Avatar url={view.contact.avatar_url} name={view.contact.full_name ?? view.contact.email} size={32} />
                ) : (
                  <Avatar url={view.group.avatar_url} name={view.group.name} size={32} kind="group" />
                )}
                <button
                  onClick={() => view.type === "group" && setDetailsOpen(true)}
                  className="text-left flex-1 min-w-0 hover:opacity-80"
                  disabled={view.type !== "group"}
                >
                  <p className="font-semibold leading-tight truncate">
                    {view.type === "dm" ? (view.contact.full_name ?? view.contact.email) : view.group.name}
                  </p>
                  {view.type === "group" && (
                    <p className="text-xs text-muted-foreground">
                      {view.group.members.length} member{view.group.members.length !== 1 ? "s" : ""} · View details
                    </p>
                  )}
                </button>
                {view.type === "group" && (
                  <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(true)} title="Group settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {threadIsEmpty && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {view.type === "dm" ? "No messages yet. Say hello!" : "No messages yet. Start the conversation!"}
                  </p>
                )}

                {view.type === "dm" &&
                  dmThread.map((m) => {
                    const mine = m.from_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={cn(
                          "max-w-md rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words",
                          mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm",
                        )}>
                          <p>{m.body}</p>
                          <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}

                {view.type === "group" &&
                  groupThread.map((m, idx) => {
                    const prev = groupThread[idx - 1];
                    const showHeader = !prev || prev.from_id !== m.from_id || (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) > 5 * 60 * 1000;
                    const senderName = m.sender?.full_name ?? m.sender?.email ?? "Unknown";
                    return (
                      <div key={m.id} className={cn("flex gap-3", showHeader ? "mt-3" : "mt-0.5")}>
                        <div className="w-8 shrink-0">
                          {showHeader && <Avatar url={m.sender?.avatar_url} name={senderName} size={32} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          {showHeader && (
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-sm">{senderName}</span>
                              <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {renderBody(m.body, view.group.members)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                <div ref={bottomRef} />
              </div>

              <form
                className="relative flex gap-2 border-t border-border px-5 py-3 shrink-0"
                onSubmit={(e) => { e.preventDefault(); void send(); }}
              >
                {mentionState.open && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-5 mb-1 w-64 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-10">
                    {mentionCandidates.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickMention(opt.label); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="font-medium">@{opt.label}</span>
                        {opt.sub && <span className="text-xs text-muted-foreground truncate">{opt.sub}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder={view.type === "dm" ? "Type a message…" : `Message ${view.group.name} (use @ to mention)`}
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a conversation or{" "}
                <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">create a group</button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setGroupName(""); setPickedMembers([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group name</label>
              <Input className="mt-1" placeholder="e.g. Design team" value={groupName} onChange={(e) => setGroupName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Add members</label>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                {contacts.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={pickedMembers.includes(c.id)}
                      onChange={() => toggleMember(c.id)}
                    />
                    <Avatar url={c.avatar_url} name={c.full_name ?? c.email} size={24} />
                    <span className="text-sm">{c.full_name ?? c.email}</span>
                  </label>
                ))}
                {contacts.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No other members.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createGroup} disabled={creating || !groupName.trim()}>
              {creating ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group details sheet */}
      {view?.type === "group" && (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-96 sm:w-[420px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Group details</SheetTitle>
            </SheetHeader>

            <div className="mt-6 flex flex-col items-center gap-3">
              {isCreator ? (
                <AvatarUploader
                  pathPrefix={`groups/${view.group.id}`}
                  currentUrl={view.group.avatar_url}
                  fallbackName={view.group.name}
                  onUploaded={updateGroupAvatar}
                  size={88}
                  rounded="lg"
                />
              ) : (
                <Avatar url={view.group.avatar_url} name={view.group.name} size={88} kind="group" />
              )}

              {isCreator ? (
                <Input
                  defaultValue={view.group.name}
                  onBlur={(e) => { if (e.target.value.trim() !== view.group.name) void renameGroup(e.target.value); }}
                  className="text-center font-semibold"
                />
              ) : (
                <p className="text-lg font-semibold">{view.group.name}</p>
              )}
              <p className="text-xs text-muted-foreground">{view.group.members.length} members</p>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Members</h3>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <div className="space-y-1">
                {view.group.members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                    <Avatar url={m.avatar_url} name={m.full_name ?? m.email} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name ?? m.email}</p>
                      {m.id === view.group.created_by && <p className="text-[10px] text-muted-foreground">Creator</p>}
                    </div>
                    {isCreator && m.id !== user?.id && (
                      <Button size="icon" variant="ghost" onClick={() => void removeMember(m.id)} title="Remove">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {!isCreator && (
              <div className="mt-6">
                <Button variant="destructive" className="w-full" onClick={leaveGroup}>
                  <LogOut className="mr-2 h-4 w-4" /> Leave group
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Add members dialog */}
      {view?.type === "group" && (
        <AddMembersDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          contacts={addableContacts}
          onConfirm={addMembers}
        />
      )}
    </>
  );
}

function AddMembersDialog({ open, onOpenChange, contacts, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contacts: Profile[];
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = React.useState<string[]>([]);
  React.useEffect(() => { if (!open) setPicked([]); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add members</DialogTitle></DialogHeader>
        <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border border-border p-2">
          {contacts.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                checked={picked.includes(c.id)}
                onChange={() => setPicked((prev) => prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
              />
              <span className="text-sm">{c.full_name ?? c.email}</span>
            </label>
          ))}
          {contacts.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Everyone is already in this group.</p>}
        </div>
        <DialogFooter>
          <Button disabled={!picked.length} onClick={() => void onConfirm(picked)}>
            Add {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
