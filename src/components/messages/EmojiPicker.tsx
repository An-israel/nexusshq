import React from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EmojiEntry {
  emoji: string;
  name: string;
}

interface EmojiCategory {
  label: string;
  emojis: EmojiEntry[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: "Smileys",
    emojis: [
      { emoji: "😀", name: "grinning face" },
      { emoji: "😂", name: "face with tears of joy" },
      { emoji: "🥹", name: "face holding back tears" },
      { emoji: "😊", name: "smiling face with smiling eyes" },
      { emoji: "😍", name: "smiling face with heart eyes" },
      { emoji: "🤩", name: "star struck" },
      { emoji: "😎", name: "smiling face with sunglasses" },
      { emoji: "😭", name: "loudly crying face" },
      { emoji: "😤", name: "face with steam from nose" },
      { emoji: "🥳", name: "partying face" },
    ],
  },
  {
    label: "Gestures",
    emojis: [
      { emoji: "👍", name: "thumbs up" },
      { emoji: "👎", name: "thumbs down" },
      { emoji: "👏", name: "clapping hands" },
      { emoji: "🙌", name: "raising hands" },
      { emoji: "🤝", name: "handshake" },
      { emoji: "✌️", name: "victory hand" },
      { emoji: "🤞", name: "crossed fingers" },
      { emoji: "💪", name: "flexed biceps" },
      { emoji: "🙏", name: "folded hands" },
      { emoji: "👋", name: "waving hand" },
    ],
  },
  {
    label: "Hearts",
    emojis: [
      { emoji: "❤️", name: "red heart" },
      { emoji: "🧡", name: "orange heart" },
      { emoji: "💛", name: "yellow heart" },
      { emoji: "💚", name: "green heart" },
      { emoji: "💙", name: "blue heart" },
      { emoji: "💜", name: "purple heart" },
      { emoji: "🖤", name: "black heart" },
      { emoji: "🤍", name: "white heart" },
      { emoji: "🤎", name: "brown heart" },
      { emoji: "💕", name: "two hearts" },
      { emoji: "💯", name: "hundred points" },
    ],
  },
  {
    label: "Objects",
    emojis: [
      { emoji: "🎉", name: "party popper" },
      { emoji: "🎊", name: "confetti ball" },
      { emoji: "🎯", name: "bullseye" },
      { emoji: "🚀", name: "rocket" },
      { emoji: "⚡", name: "high voltage" },
      { emoji: "🔥", name: "fire" },
      { emoji: "💡", name: "light bulb" },
      { emoji: "🎵", name: "musical note" },
      { emoji: "🎤", name: "microphone" },
      { emoji: "📌", name: "pushpin" },
      { emoji: "✅", name: "check mark button" },
      { emoji: "❌", name: "cross mark" },
      { emoji: "⚠️", name: "warning" },
      { emoji: "💬", name: "speech balloon" },
      { emoji: "🔔", name: "bell" },
    ],
  },
  {
    label: "Food",
    emojis: [
      { emoji: "🍕", name: "pizza" },
      { emoji: "🍔", name: "hamburger" },
      { emoji: "🍟", name: "french fries" },
      { emoji: "🌮", name: "taco" },
      { emoji: "🍜", name: "steaming bowl" },
      { emoji: "🍣", name: "sushi" },
      { emoji: "🍰", name: "shortcake" },
      { emoji: "🎂", name: "birthday cake" },
      { emoji: "🍦", name: "soft ice cream" },
      { emoji: "🍩", name: "doughnut" },
    ],
  },
];

const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

interface Props {
  onSelect: (emoji: string) => void;
  trigger: React.ReactNode;
}

export function EmojiPicker({ onSelect, trigger }: Props) {
  const [search, setSearch] = React.useState("");
  const [hoveredEmoji, setHoveredEmoji] = React.useState<EmojiEntry | null>(null);
  const [open, setOpen] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return ALL_EMOJIS.filter((e) => e.name.includes(q));
  }, [search]);

  function handleSelect(emoji: string) {
    onSelect(emoji);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="p-0 w-72 border border-[#2A2A2A] bg-[#1A1A1A] shadow-2xl"
        sideOffset={6}
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2A2A2A]">
            <Search className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            <input
              type="text"
              placeholder="Search emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-[#6B7280] outline-none"
              autoFocus
            />
          </div>

          {hoveredEmoji && (
            <div className="px-3 py-1 border-b border-[#2A2A2A] text-[10px] text-[#9CA3AF]">
              {hoveredEmoji.emoji} {hoveredEmoji.name}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto scrollbar-thin">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="text-center text-xs text-[#6B7280] py-4">No results</p>
              ) : (
                <div className="p-2">
                  <p className="text-[10px] text-[#6B7280] uppercase tracking-wide mb-1.5">
                    Results
                  </p>
                  <EmojiGrid emojis={filtered} onSelect={handleSelect} onHover={setHoveredEmoji} />
                </div>
              )
            ) : (
              EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className="p-2">
                  <p className="text-[10px] text-[#6B7280] uppercase tracking-wide mb-1.5">
                    {cat.label}
                  </p>
                  <EmojiGrid
                    emojis={cat.emojis}
                    onSelect={handleSelect}
                    onHover={setHoveredEmoji}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmojiGrid({
  emojis,
  onSelect,
  onHover,
}: {
  emojis: EmojiEntry[];
  onSelect: (emoji: string) => void;
  onHover: (e: EmojiEntry | null) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((entry) => (
        <button
          key={entry.emoji}
          type="button"
          onClick={() => onSelect(entry.emoji)}
          onMouseEnter={() => onHover(entry)}
          onMouseLeave={() => onHover(null)}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded text-lg",
            "hover:bg-[#2A2A2A] transition-colors",
          )}
        >
          {entry.emoji}
        </button>
      ))}
    </div>
  );
}
