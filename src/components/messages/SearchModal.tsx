import React from "react";
import { Search, X, Hash, MessageSquare, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  body: string;
  created_at: string;
  channel_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  onSelectChannel: (channelId: string) => void;
  onSelectDm: (conversationId: string) => void;
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query) return <span>{text}</span>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <strong key={i} className="text-white font-semibold">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

export function SearchModal({
  open,
  onClose,
  workspaceId,
  onSelectChannel,
  onSelectDm,
}: SearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset state on open/close
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      setLoading(false);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setActiveIndex(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Run search
  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select(
          "id, body, created_at, channel_id, conversation_id, sender_id"
        )
        .eq("workspace_id", workspaceId)
        .eq("is_deleted", false)
        .ilike("body", `%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(30);

      if (cancelled) return;
      if (error) {
        console.error("[SearchModal] search error:", error);
        setResults([]);
        setLoading(false);
        return;
      }

      const senderIds = Array.from(
        new Set((msgs ?? []).map((m) => m.sender_id).filter((id): id is string => !!id))
      );
      let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (senderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", senderIds);
        for (const p of profs ?? []) {
          profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }

      if (cancelled) return;
      setResults(
        (msgs ?? []).map((m) => ({ ...m, profiles: profileMap[m.sender_id] ?? null })) as SearchResult[]
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, workspaceId]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        const result = results[activeIndex];
        if (result) handleSelect(result);
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onClose]);

  // Scroll active item into view
  React.useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleSelect(result: SearchResult) {
    if (result.channel_id) {
      onSelectChannel(result.channel_id);
    } else if (result.conversation_id) {
      onSelectDm(result.conversation_id);
    }
    onClose();
  }

  if (!open) return null;

  const channelResults = results.filter((r) => r.channel_id !== null);
  const dmResults = results.filter((r) => r.conversation_id !== null);

  // Build flat ordered list for keyboard nav (channels first, then dms)
  const orderedResults = [...channelResults, ...dmResults];

  function getGlobalIndex(result: SearchResult): number {
    return orderedResults.findIndex((r) => r.id === result.id);
  }

  function ResultItem({ result }: { result: SearchResult }) {
    const globalIdx = getGlobalIndex(result);
    const isActive = activeIndex === globalIdx;
    const senderName = result.profiles?.full_name ?? "Unknown";
    const avatarUrl = result.profiles?.avatar_url;
    const initials = initialsOf(senderName);
    const senderId = result.sender_id;

    const snippet =
      result.body.length > 200 ? result.body.slice(0, 200) + "…" : result.body;

    let timeStr = "";
    try {
      timeStr = formatDistanceToNow(new Date(result.created_at), {
        addSuffix: true,
      });
    } catch {
      timeStr = "";
    }

    const context = result.channel_id
      ? `#channel`
      : `DM`;

    return (
      <button
        type="button"
        data-index={globalIdx}
        onClick={() => handleSelect(result)}
        onMouseEnter={() => setActiveIndex(globalIdx)}
        className={cn(
          "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
          isActive ? "bg-[#2A2A2A]" : "hover:bg-[#222222]"
        )}
      >
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={senderName}
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
              style={{ backgroundColor: hashColor(senderId) }}
            >
              {initials}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white text-sm font-medium truncate">
              {senderName}
            </span>
            {result.channel_id ? (
              <span className="flex items-center gap-0.5 text-[#6B7280] text-xs shrink-0">
                <Hash className="w-3 h-3" />
                <span>channel</span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[#6B7280] text-xs shrink-0">
                <MessageSquare className="w-3 h-3" />
                <span>DM</span>
              </span>
            )}
            <span className="text-[#6B7280] text-xs ml-auto shrink-0">{timeStr}</span>
          </div>
          <p className="text-[#9CA3AF] text-sm leading-snug line-clamp-2">
            <HighlightedText text={snippet} query={debouncedQuery} />
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-[#0F0F0F]/80 z-50 flex items-start justify-center pt-20 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A] shrink-0">
          <Search className="w-4 h-4 text-[#6B7280] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-[#6B7280]"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-[#6B7280] animate-spin shrink-0" />
          )}
          {!loading && query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[#6B7280] hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[#6B7280] text-xs border border-[#3A3A3A] rounded px-1 py-0.5 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results area */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {/* Initial state */}
          {debouncedQuery.length < 2 && !loading && (
            <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
              <Search className="w-8 h-8 text-[#3A3A3A]" />
              <p className="text-[#6B7280] text-sm">
                Search across all your channels and direct messages
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && debouncedQuery.length >= 2 && (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#6B7280] animate-spin" />
            </div>
          )}

          {/* No results */}
          {!loading && debouncedQuery.length >= 2 && results.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-2 text-center px-6">
              <p className="text-[#6B7280] text-sm">
                No messages found matching &lsquo;{debouncedQuery}&rsquo;
              </p>
            </div>
          )}

          {/* Results grouped */}
          {!loading && results.length > 0 && (
            <div className="p-2">
              {channelResults.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] text-[#6B7280] uppercase tracking-wide font-medium">
                    Channels
                  </p>
                  {channelResults.map((r) => (
                    <ResultItem key={r.id} result={r} />
                  ))}
                </div>
              )}

              {dmResults.length > 0 && (
                <div className={cn(channelResults.length > 0 && "mt-2")}>
                  <p className="px-3 py-1.5 text-[10px] text-[#6B7280] uppercase tracking-wide font-medium">
                    Direct Messages
                  </p>
                  {dmResults.map((r) => (
                    <ResultItem key={r.id} result={r} />
                  ))}
                </div>
              )}

              <p className="text-center text-[#4B5563] text-xs py-3">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
