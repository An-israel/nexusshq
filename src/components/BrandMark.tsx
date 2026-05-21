import { Link } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Render as a link to `/` (default true) */
  asLink?: boolean;
  /** Visual size of the lockup */
  size?: "sm" | "md" | "lg";
  /** Optional className for the wrapper */
  className?: string;
  /** Show the "Nexxos HQ" wordmark next to the glyph (default true) */
  showWordmark?: boolean;
}

const SIZE_MAP = {
  sm: { box: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5", word: "text-sm" },
  md: { box: "h-9 w-9 rounded-lg", icon: "h-4 w-4", word: "text-lg" },
  lg: { box: "h-12 w-12 rounded-xl", icon: "h-5 w-5", word: "text-xl" },
} as const;

/**
 * Consistent Nexxos HQ brand lockup used across all standalone (non-app-shell)
 * pages: login, signup, workspaces, create-workspace, join, accept-invite.
 */
export function BrandMark({
  asLink = true,
  size = "md",
  className,
  showWordmark = true,
}: BrandMarkProps) {
  const s = SIZE_MAP[size];
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("flex items-center justify-center bg-primary/15 text-primary", s.box)}>
        <Zap className={s.icon} />
      </span>
      {showWordmark && (
        <span className={cn("font-bold tracking-tight text-foreground", s.word)}>
          Nex<span className="text-blue-400">x</span>os HQ
        </span>
      )}
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" aria-label="Nexxos HQ home">
      {inner}
    </Link>
  );
}
