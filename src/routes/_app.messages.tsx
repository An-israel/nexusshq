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
import { useRealtime } from "@/lib/use-realtime";
import { toast } from "sonner";
import { Send, Plus, Users } from "lucide-react";
import { initialsOf, timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
});

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
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
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // ── Load contacts ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .neq("id", user.id)
      .order("full_name")
      .then(({ data }) => setContacts((data ?? []) as Profile[]));
  }, [user]);

  // ── Load groups ──────────────────────────────────────────────────────────
  const loadGroups = React.useCallback(async () => {
    if (!user) return;

    // Groups the user belongs to
    const { data: myMemberships } = await supabase
      .from("message_group_members")
      .select("group_id, last_read_at")
      .eq("user_id", user.id);

    if (!myMemberships?.length) { setGroups([]); return; }

    const groupIds = myMemberships.map((m) => m.group_id);
    const lastReadByGroup = Object.fromEntries(
      myMemberships.map((m) => [m.group_id, m.last_read_at]),
    );

    // Group metadata
    const { data: groupRows } = await supabase
      .from("message_groups")
      .select("id, name, created_by, created_at")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    // All members for these groups
    const { data: memberRows } = await supabase
      .from("message_group_members")
      .select("group_id, user_id, profiles(id, full_name, email)")
      .in("group_id", groupIds);

    // Unread counts: messages after last_read_at not sent by me
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

    setGroups(
      (groupRows ?? []).map((g) => ({
        ...g,
        members: membersByGroup[g.id] ?? [],
        unread: unreadByGroup[g.id] ?? 0,
      })),
    );
  }, [user]);

  React.useEffect(() => { void loadGroups(); }, [loadGroups]);

  // ── DM unread counts ─────────────────────────────────────────────────────
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

  // ── Load DM thread ───────────────────────────────────────────────────────
  const loadDmThread = React.useCallback(async () => {
    if (!user || view?.type !== "dm") return;
    const contact = view.contact;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(from_id.eq.${user.id},to_id.eq.${contact.id}),and(from_id.eq.${contact.id},to_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true });
    setDmThread((data ?? []) as Msg[]);
    // Mark read + dismiss in-app notifications
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

  // ── Load group thread ────────────────────────────────────────────────────
  const loadGroupThread = React.useCallback(async () => {
    if (!user || view?.type !== "group") return;
    const group = view.group;
    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, from_id, body, created_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true });

    // Attach sender profiles
    const senderIds = [...new Set((data ?? []).map((m) => m.from_id))];
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", senderIds);
    const profileById = Object.fromEntries(
      (profileRows ?? []).map((p) => [p.id, p as Profile]),
    );

    setGroupThread(
      (data ?? []).map((m) => ({ ...m, sender: profileById[m.from_id] ?? null })),
    );

    // Update last_read_at
    await supabase
      .from("message_group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", group.id)
      .eq("user_id", user.id);
    // Dismiss in-app notifications for this group
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "group_message");
    void loadGroups();
  }, [user, view, loadGroups]);

  React.useEffect(() => {
    if (view?.type === "dm") void loadDmThread();
    else if (view?.type === "group") void loadGroupThread();
  }, [view, loadDmThread, loadGroupThread]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmThread, groupThread]);

  // ── Realtime ─────────────────────────────────────────────────────────────
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

  // ── Send message ─────────────────────────────────────────────────────────
  async function send() {
    if (!draft.trim() || !user) return;
    setSending(true);
    if (view?.type === "dm") {
      const { error } = await supabase.from("direct_messages").insert({
        from_id: user.id,
        to_id: view.contact.id,
        body: draft.trim(),
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      void loadDmThread();
    } else if (view?.type === "group") {
      const { error } = await supabase.from("group_messages").insert({
        group_id: view.group.id,
        from_id: user.id,
        body: draft.trim(),
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      void loadGroupThread();
    }
    setDraft("");
    setSending(false);
  }

  // ── Create group ─────────────────────────────────────────────────────────
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

  const toggleMember = (id: string) =>
    setPickedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // ── Helpers ───────────────────────────────────────────────────────────────
  const threadIsEmpty =
    view?.type === "dm" ? dmThread.length === 0 : groupThread.length === 0;

  const headerTitle =
    view?.type === "dm"
      ? (view.contact.full_name ?? view.contact.email)
      : view?.type === "group"
        ? view.group.name
        : null;

  const headerSub =
    view?.type === "group"
      ? `${view.group.members.length} member${view.group.members.length !== 1 ? "s" : ""}`
      : null;

  return (
    <>
      <div className="flex h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Direct Messages */}
            <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </p>
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => { setView({ type: "dm", contact: c }); setDraft(""); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors",
                  view?.type === "dm" && view.contact.id === c.id && "bg-accent",
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  {initialsOf(c.full_name ?? c.email)}
                </div>
                <span className="flex-1 min-w-0 text-sm truncate">{c.full_name ?? c.email}</span>
                {(dmUnread[c.id] ?? 0) > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {dmUnread[c.id]}
                  </span>
                )}
              </button>
            ))}
            {contacts.length === 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">No team members yet.</p>
            )}

            {/* Groups */}
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Groups
              </p>
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
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                  <Users className="h-3.5 w-3.5" />
                </div>
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
                <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">
                  Create one
                </button>
              </p>
            )}
          </div>
        </aside>

        {/* ── Thread panel ─────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0">
          {view ? (
            <>
              <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
                {view.type === "dm" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initialsOf(view.contact.full_name ?? view.contact.email)}
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <p className="font-semibold leading-tight">{headerTitle}</p>
                  {headerSub && (
                    <p className="text-xs text-muted-foreground">{headerSub}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {threadIsEmpty && (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    {view.type === "dm"
                      ? "No messages yet. Say hello!"
                      : "No messages yet. Start the conversation!"}
                  </p>
                )}

                {view.type === "dm" &&
                  dmThread.map((m) => {
                    const mine = m.from_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={cn(
                          "max-w-xs rounded-2xl px-4 py-2 text-sm",
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                        )}>
                          <p>{m.body}</p>
                          <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {timeAgo(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                {view.type === "group" &&
                  groupThread.map((m) => {
                    const mine = m.from_id === user?.id;
                    const senderName = m.sender?.full_name ?? m.sender?.email ?? "Unknown";
                    return (
                      <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                        {!mine && (
                          <span className="text-[11px] text-muted-foreground mb-0.5 px-1">{senderName}</span>
                        )}
                        <div className={cn(
                          "max-w-xs rounded-2xl px-4 py-2 text-sm",
                          mine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm",
                        )}>
                          <p>{m.body}</p>
                          <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {timeAgo(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                <div ref={bottomRef} />
              </div>

              <form
                className="flex gap-2 border-t border-border px-5 py-3 shrink-0"
                onSubmit={(e) => { e.preventDefault(); void send(); }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={view.type === "dm" ? "Type a message…" : `Message ${view.group.name}…`}
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
                <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">
                  create a group
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create group dialog ──────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setGroupName(""); setPickedMembers([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group name</label>
              <Input
                className="mt-1"
                placeholder="e.g. Design team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Add members</label>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-2">
                {contacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={pickedMembers.includes(c.id)}
                      onChange={() => toggleMember(c.id)}
                    />
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                      {initialsOf(c.full_name ?? c.email)}
                    </div>
                    <span className="text-sm">{c.full_name ?? c.email}</span>
                  </label>
                ))}
                {contacts.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No other members.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={createGroup}
              disabled={creating || !groupName.trim()}
            >
              {creating ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
