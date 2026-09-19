"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const START_EVENT = "laterhook:navigation-start";
/** Don't flash the bar for navigations that finish faster than this. */
const SHOW_DELAY_MS = 120;
/** Give up if a navigation never lands (aborted, errored, same-URL). */
const SAFETY_MS = 15_000;

/**
 * Starts the top progress bar for a programmatic navigation
 * (`router.push`/`replace`). Link clicks are picked up automatically.
 */
export function startNavigationProgress(href: string) {
  if (!isNewLocation(href)) return;
  window.dispatchEvent(new Event(START_EVENT));
}

function isNewLocation(href: string) {
  const url = new URL(href, location.href);
  return url.origin === location.origin && (url.pathname !== location.pathname || url.search !== location.search);
}

/**
 * YouTube-style bar pinned to the top of the viewport. It starts on any
 * same-origin link click (capture phase, before `<Link>` takes over) and
 * completes when the committed pathname/search params change.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const active = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval>>(undefined);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    clearInterval(trickle.current);
  };

  const finish = () => {
    if (!active.current) return;
    active.current = false;
    clear();
    setProgress(1);
    timers.current.push(
      setTimeout(() => setVisible(false), 200),
      setTimeout(() => setProgress(0), 450),
    );
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    const start = () => {
      clear();
      active.current = true;
      setVisible(false);
      setProgress(0.08);
      timers.current.push(
        setTimeout(() => setVisible(true), SHOW_DELAY_MS),
        setTimeout(() => finishRef.current(), SAFETY_MS),
      );
      // Ease towards 90% so a slow server still shows movement.
      trickle.current = setInterval(() => setProgress((p) => p + (0.9 - p) * 0.1), 250);
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (isNewLocation(a.href)) start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, start);
      clear();
    };
  }, []);

  useEffect(() => {
    finishRef.current();
  }, [pathname, search]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5">
      <div
        className="h-full origin-left bg-primary shadow-[0_0_10px_var(--primary)]"
        style={{
          transform: `scaleX(${progress})`,
          opacity: visible ? 1 : 0,
          transition: progress === 0 ? "none" : "transform 250ms ease-out, opacity 250ms ease-out",
        }}
      />
    </div>
  );
}
