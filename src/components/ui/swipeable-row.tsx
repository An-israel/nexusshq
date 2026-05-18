import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Trash2 } from "lucide-react";

interface SwipeableRowProps {
  children: React.ReactNode;
  onComplete?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function SwipeableRow({ children, onComplete, onDelete, className }: SwipeableRowProps) {
  const [translateX, setTranslateX] = React.useState(0);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const dragging = React.useRef(false);
  const lockAxis = React.useRef<"x" | "y" | null>(null);
  const rowRef = React.useRef<HTMLDivElement>(null);

  const MAX_SWIPE = onComplete && onDelete ? -144 : -72;
  const SNAP_THRESHOLD = -60;

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0]?.clientX ?? 0;
    startY.current = e.touches[0]?.clientY ?? 0;
    dragging.current = true;
    lockAxis.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dx = (e.touches[0]?.clientX ?? 0) - startX.current;
    const dy = (e.touches[0]?.clientY ?? 0) - startY.current;

    // Lock axis on first significant move
    if (!lockAxis.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }
    if (lockAxis.current !== "x") return;

    // Apply resistance at limits
    const raw = dx + translateX;
    const bounded = raw < MAX_SWIPE ? MAX_SWIPE + (raw - MAX_SWIPE) * 0.2 : Math.min(0, raw);
    if (rowRef.current) {
      rowRef.current.style.transform = `translateX(${bounded}px)`;
      rowRef.current.style.transition = "none";
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!dragging.current || lockAxis.current !== "x") {
      dragging.current = false;
      return;
    }
    dragging.current = false;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - startX.current;

    if (rowRef.current) {
      rowRef.current.style.transition = "transform 200ms ease";
      // Snap open or closed
      if (dx < SNAP_THRESHOLD) {
        const snapTo = onComplete && onDelete ? -144 : -72;
        rowRef.current.style.transform = `translateX(${snapTo}px)`;
        setTranslateX(snapTo);
      } else {
        rowRef.current.style.transform = "translateX(0)";
        setTranslateX(0);
      }
    }
  }

  function close() {
    if (rowRef.current) {
      rowRef.current.style.transition = "transform 200ms ease";
      rowRef.current.style.transform = "translateX(0)";
    }
    setTranslateX(0);
  }

  function handleComplete() {
    close();
    setTimeout(() => onComplete?.(), 150);
  }

  function handleDelete() {
    close();
    setTimeout(() => onDelete?.(), 150);
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Action buttons behind the row */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        {onComplete && (
          <button
            type="button"
            onClick={handleComplete}
            className="flex w-[72px] items-center justify-center bg-success active:brightness-90 transition-all"
          >
            <Check className="h-5 w-5 text-white" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-[72px] items-center justify-center bg-destructive active:brightness-90 transition-all"
          >
            <Trash2 className="h-5 w-5 text-white" />
          </button>
        )}
      </div>

      {/* Row content */}
      <div
        ref={rowRef}
        style={{
          transform: "translateX(0)",
          transition: "transform 200ms ease",
          willChange: "transform",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (translateX < -20) {
            close();
          }
        }}
        className="relative bg-card"
      >
        {children}
      </div>
    </div>
  );
}
