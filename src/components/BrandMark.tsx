import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import glyphLight from "@/assets/brand/nexxos-glyph-light.svg.asset.json";
import glyphDark from "@/assets/brand/nexxos-glyph-dark.svg.asset.json";
import lockupLight from "@/assets/brand/nexxos-lockup-light.svg.asset.json";
import lockupDark from "@/assets/brand/nexxos-lockup-dark.svg.asset.json";

interface BrandMarkProps {
  /** Render as a link to `/` (default true) */
  asLink?: boolean;
  /** Visual size of the lockup */
  size?: "sm" | "md" | "lg";
  /** Optional className for the wrapper */
  className?: string;
  /** Show the "Nexxos HQ" wordmark next to the glyph (default true) */
  showWordmark?: boolean;
  /** Force a theme variant. Defaults to auto (light on dark bg, dark on light bg). */
  variant?: "light" | "dark" | "auto";
}

const SIZE_MAP = {
  sm: { glyph: "h-6 w-6", lockup: "h-5" },
  md: { glyph: "h-8 w-8", lockup: "h-7" },
  lg: { glyph: "h-11 w-11", lockup: "h-9" },
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
  variant = "auto",
}: BrandMarkProps) {
  const s = SIZE_MAP[size];

  // "auto" — render both and let CSS pick based on the dark class.
  const renderImg = (lightSrc: string, darkSrc: string, sizeClass: string, alt: string) => {
    if (variant === "light") {
      return <img src={lightSrc} alt={alt} className={cn(sizeClass, "w-auto")} />;
    }
    if (variant === "dark") {
      return <img src={darkSrc} alt={alt} className={cn(sizeClass, "w-auto")} />;
    }
    return (
      <>
        <img src={lightSrc} alt={alt} className={cn(sizeClass, "w-auto hidden dark:block")} />
        <img src={darkSrc} alt={alt} className={cn(sizeClass, "w-auto block dark:hidden")} />
      </>
    );
  };

  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {showWordmark
        ? renderImg(lockupLight.url, lockupDark.url, s.lockup, "Nexxos HQ")
        : renderImg(glyphLight.url, glyphDark.url, s.glyph, "Nexxos HQ")}
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" aria-label="Nexxos HQ home">
      {inner}
    </Link>
  );
}
