import { useEffect, useRef, useCallback } from "react";

export function usePullToRefresh(onRefresh: () => void, containerRef?: React.RefObject<HTMLElement>) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const getTarget = useCallback(() => {
    return containerRef?.current ?? document.querySelector("main") ?? document.body;
  }, [containerRef]);

  useEffect(() => {
    const target = getTarget();
    if (!target) return;

    const THRESHOLD = 72;

    function onTouchStart(e: TouchEvent) {
      const el = target as Element;
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0]?.clientY ?? 0;
      pulling.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pulling.current) return;
      const el = target as Element;
      if (el.scrollTop > 0) { pulling.current = false; return; }
      const deltaY = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (deltaY < 0) return;
      const progress = Math.min(deltaY / THRESHOLD, 1);
      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = String(progress);
        indicatorRef.current.style.transform = `translateY(${Math.min(deltaY * 0.4, 32)}px)`;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!pulling.current) return;
      pulling.current = false;
      const deltaY = (e.changedTouches[0]?.clientY ?? 0) - startY.current;
      if (indicatorRef.current) {
        indicatorRef.current.style.opacity = "0";
        indicatorRef.current.style.transform = "translateY(0)";
      }
      if (deltaY >= THRESHOLD) {
        if (navigator.vibrate) navigator.vibrate(30);
        onRefresh();
      }
    }

    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: true });
    target.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
    };
  }, [getTarget, onRefresh]);

  return indicatorRef;
}
