import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/lib/use-realtime";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { initialsOf, timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/messages")({
  component: MessagesPage,
});

interface Msg {
  id: string;
  from_id: string;
  to_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = React.useState<Profile[]>([]);
  const [selected, setSelected] = React.useState<Profile | null>(null);
  const [thread, setThread] = React.useState<Msg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [unreadCounts, setUnreadCounts] = React.useState<Record<string, number>>({});
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Load all contacts (other active employees)
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

  // Load unread counts from all contacts
  const loadUnread = React.useCallback(async () => {
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
    setUnreadCounts(counts);
  }, [user]);

  React.useEffect(() => { void loadUnread(); }, [loadUnread]);

  // Load thread for selected contact
  const loadThread = React.useCallback(async () => {
    if (!user || !selected) return;
    const { data, error } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(from_id.eq.${user.id},to_id.eq.${selected.id}),and(from_id.eq.${selected.id},to_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true });
    if (error) return;
    setThread((data ?? []) as Msg[]);
    // Mark incoming as read
    await supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("from_id", selected.id)
      .eq("to_id", user.id)
      .eq("is_read", false);
    void loadUnread();
  }, [user, selected, loadUnread]);

  React.useEffect(() => { void loadThread(); }, [loadThread]);

  // Scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  useRealtime({
    table: "direct_messages",
    filter: user ? `to_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => {
      void loadThread();
      void loadUnread();
    },
  });

  async function send() {
    if (!draft.trim() || !selected || !user) return;
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      from_id: user.id,
      to_id: selected.id,
      body: draft.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    void loadThread();
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
      {/* Contact list */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map((c) => {
            const unread = unreadCounts[c.id] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                  selected?.id === c.id && "bg-accent",
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initialsOf(c.full_name ?? c.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.full_name ?? c.email}</p>
                </div>
                {unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
          {contacts.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">No other team members yet.</p>
          )}
        </div>
      </aside>

      {/* Thread */}
      <div className="flex flex-1 flex-col min-w-0">
        {selected ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-5 py-3 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initialsOf(selected.full_name ?? selected.email)}
              </div>
              <p className="font-semibold">{selected.full_name ?? selected.email}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {thread.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No messages yet. Say hello!
                </p>
              )}
              {thread.map((m) => {
                const mine = m.from_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={cn(
                        "max-w-xs rounded-2xl px-4 py-2 text-sm",
                        mine
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm",
                      )}
                    >
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
                placeholder="Type a message…"
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
            <p className="text-sm text-muted-foreground">Select a team member to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
